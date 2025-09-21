import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrayerSyncService } from '../modules/prayer/prayer.sync.service';
import { PrayerPrerequisitesService } from '../modules/prayer/prayer-prerequisites.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Processor('prayer-sync-queue')
export class PrayerSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PrayerSyncProcessor.name);

  constructor(
    private readonly prayerSyncService: PrayerSyncService,
    private readonly prayerPrerequisitesService: PrayerPrerequisitesService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { type, action, data } = job.data;
    const jobId = job.id?.toString() || 'unknown';
    
    this.logger.log(`Processing prayer sync job: ${type}:${action} (ID: ${jobId})`);

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running');
      
      // Update job progress
      await job.updateProgress(10);

      // Check prerequisites
      await this.checkPrerequisites();
      await job.updateProgress(20);

      // Process prayer sync based on action
      let result;
      switch (action) {
        case 'sync':
          result = await this.processPrayerSync(job, data, jobId);
          break;
        default:
          throw new Error(`Unknown prayer sync action: ${action}`);
      }

      await job.updateProgress(100);
      
      // Update job status to completed
      await this.updateJobStatus(jobId, 'completed');
      
      this.logger.log(`Prayer sync job completed successfully: ${type}:${action} (ID: ${job.id})`);
      
      return result;
    } catch (error) {
      // Handle pause vs cancellation differently
      if (error.message === 'Job paused by user') {
        // Update job status to paused
        await this.updateJobStatus(jobId, 'paused');
        this.logger.log(`Prayer sync job paused: ${type}:${action} (ID: ${job.id})`);
        throw error;
      } else {
        // Update job status to failed
        await this.updateJobStatus(jobId, 'failed');
        this.logger.error(`Prayer sync job failed: ${type}:${action} (ID: ${job.id})`, error.stack);
        throw error;
      }
    }
  }

  private async checkPrerequisites(): Promise<void> {
    this.logger.log('Checking prayer sync prerequisites...');
    
    const prerequisiteResult = await this.prayerPrerequisitesService.validateAndFixPrerequisites();
    
    if (!prerequisiteResult.success) {
      throw new Error(`Prayer sync prerequisites failed: ${prerequisiteResult.message}`);
    }
    
    if (prerequisiteResult.wasFixed) {
      this.logger.log('Prayer sync prerequisites were automatically fixed');
    } else {
      this.logger.log('Prayer sync prerequisites check passed');
    }
  }

  private async processPrayerSync(job: Job, data: any, jobId: string): Promise<any> {
    this.logger.log('Starting prayer sync process');
    
    // Get all prayer locations
    const locations = await this.prisma.prayerLocation.findMany({
      select: { id: true, lat: true, lng: true, city: true, country: true },
    });

    // Get all prayer calculation methods
    const methods = await this.prisma.prayerCalculationMethod.findMany({
      select: { id: true, methodCode: true, methodName: true },
    });

    const totalLocations = locations.length;
    const totalMethods = methods.length;
    const totalCombinations = totalLocations * totalMethods;
    let processedCombinations = 0;
    let successCount = 0;
    let errorCount = 0;

    this.logger.log(`Processing ${totalCombinations} location-method combinations`);

    // Process each location-method combination
    for (const location of locations) {
      for (const method of methods) {
        try {
          // Check for cancellation
          if (await this.isJobCancelled(jobId)) {
            this.logger.log('Job cancelled, stopping prayer sync');
            return { cancelled: true, processed: processedCombinations };
          }

          // Sync prayer times for this location-method combination
          const result = await this.prayerSyncService.syncPrayerTimesForMethod(
            location.lat,
            location.lng,
            method.id,
            0, // Default school (Shafi)
            {
              force: data?.force || false,
              resource: 'times',
              dateRange: { 
                start: new Date(), 
                end: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day
              },
            },
            () => this.isJobCancelled(jobId),
            jobId // Pass the BullMQ job ID to the service
          );

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            this.logger.warn(`Failed to sync prayer times for ${location.city || location.country} with ${method.methodName}: ${result.errors.join(', ')}`);
          }

          processedCombinations++;
          
          // Update progress every 10 combinations
          if (processedCombinations % 10 === 0 || processedCombinations === totalCombinations) {
            const progress = Math.floor((processedCombinations / totalCombinations) * 80) + 20; // 20% to 100%
            await this.updateJobProgress(progress, `Processed ${processedCombinations}/${totalCombinations} combinations`);
          }

        } catch (error) {
          // Handle pause vs cancellation differently
          if (error.message === 'Job paused by user') {
            this.logger.log(`Prayer sync paused at ${location.city || location.country} with ${method.methodName}`);
            throw error; // Re-throw to be handled by the main process method
          } else if (error.message === 'Job cancelled by user') {
            this.logger.log(`Prayer sync cancelled at ${location.city || location.country} with ${method.methodName}`);
            return { cancelled: true, processed: processedCombinations };
          } else {
            errorCount++;
            this.logger.error(`Error syncing prayer times for ${location.city || location.country} with ${method.methodName}:`, error);
          }
        }
      }
    }

    this.logger.log(`Prayer sync completed: ${successCount} successful, ${errorCount} failed`);
    
    return {
      success: true,
      totalCombinations,
      successCount,
      errorCount,
      processedCombinations,
    };
  }

  private async isJobCancelled(jobId: string): Promise<boolean> {
    try {
      const cancelKey = `sync:cancel:${jobId}`;
      const pauseKey = `sync:pause:${jobId}`;
      
      const isCancelled = await this.redisService.get(cancelKey);
      const isPaused = await this.redisService.get(pauseKey);
      
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
          jobType: 'prayer',
          jobName: 'Prayer Times Sync',
          status,
          metadata: {},
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update job status for ${jobId}:`, error);
    }
  }
}
