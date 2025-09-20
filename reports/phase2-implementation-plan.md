# 📊 Phase 2: API Monitoring & Security - Implementation Plan

**Phase**: 2 of 6  
**Priority**: High (P1)  
**Estimated Duration**: 5-7 days  
**Story Points**: 40/200  
**Status**: ⏳ **READY TO IMPLEMENT**

---

## 🎯 **Phase 2 Objectives**

Implement comprehensive API monitoring, rate limiting, and IP blocking capabilities to enhance the security and observability of the DeenMate platform. This phase will track API request metrics, enforce rate limits, and provide an administrative interface for managing IP blocking rules.

---

## 📋 **Current State Analysis**

### **✅ What's Already Working**
- **Basic Rate Limiting**: `RateLimitMiddleware` with Redis-based rate limiting for admin routes
- **Audit Logging**: `AuditLoggerMiddleware` for admin API requests with user tracking
- **Security Headers**: `SecurityHeadersMiddleware` for comprehensive security headers
- **Job Control System**: Complete Phase 1 implementation with real-time monitoring
- **Admin Authentication**: JWT-based authentication with role-based access control
- **Database Infrastructure**: PostgreSQL with Prisma ORM and existing audit tables
- **Redis Integration**: Redis service for caching and rate limiting
- **Frontend Monitoring**: Basic monitoring page with system health and sync logs
- **WebSocket Support**: Real-time updates infrastructure already in place

### **❌ What's Missing**
- **API Request Tracking**: No comprehensive API request logging and analytics
- **Advanced Rate Limiting**: Current rate limiting is basic and not configurable
- **IP Blocking System**: No IP blocking capabilities
- **API Performance Metrics**: No detailed API performance tracking
- **Client Analytics**: No client IP statistics and monitoring
- **Configurable Rate Limits**: No dynamic rate limit rule management
- **API Monitoring Dashboard**: No dedicated API monitoring interface
- **Request Analytics**: No API usage patterns and insights

---

## 🏗️ **Implementation Plan**

### **Step 1: Database Schema Enhancements**

#### **New Tables to Create**

```sql
-- API Request Logs (Detailed request tracking)
CREATE TABLE api_request_logs (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  request_ip VARCHAR(45) NOT NULL,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id INTEGER,
  metadata JSONB,
  response_size INTEGER DEFAULT 0,
  error_message TEXT
);

-- Aggregated API Endpoint Statistics (Performance metrics)
CREATE TABLE api_endpoint_stats (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms FLOAT DEFAULT 0,
  max_latency_ms INTEGER DEFAULT 0,
  min_latency_ms INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(endpoint, method)
);

-- Client IP Statistics (IP-based analytics)
CREATE TABLE client_ip_stats (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_request TIMESTAMP DEFAULT NOW(),
  first_request TIMESTAMP DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  blocked_at TIMESTAMP,
  unblocked_at TIMESTAMP,
  geo_ip_info JSONB,
  user_agent_patterns TEXT[]
);

-- Enhanced Rate Limiting Rules (Configurable rate limits)
CREATE TABLE rate_limit_rules (
  id SERIAL PRIMARY KEY,
  endpoint_pattern VARCHAR(255) NOT NULL,
  method VARCHAR(10),
  limit_count INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  UNIQUE(endpoint_pattern, method)
);

-- IP Blocking Rules (IP management)
CREATE TABLE ip_blocking_rules (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  blocked_by VARCHAR(255) NOT NULL,
  blocked_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  enabled BOOLEAN DEFAULT TRUE,
  auto_blocked BOOLEAN DEFAULT FALSE,
  block_type VARCHAR(50) DEFAULT 'manual' -- manual, automatic, abuse, spam
);
```

#### **Indexes to Add**
```sql
CREATE INDEX idx_api_request_logs_endpoint ON api_request_logs(endpoint);
CREATE INDEX idx_api_request_logs_ip ON api_request_logs(request_ip);
CREATE INDEX idx_api_request_logs_timestamp ON api_request_logs(timestamp);
CREATE INDEX idx_api_request_logs_status_code ON api_request_logs(status_code);
CREATE INDEX idx_client_ip_stats_blocked ON client_ip_stats(blocked);
CREATE INDEX idx_client_ip_stats_last_request ON client_ip_stats(last_request);
CREATE INDEX idx_rate_limit_rules_endpoint ON rate_limit_rules(endpoint_pattern);
CREATE INDEX idx_rate_limit_rules_enabled ON rate_limit_rules(enabled);
CREATE INDEX idx_ip_blocking_rules_enabled ON ip_blocking_rules(enabled);
CREATE INDEX idx_ip_blocking_rules_expires ON ip_blocking_rules(expires_at);
```

