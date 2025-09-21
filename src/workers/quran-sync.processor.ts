import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { QuranSyncService } from '../modules/quran/quran.sync.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Processor('quran-sync-queue')
export class QuranSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(QuranSyncProcessor.name);

  constructor(
    private readonly quranSyncService: QuranSyncService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { type, action, data } = job.data;
    const jobId = job.id?.toString() || `unknown-${Date.now()}`;
    
    this.logger.log(`Processing Quran sync job: ${type}:${action} (ID: ${jobId})`);

    // Check if sync is enabled
    const isSyncEnabled = this.configService.get<boolean>('SYNC_ENABLED', true);
    if (!isSyncEnabled) {
      this.logger.log('Sync is disabled, skipping Quran sync job');
      return { success: false, message: 'Sync is disabled' };
    }

    // Check for cancellation before starting
    if (await this.isJobCancelled(jobId)) {
      this.logger.log(`Job ${jobId} was cancelled before processing`);
      throw new Error('Job cancelled by user');
    }

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running');
      
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

      // Process Quran sync based on action
      let result;
      switch (action) {
        case 'sync':
          result = await this.processQuranSync(data, jobId);
          break;
        default:
          throw new Error(`Unknown Quran sync action: ${action}`);
      }

      await job.updateProgress(100);
      
      // Update job status to completed
      await this.updateJobStatus(jobId, 'completed');
      
      this.logger.log(`Quran sync job completed successfully: ${type}:${action} (ID: ${job.id})`);
      
      return result;
    } catch (error) {
      // Handle pause vs cancellation differently
      if (error.message === 'Job paused by user') {
        // Update job status to paused
        await this.updateJobStatus(jobId, 'paused');
        this.logger.log(`Quran sync job paused: ${type}:${action} (ID: ${job.id})`);
        throw error;
      } else {
        // Update job status to failed
        await this.updateJobStatus(jobId, 'failed');
        this.logger.error(`Quran sync job failed: ${type}:${action} (ID: ${job.id})`, error.stack);
        throw error;
      }
    }
  }

  private async checkPrerequisites(): Promise<void> {
    // Check if we have internet connectivity (basic check)
    // For now, just log that we're checking prerequisites
    this.logger.log('Checking Quran sync prerequisites...');
    
    // TODO: Add more sophisticated prerequisite checks
    // - Check if Quran.com API is accessible
    // - Check if we have valid API keys
    // - Check database connectivity
    
    this.logger.log('Quran sync prerequisites check passed');
  }

  private async processQuranSync(data: any, jobId: string): Promise<any> {
    this.logger.log('Starting Quran sync process');
    
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
      // Step 1: Sync chapters
      this.logger.log('Syncing Quran chapters...');
      await this.updateJobProgress(25, 'Syncing Quran chapters...');
      
      const chaptersResult = await this.quranSyncService.syncChapters({}, () => this.isJobCancelled(jobId));
      if (chaptersResult.success) {
        successCount++;
        totalProcessed += chaptersResult.recordsProcessed || 0;
      } else {
        errorCount++;
        this.logger.warn(`Failed to sync chapters: ${chaptersResult.errors.join(', ')}`);
      }

      // Check for cancellation before verses sync
      if (await this.isJobCancelled(jobId)) {
        this.logger.log('Job was cancelled before verses sync');
        throw new Error('Job cancelled by user');
      }

      // Step 2: Sync verses
      this.logger.log('Syncing Quran verses...');
      await this.updateJobProgress(50, 'Syncing Quran verses...');
      
      const versesResult = await this.quranSyncService.syncVerses({}, () => this.isJobCancelled(jobId));
      if (versesResult.success) {
        successCount++;
        totalProcessed += versesResult.recordsProcessed || 0;
      } else {
        errorCount++;
        this.logger.warn(`Failed to sync verses: ${versesResult.errors.join(', ')}`);
      }

      // Check for cancellation before translation resources sync
      if (await this.isJobCancelled(jobId)) {
        this.logger.log('Job was cancelled before translation resources sync');
        throw new Error('Job cancelled by user');
      }

      // Step 3: Sync translation resources
      this.logger.log('Syncing translation resources...');
      await this.updateJobProgress(75, 'Syncing translation resources...');
      
      const translationsResult = await this.quranSyncService.syncTranslationResources();
      if (translationsResult.success) {
        successCount++;
        totalProcessed += translationsResult.recordsProcessed || 0;
      } else {
        errorCount++;
        this.logger.warn(`Failed to sync translation resources: ${translationsResult.errors.join(', ')}`);
      }

      // Check for cancellation before verse translations sync
      if (await this.isJobCancelled(jobId)) {
        this.logger.log('Job was cancelled before verse translations sync');
        throw new Error('Job cancelled by user');
      }

      // Step 4: Sync verse translations
      this.logger.log('Syncing verse translations...');
      await this.updateJobProgress(90, 'Syncing verse translations...');
      
      const verseTranslationsResult = await this.quranSyncService.syncVerseTranslations({}, () => this.isJobCancelled(jobId));
      if (verseTranslationsResult.success) {
        successCount++;
        totalProcessed += verseTranslationsResult.recordsProcessed || 0;
      } else {
        errorCount++;
        this.logger.warn(`Failed to sync verse translations: ${verseTranslationsResult.errors.join(', ')}`);
      }

      this.logger.log(`Quran sync completed: ${successCount} successful operations, ${errorCount} failed`);
      
      return {
        success: true,
        totalProcessed,
        successCount,
        errorCount,
        operations: [
          { name: 'chapters', success: chaptersResult.success },
          { name: 'verses', success: versesResult.success },
          { name: 'translation_resources', success: translationsResult.success },
          { name: 'verse_translations', success: verseTranslationsResult.success },
        ],
      };

    } catch (error) {
      this.logger.error('Error during Quran sync process:', error);
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
          jobType: 'quran',
          jobName: 'Quran Sync',
          status,
          metadata: {},
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update job status for ${jobId}:`, error);
    }
  }
}
