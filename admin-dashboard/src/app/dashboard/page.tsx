'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLayout } from '@/components/layout/page-layout';
import { apiClient, setAccessToken, clearAccessToken, type ModuleData, type DashboardSummary } from '@/lib/api';

export default function DashboardPage() {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }
    setAccessToken(token);

    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const summary = await apiClient.getDashboardSummary();
        setModules(summary.modules);
        setSystemHealth(summary.systemHealth);
      } catch (error: any) {
        console.error('Failed to fetch dashboard data:', error);
        
        // Handle authentication errors
        if (error?.response?.status === 401) {
          console.log('Authentication expired, redirecting to login');
          localStorage.removeItem('adminToken');
          clearAccessToken();
          router.push('/login');
          return;
        }
        
        // Fallback to empty state for other errors
        setModules([]);
        setSystemHealth(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  const getStatusBadge = (status: ModuleData['syncStatus']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  const handleSync = async (moduleName: string) => {
    try {
      setSyncLoading(moduleName);
      
      // Map module names to API endpoints
      const moduleMap: Record<string, string> = {
        'Quran': 'quran',
        'Hadith': 'hadith',
        'Prayer Times': 'prayer',
        'Zakat': 'zakat',
        'Audio': 'audio',
        'Finance': 'finance',
      };
      
      const apiModule = moduleMap[moduleName] || moduleName.toLowerCase();
      console.log('Triggering sync for module:', apiModule);
      
      const result = await apiClient.triggerModuleSync(apiModule);
      console.log('Sync result:', result);

      // Poll dashboard summary until this module finishes syncing
      const startTime = Date.now();
      const timeoutMs = 5 * 60 * 1000; // 5 minutes
      const pollIntervalMs = 2000; // 2s

      const hasCompleted = (m: ModuleData | undefined) => {
        if (!m) return false;
        // Consider completed if status is not pending and lastSync is set/updated
        const notPending = m.syncStatus !== 'pending';
        const lastSyncOk = m.lastSync ? new Date(m.lastSync).getTime() >= startTime : false;
        return notPending || lastSyncOk;
      };

      let completed = false;
      while (!completed && Date.now() - startTime < timeoutMs) {
        const summary = await apiClient.getDashboardSummary();
        const target = summary.modules.find((m) => m.name === moduleName);
        if (hasCompleted(target)) {
          setModules(summary.modules);
          setSystemHealth(summary.systemHealth);
          completed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
      if (!completed) {
        // Final refresh even if timed out
        const summary = await apiClient.getDashboardSummary();
        setModules(summary.modules);
        setSystemHealth(summary.systemHealth);
      }
    } catch (error) {
      console.error('Failed to trigger sync:', error);
    } finally {
      setSyncLoading(null);
    }
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    return new Date(lastSync).toLocaleString();
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">DeenMate Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor and manage your Islamic content modules</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <Card key={module.name} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{module.name}</CardTitle>
                {getStatusBadge(module.syncStatus)}
              </div>
              <CardDescription>
                {module.isHealthy ? 'Healthy' : 'Issues detected'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Records</p>
                  <p className="font-semibold">{module.recordCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Last Sync</p>
                  <p className="font-semibold text-xs">{formatLastSync(module.lastSync)}</p>
                </div>
              </div>
              
              <Button 
                onClick={() => handleSync(module.name)}
                disabled={syncLoading === module.name || module.syncStatus === 'pending'}
                className="w-full"
                variant={module.syncStatus === 'failed' ? 'destructive' : 'default'}
              >
                {syncLoading === module.name ? 'Syncing...' : 'Sync Now'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Health Overview */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Overall system status and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {modules.filter(m => m.isHealthy).length}
              </p>
              <p className="text-sm text-gray-600">Healthy Modules</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {modules.filter(m => !m.isHealthy).length}
              </p>
              <p className="text-sm text-gray-600">Issues</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {modules.reduce((sum, m) => sum + m.recordCount, 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Records</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">
                {systemHealth ? `${Math.round(systemHealth.uptime / 3600)}h` : 'N/A'}
              </p>
              <p className="text-sm text-gray-600">Uptime</p>
            </div>
          </div>
          
          {systemHealth && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">System Status</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Database</p>
                  <p className={systemHealth.isHealthy ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
                    {systemHealth.isHealthy ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Memory Usage</p>
                  <p className="font-semibold">
                    {Math.round(systemHealth.memoryUsage.heapUsed / 1024 / 1024)}MB
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Total Memory</p>
                  <p className="font-semibold">
                    {Math.round(systemHealth.memoryUsage.heapTotal / 1024 / 1024)}MB
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className={systemHealth.isHealthy ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
                    {systemHealth.isHealthy ? 'Healthy' : 'Unhealthy'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}