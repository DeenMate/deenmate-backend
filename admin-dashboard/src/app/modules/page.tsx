'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLayout } from '@/components/layout/page-layout';
import { ModuleDetailModal } from '@/components/modules/ModuleDetailModal';
import { DataEditor } from '@/components/content/DataEditor';
import { apiClient, type ModuleData } from '@/lib/api';

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [manageTab, setManageTab] = useState<null | 'manage'>(null);
  const [showDataEditor, setShowDataEditor] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        setIsLoading(true);
        const summary = await apiClient.getDashboardSummary();
        setModules(summary.modules);
      } catch (error) {
        console.error('Failed to fetch modules:', error);
        setModules([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModules();
  }, []);

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
            <p className="text-gray-600">Loading modules...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Module Management</h1>
          <p className="text-gray-600 mt-2">Detailed view and management of each module</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                {/* Module-specific details */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(module.details).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-gray-600 capitalize">{key}:</span>
                        <span className="font-semibold ml-1">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setSelectedModule(module.name);
                      setManageTab('manage');
                      setShowDataEditor(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Manage Content
                  </Button>
                  <Button 
                    onClick={async () => {
                      try {
                        setSyncing(module.name);
                        await apiClient.triggerModuleSync(module.name.toLowerCase());

                        // Poll until the module finishes syncing or timeout
                        const startTime = Date.now();
                        const timeoutMs = 5 * 60 * 1000; // 5 minutes
                        const pollIntervalMs = 2000; // 2s

                        const hasCompleted = (m: ModuleData | undefined) => {
                          if (!m) return false;
                          const notPending = m.syncStatus !== 'pending';
                          const lastSyncOk = m.lastSync ? new Date(m.lastSync).getTime() >= startTime : false;
                          return notPending || lastSyncOk;
                        };

                        let completed = false;
                        while (!completed && Date.now() - startTime < timeoutMs) {
                          const summary = await apiClient.getDashboardSummary();
                          const target = summary.modules.find((m) => m.name === module.name);
                          if (hasCompleted(target)) {
                            setModules(summary.modules);
                            completed = true;
                            break;
                          }
                          await new Promise((r) => setTimeout(r, pollIntervalMs));
                        }
                        if (!completed) {
                          const summary = await apiClient.getDashboardSummary();
                          setModules(summary.modules);
                        }
                      } catch (error) {
                        console.error('Sync failed:', error);
                      } finally {
                        setSyncing(null);
                      }
                    }}
                    variant="default"
                    size="sm"
                    className="flex-1"
                    disabled={syncing === module.name}
                  >
                    {syncing === module.name ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Module Detail Modal */}
        {/* Restore original content management modal */}
        <DataEditor
          moduleName={selectedModule || ''}
          isOpen={showDataEditor}
          onClose={() => {
            setShowDataEditor(false);
            setSelectedModule(null);
            setManageTab(null);
          }}
          onSave={async () => {
            try {
              const summary = await apiClient.getDashboardSummary();
              setModules(summary.modules);
            } catch (error) {
              console.error('Failed to refresh modules:', error);
            }
          }}
        />
    </PageLayout>
  );
}
