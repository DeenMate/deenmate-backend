import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../../redis/redis.service';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per window
    message: 'Too many requests, please try again later.',
  };

  constructor(private readonly redisService: RedisService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Apply different rate limits based on the endpoint
    const config = this.getConfigForEndpoint(req.path);
    this.applyRateLimit(req, res, next, config);
  }

  private getConfigForEndpoint(path: string): RateLimitConfig {
    // More restrictive limits for sensitive endpoints
    if (path.includes('/admin/auth/login')) {
      return {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // 5 login attempts per 15 minutes
        message: 'Too many login attempts, please try again later.',
      };
    }

    if (path.includes('/admin/users')) {
      return {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10, // 10 user creations per hour
        message: 'Too many user creation attempts, please try again later.',
      };
    }

    if (path.includes('/admin/sync')) {
      return {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 20, // 20 sync requests per 5 minutes
        message: 'Too many sync requests, please try again later.',
      };
    }

    // Default rate limit for other admin endpoints
    if (path.startsWith('/api/v4/admin/')) {
      return {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 200, // 200 requests per 15 minutes
        message: 'Too many requests, please try again later.',
      };
    }

    // No rate limiting for other endpoints
    return {
      windowMs: 0,
      maxRequests: 0,
    };
  }

  private async applyRateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
    config: RateLimitConfig,
  ) {
    // Skip rate limiting if not configured
    if (config.windowMs === 0 || config.maxRequests === 0) {
      return next();
    }

    try {
      const key = this.generateKey(req, config);
      const current = await this.redisService.get(key);

      if (current === null) {
        // First request in the window
        await this.redisService.setex(key, Math.ceil(config.windowMs / 1000), '1');
        this.setRateLimitHeaders(res, 1, config.maxRequests, config.windowMs);
        return next();
      }

      const count = parseInt(current, 10);
      if (count >= config.maxRequests) {
        this.setRateLimitHeaders(res, count, config.maxRequests, config.windowMs);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: config.message,
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment counter
      await this.redisService.incr(key);
      this.setRateLimitHeaders(res, count + 1, config.maxRequests, config.windowMs);
      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis is down, allow the request but log the error
      console.error('Rate limiting error:', error);
      next();
    }
  }

  private generateKey(req: Request, config: RateLimitConfig): string {
    // Use user ID if authenticated, otherwise use IP address
    const user = (req as any).user;
    const identifier = user ? `user:${user.id}` : `ip:${req.ip || req.connection.remoteAddress}`;
    
    // Create a time window key
    const window = Math.floor(Date.now() / config.windowMs);
    
    return `rate_limit:${identifier}:${window}`;
  }

  private setRateLimitHeaders(res: Response, current: number, max: number, windowMs: number) {
    const remaining = Math.max(0, max - current);
    const resetTime = Math.ceil((Date.now() + windowMs) / 1000);

    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toString());
  }
}