### **Step 2: Backend Services**

#### **New Service: `src/modules/admin/api-monitoring/api-monitoring.service.ts`**

```typescript
@Injectable()
export class ApiMonitoringService {
  constructor(
    private prisma: PrismaService,
    private logger: Logger
  ) {}

  // Request logging
  async logRequest(logData: ApiRequestLog): Promise<void>
  async updateEndpointStats(endpoint: string, method: string, statusCode: number, latency: number): Promise<void>
  async updateClientIpStats(ip: string, statusCode: number, userAgent?: string): Promise<void>
  
  // Statistics retrieval
  async getEndpointStats(filters?: ApiMonitoringFilters): Promise<ApiEndpointStat[]>
  async getClientIpStats(filters?: IpStatsFilters): Promise<ClientIpStat[]>
  async getApiRequestLogs(filters?: ApiRequestLogFilters): Promise<PaginatedApiLogs>
  
  // Analytics
  async getApiAnalytics(timeRange: string): Promise<ApiAnalytics>
  async getTopEndpoints(limit?: number): Promise<TopEndpoint[]>
  async getErrorRates(timeRange: string): Promise<ErrorRate[]>
  async getLatencyTrends(timeRange: string): Promise<LatencyTrend[]>
  async getClientAnalytics(timeRange: string): Promise<ClientAnalytics>
  
  // Data cleanup
  async cleanupOldLogs(daysToKeep: number): Promise<number>
  async aggregateStats(): Promise<void>
}
```

#### **Enhanced Service: `src/modules/admin/api-monitoring/rate-limiting.service.ts`**

```typescript
@Injectable()
export class RateLimitingService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private logger: Logger
  ) {}

  // Rule management
  async getRateLimitRules(): Promise<RateLimitRule[]>
  async createRateLimitRule(rule: CreateRateLimitRuleDto): Promise<RateLimitRule>
  async updateRateLimitRule(id: number, rule: UpdateRateLimitRuleDto): Promise<RateLimitRule>
  async deleteRateLimitRule(id: number): Promise<void>
  async toggleRateLimitRule(id: number, enabled: boolean): Promise<void>
  
  // Rate limiting logic
  async checkRateLimit(ip: string, endpoint: string, method: string): Promise<RateLimitResult>
  async incrementRequestCount(ip: string, endpoint: string, windowSeconds: number): Promise<void>
  async getRateLimitStatus(ip: string, endpoint: string): Promise<RateLimitStatus>
  async getMatchingRule(endpoint: string, method: string): Promise<RateLimitRule | null>
  
  // Analytics
  async getRateLimitViolations(timeRange: string): Promise<RateLimitViolation[]>
  async getTopViolators(limit?: number): Promise<TopViolator[]>
}
```

#### **New Service: `src/modules/admin/api-monitoring/ip-blocking.service.ts`**

```typescript
@Injectable()
export class IpBlockingService {
  constructor(
    private prisma: PrismaService,
    private logger: Logger
  ) {}

  // IP blocking management
  async getIpBlockingRules(): Promise<IpBlockingRule[]>
  async blockIp(ipAddress: string, reason: string, blockedBy: string, expiresAt?: Date, blockType?: string): Promise<IpBlockingRule>
  async unblockIp(ipAddress: string): Promise<void>
  async isIpBlocked(ipAddress: string): Promise<boolean>
  async getBlockedIpInfo(ipAddress: string): Promise<IpBlockingRule | null>
  
  // Automatic blocking
  async checkForAutoBlock(ipAddress: string, requestCount: number, errorRate: number): Promise<boolean>
  async autoBlockIp(ipAddress: string, reason: string): Promise<IpBlockingRule>
  
  // IP analytics
  async getIpStats(ipAddress: string): Promise<ClientIpStat>
  async getTopBlockedIps(limit?: number): Promise<TopBlockedIp[]>
  async getBlockingHistory(ipAddress: string): Promise<BlockingHistory[]>
  async getBlockingAnalytics(timeRange: string): Promise<BlockingAnalytics>
}
```

