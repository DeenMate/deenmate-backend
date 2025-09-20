import { apiClient } from './api';

export interface JobStatus {
  jobId: string;
  jobName?: string;
  jobType?: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressPercentage?: number;
  priority?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  errorMessage?: string;
  metadata?: any;
}

export interface JobProgress {
  jobId: string;
  progressPercentage: number;
  currentStep?: string;
  totalSteps?: number;
  estimatedTimeRemaining?: number;
  lastUpdated: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface JobFilters {
  status?: string;
  jobType?: string;
  priority?: number;
  startDate?: string;
  endDate?: string;
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
  startedAt?: string;
  completedAt?: string;
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

export interface JobControlResult {
  success: boolean;
  message: string;
  data: {
    jobId: string;
    action: string;
  };
  meta: {
    timestamp: string;
  };
}

export const jobControlApi = {
  // Job control operations
  pauseJob: async (jobId: string): Promise<JobControlResult> => {
    const response = await apiClient.post(`/admin/job-control/${jobId}/pause`);
    return response.data;
  },

  resumeJob: async (jobId: string): Promise<JobControlResult> => {
    const response = await apiClient.post(`/admin/job-control/${jobId}/resume`);
    return response.data;
  },

  cancelJob: async (jobId: string): Promise<JobControlResult> => {
    const response = await apiClient.post(`/admin/job-control/${jobId}/cancel`);
    return response.data;
  },

  deleteJob: async (jobId: string): Promise<JobControlResult> => {
    const response = await apiClient.delete(`/admin/job-control/${jobId}`);
    return response.data;
  },

  // Job status and progress
  getJobStatus: async (jobId: string): Promise<{ success: boolean; data: JobStatus }> => {
    const response = await apiClient.get(`/admin/job-control/${jobId}/status`);
    return response.data;
  },

  getJobProgress: async (jobId: string): Promise<{ success: boolean; data: JobProgress }> => {
    const response = await apiClient.get(`/admin/job-control/${jobId}/progress`);
    return response.data;
  },

  // Job management
  getJobs: async (filters?: JobFilters): Promise<{ success: boolean; data: PaginatedJobs }> => {
    const response = await apiClient.get('/admin/job-control', { params: filters });
    return response.data;
  },

  updateJobPriority: async (jobId: string, priority: number): Promise<JobControlResult> => {
    const response = await apiClient.put(`/admin/job-control/${jobId}/priority`, { priority });
    return response.data;
  },

  // Scheduling management
  getJobSchedules: async (): Promise<{ success: boolean; data: JobSchedule[] }> => {
    const response = await apiClient.get('/admin/job-control/schedules');
    return response.data;
  },

  updateJobSchedule: async (jobType: string, schedule: Partial<JobSchedule>): Promise<JobControlResult> => {
    const response = await apiClient.put(`/admin/job-control/schedules/${jobType}`, schedule);
    return response.data;
  },

  toggleJobSchedule: async (jobType: string, enabled: boolean): Promise<JobControlResult> => {
    const response = await apiClient.post(`/admin/job-control/schedules/${jobType}/toggle`, { enabled });
    return response.data;
  },

  // Additional endpoints
  getJobHistory: async (jobType?: string, limit?: number): Promise<{ success: boolean; data: JobHistory[] }> => {
    const response = await apiClient.get('/admin/job-control/history', { 
      params: { jobType, limit } 
    });
    return response.data;
  },

  getQueueStatus: async (): Promise<{ success: boolean; data: QueueStatus }> => {
    const response = await apiClient.get('/admin/job-control/queue/status');
    return response.data;
  },
};
