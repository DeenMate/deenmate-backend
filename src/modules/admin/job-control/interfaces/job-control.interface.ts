export interface JobControlResult {
  success: boolean;
  message: string;
  jobId: string;
  action: string;
  timestamp: Date;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  metadata?: any;
}

export interface JobProgress {
  jobId: string;
  progressPercentage: number;
  currentStep?: string;
  totalSteps?: number;
  estimatedTimeRemaining?: number;
  lastUpdated: Date;
}

export interface JobSchedule {
  id: number;
  jobType: string;
  enabled: boolean;
  cronExpression?: string;
  priority: number;
  maxConcurrency: number;
  timeoutMinutes: number;
  retryAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobScheduleUpdate {
  enabled?: boolean;
  cronExpression?: string;
  priority?: number;
  maxConcurrency?: number;
  timeoutMinutes?: number;
  retryAttempts?: number;
}

export interface JobFilters {
  status?: string;
  jobType?: string;
  priority?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface PaginatedJobs {
  jobs: JobStatus[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface JobHistory {
  id: number;
  jobId: string;
  jobType: string;
  jobName: string;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  errorMessage?: string;
}

export interface QueueStatus {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface JobControlAction {
  action: 'pause' | 'resume' | 'cancel' | 'delete' | 'priority_change';
  jobId: string;
  performedBy: string;
  metadata?: any;
}
