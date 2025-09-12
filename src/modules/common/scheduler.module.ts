import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "../../database/database.module";
import { WorkerModule } from "../../workers/worker.module";
import { QuranModule } from "../quran/quran.module";
import { PrayerModule } from "../prayer/prayer.module";
import { HadithModule } from "../hadith/hadith.module";
import { AudioModule } from "../audio/audio.module";
import { FinanceModule } from "../finance/finance.module";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    WorkerModule,
    QuranModule,
    PrayerModule,
    HadithModule,
    AudioModule,
    FinanceModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
