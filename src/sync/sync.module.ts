import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { CommonModule } from "../common/common.module";
import { DatabaseModule } from "../database/database.module";
import { AdminAuthModule } from "../modules/admin/auth/admin-auth.module";
import { QuranModule } from "../modules/quran/quran.module";
import { PrayerModule } from "../modules/prayer/prayer.module";
import { AudioModule } from "../modules/audio/audio.module";
import { SyncCronService } from "./sync.cron.service";
import { SyncController } from "./sync.controller";

@Module({
  imports: [
    ConfigModule,
    ScheduleModule,
    CommonModule,
    DatabaseModule,
    AdminAuthModule,
    QuranModule,
    PrayerModule,
    AudioModule,
  ],
  providers: [SyncCronService],
  controllers: [SyncController],
  exports: [SyncCronService],
})
export class SyncModule {}
