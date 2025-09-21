import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { Queue } from "bullmq";
import { RedisService } from "../redis/redis.service";
import { PrismaService } from "../database/prisma.service";

export interface SyncJob {
  type: "quran" | "prayer" | "hadith" | "zakat" | "audio" | "finance";
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
  private prayerQueue: Queue;
  private quranQueue: Queue;
  private hadithQueue: Queue;

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {
    this.initializeQueues();
  }

  private async initializeQueues() {
    try {
      const redisConfig = {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      };

      // Initialize main sync queue (for audio, finance, and other sync types)
      this.syncQueue = new Queue("sync-queue", redisConfig);

      // Initialize specialized queues for different job types
      this.prayerQueue = new Queue("prayer-sync-queue", redisConfig);
      this.quranQueue = new Queue("quran-sync-queue", redisConfig);
      this.hadithQueue = new Queue("hadith-sync-queue", redisConfig);

      // Initialize cache warm queue
      this.cacheQueue = new Queue("cache-queue", redisConfig);

      this.logger.log("Worker queues initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize worker queues:", error);
    }
  }

  async addSyncJob(job: SyncJob): Promise<Job> {
    try {
      // Select appropriate queue based on job type
      let targetQueue: Queue;
      let jobId: string;

      switch (job.type) {
        case 'prayer':
          targetQueue = this.prayerQueue;
          jobId = `prayer-${job.action}-${Date.now()}`;
          break;
        case 'quran':
          targetQueue = this.quranQueue;
          jobId = `quran-${job.action}-${Date.now()}`;
          break;
        case 'hadith':
          targetQueue = this.hadithQueue;
          jobId = `hadith-${job.action}-${Date.now()}`;
          break;
        default:
          targetQueue = this.syncQueue;
          jobId = `${job.type}-${job.action}-${Date.now()}`;
      }

      // Check for existing jobs to prevent duplicates
      const existingJob = await targetQueue.getJob(jobId);
      if (existingJob) {
        this.logger.log(`Job ${jobId} already exists, returning existing job`);
        return existingJob;
      }

      const addedJob = await targetQueue.add(job.type, job, {
        jobId,
        priority: job.priority || 5,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      });

      // Create database entry for job control
      const jobName = this.getJobDisplayName(job.type, job.action);
      await this.createOrUpdateJobControl(
        jobId,
        job.type,
        jobName,
        "pending",
        { queueName: targetQueue.name, bullmqJobId: addedJob.id }
      );

      this.logger.log(
        `Sync job added: ${job.type}:${job.action} (ID: ${addedJob.id}) to ${targetQueue.name}`,
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
      const [cacheStats, prayerStats, quranStats, hadithStats] = await Promise.all([
        this.cacheQueue.getJobCounts(),
        this.prayerQueue.getJobCounts(),
        this.quranQueue.getJobCounts(),
        this.hadithQueue.getJobCounts(),
      ]);

      return {
        cacheQueue: cacheStats,
        prayerQueue: prayerStats,
        quranQueue: quranStats,
        hadithQueue: hadithStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to get queue stats:", error);
      return { error: "Failed to get queue stats" };
    }
  }

  async clearQueue(queueName: "sync" | "cache" | "prayer" | "quran" | "hadith"): Promise<boolean> {
    try {
      let queue: Queue;
      switch (queueName) {
        case "sync":
          queue = this.syncQueue;
          break;
        case "cache":
          queue = this.cacheQueue;
          break;
        case "prayer":
          queue = this.prayerQueue;
          break;
        case "quran":
          queue = this.quranQueue;
          break;
        case "hadith":
          queue = this.hadithQueue;
          break;
        default:
          throw new Error(`Unknown queue: ${queueName}`);
      }
      
      await queue.obliterate();
      this.logger.log(`${queueName} queue cleared successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to clear ${queueName} queue:`, error);
      return false;
    }
  }

  async retryFailedJobs(queueName: "sync" | "cache" | "prayer" | "quran" | "hadith"): Promise<number> {
    try {
      let queue: Queue;
      switch (queueName) {
        case "sync":
          queue = this.syncQueue;
          break;
        case "cache":
          queue = this.cacheQueue;
          break;
        case "prayer":
          queue = this.prayerQueue;
          break;
        case "quran":
          queue = this.quranQueue;
          break;
        case "hadith":
          queue = this.hadithQueue;
          break;
        default:
          throw new Error(`Unknown queue: ${queueName}`);
      }
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
      await this.quranQueue.add(
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

  // Helper method to get display name for job
  private getJobDisplayName(type: string, action: string): string {
    const typeNames = {
      quran: "Quran",
      prayer: "Prayer Times", 
      hadith: "Hadith",
      audio: "Audio Files",
      finance: "Gold Price",
      zakat: "Zakat"
    };
    
    const actionNames = {
      sync: "Sync",
      update: "Update", 
      cleanup: "Cleanup",
      prewarm: "Prewarm"
    };

    return `${typeNames[type] || type} ${actionNames[action] || action}`;
  }

  // Create or update job control record
  private async createOrUpdateJobControl(jobId: string, jobType: string, jobName: string, status: string, metadata?: any): Promise<void> {
    try {
      await this.prisma.syncJobControl.upsert({
        where: { jobId },
        update: {
          status,
          metadata,
          updatedAt: new Date(),
        },
        create: {
          jobId,
          jobType,
          jobName,
          status,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create/update job control for ${jobId}:`, error);
    }
  }

  // Helper method to find job across all queues
  private async findJobAcrossQueues(jobId: string): Promise<{ job: Job; queue: Queue } | null> {
    const queues = [
      { queue: this.syncQueue, name: 'sync' }, // RE-ENABLED: for audio, finance, and other sync types
      { queue: this.prayerQueue, name: 'prayer' },
      { queue: this.quranQueue, name: 'quran' },
      { queue: this.hadithQueue, name: 'hadith' },
      { queue: this.cacheQueue, name: 'cache' },
    ];

    for (const { queue, name } of queues) {
      if (queue) { // Check if queue exists before trying to access it
        const job = await queue.getJob(jobId);
        if (job) {
          return { job, queue };
        }
      }
    }
    return null;
  }

  // Job control methods
  async pauseJob(jobId: string): Promise<boolean> {
    try {
      const result = await this.findJobAcrossQueues(jobId);
      if (!result) {
        this.logger.warn(`Job ${jobId} not found in any queue`);
        return false;
      }

      const { job, queue } = result;
      
      // Check if job is active
      const jobState = await job.getState();
      if (jobState !== 'active') {
        this.logger.warn(`Job ${jobId} is not active, current state: ${jobState}`);
        return false;
      }

      // Set Redis flag to signal pause to the running job (different from cancel)
      await this.redis.set(`sync:pause:${jobId}`, 'true', 3600); // 1 hour TTL
      
      // Pause the job by moving it to failed state with a specific error
      await job.moveToFailed(new Error('Job paused by user'), '0');
      this.logger.log(`Job ${jobId} paused successfully in ${queue.name} queue`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to pause job ${jobId}:`, error);
      return false;
    }
  }

  async resumeJob(jobId: string): Promise<boolean> {
    try {
      const result = await this.findJobAcrossQueues(jobId);
      if (!result) {
        this.logger.warn(`Job ${jobId} not found in any queue`);
        return false;
      }

      const { job, queue } = result;
      
      // Check if job is in failed state (paused)
      const jobState = await job.getState();
      if (jobState !== 'failed') {
        this.logger.warn(`Job ${jobId} is not in failed state, current state: ${jobState}`);
        return false;
      }

      // Clear Redis pause flag
      await this.redis.del(`sync:pause:${jobId}`);

      // Resume the job by retrying it
      await job.retry();
      this.logger.log(`Job ${jobId} resumed successfully in ${queue.name} queue`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to resume job ${jobId}:`, error);
      return false;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const result = await this.findJobAcrossQueues(jobId);
      if (!result) {
        this.logger.warn(`Job ${jobId} not found in any queue`);
        return false;
      }

      const { job, queue } = result;
      
      // Check if job can be cancelled
      const jobState = await job.getState();
      if (jobState === 'completed') {
        this.logger.warn(`Job ${jobId} is already completed, cannot cancel`);
        return false;
      }

      // Set Redis flag to signal cancellation to the running job
      await this.redis.set(`sync:cancel:${jobId}`, 'true', 3600); // 1 hour TTL

      // Try to remove the job from the queue
      try {
        await job.remove();
        this.logger.log(`Job ${jobId} removed from ${queue.name} queue`);
      } catch (removeError) {
        // Job might be locked by a worker, that's okay - the Redis flag will stop it
        this.logger.warn(`Could not remove job ${jobId} from queue (likely locked by worker): ${removeError.message}`);
        this.logger.log(`Job ${jobId} cancellation flag set - processor will stop gracefully`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const result = await this.findJobAcrossQueues(jobId);
      if (!result) {
        this.logger.warn(`Job ${jobId} not found in any queue`);
        return false;
      }

      const { job, queue } = result;
      await job.remove();
      this.logger.log(`Job ${jobId} deleted successfully from ${queue.name} queue`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete job ${jobId}:`, error);
      return false;
    }
  }

  async updateJobPriority(jobId: string, priority: number): Promise<boolean> {
    try {
      const result = await this.findJobAcrossQueues(jobId);
      if (!result) {
        this.logger.warn(`Job ${jobId} not found in any queue`);
        return false;
      }

      // Note: BullMQ doesn't support updating job priority after creation
      // This would require removing and re-adding the job with new priority
      this.logger.warn(`Job priority update not supported for existing job ${jobId}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to update job ${jobId} priority:`, error);
      return false;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const result = await this.findJobAcrossQueues(jobId);
      if (!result) {
        return null;
      }

      const { job, queue } = result;
      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        state: await job.getState(),
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue,
        opts: job.opts,
        queue: queue.name,
      };
    } catch (error) {
      this.logger.error(`Failed to get job ${jobId} status:`, error);
      return null;
    }
  }

  async getJobProgress(jobId: string): Promise<number> {
    try {
      const result = await this.findJobAcrossQueues(jobId);
      if (!result) {
        return 0;
      }

      const { job } = result;
      const progress = job.progress;
      return typeof progress === 'number' ? progress : 0;
    } catch (error) {
      this.logger.error(`Failed to get job ${jobId} progress:`, error);
      return 0;
    }
  }
}
