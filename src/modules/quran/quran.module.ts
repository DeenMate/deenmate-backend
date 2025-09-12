import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { QuranController } from "./quran.controller";
import { QuranService } from "./quran.service";
import { QuranSyncService } from "./quran.sync.service";
import { QuranMapper } from "./quran.mapper";
import { DatabaseModule } from "../../database/database.module";
import { RedisModule } from "../../redis/redis.module";
import { CommonModule } from "../../common/common.module";

@Module({
  imports: [DatabaseModule, RedisModule, CommonModule, ScheduleModule],
  controllers: [QuranController],
  providers: [QuranService, QuranSyncService, QuranMapper],
  exports: [QuranService, QuranSyncService, QuranMapper],
})
export class QuranModule {}
