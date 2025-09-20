import { IsString, IsNumber, IsOptional, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobControlActionDto {
  @ApiProperty({ description: 'Job ID to perform action on' })
  @IsString()
  jobId: string;

  @ApiProperty({ description: 'Action to perform', enum: ['pause', 'resume', 'cancel', 'delete'] })
  @IsString()
  action: 'pause' | 'resume' | 'cancel' | 'delete';
}

export class UpdateJobPriorityDto {
  @ApiProperty({ description: 'New priority level (1-10)', minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  priority: number;
}

export class JobScheduleUpdateDto {
  @ApiPropertyOptional({ description: 'Whether the schedule is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Cron expression for scheduling' })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ description: 'Job priority (1-10)', minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Maximum concurrent jobs', minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxConcurrency?: number;

  @ApiPropertyOptional({ description: 'Timeout in minutes', minimum: 1, maximum: 1440 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  timeoutMinutes?: number;

  @ApiPropertyOptional({ description: 'Number of retry attempts', minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retryAttempts?: number;
}

export class ToggleJobScheduleDto {
  @ApiProperty({ description: 'Whether to enable or disable the schedule' })
  @IsBoolean()
  enabled: boolean;
}

export class JobFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by job status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by job type' })
  @IsOptional()
  @IsString()
  jobType?: string;

  @ApiPropertyOptional({ description: 'Filter by priority level' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Filter by start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Number of results to return', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