### **Step 3: Enhanced Middleware Implementation**

#### **Enhanced API Monitoring Middleware: `src/common/middleware/api-monitoring.middleware.ts`**

```typescript
@Injectable()
export class ApiMonitoringMiddleware implements NestMiddleware {
  constructor(
    private apiMonitoringService: ApiMonitoringService
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;
    let responseBody: any;
    
    // Capture response body
    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };
    
    res.on('finish', async () => {
      const latency = Date.now() - startTime;
      const responseSize = responseBody ? JSON.stringify(responseBody).length : 0;
      
      try {
        await this.apiMonitoringService.logRequest({
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          latencyMs: latency,
          requestIp: req.ip,
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          responseSize,
          errorMessage: res.statusCode >= 400 ? this.extractErrorMessage(responseBody) : null,
          metadata: {
            query: req.query,
            body: req.method !== 'GET' ? this.sanitizeRequestBody(req.body) : undefined,
            headers: this.sanitizeHeaders(req.headers)
          }
        });
      } catch (error) {
        this.logger.error('Failed to log API request:', error);
      }
    });
    
    next();
  }

  private extractErrorMessage(responseBody: any): string | null {
    if (typeof responseBody === 'string') {
      try {
        const parsed = JSON.parse(responseBody);
        return parsed.message || parsed.error || null;
      } catch {
        return responseBody.length > 100 ? responseBody.substring(0, 100) + '...' : responseBody;
      }
    }
    return responseBody?.message || responseBody?.error || null;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return undefined;
    const sanitized = { ...body };
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    delete sanitized.authorization;
    delete sanitized.cookie;
    return sanitized;
  }
}
```

#### **Enhanced Rate Limiting Middleware: `src/common/middleware/rate-limiting.middleware.ts`**

```typescript
@Injectable()
export class RateLimitingMiddleware implements NestMiddleware {
  constructor(
    private rateLimitingService: RateLimitingService,
    private logger: Logger
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.rateLimitingService.checkRateLimit(
        req.ip,
        req.path,
        req.method
      );
      
      if (!result.allowed) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
          endpoint: req.path,
          method: req.method
        });
        return;
      }
      
      res.set({
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
        'X-RateLimit-Window': result.windowSeconds.toString()
      });
      
      next();
    } catch (error) {
      this.logger.error('Rate limiting error:', error);
      next(); // Continue on error to avoid breaking the application
    }
  }
}
```

#### **New IP Blocking Middleware: `src/common/middleware/ip-blocking.middleware.ts`**

```typescript
@Injectable()
export class IpBlockingMiddleware implements NestMiddleware {
  constructor(
    private ipBlockingService: IpBlockingService,
    private logger: Logger
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const isBlocked = await this.ipBlockingService.isIpBlocked(req.ip);
      
      if (isBlocked) {
        const blockInfo = await this.ipBlockingService.getBlockedIpInfo(req.ip);
        res.status(403).json({
          error: 'IP address blocked',
          ip: req.ip,
          reason: blockInfo?.reason || 'Access denied',
          blockedAt: blockInfo?.blockedAt,
          expiresAt: blockInfo?.expiresAt,
          message: 'Your IP address has been blocked from accessing this service'
        });
        return;
      }
      
      next();
    } catch (error) {
      this.logger.error('IP blocking error:', error);
      next(); // Continue on error to avoid breaking the application
    }
  }
}
```

### **Step 4: API Endpoints**

#### **New Controller: `src/modules/admin/api-monitoring/api-monitoring.controller.ts`**

