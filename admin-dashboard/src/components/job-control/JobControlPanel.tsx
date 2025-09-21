'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { jobControlApi, JobStatus, QueueStatus } from '@/lib/job-control-api';
import { useJobUpdates } from '@/hooks/useJobUpdates';

interface JobControlPanelProps {
  refreshInterval?: number;
}

export function JobControlPanel({ refreshInterval = 60000 }: JobControlPanelProps) {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Real-time updates
  const { isConnected, jobUpdates, queueStatus: realtimeQueueStatus, lastUpdate } = useJobUpdates();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [jobsResponse, queueResponse] = await Promise.all([
        jobControlApi.getJobs({ limit: 10 }),
        jobControlApi.getQueueStatus(),
      ]);
      
      setJobs(jobsResponse.data.jobs);
      setQueueStatus(queueResponse.data);
    } catch (error) {
      console.error('Failed to fetch job control data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Update queue status from real-time updates
  useEffect(() => {
    if (realtimeQueueStatus) {
      setQueueStatus(realtimeQueueStatus);
    }
  }, [realtimeQueueStatus]);

  // Update jobs from real-time updates
  useEffect(() => {
    if (jobUpdates.length > 0) {
      setJobs(prevJobs => {
        const updatedJobs = [...prevJobs];
        jobUpdates.forEach(update => {
          const jobIndex = updatedJobs.findIndex(job => job.jobId === update.jobId);
          if (jobIndex !== -1) {
            if (update.status) {
              updatedJobs[jobIndex] = { ...updatedJobs[jobIndex], ...update.status };
            }
            if (update.progress) {
              updatedJobs[jobIndex] = { 
                ...updatedJobs[jobIndex], 
                progressPercentage: update.progress.progressPercentage 
              };
            }
          }
        });
        return updatedJobs;
      });
    }
  }, [jobUpdates]);

  const handleJobAction = async (jobId: string, action: 'pause' | 'resume' | 'cancel' | 'delete') => {
    try {
      setActionLoading(jobId);
      
      let result;
      switch (action) {
        case 'pause':
          result = await jobControlApi.pauseJob(jobId);
          break;
        case 'resume':
          result = await jobControlApi.resumeJob(jobId);
          break;
        case 'cancel':
          result = await jobControlApi.cancelJob(jobId);
          break;
        case 'delete':
          result = await jobControlApi.deleteJob(jobId);
          break;
      }

      if (result.success) {
        await fetchData(); // Refresh data
      } else {
        alert(`Failed to ${action} job: ${result.message}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
      alert(`Failed to ${action} job`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-500">Running</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-yellow-500">Paused</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-500">Cancelled</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getActionButtons = (job: JobStatus) => {
    const buttons = [];
    
    if (job.status === 'running') {
      buttons.push(
        <Button
          key="pause"
          size="sm"
          variant="outline"
          onClick={() => handleJobAction(job.jobId, 'pause')}
          disabled={actionLoading === job.jobId}
        >
          Pause
        </Button>
      );
    }
    
    if (job.status === 'paused') {
      buttons.push(
        <Button
          key="resume"
          size="sm"
          variant="outline"
          onClick={() => handleJobAction(job.jobId, 'resume')}
          disabled={actionLoading === job.jobId}
        >
          Resume
        </Button>
      );
    }
    
    if (['running', 'paused', 'pending'].includes(job.status)) {
      buttons.push(
        <Button
          key="cancel"
          size="sm"
          variant="destructive"
          onClick={() => handleJobAction(job.jobId, 'cancel')}
          disabled={actionLoading === job.jobId}
        >
          Cancel
        </Button>
      );
    }
    
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      buttons.push(
        <Button
          key="delete"
          size="sm"
          variant="destructive"
          onClick={() => handleJobAction(job.jobId, 'delete')}
          disabled={actionLoading === job.jobId}
        >
          Delete
        </Button>
      );
    }
    
    return buttons;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Control</CardTitle>
          <CardDescription>Loading job control data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Status */}
      {queueStatus && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Queue Status</CardTitle>
                <CardDescription>Current queue statistics</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{queueStatus.waiting}</div>
                <div className="text-sm text-gray-600">Waiting</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{queueStatus.active}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{queueStatus.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{queueStatus.failed}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Latest job activities and controls</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No jobs found
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.jobId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{job.jobId}</span>
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="flex space-x-2">
                      {getActionButtons(job)}
                    </div>
                  </div>
                  
                  {job.status === 'running' && (
                    <div className="mb-2">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2" />
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600">
                    {job.startedAt && (
                      <div>Started: {new Date(job.startedAt).toLocaleString()}</div>
                    )}
                    {job.completedAt && (
                      <div>Completed: {new Date(job.completedAt).toLocaleString()}</div>
                    )}
                    {job.errorMessage && (
                      <div className="text-red-600 mt-1">Error: {job.errorMessage}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
