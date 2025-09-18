import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { Queue } from "bullmq";
import { RedisService } from "../redis/redis.service";

export interface SyncJob {
  type: "quran" | "prayer" | "hadith" | "zakat" | "audio";
  action: "sync" | "update" | "cleanup" | "prewarm";
  data?: any;
  priority?: number;
}

export interface CacheWarmJob {
  type: "quran" | "prayer" | "hadith" | "zakat" | "audio";
  keys: string[];
  priority?: number;
}

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private syncQueue: Queue;
  private cacheQueue: Queue;

  constructor(private redis: RedisService) {
    this.initializeQueues();
  }

  private async initializeQueues() {
    try {
      // Initialize sync queue
      this.syncQueue = new Queue("sync-queue", {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      });

      // Initialize cache warm queue
      this.cacheQueue = new Queue("cache-queue", {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      });

      this.logger.log("Worker queues initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize worker queues:", error);
    }
  }

  async addSyncJob(job: SyncJob): Promise<Job> {
    try {
      const addedJob = await this.syncQueue.add(job.type, job, {
        priority: job.priority || 5,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      });

      this.logger.log(
        `Sync job added: ${job.type}:${job.action} (ID: ${addedJob.id})`,
      );
      return addedJob;
    } catch (error) {
      this.logger.error(
        `Failed to add sync job: ${job.type}:${job.action}`,
        error,
      );
      throw error;
    }
  }

  async addCacheWarmJob(job: CacheWarmJob): Promise<Job> {
    try {
      const addedJob = await this.cacheQueue.add("warm-cache", job, {
        priority: job.priority || 3,
        attempts: 2,
        delay: 5000, // 5 second delay
      });

      this.logger.log(`Cache warm job added: ${job.type} (ID: ${addedJob.id})`);
      return addedJob;
    } catch (error) {
      this.logger.error(`Failed to add cache warm job: ${job.type}`, error);
      throw error;
    }
  }

  async getQueueStats(): Promise<any> {
    try {
      const [syncStats, cacheStats] = await Promise.all([
        this.syncQueue.getJobCounts(),
        this.cacheQueue.getJobCounts(),
      ]);

      return {
        syncQueue: syncStats,
        cacheQueue: cacheStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to get queue stats:", error);
      return { error: "Failed to get queue stats" };
    }
  }

  async clearQueue(queueName: "sync" | "cache"): Promise<boolean> {
    try {
      const queue = queueName === "sync" ? this.syncQueue : this.cacheQueue;
      await queue.obliterate();

      this.logger.log(`${queueName} queue cleared successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to clear ${queueName} queue:`, error);
      return false;
    }
  }

  async retryFailedJobs(queueName: "sync" | "cache"): Promise<number> {
    try {
      const queue = queueName === "sync" ? this.syncQueue : this.cacheQueue;
      const failedJobs = await queue.getFailed();

      let retryCount = 0;
      for (const job of failedJobs) {
        await job.retry();
        retryCount++;
      }

      this.logger.log(
        `${retryCount} failed jobs retried in ${queueName} queue`,
      );
      return retryCount;
    } catch (error) {
      this.logger.error(
        `Failed to retry failed jobs in ${queueName} queue:`,
        error,
      );
      return 0;
    }
  }

  async scheduleRecurringJobs(): Promise<void> {
    try {
      // Schedule daily Quran sync at 2 AM
      await this.syncQueue.add(
        "quran",
        { type: "quran", action: "sync", priority: 1 },
        {
          repeat: {
            pattern: "0 2 * * *", // Daily at 2 AM
          },
        },
      );

      // Schedule cache warming every 6 hours
      await this.cacheQueue.add(
        "warm-cache",
        {
          type: "all",
          keys: ["quran:chapters", "prayer:methods", "hadith:collections"],
        },
        {
          repeat: {
            pattern: "0 */6 * * *", // Every 6 hours
          },
        },
      );

      this.logger.log("Recurring jobs scheduled successfully");
    } catch (error) {
      this.logger.error("Failed to schedule recurring jobs:", error);
    }
  }
}
