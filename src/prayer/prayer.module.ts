import { Module } from '@nestjs/common';
import { PrayerController } from './prayer.controller';
import { PrayerService } from './prayer.service';
import { PrayerSyncService } from './prayer.sync.service';
import { PrayerMapper } from './prayer.mapper';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [CommonModule, DatabaseModule, RedisModule],
  controllers: [PrayerController],
  providers: [PrayerService, PrayerSyncService, PrayerMapper],
  exports: [PrayerService, PrayerSyncService, PrayerMapper],
})
export class PrayerModule {}