```typescript
@Controller({ path: "admin/monitoring/api", version: "4" })
@UseGuards(JwtAuthGuard)
@ApiTags('API Monitoring')
export class ApiMonitoringController {
  constructor(
    private apiMonitoringService: ApiMonitoringService,
    private rateLimitingService: RateLimitingService,
    private ipBlockingService: IpBlockingService
  ) {}

  // API monitoring endpoints
  @Get("stats")
  @ApiOperation({ summary: 'Get API endpoint statistics' })
  async getEndpointStats(@Query() filters: ApiMonitoringFiltersDto): Promise<ApiResponse>
  
  @Get("ips")
  @ApiOperation({ summary: 'Get client IP statistics' })
  async getClientIpStats(@Query() filters: IpStatsFiltersDto): Promise<ApiResponse>
  
  @Get("logs")
  @ApiOperation({ summary: 'Get API request logs' })
  async getApiRequestLogs(@Query() filters: ApiRequestLogFiltersDto): Promise<ApiResponse>
  
  @Get("analytics")
  @ApiOperation({ summary: 'Get API analytics' })
  async getApiAnalytics(@Query('timeRange') timeRange: string): Promise<ApiResponse>
  
  @Get("top-endpoints")
  @ApiOperation({ summary: 'Get top endpoints by request count' })
  async getTopEndpoints(@Query('limit') limit?: number): Promise<ApiResponse>
  
  @Get("error-rates")
  @ApiOperation({ summary: 'Get error rates by time range' })
  async getErrorRates(@Query('timeRange') timeRange: string): Promise<ApiResponse>

  // Rate limiting management
  @Get("rate-limits")
  @ApiOperation({ summary: 'Get rate limit rules' })
  async getRateLimitRules(): Promise<ApiResponse>
  
  @Post("rate-limits")
  @ApiOperation({ summary: 'Create rate limit rule' })
  async createRateLimitRule(@Body() rule: CreateRateLimitRuleDto): Promise<ApiResponse>
  
  @Put("rate-limits/:id")
  @ApiOperation({ summary: 'Update rate limit rule' })
  async updateRateLimitRule(
    @Param('id') id: number,
    @Body() rule: UpdateRateLimitRuleDto
  ): Promise<ApiResponse>
  
  @Delete("rate-limits/:id")
  @ApiOperation({ summary: 'Delete rate limit rule' })
  async deleteRateLimitRule(@Param('id') id: number): Promise<ApiResponse>

  @Post("rate-limits/:id/toggle")
  @ApiOperation({ summary: 'Toggle rate limit rule' })
  async toggleRateLimitRule(
    @Param('id') id: number,
    @Body() data: ToggleRateLimitRuleDto
  ): Promise<ApiResponse>

  // IP blocking management
  @Get("ip-blocking")
  @ApiOperation({ summary: 'Get IP blocking rules' })
  async getIpBlockingRules(): Promise<ApiResponse>
  
  @Post("ip-blocking")
  @ApiOperation({ summary: 'Block IP address' })
  async blockIp(@Body() blockData: BlockIpDto): Promise<ApiResponse>
  
  @Delete("ip-blocking/:ipAddress")
  @ApiOperation({ summary: 'Unblock IP address' })
  async unblockIp(@Param('ipAddress') ipAddress: string): Promise<ApiResponse>
  
  @Get("ip-blocking/:ipAddress/stats")
  @ApiOperation({ summary: 'Get IP statistics' })
  async getIpStats(@Param('ipAddress') ipAddress: string): Promise<ApiResponse>

  // Analytics endpoints
  @Get("violations")
  @ApiOperation({ summary: 'Get rate limit violations' })
  async getRateLimitViolations(@Query('timeRange') timeRange: string): Promise<ApiResponse>
  
  @Get("blocking-analytics")
  @ApiOperation({ summary: 'Get IP blocking analytics' })
  async getBlockingAnalytics(@Query('timeRange') timeRange: string): Promise<ApiResponse>
}
```

### **Step 5: Frontend Components**

#### **New API Client: `admin-dashboard/src/lib/api-monitoring-api.ts`**

