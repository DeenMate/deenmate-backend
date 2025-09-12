import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { RedisModule } from '../../../redis/redis.module';
import { AuditLoggerMiddleware } from './audit-logger.middleware';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { SessionManagerService } from './session-manager.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [AuditLoggerMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware, SessionManagerService],
  exports: [AuditLoggerMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware, SessionManagerService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply security headers to all routes
    consumer
      .apply(SecurityHeadersMiddleware)
      .forRoutes('*');

    // Apply rate limiting to all admin routes
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('/api/v4/admin/*');

    // Apply audit logging to all admin routes
    consumer
      .apply(AuditLoggerMiddleware)
      .forRoutes('/api/v4/admin/*');
  }
}
