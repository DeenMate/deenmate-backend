import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { QuranSyncService } from "./quran.sync.service";

export interface QuranSyncJob {
  type: "chapters" | "verses" | "translations" | "reciters";
  chapterId?: number;
  resourceId?: number;
}

@Injectable()
export class QuranSyncWorker {
  private readonly logger = new Logger(QuranSyncWorker.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private quranSync: QuranSyncService,
  ) {}

  async processJob(job: Job<QuranSyncJob>) {
    this.logger.log(`Processing job ${job.id}: ${job.data.type}`);

    try {
      switch (job.data.type) {
        case "chapters":
          await this.syncChapters();
          break;
        case "verses":
          if (job.data.chapterId) {
            await this.syncVerses(job.data.chapterId);
          }
          break;
        case "translations":
          await this.syncTranslations();
          break;
        case "reciters":
          await this.syncReciters();
          break;
        default:
          throw new Error(`Unknown sync type: ${job.data.type}`);
      }

      // Clear cache after sync
      await this.clearCache(job.data.type);

      this.logger.log(`Job ${job.id} completed successfully`);
      return { success: true, type: job.data.type };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async syncChapters() {
    this.logger.log("Syncing chapters...");
    await this.quranSync.syncChapters();
  }

  private async syncVerses(chapterId: number) {
    this.logger.log(`Syncing verses for chapter ${chapterId}...`);
    await this.quranSync.syncVerses();
  }

  private async syncTranslations() {
    this.logger.log("Syncing translations...");
    await this.quranSync.syncTranslationResources();
    await this.quranSync.syncVerseTranslations();
  }

  private async syncReciters() {
    this.logger.log("Syncing reciters...");
    // TODO: Implement reciters sync when method is available
  }

  private async clearCache(type: string) {
    const cacheKey = `quran:${type}`;
    await this.redis.del(cacheKey);
    this.logger.log(`Cleared cache for ${cacheKey}`);
  }
}
