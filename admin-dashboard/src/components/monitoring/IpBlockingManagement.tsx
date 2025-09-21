'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Shield, ShieldOff, RefreshCw, AlertTriangle, Clock, User } from 'lucide-react';
import { apiMonitoringApi, BlockIpDto } from '@/lib/api-monitoring-api';

interface IpBlockingRule {
  id: number;
  ipAddress: string;
  reason?: string;
  blockedBy: string;
  blockedAt: string;
  expiresAt?: string;
  enabled: boolean;
}

interface ClientIpStat {
  id: number;
  ipAddress: string;
  requestCount: number;
  errorCount: number;
  lastRequest: string;
  blocked: boolean;
  blockReason?: string;
  blockedAt?: string;
  unblockedAt?: string;
}

export function IpBlockingManagement() {
  const [blockingRules, setBlockingRules] = useState<IpBlockingRule[]>([]);
  const [clientStats, setClientStats] = useState<ClientIpStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [formData, setFormData] = useState<BlockIpDto>({
    ipAddress: '',
    reason: '',
    blockedBy: 'admin',
    expiresAt: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesResponse, statsResponse] = await Promise.all([
        apiMonitoringApi.getIpBlockingRules(),
        apiMonitoringApi.getClientIpStats({ blocked: true, limit: 50 }),
      ]);

      if (rulesResponse.success) {
        setBlockingRules(rulesResponse.data);
      }
      if (statsResponse.success) {
        setClientStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching IP blocking data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBlockIp = async () => {
    try {
      const response = await apiMonitoringApi.blockIp(formData);
      if (response.success) {
        await fetchData();
        setIsBlockDialogOpen(false);
        setFormData({
          ipAddress: '',
          reason: '',
          blockedBy: 'admin',
          expiresAt: '',
        });
      }
    } catch (error) {
      console.error('Error blocking IP:', error);
    }
  };

  const handleUnblockIp = async (ipAddress: string) => {
    if (confirm(`Are you sure you want to unblock IP ${ipAddress}?`)) {
      try {
        const response = await apiMonitoringApi.unblockIp(ipAddress);
        if (response.success) {
          await fetchData();
        }
      } catch (error) {
        console.error('Error unblocking IP:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getBlockStatus = (rule: IpBlockingRule) => {
    if (!rule.enabled) return { status: 'Unblocked', color: 'bg-gray-500' };
    if (isExpired(rule.expiresAt)) return { status: 'Expired', color: 'bg-yellow-500' };
    return { status: 'Blocked', color: 'bg-red-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading IP blocking data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">IP Blocking Management</h2>
          <p className="text-gray-600">Manage blocked IP addresses and monitor client activity</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Block IP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block IP Address</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="192.168.1.1"
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Input
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Suspicious activity, abuse, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="blockedBy">Blocked By</Label>
                  <Input
                    id="blockedBy"
                    value={formData.blockedBy}
                    onChange={(e) => setFormData({ ...formData, blockedBy: e.target.value })}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <Label htmlFor="expiresAt">Expires At (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleBlockIp}>Block IP</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Blocked IPs</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockingRules.length}</div>
            <p className="text-xs text-muted-foreground">
              Active blocking rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Blocks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {blockingRules.filter(rule => rule.enabled && !isExpired(rule.expiresAt)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired Blocks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {blockingRules.filter(rule => isExpired(rule.expiresAt)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-expired
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Blocking Rules */}
      <Card>
        <CardHeader>
          <CardTitle>IP Blocking Rules ({blockingRules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {blockingRules.map((rule) => {
              const blockStatus = getBlockStatus(rule);
              return (
                <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Badge className={blockStatus.color}>
                      {blockStatus.status}
                    </Badge>
                    <div>
                      <div className="font-mono text-sm">{rule.ipAddress}</div>
                      <div className="text-sm text-gray-500">
                        {rule.reason && `Reason: ${rule.reason}`}
                        {rule.expiresAt && ` • Expires: ${formatDate(rule.expiresAt)}`}
                      </div>
                      <div className="text-xs text-gray-400">
                        Blocked by {rule.blockedBy} on {formatDate(rule.blockedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {rule.enabled && !isExpired(rule.expiresAt) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblockIp(rule.ipAddress)}
                      >
                        <ShieldOff className="h-4 w-4 mr-1" />
                        Unblock
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {blockingRules.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No IP addresses are currently blocked.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client IP Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Client IP Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {clientStats.map((stat) => (
              <div key={stat.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Badge variant={stat.blocked ? 'destructive' : 'default'}>
                    {stat.blocked ? 'Blocked' : 'Active'}
                  </Badge>
                  <div>
                    <div className="font-mono text-sm">{stat.ipAddress}</div>
                    <div className="text-sm text-gray-500">
                      {stat.requestCount} requests • {stat.errorCount} errors
                    </div>
                    <div className="text-xs text-gray-400">
                      Last request: {formatDate(stat.lastRequest)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-right">
                    <div className="font-semibold">{stat.requestCount}</div>
                    <div className="text-gray-500">requests</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">{stat.errorCount}</div>
                    <div className="text-gray-500">errors</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {stat.requestCount > 0 ? ((stat.errorCount / stat.requestCount) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-gray-500">error rate</div>
                  </div>
                </div>
              </div>
            ))}
            {clientStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No client IP statistics available.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
