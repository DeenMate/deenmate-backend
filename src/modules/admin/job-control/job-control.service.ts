import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WorkerService } from '../../../workers/worker.service';
import {
  JobControlResult,
  JobStatus,
  JobProgress,
  JobSchedule,
  JobScheduleUpdate,
  JobFilters,
  PaginatedJobs,
  JobHistory,
  QueueStatus,
} from './interfaces/job-control.interface';

@Injectable()
export class JobControlService {
  private readonly logger = new Logger(JobControlService.name);

  constructor(
    private prisma: PrismaService,
    private workerService: WorkerService,
  ) {}

  // Job control operations
  async pauseJob(jobId: string, userId: string): Promise<JobControlResult> {
    try {
      const job = await this.prisma.syncJobControl.findUnique({
        where: { jobId },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      if (job.status !== 'running') {
        throw new BadRequestException(`Job ${jobId} is not running and cannot be paused`);
      }

      // Update job status
      await this.prisma.syncJobControl.update({
        where: { jobId },
        data: {
          status: 'paused',
          pausedAt: new Date(),
        },
      });

      // Log the action
      await this.logJobAction(jobId, 'pause', userId);

      this.logger.log(`Job ${jobId} paused by user ${userId}`);

      return {
        success: true,
        message: `Job ${jobId} paused successfully`,
        jobId,
        action: 'pause',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to pause job ${jobId}:`, error);
      throw error;
    }
  }

  async resumeJob(jobId: string, userId: string): Promise<JobControlResult> {
    try {
      const job = await this.prisma.syncJobControl.findUnique({
        where: { jobId },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      if (job.status !== 'paused') {
        throw new BadRequestException(`Job ${jobId} is not paused and cannot be resumed`);
      }

      // Update job status
      await this.prisma.syncJobControl.update({
        where: { jobId },
        data: {
          status: 'running',
          pausedAt: null,
        },
      });

      // Log the action
      await this.logJobAction(jobId, 'resume', userId);

      this.logger.log(`Job ${jobId} resumed by user ${userId}`);

      return {
        success: true,
        message: `Job ${jobId} resumed successfully`,
        jobId,
        action: 'resume',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to resume job ${jobId}:`, error);
      throw error;
    }
  }

  async cancelJob(jobId: string, userId: string): Promise<JobControlResult> {
    try {
      const job = await this.prisma.syncJobControl.findUnique({
        where: { jobId },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        throw new BadRequestException(`Job ${jobId} is already ${job.status} and cannot be cancelled`);
      }

      // Update job status
      await this.prisma.syncJobControl.update({
        where: { jobId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      // Log the action
      await this.logJobAction(jobId, 'cancel', userId);

      this.logger.log(`Job ${jobId} cancelled by user ${userId}`);

      return {
        success: true,
        message: `Job ${jobId} cancelled successfully`,
        jobId,
        action: 'cancel',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  async deleteJob(jobId: string, userId: string): Promise<JobControlResult> {
    try {
      const job = await this.prisma.syncJobControl.findUnique({
        where: { jobId },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      if (job.status === 'running') {
        throw new BadRequestException(`Job ${jobId} is running and cannot be deleted`);
      }

      // Delete the job
      await this.prisma.syncJobControl.delete({
        where: { jobId },
      });

      // Log the action
      await this.logJobAction(jobId, 'delete', userId);

      this.logger.log(`Job ${jobId} deleted by user ${userId}`);

      return {
        success: true,
        message: `Job ${jobId} deleted successfully`,
        jobId,
        action: 'delete',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to delete job ${jobId}:`, error);
      throw error;
    }
  }

  // Job management
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.prisma.syncJobControl.findUnique({
      where: { jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return {
      jobId: job.jobId,
      status: job.status as any,
      progress: job.progressPercentage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
      metadata: job.metadata,
    };
  }

  async getJobProgress(jobId: string): Promise<JobProgress> {
    const job = await this.prisma.syncJobControl.findUnique({
      where: { jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return {
      jobId: job.jobId,
      progressPercentage: job.progressPercentage,
      lastUpdated: job.updatedAt,
    };
  }

  async updateJobPriority(jobId: string, priority: number, userId: string): Promise<JobControlResult> {
    try {
      const job = await this.prisma.syncJobControl.findUnique({
        where: { jobId },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      // Update job priority
      await this.prisma.syncJobControl.update({
        where: { jobId },
        data: { priority },
      });

      // Log the action
      await this.logJobAction(jobId, 'priority_change', userId, { oldPriority: job.priority, newPriority: priority });

      this.logger.log(`Job ${jobId} priority updated to ${priority} by user ${userId}`);

      return {
        success: true,
        message: `Job ${jobId} priority updated to ${priority}`,
        jobId,
        action: 'priority_change',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to update job priority ${jobId}:`, error);
      throw error;
    }
  }

  // Scheduling management
  async getJobSchedules(): Promise<JobSchedule[]> {
    const schedules = await this.prisma.syncJobSchedule.findMany({
      orderBy: { priority: 'asc' },
    });

    return schedules.map(schedule => ({
      id: schedule.id,
      jobType: schedule.jobType,
      enabled: schedule.enabled,
      cronExpression: schedule.cronExpression,
      priority: schedule.priority,
      maxConcurrency: schedule.maxConcurrency,
      timeoutMinutes: schedule.timeoutMinutes,
      retryAttempts: schedule.retryAttempts,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }));
  }

  async updateJobSchedule(jobType: string, schedule: JobScheduleUpdate, userId: string): Promise<JobControlResult> {
    try {
      const existingSchedule = await this.prisma.syncJobSchedule.findUnique({
        where: { jobType },
      });

      if (!existingSchedule) {
        throw new NotFoundException(`Schedule for job type ${jobType} not found`);
      }

      // Update the schedule
      await this.prisma.syncJobSchedule.update({
        where: { jobType },
        data: schedule,
      });

      this.logger.log(`Schedule for ${jobType} updated by user ${userId}`);

      return {
        success: true,
        message: `Schedule for ${jobType} updated successfully`,
        jobId: jobType,
        action: 'schedule_update',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to update schedule for ${jobType}:`, error);
      throw error;
    }
  }

  async enableJobSchedule(jobType: string, enabled: boolean, userId: string): Promise<JobControlResult> {
    try {
      const existingSchedule = await this.prisma.syncJobSchedule.findUnique({
        where: { jobType },
      });

      if (!existingSchedule) {
        throw new NotFoundException(`Schedule for job type ${jobType} not found`);
      }

      // Update the schedule
      await this.prisma.syncJobSchedule.update({
        where: { jobType },
        data: { enabled },
      });

      this.logger.log(`Schedule for ${jobType} ${enabled ? 'enabled' : 'disabled'} by user ${userId}`);

      return {
        success: true,
        message: `Schedule for ${jobType} ${enabled ? 'enabled' : 'disabled'} successfully`,
        jobId: jobType,
        action: enabled ? 'schedule_enable' : 'schedule_disable',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to toggle schedule for ${jobType}:`, error);
      throw error;
    }
  }

  // Job listing and filtering
  async getJobs(filters: JobFilters): Promise<PaginatedJobs> {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.jobType) {
      where.jobType = filters.jobType;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [jobs, total] = await Promise.all([
      this.prisma.syncJobControl.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.syncJobControl.count({ where }),
    ]);

    return {
      jobs: jobs.map(job => ({
        jobId: job.jobId,
        status: job.status as any,
        progress: job.progressPercentage,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
        metadata: job.metadata,
      })),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getJobHistory(jobType?: string, limit: number = 100): Promise<JobHistory[]> {
    const where: any = {};
    if (jobType) {
      where.jobType = jobType;
    }

    const jobs = await this.prisma.syncJobControl.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return jobs.map(job => ({
      id: job.id,
      jobId: job.jobId,
      jobType: job.jobType,
      jobName: job.jobName,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      duration: job.startedAt && job.completedAt 
        ? job.completedAt.getTime() - job.startedAt.getTime()
        : undefined,
      errorMessage: job.errorMessage,
    }));
  }

  async getQueueStatus(): Promise<QueueStatus> {
    try {
      const stats = await this.workerService.getQueueStats();
      return {
        queueName: 'sync-queue',
        waiting: stats.syncQueue?.waiting || 0,
        active: stats.syncQueue?.active || 0,
        completed: stats.syncQueue?.completed || 0,
        failed: stats.syncQueue?.failed || 0,
        delayed: stats.syncQueue?.delayed || 0,
        paused: stats.syncQueue?.paused || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get queue status:', error);
      return {
        queueName: 'sync-queue',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };
    }
  }

  // Helper methods
  private async logJobAction(jobId: string, action: string, performedBy: string, metadata?: any): Promise<void> {
    try {
      await this.prisma.syncJobAuditLog.create({
        data: {
          jobId,
          action,
          performedBy,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log job action ${action} for job ${jobId}:`, error);
    }
  }

  // Create or update job control record
  async createOrUpdateJobControl(jobId: string, jobType: string, jobName: string, status: string, metadata?: any): Promise<void> {
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

  // Update job progress
  async updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<void> {
    try {
      await this.prisma.syncJobControl.update({
        where: { jobId },
        data: {
          progressPercentage: progress,
          metadata: currentStep ? { currentStep } : undefined,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update job progress for ${jobId}:`, error);
    }
  }
}
