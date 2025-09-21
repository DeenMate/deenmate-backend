import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminAuthModule } from "./auth/admin-auth.module";
import { UserManagementModule } from "./user-management/user-management.module";
import { SecurityModule } from "./security/security.module";
import { ContentManagementModule } from "./content-management/content-management.module";
import { JobControlModule } from "./job-control/job-control.module";
import { ApiMonitoringModule } from "./api-monitoring/api-monitoring.module";
import { DatabaseModule } from "../../database/database.module";
import { RedisModule } from "../../redis/redis.module";
import { WorkerModule } from "../../workers/worker.module";
import { QuranModule } from "../quran/quran.module";
import { PrayerModule } from "../prayer/prayer.module";
import { HadithModule } from "../hadith/hadith.module";
import { ZakatModule } from "../zakat/zakat.module";
import { AudioModule } from "../audio/audio.module";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    WorkerModule,
    AdminAuthModule,
    UserManagementModule,
    SecurityModule,
    ContentManagementModule,
    JobControlModule,
    ApiMonitoringModule,
    QuranModule,
    PrayerModule,
    HadithModule,
    ZakatModule,
    AudioModule,
    FinanceModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService, AdminAuthModule, UserManagementModule, SecurityModule, ContentManagementModule, JobControlModule, ApiMonitoringModule],
})
export class AdminModule {}
