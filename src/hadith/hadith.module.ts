import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { HadithController } from './hadith.controller';
import { HadithService } from './hadith.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HadithController],
  providers: [HadithService],
  exports: [HadithService],
})
export class HadithModule {}
