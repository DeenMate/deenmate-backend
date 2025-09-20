'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { jobControlApi } from '@/lib/job-control-api';
import { JobSchedule } from '@/lib/job-control-api';
import { Clock, Play, Pause, Settings, Save, RefreshCw } from 'lucide-react';

interface JobScheduleManagerProps {
  refreshInterval?: number;
}

const cronPresets = {
  'Every 5 minutes': '*/5 * * * *',
  'Every 15 minutes': '*/15 * * * *',
  'Every 30 minutes': '*/30 * * * *',
  'Every hour': '0 * * * *',
  'Every 6 hours': '0 */6 * * *',
  'Every 12 hours': '0 */12 * * *',
  'Daily at 3 AM': '0 3 * * *',
  'Daily at 6 AM': '0 6 * * *',
  'Daily at midnight': '0 0 * * *',
  'Weekly on Sunday': '0 2 * * 0',
  'Weekly on Monday': '0 2 * * 1',
  'Monthly on 1st': '0 2 1 * *',
};

export function JobScheduleManager({ refreshInterval = 30000 }: JobScheduleManagerProps) {
  const [schedules, setSchedules] = useState<JobSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<JobSchedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const response = await jobControlApi.getJobSchedules();
      setSchedules(response.data);
    } catch (error) {
      console.error('Failed to fetch job schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    const interval = setInterval(fetchSchedules, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleToggleSchedule = async (jobType: string, enabled: boolean) => {
    try {
      const result = await jobControlApi.toggleJobSchedule(jobType, enabled);
      if (result.success) {
        await fetchSchedules();
      } else {
        alert(`Failed to toggle schedule: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      alert('Failed to toggle schedule');
    }
  };

  const handleUpdateSchedule = async (jobType: string, updates: Partial<JobSchedule>) => {
    try {
      setIsSaving(true);
      const result = await jobControlApi.updateJobSchedule(jobType, updates);
      if (result.success) {
        await fetchSchedules();
        setEditingSchedule(null);
      } else {
        alert(`Failed to update schedule: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to update schedule:', error);
      alert('Failed to update schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCronExpression = (cron: string) => {
    const preset = Object.entries(cronPresets).find(([_, value]) => value === cron);
    return preset ? preset[0] : cron;
  };

  const getJobTypeDisplayName = (jobType: string) => {
    const displayNames: Record<string, string> = {
      quran: 'Quran Data',
      prayer: 'Prayer Times',
      hadith: 'Hadith Collection',
      audio: 'Audio Files',
      finance: 'Finance Data',
    };
    return displayNames[jobType] || jobType;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Schedules</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedules...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Job Schedules</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSchedules}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Concurrency</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.jobType}>
                <TableCell className="font-medium">
                  {getJobTypeDisplayName(schedule.jobType)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {schedule.enabled ? (
                      <Badge className="bg-green-500">
                        <Play className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100">
                        <Pause className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {schedule.cronExpression ? formatCronExpression(schedule.cronExpression) : 'Manual'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {schedule.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{schedule.maxConcurrency}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(enabled) => handleToggleSchedule(schedule.jobType, enabled)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSchedule(schedule)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Edit Schedule Modal */}
        {editingSchedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Edit Schedule - {getJobTypeDisplayName(editingSchedule.jobType)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="enabled">Enabled</Label>
                  <Switch
                    id="enabled"
                    checked={editingSchedule.enabled}
                    onCheckedChange={(enabled) => 
                      setEditingSchedule({ ...editingSchedule, enabled })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cron">Cron Expression</Label>
                  <Select
                    value={editingSchedule.cronExpression || ''}
                    onValueChange={(value) => 
                      setEditingSchedule({ ...editingSchedule, cronExpression: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(cronPresets).map(([label, value]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="10"
                    value={editingSchedule.priority}
                    onChange={(e) => 
                      setEditingSchedule({ ...editingSchedule, priority: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="concurrency">Max Concurrency</Label>
                  <Input
                    id="concurrency"
                    type="number"
                    min="1"
                    value={editingSchedule.maxConcurrency}
                    onChange={(e) => 
                      setEditingSchedule({ ...editingSchedule, maxConcurrency: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (minutes)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="1"
                    value={editingSchedule.timeoutMinutes}
                    onChange={(e) => 
                      setEditingSchedule({ ...editingSchedule, timeoutMinutes: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retries">Retry Attempts</Label>
                  <Input
                    id="retries"
                    type="number"
                    min="0"
                    value={editingSchedule.retryAttempts}
                    onChange={(e) => 
                      setEditingSchedule({ ...editingSchedule, retryAttempts: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleUpdateSchedule(editingSchedule.jobType, editingSchedule)}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingSchedule(null)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
