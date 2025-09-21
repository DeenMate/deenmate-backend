import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { WorkerService } from "../../workers/worker.service";
import { QuranSyncService } from "../quran/quran.sync.service";
import { PrayerSyncService } from "../prayer/prayer.sync.service";
import { HadithSyncService } from "../hadith/hadith-sync.service";
import { AudioSyncService } from "../audio/audio.sync.service";
import { GoldPriceScheduler } from "../finance/goldprice.scheduler";

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workerService: WorkerService,
    private readonly configService: ConfigService,
    private readonly quranSync: QuranSyncService,
    private readonly prayerSync: PrayerSyncService,
    private readonly hadithSync: HadithSyncService,
    private readonly audioSync: AudioSyncService,
    private readonly goldPriceScheduler: GoldPriceScheduler,
  ) {}

  // Daily Quran sync at 3:00 AM
  @Cron("0 3 * * *", {
    name: "quran-daily-sync",
    timeZone: "UTC",
  })
  async scheduledQuranSync(): Promise<void> {
    // Check if sync is enabled
    const isSyncEnabled = this.configService.get("SYNC_ENABLED", "true") === "true";
    if (!isSyncEnabled) {
      this.logger.log("Scheduled Quran sync is disabled");
      return;
    }

    this.logger.log("Starting scheduled Quran sync");

    try {
      await this.logSyncJob("quran-daily", "quran-chapters", "started");
      
      // Queue the quran sync job instead of running synchronously
      const syncJob = {
        type: 'quran' as const,
        action: 'sync' as const,
        priority: 2, // Lower priority for scheduled jobs
      };

      const job = await this.workerService.addSyncJob(syncJob);
      this.logger.log(`Scheduled Quran sync job queued with ID: ${job.id}`);
      
      await this.logSyncJob("quran-daily", "quran-chapters", "started");
      this.logger.log("Scheduled Quran sync queued successfully");
    } catch (error) {
      this.logger.error("Scheduled Quran sync failed", error.stack);
      await this.logSyncJob(
        "quran-daily",
        "quran-chapters",
        "failed",
        error.message,
      );
    }
  }

  // Daily Prayer times pre-warming at 4:00 AM
  @Cron("0 4 * * *", {
    name: "prayer-prewarm",
    timeZone: "UTC",
  })
  async scheduledPrayerPrewarm(): Promise<void> {
    // Check if sync is enabled
    const isSyncEnabled = this.configService.get("SYNC_ENABLED", "true") === "true";
    if (!isSyncEnabled) {
      this.logger.log("Scheduled Prayer pre-warming is disabled");
      return;
    }

    this.logger.log("Starting scheduled Prayer times pre-warming");

    try {
      await this.logSyncJob("prayer-prewarm", "prayer-times", "started");
      
      // Queue the prayer sync job instead of running synchronously
      const syncJob = {
        type: 'prayer' as const,
        action: 'sync' as const,
        priority: 2, // Lower priority for scheduled jobs
      };

      const job = await this.workerService.addSyncJob(syncJob);
      this.logger.log(`Scheduled Prayer sync job queued with ID: ${job.id}`);
      
      await this.logSyncJob("prayer-prewarm", "prayer-times", "started");
      this.logger.log("Scheduled Prayer pre-warming queued successfully");
    } catch (error) {
      this.logger.error("Scheduled Prayer pre-warming failed", error.stack);
      await this.logSyncJob(
        "prayer-prewarm",
        "prayer-times",
        "failed",
        error.message,
      );
    }
  }

  // Daily Hadith sync at 2:00 AM
  @Cron("0 2 * * *", {
    name: "hadith-daily-sync",
    timeZone: "UTC",
  })
  async scheduledHadithSync(): Promise<void> {
    // Check if sync is enabled
    const isSyncEnabled = this.configService.get("SYNC_ENABLED", "true") === "true";
    if (!isSyncEnabled) {
      this.logger.log("Scheduled Hadith sync is disabled");
      return;
    }

    this.logger.log("Starting scheduled Hadith sync");

    try {
      await this.logSyncJob("hadith-sync", "hadith-collections", "started");
      
      // Queue the hadith sync job instead of running synchronously
      const syncJob = {
        type: 'hadith' as const,
        action: 'sync' as const,
        priority: 2, // Lower priority for scheduled jobs
      };

      const job = await this.workerService.addSyncJob(syncJob);
      this.logger.log(`Scheduled Hadith sync job queued with ID: ${job.id}`);
      
      await this.logSyncJob("hadith-sync", "hadith-collections", "started");
      this.logger.log("Scheduled Hadith sync queued successfully");
    } catch (error) {
      this.logger.error("Scheduled Hadith sync failed", error.stack);
      await this.logSyncJob(
        "hadith-sync",
        "hadith-collections",
        "failed",
        error.message,
      );
    }
  }

  // Weekly Audio sync on Sundays at 5:00 AM
  @Cron("0 5 * * 0", {
    name: "audio-weekly-sync",
    timeZone: "UTC",
  })
  async scheduledAudioSync(): Promise<void> {
    this.logger.log("Starting scheduled Audio sync");

    try {
      await this.logSyncJob("audio-sync", "audio-files", "started");
      await this.audioSync.syncReciters();
      await this.audioSync.syncAllAudioFiles();
      await this.logSyncJob("audio-sync", "audio-files", "success");
      this.logger.log("Scheduled Audio sync completed successfully");
    } catch (error) {
      this.logger.error("Scheduled Audio sync failed", error.stack);
      await this.logSyncJob(
        "audio-sync",
        "audio-files",
        "failed",
        error.message,
      );
    }
  }

  // Gold price updates every 2 hours
  @Cron("0 */2 * * *", {
    name: "gold-price-update",
    timeZone: "UTC",
  })
  async scheduledGoldPriceUpdate(): Promise<void> {
    this.logger.log("Starting scheduled Gold price update");

    try {
      await this.logSyncJob("gold-price-update", "gold-prices", "started");
      await this.goldPriceScheduler.handleDailyScrape();
      await this.logSyncJob("gold-price-update", "gold-prices", "success");
      this.logger.log("Scheduled Gold price update completed successfully");
    } catch (error) {
      this.logger.error("Scheduled Gold price update failed", error.stack);
      await this.logSyncJob(
        "gold-price-update",
        "gold-prices",
        "failed",
        error.message,
      );
    }
  }

  // Cache cleanup every 6 hours
  @Cron("0 */6 * * *", {
    name: "cache-cleanup",
    timeZone: "UTC",
  })
  async scheduledCacheCleanup(): Promise<void> {
    this.logger.log("Starting scheduled cache cleanup");

    try {
      // Clean up old sync job logs (keep last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedLogs = await this.prisma.syncJobLog.deleteMany({
        where: {
          startedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(
        `Cache cleanup completed. Deleted ${deletedLogs.count} old sync logs`,
      );
    } catch (error) {
      this.logger.error("Scheduled cache cleanup failed", error.stack);
    }
  }

  // System health check every 15 minutes
  @Cron("*/15 * * * *", {
    name: "health-check",
    timeZone: "UTC",
  })
  async scheduledHealthCheck(): Promise<void> {
    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;

      // Log system metrics
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      this.logger.debug(
        `System health check - Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB, Uptime: ${Math.round(uptime)}s`,
      );
    } catch (error) {
      this.logger.error("Health check failed", error.stack);
    }
  }

  private async logSyncJob(
    jobName: string,
    resource: string,
    status: "started" | "success" | "failed",
    error?: string,
  ): Promise<void> {
    try {
      if (status === "started") {
        await this.prisma.syncJobLog.create({
          data: {
            jobName,
            resource,
            status: "in_progress",
            startedAt: new Date(),
          },
        });
      } else {
        const latestJob = await this.prisma.syncJobLog.findFirst({
          where: {
            jobName,
            resource,
            status: "in_progress",
          },
          orderBy: { startedAt: "desc" },
        });

        if (latestJob) {
          const finishedAt = new Date();
          const durationMs =
            finishedAt.getTime() - latestJob.startedAt.getTime();

          await this.prisma.syncJobLog.update({
            where: { id: latestJob.id },
            data: {
              status: status === "success" ? "success" : "failed",
              finishedAt,
              durationMs,
              error: status === "failed" ? error : null,
            },
          });
        }
      }
    } catch (logError) {
      this.logger.error(
        `Failed to log sync job: ${logError.message}`,
        logError.stack,
      );
    }
  }

  // Manual trigger methods for admin use
  async triggerQuranSync(): Promise<void> {
    await this.scheduledQuranSync();
  }

  async triggerPrayerSync(): Promise<void> {
    await this.scheduledPrayerPrewarm();
  }

  async triggerHadithSync(): Promise<void> {
    await this.scheduledHadithSync();
  }

  async triggerAudioSync(): Promise<void> {
    await this.scheduledAudioSync();
  }

  async triggerGoldPriceUpdate(): Promise<void> {
    await this.scheduledGoldPriceUpdate();
  }

  async triggerCacheCleanup(): Promise<void> {
    await this.scheduledCacheCleanup();
  }
}
