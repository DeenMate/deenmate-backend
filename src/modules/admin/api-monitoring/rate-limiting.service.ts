import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import {
  RateLimitRule,
  CreateRateLimitRuleDto,
  UpdateRateLimitRuleDto,
  RateLimitResult,
  RateLimitStatus,
} from './interfaces/rate-limiting.interface';

@Injectable()
export class RateLimitingService {
  private readonly logger = new Logger(RateLimitingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getRateLimitRules(): Promise<RateLimitRule[]> {
    try {
      return await this.prisma.rateLimitRule.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error getting rate limit rules:', error);
      return [];
    }
  }

  async createRateLimitRule(rule: CreateRateLimitRuleDto): Promise<RateLimitRule> {
    try {
      return await this.prisma.rateLimitRule.create({
        data: {
          endpoint: rule.endpoint,
          method: rule.method,
          limitCount: rule.limitCount,
          windowSeconds: rule.windowSeconds,
          enabled: rule.enabled ?? true,
        },
      });
    } catch (error) {
      this.logger.error('Error creating rate limit rule:', error);
      throw error;
    }
  }

  async updateRateLimitRule(id: number, rule: UpdateRateLimitRuleDto): Promise<RateLimitRule> {
    try {
      return await this.prisma.rateLimitRule.update({
        where: { id },
        data: {
          method: rule.method,
          limitCount: rule.limitCount,
          windowSeconds: rule.windowSeconds,
          enabled: rule.enabled,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error updating rate limit rule:', error);
      throw error;
    }
  }

  async deleteRateLimitRule(id: number): Promise<void> {
    try {
      await this.prisma.rateLimitRule.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error deleting rate limit rule:', error);
      throw error;
    }
  }

  async checkRateLimit(ip: string, endpoint: string, method: string): Promise<RateLimitResult> {
    try {
      // Find matching rate limit rule
      const rule = await this.findMatchingRule(endpoint, method);
      
      if (!rule || !rule.enabled) {
        return {
          allowed: true,
          limit: 0,
          remaining: 0,
          resetTime: 0,
        };
      }

      const key = this.generateRedisKey(ip, endpoint, method);
      const windowStart = Math.floor(Date.now() / 1000);
      const windowEnd = windowStart + rule.windowSeconds;

      // Get current count from Redis
      const currentCount = await this.redis.get(key);
      const count = currentCount ? parseInt(currentCount) : 0;

      if (count >= rule.limitCount) {
        return {
          allowed: false,
          limit: rule.limitCount,
          remaining: 0,
          resetTime: windowEnd,
          retryAfter: windowEnd - windowStart,
        };
      }

      // Increment counter
      await this.incrementRequestCount(ip, endpoint, rule.windowSeconds);

      return {
        allowed: true,
        limit: rule.limitCount,
        remaining: rule.limitCount - count - 1,
        resetTime: windowEnd,
      };
    } catch (error) {
      this.logger.error('Error checking rate limit:', error);
      // On error, allow the request
      return {
        allowed: true,
        limit: 0,
        remaining: 0,
        resetTime: 0,
      };
    }
  }

  async incrementRequestCount(ip: string, endpoint: string, windowSeconds: number): Promise<void> {
    try {
      const key = this.generateRedisKey(ip, endpoint, 'ALL');
      const currentCount = await this.redis.get(key);
      const count = currentCount ? parseInt(currentCount) : 0;

      await this.redis.setex(key, windowSeconds, (count + 1).toString());
    } catch (error) {
      this.logger.error('Error incrementing request count:', error);
    }
  }

  async getRateLimitStatus(ip: string, endpoint: string): Promise<RateLimitStatus> {
    try {
      const rule = await this.findMatchingRule(endpoint, 'ALL');
      
      if (!rule || !rule.enabled) {
        return {
          limit: 0,
          remaining: 0,
          resetTime: 0,
          windowSeconds: 0,
        };
      }

      const key = this.generateRedisKey(ip, endpoint, 'ALL');
      const currentCount = await this.redis.get(key);
      const count = currentCount ? parseInt(currentCount) : 0;

      const windowStart = Math.floor(Date.now() / 1000);
      const windowEnd = windowStart + rule.windowSeconds;

      return {
        limit: rule.limitCount,
        remaining: Math.max(0, rule.limitCount - count),
        resetTime: windowEnd,
        windowSeconds: rule.windowSeconds,
      };
    } catch (error) {
      this.logger.error('Error getting rate limit status:', error);
      return {
        limit: 0,
        remaining: 0,
        resetTime: 0,
        windowSeconds: 0,
      };
    }
  }

  private async findMatchingRule(endpoint: string, method: string): Promise<RateLimitRule | null> {
    try {
      // First try to find exact match
      let rule = await this.prisma.rateLimitRule.findFirst({
        where: {
          endpoint: endpoint,
          method: method,
          enabled: true,
        },
      });

      if (rule) {
        return rule;
      }

      // Try to find wildcard match for method
      rule = await this.prisma.rateLimitRule.findFirst({
        where: {
          endpoint: endpoint,
          method: 'ALL',
          enabled: true,
        },
      });

      if (rule) {
        return rule;
      }

      // Try to find wildcard match for endpoint
      const rules = await this.prisma.rateLimitRule.findMany({
        where: {
          enabled: true,
        },
      });

      // Find the most specific wildcard match
      for (const r of rules) {
        if (this.matchesWildcard(endpoint, r.endpoint)) {
          if (r.method === 'ALL' || r.method === method) {
            return r;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error finding matching rule:', error);
      return null;
    }
  }

  private matchesWildcard(endpoint: string, pattern: string): boolean {
    if (pattern === endpoint) {
      return true;
    }

    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return endpoint.startsWith(prefix);
    }

    return false;
  }

  private generateRedisKey(ip: string, endpoint: string, method: string): string {
    return `rate_limit:${ip}:${endpoint}:${method}`;
  }
}
