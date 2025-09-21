import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimitingService } from '../../modules/admin/api-monitoring/rate-limiting.service';

@Injectable()
export class RateLimitingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitingMiddleware.name);

  constructor(private readonly rateLimitingService: RateLimitingService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const endpoint = req.path;
      const method = req.method;

      const result = await this.rateLimitingService.checkRateLimit(ip, endpoint, method);

      if (!result.allowed) {
        this.logger.warn(`Rate limit exceeded for IP ${ip} on ${method} ${endpoint}`);
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
        });
        return;
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
      });

      next();
    } catch (error) {
      this.logger.error('Rate limiting middleware error:', error);
      // On error, allow the request to continue
      next();
    }
  }
}
