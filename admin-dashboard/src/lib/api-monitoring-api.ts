import { apiClient } from './api';

// Types for API monitoring
export interface ApiMonitoringFilters {
  startDate?: string;
  endDate?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  limit?: number;
  offset?: number;
}

export interface IpStatsFilters {
  blocked?: boolean;
  limit?: number;
  offset?: number;
}

export interface ApiRequestLogFilters {
  startDate?: string;
  endDate?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestIp?: string;
  limit?: number;
  offset?: number;
}

export interface CreateRateLimitRuleDto {
  endpoint: string;
  method?: string;
  limitCount: number;
  windowSeconds: number;
  enabled?: boolean;
}

export interface UpdateRateLimitRuleDto {
  method?: string;
  limitCount?: number;
  windowSeconds?: number;
  enabled?: boolean;
}

export interface BlockIpDto {
  ipAddress: string;
  reason?: string;
  blockedBy: string;
  expiresAt?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
  error?: string;
}

export const apiMonitoringApi = {
  // API monitoring
  getEndpointStats: (filters?: ApiMonitoringFilters): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/stats', { params: filters }),

  getClientIpStats: (filters?: IpStatsFilters): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/ips', { params: filters }),

  getApiRequestLogs: (filters?: ApiRequestLogFilters): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/logs', { params: filters }),

  getApiAnalytics: (timeRange: string = '24h'): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/analytics', { params: { timeRange } }),

  getTopEndpoints: (limit?: number): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/top-endpoints', { params: { limit } }),

  getErrorRates: (timeRange: string = '24h'): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/error-rates', { params: { timeRange } }),

  // Rate limiting management
  getRateLimitRules: (): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/rate-limits'),

  createRateLimitRule: (rule: CreateRateLimitRuleDto): Promise<ApiResponse> =>
    apiClient.post('/admin/monitoring/api/rate-limits', rule),

  updateRateLimitRule: (id: number, rule: UpdateRateLimitRuleDto): Promise<ApiResponse> =>
    apiClient.put(`/admin/monitoring/api/rate-limits/${id}`, rule),

  deleteRateLimitRule: (id: number): Promise<ApiResponse> =>
    apiClient.delete(`/admin/monitoring/api/rate-limits/${id}`),

  // IP blocking management
  getIpBlockingRules: (): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/ip-blocking'),

  blockIp: (blockData: BlockIpDto): Promise<ApiResponse> =>
    apiClient.post('/admin/monitoring/api/ip-blocking', blockData),

  unblockIp: (ipAddress: string): Promise<ApiResponse> =>
    apiClient.delete(`/admin/monitoring/api/ip-blocking/${ipAddress}`),

  getIpStats: (ipAddress: string): Promise<ApiResponse> =>
    apiClient.get(`/admin/monitoring/api/ip-blocking/${ipAddress}/stats`),

  getTopBlockedIps: (limit?: number): Promise<ApiResponse> =>
    apiClient.get('/admin/monitoring/api/ip-blocking/top-blocked', { params: { limit } }),

  getBlockingHistory: (ipAddress: string): Promise<ApiResponse> =>
    apiClient.get(`/admin/monitoring/api/ip-blocking/${ipAddress}/history`),
};
