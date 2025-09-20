import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}