```typescript
export const apiMonitoringApi = {
  // API monitoring
  getEndpointStats: (filters?: ApiMonitoringFilters) => 
    apiClient.get('/admin/monitoring/api/stats', { params: filters }),
  
  getClientIpStats: (filters?: IpStatsFilters) => 
    apiClient.get('/admin/monitoring/api/ips', { params: filters }),
  
  getApiRequestLogs: (filters?: ApiRequestLogFilters) => 
    apiClient.get('/admin/monitoring/api/logs', { params: filters }),
  
  getApiAnalytics: (timeRange: string) => 
    apiClient.get('/admin/monitoring/api/analytics', { params: { timeRange } }),
  
  getTopEndpoints: (limit?: number) => 
    apiClient.get('/admin/monitoring/api/top-endpoints', { params: { limit } }),
  
  getErrorRates: (timeRange: string) => 
    apiClient.get('/admin/monitoring/api/error-rates', { params: { timeRange } }),

  // Rate limiting management
  getRateLimitRules: () => apiClient.get('/admin/monitoring/api/rate-limits'),
  
  createRateLimitRule: (rule: CreateRateLimitRuleDto) => 
    apiClient.post('/admin/monitoring/api/rate-limits', rule),
  
  updateRateLimitRule: (id: number, rule: UpdateRateLimitRuleDto) => 
    apiClient.put(`/admin/monitoring/api/rate-limits/${id}`, rule),
  
  deleteRateLimitRule: (id: number) => 
    apiClient.delete(`/admin/monitoring/api/rate-limits/${id}`),

  toggleRateLimitRule: (id: number, enabled: boolean) =>
    apiClient.post(`/admin/monitoring/api/rate-limits/${id}/toggle`, { enabled }),

  // IP blocking management
  getIpBlockingRules: () => apiClient.get('/admin/monitoring/api/ip-blocking'),
  
  blockIp: (blockData: BlockIpDto) => 
    apiClient.post('/admin/monitoring/api/ip-blocking', blockData),
  
  unblockIp: (ipAddress: string) => 
    apiClient.delete(`/admin/monitoring/api/ip-blocking/${ipAddress}`),
  
  getIpStats: (ipAddress: string) => 
    apiClient.get(`/admin/monitoring/api/ip-blocking/${ipAddress}/stats`),

  // Analytics
  getRateLimitViolations: (timeRange: string) =>
    apiClient.get('/admin/monitoring/api/violations', { params: { timeRange } }),

  getBlockingAnalytics: (timeRange: string) =>
    apiClient.get('/admin/monitoring/api/blocking-analytics', { params: { timeRange } })
};
```

#### **New Components: `admin-dashboard/src/components/monitoring/`**

```typescript
// ApiMonitoringDashboard.tsx
export function ApiMonitoringDashboard() {
  // Real-time API request counts, latency, error rates
  // Top endpoints and client IPs with charts
  // Performance metrics and trends
  // Data visualization with interactive charts
}

// RateLimitManagement.tsx
export function RateLimitManagement() {
  // View, create, update, delete rate limit rules
  // Toggle rules on/off with real-time status
  // Rule testing interface and validation
  // Rate limit violation monitoring
}

// IpBlockingManagement.tsx
export function IpBlockingManagement() {
  // View blocked IPs with reasons and expiration
  // Block/unblock IP addresses with bulk operations
  // IP analytics and history tracking
  // Automatic blocking configuration
}

// ApiAnalytics.tsx
export function ApiAnalytics() {
  // Historical API performance data
  // Error rate trends and patterns
  // Usage patterns and insights
  // Custom time range analysis
}

// ApiRequestLogs.tsx
export function ApiRequestLogs() {
  // Detailed API request logs with filtering
  // Search and pagination capabilities
  // Request/response inspection
  // Error analysis and debugging
}
```

### **Step 6: Integration**

#### **Update App Module: `src/app.module.ts`**

```typescript
@Module({
  imports: [
    // ... existing imports
    ApiMonitoringModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply IP blocking first (highest priority)
    consumer
      .apply(IpBlockingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
      
    // Apply rate limiting second
    consumer
      .apply(RateLimitingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
      
    // Apply API monitoring last (for all requests)
    consumer
      .apply(ApiMonitoringMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
```

#### **Update Monitoring Page: `admin-dashboard/src/app/monitoring/page.tsx`**

```typescript
// Add new tabs for API monitoring
const tabs = [
  { id: 'system', label: 'System Health', component: SystemHealthPanel },
  { id: 'jobs', label: 'Job Control', component: JobControlPanel },
  { id: 'api', label: 'API Monitoring', component: ApiMonitoringDashboard },
  { id: 'rate-limits', label: 'Rate Limits', component: RateLimitManagement },
  { id: 'ip-blocking', label: 'IP Blocking', component: IpBlockingManagement },
  { id: 'analytics', label: 'Analytics', component: ApiAnalytics },
  { id: 'logs', label: 'Request Logs', component: ApiRequestLogs },
];
```

---

## 📁 **File Structure Changes**

### **New Files to Create**

