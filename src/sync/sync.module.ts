import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { QuranModule } from '../quran/quran.module';
import { PrayerModule } from '../prayer/prayer.module';
import { QuranSyncService } from '../quran/quran.sync.service';
import { PrayerSyncService } from '../prayer/prayer.sync.service';
import { SyncCronService } from './sync.cron.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule,
    CommonModule,
    DatabaseModule,
    QuranModule,
    PrayerModule,
  ],
  providers: [
    QuranSyncService,
    PrayerSyncService,
    SyncCronService,
  ],
  controllers: [SyncController],
  exports: [
    QuranSyncService,
    PrayerSyncService,
    SyncCronService,
  ],
})
export class SyncModule {}
