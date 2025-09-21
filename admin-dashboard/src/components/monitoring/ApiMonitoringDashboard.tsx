'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, AlertTriangle, Clock, Users, Globe } from 'lucide-react';
import { apiMonitoringApi } from '@/lib/api-monitoring-api';

interface ApiAnalytics {
  totalRequests: number;
  totalErrors: number;
  avgLatency: number;
  errorRate: number;
  topEndpoints: TopEndpoint[];
  errorRates: ErrorRate[];
  requestTrends: RequestTrend[];
}

interface TopEndpoint {
  endpoint: string;
  method: string;
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  errorRate: number;
}

interface ErrorRate {
  statusCode: number;
  count: number;
  percentage: number;
}

interface RequestTrend {
  date: string;
  requests: number;
  errors: number;
  avgLatency: number;
}

export function ApiMonitoringDashboard() {
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiMonitoringApi.getApiAnalytics(timeRange);
      if (response.success) {
        setAnalytics(response.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching API analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  const getStatusColor = (errorRate: number) => {
    if (errorRate < 1) return 'bg-green-500';
    if (errorRate < 5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading API analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Monitoring Dashboard</h2>
          <p className="text-gray-600">Real-time API performance and analytics</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button onClick={fetchAnalytics} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? formatNumber(analytics.totalRequests) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? `${analytics.errorRate.toFixed(2)}%` : '0%'}
            </div>
            <div className="flex items-center mt-1">
              <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(analytics?.errorRate || 0)}`} />
              <p className="text-xs text-muted-foreground">
                {analytics?.totalErrors || 0} errors
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? formatLatency(analytics.avgLatency) : '0ms'}
            </div>
            <p className="text-xs text-muted-foreground">
              Response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Endpoints</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.topEndpoints.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active endpoints
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Top Endpoints by Request Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.topEndpoints.slice(0, 10).map((endpoint, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Badge variant={endpoint.method === 'GET' ? 'default' : 'secondary'}>
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono">{endpoint.endpoint}</code>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-right">
                    <div className="font-semibold">{formatNumber(endpoint.requestCount)}</div>
                    <div className="text-gray-500">requests</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatLatency(endpoint.avgLatency)}</div>
                    <div className="text-gray-500">avg latency</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${endpoint.errorRate > 5 ? 'text-red-600' : endpoint.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {endpoint.errorRate.toFixed(2)}%
                    </div>
                    <div className="text-gray-500">error rate</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Rates by Status Code */}
      <Card>
        <CardHeader>
          <CardTitle>Error Distribution by Status Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics?.errorRates.map((error, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Badge variant="destructive">{error.statusCode}</Badge>
                  <span className="text-sm">
                    {error.statusCode === 400 && 'Bad Request'}
                    {error.statusCode === 401 && 'Unauthorized'}
                    {error.statusCode === 403 && 'Forbidden'}
                    {error.statusCode === 404 && 'Not Found'}
                    {error.statusCode === 429 && 'Rate Limited'}
                    {error.statusCode === 500 && 'Internal Server Error'}
                    {error.statusCode >= 500 && 'Server Error'}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-semibold">{error.count}</div>
                  <div className="text-sm text-gray-500">{error.percentage.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
