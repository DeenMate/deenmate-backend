# 📊 Phase 1: Sync Job Monitoring & Control - Implementation Plan

**Phase**: 1 of 6  
**Priority**: High (P1)  
**Estimated Duration**: 3-5 days  
**Story Points**: 35/200

---

## 🎯 **Phase 1 Objectives**

Transform the current basic sync job monitoring into a comprehensive job control system with:
- Real-time job status tracking
- Job control operations (pause, cancel, delete)
- Progress tracking for long-running jobs
- Dynamic job priority and scheduling management
- Enhanced admin UI for job management

---

## 📋 **Current State Analysis**

### **✅ What's Working**
- Basic sync job logs in `sync_job_logs` table
- BullMQ queue system with job processing
- Admin endpoints for triggering sync jobs
- Basic job status tracking (success/failed/running)

### **❌ What's Missing**
- Job control operations (pause, cancel, delete)
- Real-time progress tracking
- Job priority management
- Dynamic scheduling modification
- Enhanced job management UI

---

## 🏗️ **Implementation Plan**

### **Step 1: Database Schema Enhancements**

#### **New Tables to Create**

```sql
-- Enhanced job tracking with control capabilities
CREATE TABLE sync_job_control (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  job_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, failed, cancelled
  priority INTEGER DEFAULT 5,
  progress_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Job scheduling configuration
CREATE TABLE sync_job_schedules (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  cron_expression VARCHAR(100),
  priority INTEGER DEFAULT 5,
  max_concurrency INTEGER DEFAULT 1,
  timeout_minutes INTEGER DEFAULT 60,
  retry_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Job control audit log
CREATE TABLE sync_job_audit_logs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- pause, resume, cancel, delete, priority_change
  performed_by VARCHAR(255) NOT NULL,
  performed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

#### **Indexes to Add**
```sql
CREATE INDEX idx_sync_job_control_status ON sync_job_control(status);
CREATE INDEX idx_sync_job_control_type ON sync_job_control(job_type);
CREATE INDEX idx_sync_job_control_created_at ON sync_job_control(created_at);
CREATE INDEX idx_sync_job_audit_logs_job_id ON sync_job_audit_logs(job_id);
```

### **Step 2: Backend Service Enhancements**

#### **New Service: `src/modules/admin/job-control/job-control.service.ts`**

```typescript
@Injectable()
export class JobControlService {
  constructor(
    private prisma: PrismaService,
    private workerService: WorkerService,
    private logger: Logger
  ) {}

  // Job control operations
  async pauseJob(jobId: string, userId: string): Promise<JobControlResult>
  async resumeJob(jobId: string, userId: string): Promise<JobControlResult>
  async cancelJob(jobId: string, userId: string): Promise<JobControlResult>
  async deleteJob(jobId: string, userId: string): Promise<JobControlResult>
  
  // Job management
  async getJobStatus(jobId: string): Promise<JobStatus>
  async getJobProgress(jobId: string): Promise<JobProgress>
  async updateJobPriority(jobId: string, priority: number, userId: string): Promise<JobControlResult>
  
  // Scheduling management
  async getJobSchedules(): Promise<JobSchedule[]>
  async updateJobSchedule(jobType: string, schedule: JobScheduleUpdate, userId: string): Promise<JobControlResult>
  async enableJobSchedule(jobType: string, enabled: boolean, userId: string): Promise<JobControlResult>
  
  // Job listing and filtering
  async getJobs(filters: JobFilters): Promise<PaginatedJobs>
  async getJobHistory(jobType?: string, limit?: number): Promise<JobHistory[]>
}
```

#### **Enhanced Worker Service: `src/workers/enhanced-worker.service.ts`**

```typescript
@Injectable()
export class EnhancedWorkerService extends WorkerService {
  constructor(
    private jobControlService: JobControlService,
    private redis: RedisService
  ) {
    super(redis);
  }

  // Enhanced job processing with progress tracking
  async processJobWithProgress(job: Job, progressCallback: (progress: number) => void): Promise<any>
  
  // Job control integration
  async pauseJob(jobId: string): Promise<boolean>
  async resumeJob(jobId: string): Promise<boolean>
  async cancelJob(jobId: string): Promise<boolean>
  
  // Priority management
  async updateJobPriority(jobId: string, priority: number): Promise<boolean>
  async getJobQueueStatus(): Promise<QueueStatus>
}
```

### **Step 3: API Endpoints**

#### **New Controller: `src/modules/admin/job-control/job-control.controller.ts`**

```typescript
@Controller({ path: "admin/jobs", version: "4" })
@UseGuards(JwtAuthGuard)
export class JobControlController {
  constructor(private jobControlService: JobControlService) {}

  // Job control endpoints
  @Post(":jobId/pause")
  async pauseJob(@Param("jobId") jobId: string, @Request() req): Promise<ApiResponse>

