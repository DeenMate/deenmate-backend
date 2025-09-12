'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageLayout } from '@/components/layout/page-layout';
import { apiClient, type AuditLog } from '@/lib/api';
import { Search, Shield, Eye, Clock, User, Activity, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SecurityPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [activeTab, setActiveTab] = useState('audit');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [auditLogs, searchTerm, actionFilter, resourceFilter, userFilter]);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getAuditLogs({ limit: 100 });
      setAuditLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...auditLogs];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.method?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply action filter
    if (actionFilter && actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Apply resource filter
    if (resourceFilter && resourceFilter !== 'all') {
      filtered = filtered.filter(log => log.resource === resourceFilter);
    }

    // Apply user filter
    if (userFilter) {
      filtered = filtered.filter(log => log.user.email === userFilter);
    }

    setFilteredLogs(filtered);
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, string> = {
      CREATE: 'default',
      READ: 'secondary',
      UPDATE: 'outline',
      DELETE: 'destructive',
      LOGIN: 'default',
      LOGOUT: 'secondary',
      SYNC: 'outline',
      CHANGE_PASSWORD: 'destructive',
      RESET_PASSWORD: 'destructive',
    };

    return (
      <Badge variant={variants[action] as any} className="text-xs">
        {action}
      </Badge>
    );
  };

  const getResourceBadge = (resource: string) => {
    const colors: Record<string, string> = {
      user: 'bg-blue-100 text-blue-800',
      quran: 'bg-green-100 text-green-800',
      hadith: 'bg-purple-100 text-purple-800',
      prayer: 'bg-yellow-100 text-yellow-800',
      finance: 'bg-orange-100 text-orange-800',
      audio: 'bg-pink-100 text-pink-800',
      system: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={`text-xs ${colors[resource] || 'bg-gray-100 text-gray-800'}`}>
        {resource}
      </Badge>
    );
  };

  const getSecurityStats = () => {
    const totalLogs = auditLogs.length;
    const loginAttempts = auditLogs.filter(log => log.action === 'LOGIN').length;
    const failedLogins = auditLogs.filter(log => 
      log.action === 'LOGIN' && log.details?.statusCode >= 400
    ).length;
    const adminActions = auditLogs.filter(log => 
      ['CREATE', 'UPDATE', 'DELETE'].includes(log.action)
    ).length;
    const uniqueUsers = new Set(auditLogs.map(log => log.user.email)).size;

    return {
      totalLogs,
      loginAttempts,
      failedLogins,
      adminActions,
      uniqueUsers,
    };
  };

  const stats = getSecurityStats();

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading security data...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor security events, audit logs, and system access</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="overview">Security Overview</TabsTrigger>
            <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-6">
            {/* Security Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Total Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLogs}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Login Attempts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.loginAttempts}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Failed Logins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.failedLogins}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Admin Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.adminActions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Active Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.uniqueUsers}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Monitor all admin actions and security events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="LOGIN">Login</SelectItem>
                      <SelectItem value="LOGOUT">Logout</SelectItem>
                      <SelectItem value="CREATE">Create</SelectItem>
                      <SelectItem value="READ">Read</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="DELETE">Delete</SelectItem>
                      <SelectItem value="SYNC">Sync</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={resourceFilter} onValueChange={setResourceFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Resources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="quran">Quran</SelectItem>
                      <SelectItem value="hadith">Hadith</SelectItem>
                      <SelectItem value="prayer">Prayer</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Audit Logs Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Timestamp</th>
                        <th className="text-left p-3 font-semibold">User</th>
                        <th className="text-left p-3 font-semibold">Action</th>
                        <th className="text-left p-3 font-semibold">Resource</th>
                        <th className="text-left p-3 font-semibold">Details</th>
                        <th className="text-left p-3 font-semibold">IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1 text-gray-400" />
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{log.user.email}</div>
                            {log.user.firstName && (
                              <div className="text-xs text-gray-500">
                                {log.user.firstName} {log.user.lastName}
                              </div>
                            )}
                          </td>
                          <td className="p-3">{getActionBadge(log.action)}</td>
                          <td className="p-3">{getResourceBadge(log.resource)}</td>
                          <td className="p-3 text-sm">
                            {log.details?.method && (
                              <div>
                                <div className="font-medium">{log.details.method} {log.details.url}</div>
                                {log.details.statusCode && (
                                  <Badge 
                                    variant={log.details.statusCode >= 400 ? 'destructive' : 'default'}
                                    className="text-xs mt-1"
                                  >
                                    {log.details.statusCode}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-sm text-gray-500">
                            {log.ipAddress || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No audit logs found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Security Events</CardTitle>
                  <CardDescription>Latest security-related activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {auditLogs
                      .filter(log => ['LOGIN', 'LOGOUT', 'CHANGE_PASSWORD', 'RESET_PASSWORD'].includes(log.action))
                      .slice(0, 5)
                      .map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">{log.action}</div>
                            <div className="text-xs text-gray-500">{log.user.email}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                            {getActionBadge(log.action)}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Current security status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Failed Login Rate</span>
                      <Badge variant={stats.failedLogins > stats.loginAttempts * 0.1 ? 'destructive' : 'default'}>
                        {stats.loginAttempts > 0 ? Math.round((stats.failedLogins / stats.loginAttempts) * 100) : 0}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active Sessions</span>
                      <Badge variant="default">{stats.uniqueUsers}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Admin Actions (24h)</span>
                      <Badge variant="secondary">{stats.adminActions}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Security Status</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Secure
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>Important security notifications and warnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No security alerts at this time</p>
                  <p className="text-sm">All systems are operating normally</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </PageLayout>
  );
}
