import { Module } from '@nestjs/common';
import { PrayerController } from './prayer.controller';
import { PrayerService } from './prayer.service';
import { PrayerSyncService } from './prayer.sync.service';
import { PrayerMapper } from './prayer.mapper';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [CommonModule, DatabaseModule],
  controllers: [PrayerController],
  providers: [PrayerService, PrayerSyncService, PrayerMapper],
  exports: [PrayerService, PrayerSyncService, PrayerMapper],
})
export class PrayerModule {}