  @Post(":jobId/resume")
  async resumeJob(@Param("jobId") jobId: string, @Request() req): Promise<ApiResponse>

  @Post(":jobId/cancel")
  async cancelJob(@Param("jobId") jobId: string, @Request() req): Promise<ApiResponse>

  @Delete(":jobId")
  async deleteJob(@Param("jobId") jobId: string, @Request() req): Promise<ApiResponse>

  // Job status and progress
  @Get(":jobId/status")
  async getJobStatus(@Param("jobId") jobId: string): Promise<ApiResponse>

  @Get(":jobId/progress")
  async getJobProgress(@Param("jobId") jobId: string): Promise<ApiResponse>

  // Job management
  @Get()
  async getJobs(@Query() filters: JobFilters): Promise<ApiResponse>

  @Put(":jobId/priority")
  async updateJobPriority(
    @Param("jobId") jobId: string,
    @Body() body: { priority: number },
    @Request() req
  ): Promise<ApiResponse>

  // Scheduling management
  @Get("schedules")
  async getJobSchedules(): Promise<ApiResponse>

  @Put("schedules/:jobType")
  async updateJobSchedule(
    @Param("jobType") jobType: string,
    @Body() schedule: JobScheduleUpdate,
    @Request() req
  ): Promise<ApiResponse>

  @Post("schedules/:jobType/toggle")
  async toggleJobSchedule(
    @Param("jobType") jobType: string,
    @Body() body: { enabled: boolean },
    @Request() req
  ): Promise<ApiResponse>
}
```

### **Step 4: Frontend Enhancements**

#### **New API Client Methods: `admin-dashboard/src/lib/api.ts`**

```typescript
// Job control API methods
export const jobControlApi = {
  // Job control operations
  pauseJob: (jobId: string) => apiClient.post(`/admin/jobs/${jobId}/pause`),
  resumeJob: (jobId: string) => apiClient.post(`/admin/jobs/${jobId}/resume`),
  cancelJob: (jobId: string) => apiClient.post(`/admin/jobs/${jobId}/cancel`),
  deleteJob: (jobId: string) => apiClient.delete(`/admin/jobs/${jobId}`),
  
  // Job status and progress
  getJobStatus: (jobId: string) => apiClient.get(`/admin/jobs/${jobId}/status`),
  getJobProgress: (jobId: string) => apiClient.get(`/admin/jobs/${jobId}/progress`),
  
  // Job management
  getJobs: (filters?: JobFilters) => apiClient.get('/admin/jobs', { params: filters }),
  updateJobPriority: (jobId: string, priority: number) => 
    apiClient.put(`/admin/jobs/${jobId}/priority`, { priority }),
  
  // Scheduling management
  getJobSchedules: () => apiClient.get('/admin/jobs/schedules'),
  updateJobSchedule: (jobType: string, schedule: JobScheduleUpdate) =>
    apiClient.put(`/admin/jobs/schedules/${jobType}`, schedule),
  toggleJobSchedule: (jobType: string, enabled: boolean) =>
    apiClient.post(`/admin/jobs/schedules/${jobType}/toggle`, { enabled })
};
```

#### **Enhanced Monitoring Page: `admin-dashboard/src/app/monitoring/page.tsx`**

```typescript
// New components to add:
- JobControlPanel: Real-time job control interface
- JobProgressBar: Progress tracking for long-running jobs
- JobPrioritySelector: Dynamic priority management
- JobScheduleManager: Scheduling configuration interface
- JobHistoryTable: Historical job data with filtering
```

#### **New Job Management Page: `admin-dashboard/src/app/jobs/page.tsx`**

```typescript
// Dedicated job management page with:
- Real-time job status dashboard
- Job control operations (pause, resume, cancel, delete)
- Job priority management
- Scheduling configuration
- Job history and analytics
- Bulk operations for multiple jobs
```

### **Step 5: Real-time Updates**

#### **WebSocket Gateway: `src/modules/admin/job-control/job-control.gateway.ts`**

```typescript
@WebSocketGateway({
  namespace: '/job-control',
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3001' }
})
export class JobControlGateway {
  @WebSocketServer()
  server: Server;

  // Emit job status updates
  emitJobStatusUpdate(jobId: string, status: JobStatus): void
  emitJobProgressUpdate(jobId: string, progress: JobProgress): void
  emitJobControlAction(jobId: string, action: string, result: JobControlResult): void
}
```

---

## 📁 **File Structure Changes**

### **New Files to Create**

```
src/modules/admin/job-control/
├── job-control.controller.ts
├── job-control.service.ts
├── job-control.gateway.ts
├── job-control.module.ts
├── dto/
│   ├── job-control.dto.ts
│   ├── job-schedule.dto.ts
│   └── job-filters.dto.ts
├── interfaces/
│   ├── job-control.interface.ts
│   └── job-status.interface.ts
└── __tests__/
    ├── job-control.controller.spec.ts
    └── job-control.service.spec.ts

