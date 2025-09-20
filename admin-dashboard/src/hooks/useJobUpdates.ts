'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { JobStatus, JobProgress, QueueStatus } from '@/lib/job-control-api';

interface JobUpdateEvent {
  jobId: string;
  status?: JobStatus;
  progress?: JobProgress;
  action?: string;
  result?: any;
  timestamp: string;
}

interface QueueUpdateEvent {
  queueStatus: QueueStatus;
  timestamp: string;
}

export function useJobUpdates() {
  const [jobUpdates, setJobUpdates] = useState<Map<string, JobUpdateEvent>>(new Map());
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { isConnected, on, off } = useWebSocket({
    namespace: '/job-control',
    onConnect: () => {
      console.log('Connected to job control WebSocket');
    },
    onDisconnect: () => {
      console.log('Disconnected from job control WebSocket');
    },
    onError: (error) => {
      console.error('Job control WebSocket error:', error);
    },
  });

  // Handle job status updates
  const handleJobStatusUpdate = useCallback((data: JobUpdateEvent) => {
    console.log('Job status update received:', data);
    setJobUpdates(prev => new Map(prev.set(data.jobId, data)));
    setLastUpdate(new Date());
  }, []);

  // Handle job progress updates
  const handleJobProgressUpdate = useCallback((data: JobUpdateEvent) => {
    console.log('Job progress update received:', data);
    setJobUpdates(prev => new Map(prev.set(data.jobId, data)));
    setLastUpdate(new Date());
  }, []);

  // Handle job control actions
  const handleJobControlAction = useCallback((data: JobUpdateEvent) => {
    console.log('Job control action received:', data);
    setJobUpdates(prev => new Map(prev.set(data.jobId, data)));
    setLastUpdate(new Date());
  }, []);

  // Handle queue status updates
  const handleQueueStatusUpdate = useCallback((data: QueueUpdateEvent) => {
    console.log('Queue status update received:', data);
    setQueueStatus(data.queueStatus);
    setLastUpdate(new Date());
  }, []);

  // Subscribe to specific job updates
  const subscribeToJob = useCallback((jobId: string) => {
    if (isConnected) {
      on('subscribe-job', { jobId });
    }
  }, [isConnected, on]);

  // Unsubscribe from specific job updates
  const unsubscribeFromJob = useCallback((jobId: string) => {
    if (isConnected) {
      on('unsubscribe-job', { jobId });
    }
  }, [isConnected, on]);

  // Subscribe to all job updates
  const subscribeToAllJobs = useCallback(() => {
    if (isConnected) {
      on('subscribe-all-jobs');
    }
  }, [isConnected, on]);

  // Unsubscribe from all job updates
  const unsubscribeFromAllJobs = useCallback(() => {
    if (isConnected) {
      on('unsubscribe-all-jobs');
    }
  }, [isConnected, on]);

  // Get latest update for a specific job
  const getJobUpdate = useCallback((jobId: string): JobUpdateEvent | undefined => {
    return jobUpdates.get(jobId);
  }, [jobUpdates]);

  // Clear updates for a specific job
  const clearJobUpdate = useCallback((jobId: string) => {
    setJobUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });
  }, []);

  // Clear all updates
  const clearAllUpdates = useCallback(() => {
    setJobUpdates(new Map());
    setLastUpdate(null);
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    // Set up event listeners
    on('job-status-update', handleJobStatusUpdate);
    on('job-progress-update', handleJobProgressUpdate);
    on('job-control-action', handleJobControlAction);
    on('queue-status-update', handleQueueStatusUpdate);

    // Subscribe to all job updates by default
    subscribeToAllJobs();

    return () => {
      // Clean up event listeners
      off('job-status-update', handleJobStatusUpdate);
      off('job-progress-update', handleJobProgressUpdate);
      off('job-control-action', handleJobControlAction);
      off('queue-status-update', handleQueueStatusUpdate);
      
      // Unsubscribe from all jobs
      unsubscribeFromAllJobs();
    };
  }, [
    isConnected,
    on,
    off,
    handleJobStatusUpdate,
    handleJobProgressUpdate,
    handleJobControlAction,
    handleQueueStatusUpdate,
    subscribeToAllJobs,
    unsubscribeFromAllJobs,
  ]);

  return {
    isConnected,
    jobUpdates: Array.from(jobUpdates.values()),
    queueStatus,
    lastUpdate,
    getJobUpdate,
    clearJobUpdate,
    clearAllUpdates,
    subscribeToJob,
    unsubscribeFromJob,
    subscribeToAllJobs,
    unsubscribeFromAllJobs,
  };
}
