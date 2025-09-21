'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, RefreshCw, Settings } from 'lucide-react';
import { apiMonitoringApi, CreateRateLimitRuleDto, UpdateRateLimitRuleDto } from '@/lib/api-monitoring-api';

interface RateLimitRule {
  id: number;
  endpoint: string;
  method?: string;
  limitCount: number;
  windowSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function RateLimitManagement() {
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RateLimitRule | null>(null);
  const [formData, setFormData] = useState<CreateRateLimitRuleDto>({
    endpoint: '',
    method: 'ALL',
    limitCount: 100,
    windowSeconds: 3600,
    enabled: true,
  });

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await apiMonitoringApi.getRateLimitRules();
      if (response.success) {
        setRules(response.data);
      }
    } catch (error) {
      console.error('Error fetching rate limit rules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreateRule = async () => {
    try {
      const response = await apiMonitoringApi.createRateLimitRule(formData);
      if (response.success) {
        await fetchRules();
        setIsCreateDialogOpen(false);
        setFormData({
          endpoint: '',
          method: 'ALL',
          limitCount: 100,
          windowSeconds: 3600,
          enabled: true,
        });
      }
    } catch (error) {
      console.error('Error creating rate limit rule:', error);
    }
  };

  const handleUpdateRule = async (id: number, updates: UpdateRateLimitRuleDto) => {
    try {
      const response = await apiMonitoringApi.updateRateLimitRule(id, updates);
      if (response.success) {
        await fetchRules();
        setEditingRule(null);
      }
    } catch (error) {
      console.error('Error updating rate limit rule:', error);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (confirm('Are you sure you want to delete this rate limit rule?')) {
      try {
        const response = await apiMonitoringApi.deleteRateLimitRule(id);
        if (response.success) {
          await fetchRules();
        }
      } catch (error) {
        console.error('Error deleting rate limit rule:', error);
      }
    }
  };

  const toggleRule = async (rule: RateLimitRule) => {
    await handleUpdateRule(rule.id, { enabled: !rule.enabled });
  };

  const formatWindow = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-500';
      case 'POST': return 'bg-blue-500';
      case 'PUT': return 'bg-yellow-500';
      case 'DELETE': return 'bg-red-500';
      case 'ALL': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading rate limit rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Rate Limit Management</h2>
          <p className="text-gray-600">Configure and manage API rate limiting rules</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={fetchRules} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Rate Limit Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="endpoint">Endpoint Pattern</Label>
                  <Input
                    id="endpoint"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    placeholder="/api/v4/example/*"
                  />
                </div>
                <div>
                  <Label htmlFor="method">HTTP Method</Label>
                  <select
                    id="method"
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Methods</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="limitCount">Request Limit</Label>
                  <Input
                    id="limitCount"
                    type="number"
                    value={formData.limitCount}
                    onChange={(e) => setFormData({ ...formData, limitCount: parseInt(e.target.value) })}
                    min="1"
                    max="10000"
                  />
                </div>
                <div>
                  <Label htmlFor="windowSeconds">Time Window (seconds)</Label>
                  <Input
                    id="windowSeconds"
                    type="number"
                    value={formData.windowSeconds}
                    onChange={(e) => setFormData({ ...formData, windowSeconds: parseInt(e.target.value) })}
                    min="1"
                    max="86400"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRule}>Create Rule</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Rules ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleRule(rule)}
                    />
                    <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getMethodColor(rule.method || 'ALL')}>
                        {rule.method || 'ALL'}
                      </Badge>
                      <code className="text-sm font-mono">{rule.endpoint}</code>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {rule.limitCount} requests per {formatWindow(rule.windowSeconds)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No rate limit rules configured. Create your first rule to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingRule && (
        <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Rate Limit Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Endpoint Pattern</Label>
                <Input value={editingRule.endpoint} disabled />
              </div>
              <div>
                <Label>HTTP Method</Label>
                <Input value={editingRule.method || 'ALL'} disabled />
              </div>
              <div>
                <Label htmlFor="edit-limitCount">Request Limit</Label>
                <Input
                  id="edit-limitCount"
                  type="number"
                  value={editingRule.limitCount}
                  onChange={(e) => setEditingRule({ ...editingRule, limitCount: parseInt(e.target.value) })}
                  min="1"
                  max="10000"
                />
              </div>
              <div>
                <Label htmlFor="edit-windowSeconds">Time Window (seconds)</Label>
                <Input
                  id="edit-windowSeconds"
                  type="number"
                  value={editingRule.windowSeconds}
                  onChange={(e) => setEditingRule({ ...editingRule, windowSeconds: parseInt(e.target.value) })}
                  min="1"
                  max="86400"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingRule.enabled}
                  onCheckedChange={(checked) => setEditingRule({ ...editingRule, enabled: checked })}
                />
                <Label>Enabled</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingRule(null)}>
                  Cancel
                </Button>
                <Button onClick={() => handleUpdateRule(editingRule.id, {
                  limitCount: editingRule.limitCount,
                  windowSeconds: editingRule.windowSeconds,
                  enabled: editingRule.enabled,
                })}>
                  Update Rule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