admin-dashboard/src/
├── app/jobs/
│   ├── page.tsx
│   └── components/
│       ├── JobControlPanel.tsx
│       ├── JobProgressBar.tsx
│       ├── JobPrioritySelector.tsx
│       ├── JobScheduleManager.tsx
│       └── JobHistoryTable.tsx
└── lib/
    └── job-control-api.ts
```

### **Files to Modify**

```
src/modules/admin/
├── admin.module.ts (add JobControlModule)
└── admin.controller.ts (enhance existing endpoints)

src/workers/
├── worker.service.ts (enhance with job control)
└── enhanced-worker.service.ts (new)

admin-dashboard/src/
├── app/monitoring/page.tsx (enhance with job control)
└── lib/api.ts (add job control methods)

prisma/
└── schema.prisma (add new tables)
```

---

## 🔧 **Database Migration**

### **Migration File: `prisma/migrations/add_job_control_tables.sql`**

```sql
-- Create sync_job_control table
CREATE TABLE sync_job_control (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  job_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  progress_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create sync_job_schedules table
CREATE TABLE sync_job_schedules (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  cron_expression VARCHAR(100),
  priority INTEGER DEFAULT 5,
  max_concurrency INTEGER DEFAULT 1,
  timeout_minutes INTEGER DEFAULT 60,
  retry_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create sync_job_audit_logs table
CREATE TABLE sync_job_audit_logs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  performed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Create indexes
CREATE INDEX idx_sync_job_control_status ON sync_job_control(status);
CREATE INDEX idx_sync_job_control_type ON sync_job_control(job_type);
CREATE INDEX idx_sync_job_control_created_at ON sync_job_control(created_at);
CREATE INDEX idx_sync_job_audit_logs_job_id ON sync_job_audit_logs(job_id);

-- Insert default job schedules
INSERT INTO sync_job_schedules (job_type, enabled, cron_expression, priority, max_concurrency) VALUES
('quran', true, '0 3 * * *', 1, 1),
('prayer', true, '0 */6 * * *', 2, 2),
('hadith', true, '0 2 * * 0', 3, 1),
('audio', true, '0 4 * * 0', 4, 1),
('finance', true, '0 4 * * *', 2, 1);
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
- `JobControlService` methods
- `JobControlController` endpoints
- `EnhancedWorkerService` job processing
- Database operations and validations

### **Integration Tests**
- Job control workflow (pause, resume, cancel)
- Real-time updates via WebSocket
- Job scheduling and priority management
- Error handling and edge cases

### **E2E Tests**
- Complete job management workflow
- Admin UI job control operations
- Real-time dashboard updates
- Job scheduling configuration

---

## 📊 **Success Metrics**

### **Functional Requirements**
- ✅ All sync jobs can be paused, resumed, cancelled, and deleted
- ✅ Real-time progress tracking for long-running jobs
- ✅ Dynamic job priority and scheduling management
- ✅ Comprehensive job history and audit logging
- ✅ Enhanced admin UI for job management

### **Performance Requirements**
- ✅ Job control operations complete within 2 seconds
- ✅ Real-time updates delivered within 1 second
- ✅ Dashboard loads within 3 seconds
- ✅ Support for 100+ concurrent jobs

### **Quality Requirements**
- ✅ 90%+ test coverage for new code
- ✅ Comprehensive error handling and logging
- ✅ Type-safe implementation with TypeScript
- ✅ Responsive UI design

---

## 🚀 **Deployment Plan**

### **Phase 1A: Backend Implementation (Days 1-2)**
1. Database schema creation and migration
2. Core service implementation
3. API endpoint development
4. Unit and integration testing

### **Phase 1B: Frontend Implementation (Days 3-4)**
1. Enhanced monitoring page
2. New job management page
3. Real-time WebSocket integration
4. UI/UX testing and refinement

### **Phase 1C: Integration & Testing (Day 5)**
1. End-to-end testing
2. Performance optimization
3. Documentation updates
4. Production deployment preparation

---

## 📋 **Acceptance Criteria**

### **Must Have**
- [ ] Job pause, resume, cancel, delete operations working
- [ ] Real-time progress tracking for all sync jobs
- [ ] Dynamic job priority management
- [ ] Job scheduling configuration interface
- [ ] Comprehensive job history and audit logs
- [ ] Enhanced admin UI with job control panel

### **Should Have**
- [ ] Bulk job operations
- [ ] Job performance analytics
- [ ] Advanced filtering and search
- [ ] Job template management
- [ ] Automated job recovery

### **Could Have**
- [ ] Job dependency management
- [ ] Custom job scheduling rules
- [ ] Job performance optimization suggestions
- [ ] Advanced job analytics dashboard

---

**Phase 1 Implementation Plan Complete** ✅

This plan provides a comprehensive roadmap for implementing sync job monitoring and control capabilities, transforming the current basic monitoring into a production-grade job management system.
