import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface HttpRequestOptions {
  retryConfig?: Partial<RetryConfig>;
  timeout?: number;
  headers?: Record<string, string>;
}

// Circuit breaker states per host
type BreakerState = 'closed' | 'open' | 'half-open';
interface HostCircuit {
  state: BreakerState;
  failures: number[]; // epoch ms of failures
  openedAt?: number;
  lastAttemptAt?: number;
  tokens?: number;
  windowStartedAt?: number;
}

@Injectable()
export class CommonHttpService {
  private readonly logger = new Logger(CommonHttpService.name);
  private readonly defaultRetryConfig: RetryConfig;
  private readonly circuits: Map<string, HostCircuit> = new Map();

  private readonly breakerFailureThreshold: number;
  private readonly breakerWindowMs: number;
  private readonly breakerOpenMs: number;
  private readonly rateLimitMax: number;
  private readonly rateLimitWindowMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.defaultRetryConfig = {
      maxRetries: parseInt(this.configService.get('HTTP_MAX_RETRIES') || '3', 10),
      baseDelay: parseInt(this.configService.get('HTTP_RETRY_BACKOFF_MS') || '1000', 10),
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
    };
    this.breakerFailureThreshold = parseInt(this.configService.get('HTTP_BREAKER_FAILURES') || '5', 10);
    this.breakerWindowMs = parseInt(this.configService.get('HTTP_BREAKER_WINDOW_MS') || '60000', 10);
    this.breakerOpenMs = parseInt(this.configService.get('HTTP_BREAKER_OPEN_MS') || '30000', 10);
    this.rateLimitMax = parseInt(this.configService.get('HTTP_RATE_LIMIT_MAX') || '30', 10);
    this.rateLimitWindowMs = parseInt(this.configService.get('HTTP_RATE_LIMIT_WINDOW_MS') || '1000', 10);
  }

  /** Extract host key */
  private getHostKey(url: string): string {
    try { const u = new URL(url); return u.host; } catch { return 'unknown'; }
  }

  private getCircuit(url: string): HostCircuit {
    const key = this.getHostKey(url);
    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = { state: 'closed', failures: [], tokens: this.rateLimitMax, windowStartedAt: Date.now() };
      this.circuits.set(key, circuit);
    }
    return circuit;
  }

  private checkRateLimit(url: string) {
    const c = this.getCircuit(url);
    const now = Date.now();
    if (!c.windowStartedAt || now - c.windowStartedAt >= this.rateLimitWindowMs) {
      c.windowStartedAt = now;
      c.tokens = this.rateLimitMax;
    }
    if ((c.tokens || 0) <= 0) {
      throw new Error(`Rate limit exceeded for host ${this.getHostKey(url)}`);
    }
    c.tokens! -= 1;
  }

  private checkCircuit(url: string) {
    const c = this.getCircuit(url);
    const now = Date.now();
    // Cleanup old failures
    c.failures = c.failures.filter(ts => now - ts <= this.breakerWindowMs);

    if (c.state === 'open') {
      if (c.openedAt && now - c.openedAt >= this.breakerOpenMs) {
        c.state = 'half-open';
        c.lastAttemptAt = now;
      } else {
        throw new Error(`Circuit open for host ${this.getHostKey(url)}`);
      }
    }
  }

  private recordFailure(url: string) {
    const c = this.getCircuit(url);
    const now = Date.now();
    c.failures.push(now);
    c.failures = c.failures.filter(ts => now - ts <= this.breakerWindowMs);
    if (c.failures.length >= this.breakerFailureThreshold) {
      c.state = 'open';
      c.openedAt = now;
      this.logger.warn(`Opening circuit for host ${this.getHostKey(url)} due to repeated failures`);
    }
  }

  private recordSuccess(url: string) {
    const c = this.getCircuit(url);
    c.failures = [];
    c.state = 'closed';
  }

  /** Make a GET request with retry, rate limit and circuit breaker */
  async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    // Rate limit and circuit checks
    this.checkRateLimit(url);
    this.checkCircuit(url);

    const retryConfig = { ...this.defaultRetryConfig, ...options.retryConfig };
    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<T>(url, {
            timeout: options.timeout || this.defaultRetryConfig.baseDelay,
            headers: options.headers,
          })
        );
        this.logger.debug(`GET ${url} successful on attempt ${attempt}`);
        this.recordSuccess(url);
        return response.data as any;
      } catch (error) {
        if (!this.isRetryableError(error) || attempt === retryConfig.maxRetries) {
          this.recordFailure(url);
          this.logger.error(`GET ${url} failed after ${attempt} attempts`, error as any);
          throw this.transformError(error, url);
        }
        const delay = this.calculateBackoff(attempt, retryConfig);
        this.logger.warn(`GET ${url} failed on attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${(error as any).message}`);
        await this.sleep(delay);
      }
    }
    throw new Error(`GET ${url} failed after ${retryConfig.maxRetries} attempts`);
  }

  /** Make a POST request with retry, rate limit and circuit breaker */
  async post<T = any>(url: string, data: any, options: HttpRequestOptions = {}): Promise<T> {
    this.checkRateLimit(url);
    this.checkCircuit(url);

    const retryConfig = { ...this.defaultRetryConfig, ...options.retryConfig };
    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post<T>(url, data, {
            timeout: options.timeout || this.defaultRetryConfig.baseDelay,
            headers: options.headers,
          })
        );
        this.logger.debug(`POST ${url} successful on attempt ${attempt}`);
        this.recordSuccess(url);
        return response.data as any;
      } catch (error) {
        if (!this.isRetryableError(error) || attempt === retryConfig.maxRetries) {
          this.recordFailure(url);
          this.logger.error(`POST ${url} failed after ${attempt} attempts`, error as any);
          throw this.transformError(error, url);
        }
        const delay = this.calculateBackoff(attempt, retryConfig);
        this.logger.warn(`POST ${url} failed on attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${(error as any).message}`);
        await this.sleep(delay);
      }
    }
    throw new Error(`POST ${url} failed after ${retryConfig.maxRetries} attempts`);
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof AxiosError) {
      return (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        (error.response?.status >= 500 && error.response?.status < 600) ||
        error.response?.status === 429
      );
    }
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
  }

  private calculateBackoff(attempt: number, config: RetryConfig): number {
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    );
    if (config.jitter) {
      const jitter = delay * 0.25;
      return delay + (Math.random() * 2 - 1) * jitter;
    }
    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private transformError(error: any, url: string): Error {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      if (status === 429) return new Error(`Rate limit exceeded for ${url}: ${message}`);
      else if (status && status >= 500) return new Error(`Server error (${status}) for ${url}: ${message}`);
      else if (status && status >= 400) return new Error(`Client error (${status}) for ${url}: ${message}`);
      else return new Error(`Request failed for ${url}: ${message}`);
    }
    return new Error(`Request failed for ${url}: ${error.message || String(error)}`);
  }

  getStats(): Record<string, any> {
    return {
      timeout: this.defaultRetryConfig.baseDelay,
      maxRetries: this.defaultRetryConfig.maxRetries,
      backoffMultiplier: this.defaultRetryConfig.backoffMultiplier,
      breakerFailureThreshold: this.breakerFailureThreshold,
      breakerWindowMs: this.breakerWindowMs,
      breakerOpenMs: this.breakerOpenMs,
      rateLimitMax: this.rateLimitMax,
      rateLimitWindowMs: this.rateLimitWindowMs,
    };
  }
}
