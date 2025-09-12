'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { apiClient } from '@/lib/api';

interface SyncLog {
  id: string;
  jobName: string;
  startedAt: string;
  completedAt?: string;
  status: 'success' | 'failed' | 'running';
  message?: string;
}

export default function MonitoringPage() {
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMonitoringData = async () => {
      try {
        setIsLoading(true);
        const [health, logs] = await Promise.all([
          apiClient.getSystemHealth(),
          apiClient.getSyncLogs(20)
        ]);
        setSystemHealth(health);
        setSyncLogs(logs);
      } catch (error) {
        console.error('Failed to fetch monitoring data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMonitoringData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'ok':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'failed':
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading monitoring data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-gray-600 mt-2">Real-time system health and performance metrics</p>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {systemHealth ? getStatusBadge(systemHealth.status) : <Badge variant="outline">Unknown</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {systemHealth ? formatUptime(systemHealth.uptime) : 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {systemHealth ? getStatusBadge(systemHealth.checks?.database || 'unknown') : <Badge variant="outline">Unknown</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Redis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {systemHealth ? getStatusBadge(systemHealth.checks?.redis || 'unknown') : <Badge variant="outline">Unknown</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Resources */}
          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
              <CardDescription>Memory and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {systemHealth ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Memory Usage</span>
                    <span className="font-semibold">
                      {formatMemory(systemHealth.memoryUsage?.heapUsed || 0)} / {formatMemory(systemHealth.memoryUsage?.heapTotal || 0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: `${((systemHealth.memoryUsage?.heapUsed || 0) / (systemHealth.memoryUsage?.heapTotal || 1)) * 100}%` 
                      }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">External Memory</p>
                      <p className="font-semibold">{formatMemory(systemHealth.memoryUsage?.external || 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">RSS Memory</p>
                      <p className="font-semibold">{formatMemory(systemHealth.memoryUsage?.rss || 0)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No system data available</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Sync Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Jobs</CardTitle>
              <CardDescription>Latest synchronization activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncLogs.length > 0 ? (
                  syncLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{log.jobName}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(log.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(log.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No sync logs available</p>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {/* TODO: Navigate to full logs */}}
                >
                  View All Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const result = await apiClient.clearCache();
                    alert(result.message);
                  } catch (error) {
                    alert('Failed to clear cache');
                  }
                }}
              >
                Clear Cache
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  // Refresh monitoring data
                  window.location.reload();
                }}
              >
                Refresh Data
              </Button>
              <Button 
                variant="outline"
                onClick={() => {/* TODO: Export logs */}}
              >
                Export Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
