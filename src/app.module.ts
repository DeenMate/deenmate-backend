import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { BullModule } from "@nestjs/bullmq";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AppController } from "./app.controller";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { CommonModule } from "./common/common.module";
import { UtilsModule } from "./utils/utils.module";
import { WorkerModule } from "./workers/worker.module";
import { SyncModule } from "./sync/sync.module";

// Feature Modules
import { QuranModule } from "./modules/quran/quran.module";
import { PrayerModule } from "./modules/prayer/prayer.module";
import { HadithModule } from "./modules/hadith/hadith.module";
import { ZakatModule } from "./modules/zakat/zakat.module";
import { AudioModule } from "./modules/audio/audio.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SchedulerModule } from "./modules/common/scheduler.module";

@Module({
  imports: [
    // Core Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TerminusModule,

    // Serve Static Files (Admin Dashboard)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'admin-dashboard/dist'),
      serveRoot: '/admin',
      exclude: ['/api*', '/docs*'],
    }),

    // BullMQ Configuration
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Infrastructure Modules
    DatabaseModule,
    RedisModule,
    CommonModule,
    UtilsModule,
    WorkerModule,
    SyncModule,

    // Scheduler Module (consolidates all scheduled tasks)
    SchedulerModule,

    // Feature Modules
    QuranModule,
    PrayerModule,
    HadithModule,
    ZakatModule,
    AudioModule,
    FinanceModule,

    // Admin Module (consolidates all admin functionality)
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