```
src/modules/admin/api-monitoring/
├── api-monitoring.controller.ts
├── api-monitoring.service.ts
├── rate-limiting.service.ts
├── ip-blocking.service.ts
├── api-monitoring.module.ts
├── dto/
│   ├── api-monitoring.dto.ts
│   ├── rate-limiting.dto.ts
│   └── ip-blocking.dto.ts
├── interfaces/
│   ├── api-monitoring.interface.ts
│   ├── rate-limiting.interface.ts
│   └── ip-blocking.interface.ts
└── __tests__/
    ├── api-monitoring.controller.spec.ts
    ├── api-monitoring.service.spec.ts
    ├── rate-limiting.service.spec.ts
    └── ip-blocking.service.spec.ts

src/common/middleware/
├── api-monitoring.middleware.ts
├── rate-limiting.middleware.ts
└── ip-blocking.middleware.ts

admin-dashboard/src/
├── components/monitoring/
│   ├── ApiMonitoringDashboard.tsx
│   ├── RateLimitManagement.tsx
│   ├── IpBlockingManagement.tsx
│   ├── ApiAnalytics.tsx
│   └── ApiRequestLogs.tsx
└── lib/
    └── api-monitoring-api.ts
```

### **Files to Modify**

```
src/
├── app.module.ts (add middleware and module)
├── modules/admin/admin.module.ts (add ApiMonitoringModule)
└── modules/admin/security/security.module.ts (update middleware configuration)

admin-dashboard/src/
├── app/monitoring/page.tsx (add new tabs)
└── lib/api.ts (add monitoring methods)

prisma/
└── schema.prisma (add new tables)
```

---

## 🔧 **Database Migration**

### **Migration File: `prisma/migrations/add_api_monitoring_tables.sql`**

