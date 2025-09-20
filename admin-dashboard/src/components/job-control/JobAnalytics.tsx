'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { jobControlApi } from '@/lib/job-control-api';
import { JobStatus } from '@/lib/job-control-api';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Activity,
  Zap,
  Target
} from 'lucide-react';

interface JobAnalyticsProps {
  jobs: JobStatus[];
}

interface AnalyticsData {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  averageDuration: number;
  successRate: number;
  jobsByType: Record<string, number>;
  jobsByStatus: Record<string, number>;
  recentTrends: Array<{
    date: string;
    completed: number;
    failed: number;
    running: number;
  }>;
}

export function JobAnalytics({ jobs }: JobAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    calculateAnalytics();
  }, [jobs, timeRange]);

  const calculateAnalytics = () => {
    setIsLoading(true);
    
    try {
      console.log('JobAnalytics: Calculating analytics for', jobs?.length || 0, 'jobs');
      
      // Filter jobs by time range
      const now = new Date();
      const timeRangeMs = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        'all': Infinity,
      }[timeRange];

      const filteredJobs = (jobs || []).filter(job => {
        if (timeRange === 'all') return true;
        if (!job.createdAt) return false; // Skip jobs without createdAt
        const jobDate = new Date(job.createdAt);
        return (now.getTime() - jobDate.getTime()) <= timeRangeMs;
      });

      console.log('JobAnalytics: Filtered jobs count:', filteredJobs.length);

    // Calculate basic metrics
    const totalJobs = filteredJobs.length;
    const completedJobs = filteredJobs.filter(job => job.status === 'completed').length;
    const failedJobs = filteredJobs.filter(job => job.status === 'failed').length;
    const runningJobs = filteredJobs.filter(job => job.status === 'running').length;

    // Calculate average duration
    const jobsWithDuration = filteredJobs.filter(job => 
      job.startedAt && job.completedAt && job.status === 'completed'
    );
    const averageDuration = jobsWithDuration.length > 0 
      ? jobsWithDuration.reduce((sum, job) => {
          const duration = new Date(job.completedAt!).getTime() - new Date(job.startedAt!).getTime();
          return sum + duration;
        }, 0) / jobsWithDuration.length / 1000 / 60 // Convert to minutes
      : 0;

    // Calculate success rate
    const finishedJobs = completedJobs + failedJobs;
    const successRate = finishedJobs > 0 ? (completedJobs / finishedJobs) * 100 : 0;

    // Jobs by type
    const jobsByType = filteredJobs.reduce((acc, job) => {
      acc[job.jobType] = (acc[job.jobType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Jobs by status
    const jobsByStatus = filteredJobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent trends (last 7 days)
    const recentTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayJobs = filteredJobs.filter(job => {
        if (!job.createdAt) return false;
        const jobDate = new Date(job.createdAt).toISOString().split('T')[0];
        return jobDate === dateStr;
      });

      recentTrends.push({
        date: dateStr,
        completed: dayJobs.filter(job => job.status === 'completed').length,
        failed: dayJobs.filter(job => job.status === 'failed').length,
        running: dayJobs.filter(job => job.status === 'running').length,
      });
    }

      setAnalyticsData({
        totalJobs,
        completedJobs,
        failedJobs,
        runningJobs,
        averageDuration,
        successRate,
        jobsByType,
        jobsByStatus,
        recentTrends,
      });

      console.log('JobAnalytics: Analytics data set:', {
        totalJobs,
        completedJobs,
        failedJobs,
        runningJobs,
        successRate: successRate.toFixed(1) + '%'
      });
    } catch (error) {
      console.error('JobAnalytics: Error calculating analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 1) return '< 1m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Analytics</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Calculating analytics...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Analytics</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Job Analytics</span>
            </CardTitle>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Total Jobs</p>
                <p className="text-2xl font-bold">{analyticsData.totalJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold">{analyticsData.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-gray-500">Avg Duration</p>
                <p className="text-2xl font-bold">{formatDuration(analyticsData.averageDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Running</p>
                <p className="text-2xl font-bold">{analyticsData.runningJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(analyticsData.jobsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{type}</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(count / analyticsData.totalJobs) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Jobs by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{analyticsData.completedJobs}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{analyticsData.failedJobs}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{analyticsData.runningJobs}</div>
              <div className="text-sm text-gray-600">Running</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {analyticsData.totalJobs - analyticsData.completedJobs - analyticsData.failedJobs - analyticsData.runningJobs}
              </div>
              <div className="text-sm text-gray-600">Other</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trends (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analyticsData.recentTrends.map((trend) => (
              <div key={trend.date} className="flex items-center justify-between p-2 border rounded">
                <div className="text-sm font-medium">
                  {new Date(trend.date).toLocaleDateString()}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">{trend.completed}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm">{trend.failed}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">{trend.running}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
