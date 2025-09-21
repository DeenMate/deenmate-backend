'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';

interface SystemHealthPanelProps {
  systemHealth: any;
  syncLogs: any[];
  getStatusBadge: (status: string) => React.ReactNode;
  formatUptime: (seconds: number) => string;
  formatMemory: (bytes: number) => string;
}

export function SystemHealthPanel({ 
  systemHealth, 
  syncLogs, 
  getStatusBadge, 
  formatUptime, 
  formatMemory 
}: SystemHealthPanelProps) {
  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <Card>
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
  );
}