```sql
-- Create api_request_logs table
CREATE TABLE api_request_logs (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  request_ip VARCHAR(45) NOT NULL,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id INTEGER,
  metadata JSONB,
  response_size INTEGER DEFAULT 0,
  error_message TEXT
);

-- Create api_endpoint_stats table
CREATE TABLE api_endpoint_stats (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms FLOAT DEFAULT 0,
  max_latency_ms INTEGER DEFAULT 0,
  min_latency_ms INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(endpoint, method)
);

-- Create client_ip_stats table
CREATE TABLE client_ip_stats (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_request TIMESTAMP DEFAULT NOW(),
  first_request TIMESTAMP DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  blocked_at TIMESTAMP,
  unblocked_at TIMESTAMP,
  geo_ip_info JSONB,
  user_agent_patterns TEXT[]
);

-- Create rate_limit_rules table
CREATE TABLE rate_limit_rules (
  id SERIAL PRIMARY KEY,
  endpoint_pattern VARCHAR(255) NOT NULL,
  method VARCHAR(10),
  limit_count INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  UNIQUE(endpoint_pattern, method)
);

-- Create ip_blocking_rules table
CREATE TABLE ip_blocking_rules (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  blocked_by VARCHAR(255) NOT NULL,
  blocked_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  enabled BOOLEAN DEFAULT TRUE,
  auto_blocked BOOLEAN DEFAULT FALSE,
  block_type VARCHAR(50) DEFAULT 'manual'
);

-- Create indexes
CREATE INDEX idx_api_request_logs_endpoint ON api_request_logs(endpoint);
CREATE INDEX idx_api_request_logs_ip ON api_request_logs(request_ip);
CREATE INDEX idx_api_request_logs_timestamp ON api_request_logs(timestamp);
CREATE INDEX idx_api_request_logs_status_code ON api_request_logs(status_code);
CREATE INDEX idx_client_ip_stats_blocked ON client_ip_stats(blocked);
CREATE INDEX idx_client_ip_stats_last_request ON client_ip_stats(last_request);
CREATE INDEX idx_rate_limit_rules_endpoint ON rate_limit_rules(endpoint_pattern);
CREATE INDEX idx_rate_limit_rules_enabled ON rate_limit_rules(enabled);
CREATE INDEX idx_ip_blocking_rules_enabled ON ip_blocking_rules(enabled);
CREATE INDEX idx_ip_blocking_rules_expires ON ip_blocking_rules(expires_at);

-- Insert default rate limit rules
INSERT INTO rate_limit_rules (endpoint_pattern, method, limit_count, window_seconds, description, created_by) VALUES
('/', 'ALL', 1000, 3600, 'Global rate limit', 'system'),
('/api/v4/admin/*', 'ALL', 100, 3600, 'Admin API rate limit', 'system'),
('/api/v4/quran/*', 'GET', 500, 3600, 'Quran API rate limit', 'system'),
('/api/v4/hadith/*', 'GET', 200, 3600, 'Hadith API rate limit', 'system'),
('/api/v4/prayer/*', 'GET', 300, 3600, 'Prayer API rate limit', 'system'),
('/api/v4/admin/monitoring/*', 'ALL', 50, 3600, 'Monitoring API rate limit', 'system');
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
- `ApiMonitoringService` methods and data aggregation
- `RateLimitingService` rate limit logic and rule matching
- `IpBlockingService` IP blocking logic and automatic blocking
- Middleware functionality and error handling

### **Integration Tests**
- API monitoring workflow with database operations
- Rate limiting enforcement with Redis integration
- IP blocking functionality with rule management
- Database operations and data consistency

### **E2E Tests**
- Complete API monitoring workflow
- Rate limit rule management and enforcement
- IP blocking management and automatic blocking
- Analytics dashboard and data visualization

---

## 📊 **Success Metrics**

### **Functional Requirements**
- ✅ API request tracking and logging with detailed metrics
- ✅ Configurable rate limiting system with rule management
- ✅ IP blocking system with manual and automatic blocking
- ✅ API performance analytics and insights
- ✅ Real-time monitoring dashboard with interactive charts

### **Performance Requirements**
- ✅ Request logging adds < 5ms latency
- ✅ Rate limiting checks complete within 10ms
- ✅ IP blocking checks complete within 5ms
- ✅ Analytics queries complete within 2 seconds
- ✅ Database operations optimized with proper indexing

### **Quality Requirements**
- ✅ 90%+ test coverage for new code
- ✅ Comprehensive error handling and logging
- ✅ Type-safe implementation with TypeScript
- ✅ Responsive UI design with accessibility
- ✅ Security best practices implementation

---

## 🚀 **Deployment Plan**

### **Phase 2A: Backend Implementation (Days 1-3)**
1. Database schema creation and migration
2. Core service implementation (ApiMonitoring, RateLimiting, IpBlocking)
3. Middleware development and integration
4. API endpoint development and testing

### **Phase 2B: Frontend Implementation (Days 4-5)**
1. API monitoring dashboard with real-time charts
2. Rate limiting management interface
3. IP blocking management interface
4. Analytics visualization and insights

### **Phase 2C: Integration & Testing (Days 6-7)**
1. End-to-end testing and validation
2. Performance optimization and tuning
3. Documentation updates and deployment preparation
4. Production deployment and monitoring

---

## 📋 **Acceptance Criteria**

### **Must Have**
- [ ] API request logging and tracking with detailed metrics
- [ ] Configurable rate limiting system with rule management
- [ ] IP blocking system with manual and automatic blocking
- [ ] API performance analytics dashboard
- [ ] Real-time monitoring capabilities with WebSocket updates

### **Should Have**
- [ ] Advanced analytics and insights with trend analysis
- [ ] Bulk IP blocking operations and management
- [ ] Rate limit rule templates and presets
- [ ] Automated IP blocking based on abuse patterns
- [ ] API usage reporting and export capabilities

### **Could Have**
- [ ] GeoIP integration for IP analytics and location-based blocking
- [ ] Machine learning-based anomaly detection
- [ ] Advanced rate limiting algorithms (sliding window, token bucket)
- [ ] API performance optimization suggestions
- [ ] Custom alerting rules and notifications

---

## 🔄 **Integration with Existing Systems**

### **Leveraging Current Infrastructure**
- **Redis Integration**: Extend existing Redis service for rate limiting and caching
- **Prisma ORM**: Use existing database connection and transaction management
- **WebSocket Gateway**: Extend existing WebSocket infrastructure for real-time updates
- **Admin Authentication**: Integrate with existing JWT authentication system
- **Security Middleware**: Enhance existing security middleware stack

### **Backward Compatibility**
- **Existing Rate Limiting**: Enhance current `RateLimitMiddleware` without breaking changes
- **Audit Logging**: Extend existing `AuditLoggerMiddleware` for comprehensive logging
- **Admin Dashboard**: Integrate seamlessly with existing monitoring page structure
- **API Endpoints**: Maintain existing API structure while adding new monitoring endpoints

---

**Phase 2 Implementation Plan Complete** ✅

This plan provides a comprehensive roadmap for implementing API monitoring, rate limiting, and IP blocking capabilities, building upon the existing infrastructure while adding powerful new security and observability features to the DeenMate platform.