'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageLayout } from '@/components/layout/page-layout';
import { JobControlPanel } from '@/components/job-control/JobControlPanel';
import { JobProgressBar } from '@/components/job-control/JobProgressBar';
import { JobPrioritySelector } from '@/components/job-control/JobPrioritySelector';
import { JobScheduleManager } from '@/components/job-control/JobScheduleManager';
import { JobHistoryTable } from '@/components/job-control/JobHistoryTable';
import { BulkJobOperations } from '@/components/job-control/BulkJobOperations';
import { JobAnalytics } from '@/components/job-control/JobAnalytics';
import { jobControlApi } from '@/lib/job-control-api';
import { JobStatus, QueueStatus } from '@/lib/job-control-api';
import { initializeAuth } from '@/lib/api';
import { 
  Activity, 
  Clock, 
  Settings, 
  History, 
  BarChart3, 
  Play, 
  Pause, 
  Square,
  RefreshCw 
} from 'lucide-react';

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobStatus | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Initialize authentication
    initializeAuth();
    
    fetchJobData();
  }, [router]);

  const fetchJobData = async () => {
    try {
      setIsLoading(true);
      const [jobsResponse, queueResponse] = await Promise.all([
        jobControlApi.getJobs({ limit: 50 }),
        jobControlApi.getQueueStatus(),
      ]);
      
      setJobs(jobsResponse.data.jobs);
      setQueueStatus(queueResponse.data);
    } catch (error) {
      console.error('Failed to fetch job data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getStatusCounts = () => {
    const counts = {
      running: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      pending: 0,
      cancelled: 0,
    };

    (jobs || []).forEach(job => {
      counts[job.status as keyof typeof counts]++;
    });

    return counts;
  };

  const statusCounts = getStatusCounts();

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading job data...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Management</h1>
            <p className="text-gray-600 mt-2">Monitor and control background synchronization jobs</p>
          </div>
          <Button
            variant="outline"
            onClick={fetchJobData}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Running</p>
                <p className="text-xl font-bold">{statusCounts.running}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-bold">{statusCounts.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Pause className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-gray-500">Paused</p>
                <p className="text-xl font-bold">{statusCounts.paused}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Play className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-xl font-bold">{statusCounts.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Square className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-xl font-bold">{statusCounts.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-xl font-bold">{jobs?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status */}
      {queueStatus && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Queue Status</CardTitle>
            <CardDescription>Current queue statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Waiting</p>
                <p className="text-2xl font-bold">{queueStatus?.waiting || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold">{queueStatus?.active || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold">{queueStatus?.completed || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-2xl font-bold">{queueStatus?.failed || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Delayed</p>
                <p className="text-2xl font-bold">{queueStatus?.delayed || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="control" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Control</span>
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center space-x-2">
            <Square className="h-4 w-4" />
            <span>Bulk Ops</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Schedules</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <span>History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Active Jobs</CardTitle>
                <CardDescription>Currently running and pending jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(jobs || []).filter(job => ['running', 'pending', 'paused'].includes(job.status)).length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No active jobs</p>
                  ) : (
                    (jobs || [])
                      .filter(job => ['running', 'pending', 'paused'].includes(job.status))
                      .map((job) => (
                        <div key={job.jobId} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm">{job.jobName}</span>
                              {getStatusBadge(job.status)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedJob(job)}
                            >
                              View Details
                            </Button>
                          </div>
                          {job.status === 'running' && (
                            <JobProgressBar
                              jobId={job.jobId}
                              progress={job.progressPercentage}
                              status={job.status}
                              startedAt={job.startedAt ? new Date(job.startedAt) : undefined}
                              completedAt={job.completedAt ? new Date(job.completedAt) : undefined}
                              errorMessage={job.errorMessage}
                            />
                          )}
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Completed Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Completed Jobs</CardTitle>
                <CardDescription>Latest completed and failed jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(jobs || []).filter(job => ['completed', 'failed', 'cancelled'].includes(job.status)).length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No recent jobs</p>
                  ) : (
                    (jobs || [])
                      .filter(job => ['completed', 'failed', 'cancelled'].includes(job.status))
                      .slice(0, 5)
                      .map((job) => (
                        <div key={job.jobId} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm">{job.jobName}</span>
                              {getStatusBadge(job.status)}
                            </div>
                            <span className="text-xs text-gray-500">
                              {job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          {job.errorMessage && (
                            <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="control">
          <JobControlPanel />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkJobOperations jobs={jobs} onJobsUpdate={fetchJobData} />
        </TabsContent>

        <TabsContent value="analytics">
          <JobAnalytics jobs={jobs} />
        </TabsContent>

        <TabsContent value="schedules">
          <JobScheduleManager />
        </TabsContent>

        <TabsContent value="history">
          <JobHistoryTable />
        </TabsContent>
      </Tabs>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Job Details - {selectedJob.jobName}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedJob(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Job ID</label>
                  <p className="font-mono text-sm">{selectedJob.jobId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Job Type</label>
                  <p className="text-sm">{selectedJob.jobType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Priority</label>
                  <p className="text-sm">{selectedJob.priority}</p>
                </div>
              </div>

              <JobProgressBar
                jobId={selectedJob.jobId}
                progress={selectedJob.progressPercentage}
                status={selectedJob.status}
                startedAt={selectedJob.startedAt ? new Date(selectedJob.startedAt) : undefined}
                completedAt={selectedJob.completedAt ? new Date(selectedJob.completedAt) : undefined}
                errorMessage={selectedJob.errorMessage}
              />

              <JobPrioritySelector
                jobId={selectedJob.jobId}
                currentPriority={selectedJob.priority}
                onPriorityChange={(newPriority) => {
                  setSelectedJob({ ...selectedJob, priority: newPriority });
                }}
              />

              {selectedJob.metadata && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Metadata</label>
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(selectedJob.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
