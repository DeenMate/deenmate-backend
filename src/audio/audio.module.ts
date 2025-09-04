import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { UtilsModule } from '../utils/utils.module';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';

@Module({
  imports: [DatabaseModule, RedisModule, UtilsModule],
  controllers: [AudioController],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
