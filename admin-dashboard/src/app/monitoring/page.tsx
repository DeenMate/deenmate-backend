'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { apiClient } from '@/lib/api';
import { JobControlPanel } from '@/components/job-control/JobControlPanel';
import { ApiMonitoringDashboard } from '@/components/monitoring/ApiMonitoringDashboard';
import { RateLimitManagement } from '@/components/monitoring/RateLimitManagement';
import { IpBlockingManagement } from '@/components/monitoring/IpBlockingManagement';
import { ApiAnalytics } from '@/components/monitoring/ApiAnalytics';
import { SystemHealthPanel } from '@/components/monitoring/SystemHealthPanel';

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
  const [activeTab, setActiveTab] = useState('system');

  const tabs = [
    { 
      id: 'system', 
      label: 'System Health', 
      component: () => (
        <SystemHealthPanel 
          systemHealth={systemHealth}
          syncLogs={syncLogs}
          getStatusBadge={getStatusBadge}
          formatUptime={formatUptime}
          formatMemory={formatMemory}
        />
      )
    },
    { id: 'jobs', label: 'Job Control', component: JobControlPanel },
    { id: 'api', label: 'API Monitoring', component: ApiMonitoringDashboard },
    { id: 'rate-limits', label: 'Rate Limits', component: RateLimitManagement },
    { id: 'ip-blocking', label: 'IP Blocking', component: IpBlockingManagement },
    { id: 'analytics', label: 'Analytics', component: ApiAnalytics },
  ];

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

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-gray-600 mt-2">Real-time system health and performance metrics</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  );
}
