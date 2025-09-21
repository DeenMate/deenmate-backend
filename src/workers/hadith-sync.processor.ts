import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { HadithSyncService } from '../modules/hadith/hadith-sync.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Processor('hadith-sync-queue')
export class HadithSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(HadithSyncProcessor.name);

  constructor(
    private readonly hadithSyncService: HadithSyncService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { type, action, data } = job.data;
    const jobId = job.id?.toString() || `unknown-${Date.now()}`;
    
    this.logger.log(`Processing Hadith sync job: ${type}:${action} (ID: ${jobId})`);

    // Check if sync is enabled
    const isSyncEnabled = this.configService.get<boolean>('SYNC_ENABLED', true);
    if (!isSyncEnabled) {
      this.logger.log('Sync is disabled, skipping Hadith sync job');
      return { success: false, message: 'Sync is disabled' };
    }

    // Check for cancellation before starting
    if (await this.isJobCancelled(jobId)) {
      this.logger.log(`Job ${jobId} was cancelled before processing`);
      throw new Error('Job cancelled by user');
    }

    try {
      // Update job progress
      await job.updateProgress(10);

      // Check prerequisites
      await this.checkPrerequisites();
      await job.updateProgress(20);

      // Check for cancellation after prerequisites
      if (await this.isJobCancelled(jobId)) {
        this.logger.log(`Job ${jobId} was cancelled after prerequisites check`);
        throw new Error('Job cancelled by user');
      }

      // Process Hadith sync based on action
      let result;
      switch (action) {
        case 'sync':
          result = await this.processHadithSync(data, jobId);
          break;
        default:
          throw new Error(`Unknown Hadith sync action: ${action}`);
      }

      await job.updateProgress(100);
      this.logger.log(`Hadith sync job completed successfully: ${type}:${action} (ID: ${job.id})`);
      
      return result;
    } catch (error) {
      // Handle pause vs cancellation differently
      if (error.message === 'Job paused by user') {
        // Update job status to paused
        await this.updateJobStatus(jobId, 'paused');
        this.logger.log(`Hadith sync job paused: ${type}:${action} (ID: ${job.id})`);
        throw error;
      } else {
        // Update job status to failed
        await this.updateJobStatus(jobId, 'failed');
        this.logger.error(`Hadith sync job failed: ${type}:${action} (ID: ${job.id})`, error.stack);
        throw error;
      }
    }
  }

  private async checkPrerequisites(): Promise<void> {
    // Check if we have hadith data in the database
    const collectionCount = await this.prisma.hadithCollection.count();
    if (collectionCount === 0) {
      throw new Error('No hadith collections found. Please ensure hadith data is imported.');
    }

    this.logger.log(`Prerequisites check passed: ${collectionCount} hadith collections found`);
  }

  private async processHadithSync(data: any, jobId: string): Promise<any> {
    this.logger.log('Starting Hadith sync process');
    
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
      // Get collections to sync
      let collections;
      if (data?.collectionName) {
        // Sync specific collection
        collections = await this.prisma.hadithCollection.findMany({
          where: { 
            name: { contains: data.collectionName, mode: 'insensitive' }
          },
        });
        this.logger.log(`Syncing specific collection: ${data.collectionName}`);
      } else {
        // Sync all collections
        collections = await this.prisma.hadithCollection.findMany();
        this.logger.log(`Syncing all collections: ${collections.length} collections`);
      }

      if (collections.length === 0) {
        throw new Error('No collections found to sync');
      }

      const totalCollections = collections.length;
      let processedCollections = 0;

      // Process each collection
      for (const collection of collections) {
        try {
          // Check for cancellation
          if (await this.isJobCancelled(jobId)) {
            this.logger.log('Job cancelled, stopping Hadith sync');
            return { cancelled: true, processed: processedCollections };
          }

          this.logger.log(`Syncing collection: ${collection.name}`);
          
          // Sync collection data
          await this.hadithSyncService.syncCollection(collection.name);
          
          // Since syncCollection returns void, we'll assume success if no error is thrown
          successCount++;
          this.logger.log(`Successfully synced collection ${collection.name}`);

          processedCollections++;
          
          // Update progress
          const progress = Math.floor((processedCollections / totalCollections) * 80) + 20; // 20% to 100%
          await this.updateJobProgress(progress, `Processed ${processedCollections}/${totalCollections} collections`);

        } catch (error) {
          errorCount++;
          this.logger.error(`Error syncing collection ${collection.name}:`, error);
        }
      }

      this.logger.log(`Hadith sync completed: ${successCount} successful, ${errorCount} failed`);
      
      return {
        success: true,
        totalProcessed,
        successCount,
        errorCount,
        processedCollections,
        totalCollections,
      };

    } catch (error) {
      this.logger.error('Error during Hadith sync process:', error);
      throw error;
    }
  }

  private async isJobCancelled(jobId: string): Promise<boolean> {
    try {
      const cancelKey = `sync:cancel:${jobId}`;
      const pauseKey = `sync:pause:${jobId}`;
      
      const isCancelled = await this.redis.get(cancelKey);
      const isPaused = await this.redis.get(pauseKey);
      
      // If paused, throw a different error that can be handled by resume
      if (isPaused === 'true') {
        throw new Error('Job paused by user');
      }
      
      return isCancelled === 'true';
    } catch (error) {
      // If it's a pause error, re-throw it
      if (error.message === 'Job paused by user') {
        throw error;
      }
      this.logger.error('Error checking job cancellation:', error);
      return false;
    }
  }

  private async updateJobProgress(progress: number, message: string): Promise<void> {
    // TODO: Implement job progress update
    this.logger.log(`Progress: ${progress}% - ${message}`);
  }

  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    try {
      await this.prisma.syncJobControl.upsert({
        where: { jobId },
        update: { 
          status,
          updatedAt: new Date(),
        },
        create: {
          jobId,
          jobType: 'hadith',
          jobName: 'Hadith Sync',
          status,
          metadata: {},
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update job status for ${jobId}:`, error);
    }
  }
}
