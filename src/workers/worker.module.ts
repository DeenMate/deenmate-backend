import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { SyncJobsProcessor } from './sync-jobs.processor';
import { PrayerSyncProcessor } from './prayer-sync.processor';
import { QuranSyncProcessor } from './quran-sync.processor';
import { HadithSyncProcessor } from './hadith-sync.processor';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { HadithModule } from '../modules/hadith/hadith.module';
import { QuranModule } from '../modules/quran/quran.module';
import { PrayerModule } from '../modules/prayer/prayer.module';
import { AudioModule } from '../modules/audio/audio.module';
import { FinanceModule } from '../modules/finance/finance.module';
import { JobControlService } from '../modules/admin/job-control/job-control.service';
import { JobControlGateway } from '../modules/admin/job-control/job-control.gateway';

@Module({
  imports: [
    RedisModule,
    DatabaseModule,
    HadithModule,
    QuranModule,
    PrayerModule,
    AudioModule,
    FinanceModule,
  ],
  providers: [
    WorkerService, 
    SyncJobsProcessor, // RE-ENABLED: Handles audio, finance, and other sync types
    PrayerSyncProcessor, 
    QuranSyncProcessor, 
    HadithSyncProcessor, 
    JobControlService, 
    JobControlGateway
  ],
  exports: [WorkerService],
})
export class WorkerModule {}