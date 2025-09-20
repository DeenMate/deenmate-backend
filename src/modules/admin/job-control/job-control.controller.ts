import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body, 
  Query, 
  Request,
  UseGuards 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiBearerAuth,
  ApiQuery 
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JobControlService } from './job-control.service';
import {
  UpdateJobPriorityDto,
  JobScheduleUpdateDto,
  ToggleJobScheduleDto,
  JobFiltersDto,
} from './dto/job-control.dto';

@ApiTags('Admin - Job Control')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'admin/jobs', version: '4' })
export class JobControlController {
  constructor(private readonly jobControlService: JobControlService) {}

  // Job control endpoints
  @Post(':jobId/pause')
  @ApiOperation({ summary: 'Pause a running job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to pause' })
  @ApiResponse({ status: 200, description: 'Job paused successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Job cannot be paused' })
  async pauseJob(@Param('jobId') jobId: string, @Request() req) {
    const result = await this.jobControlService.pauseJob(jobId, req.user.email);
    return {
      success: result.success,
      message: result.message,
      data: { jobId: result.jobId, action: result.action },
      meta: { timestamp: result.timestamp },
    };
  }

  @Post(':jobId/resume')
  @ApiOperation({ summary: 'Resume a paused job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to resume' })
  @ApiResponse({ status: 200, description: 'Job resumed successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Job cannot be resumed' })
  async resumeJob(@Param('jobId') jobId: string, @Request() req) {
    const result = await this.jobControlService.resumeJob(jobId, req.user.email);
    return {
      success: result.success,
      message: result.message,
      data: { jobId: result.jobId, action: result.action },
      meta: { timestamp: result.timestamp },
    };
  }

  @Post(':jobId/cancel')
  @ApiOperation({ summary: 'Cancel a job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to cancel' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Job cannot be cancelled' })
  async cancelJob(@Param('jobId') jobId: string, @Request() req) {
    const result = await this.jobControlService.cancelJob(jobId, req.user.email);
    return {
      success: result.success,
      message: result.message,
      data: { jobId: result.jobId, action: result.action },
      meta: { timestamp: result.timestamp },
    };
  }

  @Delete(':jobId')
  @ApiOperation({ summary: 'Delete a job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to delete' })
  @ApiResponse({ status: 200, description: 'Job deleted successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Job cannot be deleted' })
  async deleteJob(@Param('jobId') jobId: string, @Request() req) {
    const result = await this.jobControlService.deleteJob(jobId, req.user.email);
    return {
      success: result.success,
      message: result.message,
      data: { jobId: result.jobId, action: result.action },
      meta: { timestamp: result.timestamp },
    };
  }

  // Job status and progress
  @Get(':jobId/status')
  @ApiOperation({ summary: 'Get job status' })
  @ApiParam({ name: 'jobId', description: 'Job ID to get status for' })
  @ApiResponse({ status: 200, description: 'Job status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.jobControlService.getJobStatus(jobId);
    return {
      success: true,
      data: status,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get(':jobId/progress')
  @ApiOperation({ summary: 'Get job progress' })
  @ApiParam({ name: 'jobId', description: 'Job ID to get progress for' })
  @ApiResponse({ status: 200, description: 'Job progress retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobProgress(@Param('jobId') jobId: string) {
    const progress = await this.jobControlService.getJobProgress(jobId);
    return {
      success: true,
      data: progress,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  // Job management
  @Get()
  @ApiOperation({ summary: 'Get jobs with filtering' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by job status' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Filter by job type' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  async getJobs(@Query() filters: JobFiltersDto) {
    const jobFilters = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    };
    const jobs = await this.jobControlService.getJobs(jobFilters);
    return {
      success: true,
      data: jobs,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Put(':jobId/priority')
  @ApiOperation({ summary: 'Update job priority' })
  @ApiParam({ name: 'jobId', description: 'Job ID to update priority for' })
  @ApiResponse({ status: 200, description: 'Job priority updated successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async updateJobPriority(
    @Param('jobId') jobId: string,
    @Body() body: UpdateJobPriorityDto,
    @Request() req
  ) {
    const result = await this.jobControlService.updateJobPriority(jobId, body.priority, req.user.email);
    return {
      success: result.success,
      message: result.message,
      data: { jobId: result.jobId, action: result.action },
      meta: { timestamp: result.timestamp },
    };
  }

  // Scheduling management
  @Get('schedules')
  @ApiOperation({ summary: 'Get job schedules' })
  @ApiResponse({ status: 200, description: 'Job schedules retrieved successfully' })
  async getJobSchedules() {
    const schedules = await this.jobControlService.getJobSchedules();
    return {
      success: true,
      data: schedules,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Put('schedules/:jobType')
  @ApiOperation({ summary: 'Update job schedule' })
  @ApiParam({ name: 'jobType', description: 'Job type to update schedule for' })
  @ApiResponse({ status: 200, description: 'Job schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Job schedule not found' })
  async updateJobSchedule(
    @Param('jobType') jobType: string,
    @Body() schedule: JobScheduleUpdateDto,
    @Request() req
  ) {
    const result = await this.jobControlService.updateJobSchedule(jobType, schedule, req.user.email);
    return {
      success: result.success,
      message: result.message,
      data: { jobType: result.jobId, action: result.action },
      meta: { timestamp: result.timestamp },
    };
  }

  @Post('schedules/:jobType/toggle')
  @ApiOperation({ summary: 'Toggle job schedule enabled/disabled' })
  @ApiParam({ name: 'jobType', description: 'Job type to toggle schedule for' })
  @ApiResponse({ status: 200, description: 'Job schedule toggled successfully' })
  @ApiResponse({ status: 404, description: 'Job schedule not found' })
  async toggleJobSchedule(
    @Param('jobType') jobType: string,
    @Body() body: ToggleJobScheduleDto,
    @Request() req
  ) {
    const result = await this.jobControlService.enableJobSchedule(jobType, body.enabled, req.user.email);
    return {
      success: result.success,
      message: result.message,
      data: { jobType: result.jobId, action: result.action },
      meta: { timestamp: result.timestamp },
    };
  }

  // Additional endpoints
  @Get('history')
  @ApiOperation({ summary: 'Get job history' })
  @ApiQuery({ name: 'jobType', required: false, description: 'Filter by job type' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  @ApiResponse({ status: 200, description: 'Job history retrieved successfully' })
  async getJobHistory(
    @Query('jobType') jobType?: string,
    @Query('limit') limit?: string
  ) {
    const history = await this.jobControlService.getJobHistory(jobType, limit ? parseInt(limit) : 100);
    return {
      success: true,
      data: history,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('queue/status')
  @ApiOperation({ summary: 'Get queue status' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved successfully' })
  async getQueueStatus() {
    const status = await this.jobControlService.getQueueStatus();
    return {
      success: true,
      data: status,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
