import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { WorkerService } from './worker.service';

@Module({
  imports: [RedisModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
