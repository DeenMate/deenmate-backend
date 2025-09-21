export interface ApiRequestLog {
  id?: number;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  requestIp: string;
  userAgent?: string;
  timestamp?: Date;
  userId?: number;
  metadata?: any;
}

export interface ApiEndpointStat {
  id?: number;
  endpoint: string;
  method: string;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  lastUpdated?: Date;
}

export interface ClientIpStat {
  id?: number;
  ipAddress: string;
  requestCount: number;
  errorCount: number;
  lastRequest?: Date;
  blocked: boolean;
  blockReason?: string;
  blockedAt?: Date;
  unblockedAt?: Date;
  geoIpInfo?: any;
}

export interface ApiMonitoringFilters {
  startDate?: Date;
  endDate?: Date;
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
  startDate?: Date;
  endDate?: Date;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestIp?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedApiLogs {
  logs: ApiRequestLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiAnalytics {
  totalRequests: number;
  totalErrors: number;
  avgLatency: number;
  errorRate: number;
  topEndpoints: TopEndpoint[];
  errorRates: ErrorRate[];
  requestTrends: RequestTrend[];
}

export interface TopEndpoint {
  endpoint: string;
  method: string;
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  errorRate: number;
}

export interface ErrorRate {
  statusCode: number;
  count: number;
  percentage: number;
}

export interface RequestTrend {
  date: string;
  requests: number;
  errors: number;
  avgLatency: number;
}
