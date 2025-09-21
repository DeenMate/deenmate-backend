import { Module } from '@nestjs/common';
import { ApiMonitoringController } from './api-monitoring.controller';
import { ApiMonitoringService } from './api-monitoring.service';
import { RateLimitingService } from './rate-limiting.service';
import { IpBlockingService } from './ip-blocking.service';
import { DatabaseModule } from '../../../database/database.module';
import { RedisModule } from '../../../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [ApiMonitoringController],
  providers: [ApiMonitoringService, RateLimitingService, IpBlockingService],
  exports: [ApiMonitoringService, RateLimitingService, IpBlockingService],
})
export class ApiMonitoringModule {}
