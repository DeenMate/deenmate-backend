import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { RedisModule } from "../redis/redis.module";
import { DatabaseModule } from "../database/database.module";
import { HadithModule } from "../modules/hadith/hadith.module";
import { QuranModule } from "../modules/quran/quran.module";
import { PrayerModule } from "../modules/prayer/prayer.module";
import { AudioModule } from "../modules/audio/audio.module";
import { FinanceModule } from "../modules/finance/finance.module";
import { WorkerService } from "./worker.service";
import { SyncJobsProcessor } from "./sync-jobs.processor";

@Module({
  imports: [
    RedisModule,
    DatabaseModule,
    HadithModule,
    QuranModule,
    PrayerModule,
    AudioModule,
    FinanceModule,
    BullModule.registerQueue({
      name: 'sync-queue',
    }),
  ],
  providers: [WorkerService, SyncJobsProcessor],
  exports: [WorkerService],
})
export class WorkerModule {}
