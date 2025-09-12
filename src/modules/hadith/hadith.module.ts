import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "../../database/database.module";
import { RedisModule } from "../../redis/redis.module";
import { HadithController } from "./hadith.controller";
import { AdminHadithController } from "./admin-hadith.controller";
import { HadithService } from "./hadith.service";
import { SunnahApiService } from "./sunnah-api.service";
import { HadithSyncService } from "./hadith-sync.service";
import { HadithImportService } from "./hadith-import.service";
import { TranslationService } from "./translation.service";

@Module({
  imports: [DatabaseModule, RedisModule, HttpModule, ConfigModule, ScheduleModule],
  controllers: [HadithController, AdminHadithController],
  providers: [
    HadithService,
    SunnahApiService,
    HadithSyncService,
    HadithImportService,
    TranslationService,
  ],
  exports: [
    HadithService,
    SunnahApiService,
    HadithSyncService,
    HadithImportService,
    TranslationService,
  ],
})
export class HadithModule {}
