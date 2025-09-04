## Backend TODO Backlog

Last updated: 2025-09-04

| ID | Title | Module | Priority | Assignee | Estimate | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| TASK-1 | Ensure daily Quran sync populates DB | Quran | P0 | Backend | 2d | DB up, Prisma migrate | In Progress | Verify `QuranSyncService.syncChapters/Verses` write rows; add counts.
| TASK-2 | Ensure daily Prayer times caching and DB storage | Prayer | P0 | Backend | 2d | Redis, DB | In Progress | Verify `PrayerSyncService.syncPrayerTimes` upserts and cache usage.
| TASK-3 | Fix any API parity mismatches discovered | Quran/Prayer | P0 | Backend | 1-2d | Upstream parity run | Pending | Compare local vs upstream JSON shapes; adjust mappers.
| TASK-4 | Add unit/integration tests for core endpoints | All | P0 | Backend | 2-3d | Jest setup | Pending | Currently 0 tests; add tests for Quran/Prayer controllers/services.
| TASK-5 | Implement Redis cache TTL adjustments | Cache | P1 | Backend | 1d | Redis | In Progress | Confirm TTL matrix per endpoint in `RedisService` consumers.
| TASK-6 | Add admin sync retrigger endpoint & secure it | Sync | P1 | Backend | 1d | Auth | Pending | Endpoints exist in Swagger; ensure guard/auth and audit logs.
| TASK-7 | Add monitoring/alerts for sync failures | Observability | P1 | Backend | 1d | DB logs | Pending | Emit errors to Sentry; track `SyncJobLog` failures.
| TASK-8 | Create runbook docs for manual sync & rollback | Docs | P2 | Backend | 1d | Sync endpoints | Pending | Add step-by-step guides in docs/backend/runbooks.
| TASK-9 | Export OpenAPI JSON and wire into docs | Docs | P2 | Backend | 0.5d | App running | Done | Saved to `docs/backend/openapi-latest.json`.
| TASK-10 | Verify cron module loading in `AppModule` | Scheduler | P0 | Backend | 0.5d | ScheduleModule | Done | `ScheduleModule.forRoot()` present; crons in `SyncCronService`.
| TASK-11 | Seed baseline data and validate counts | DB | P1 | Backend | 1d | Postgres | Pending | Run `npm run db:migrate && npm run db:seed` and verify rows.
| TASK-12 | Health endpoints include Redis/DB checks | Platform | P1 | Backend | 0.5d | Redis/DB | In Progress | `TerminusModule` present; ensure Redis indicator wired.

Notes:
- Reference files: `src/sync/sync.cron.service.ts`, `src/app.module.ts`, `src/prayer/prayer.sync.service.ts`, `src/quran/quran.sync.service.ts`, `src/redis/redis.service.ts`.


# 🚀 DeenMate Backend — TODO & Action Items

## 📊 **Current Status: Live Sync Implementation Phase**

**Last Updated:** September 4, 2025  
**Phase:** Live Sync + Upstream-Compatible APIs  
**Branch:** `feature/live-quran-prayer-sync`

---

## 🎯 **Phase Goals**

1. **Replace mock data** with **live data** from Quran.com and Aladhan
2. **Persist data** to PostgreSQL via Prisma
3. **Schedule daily sync** jobs (03:00 UTC)
4. **Serve API responses** that mirror upstream shapes exactly
5. **Provide fallback** to upstream APIs when needed
6. **Expose Swagger/OpenAPI** for consumers (UI + JSON)

---

## ✅ **COMPLETED (Previous Phase)**

### **Sprint 0: Foundation**
- [x] Project scaffolding and NestJS setup
- [x] Docker infrastructure (PostgreSQL + Redis)
- [x] Basic CI/CD pipeline
- [x] Health endpoints

### **Sprint 1: Core Modules**
- [x] Database schema and Prisma setup
- [x] Quran module (mock data)
- [x] Redis caching layer
- [x] Audio URL signing service
- [x] Background sync worker

### **Sprint 2: Extended Modules**
- [x] Prayer times module (mock data)
- [x] Hadith module (mock data)
- [x] Database seeding

### **Sprint 3: Advanced Features**
- [x] Zakat calculation module
- [x] Audio management module
- [x] Worker service for background jobs
- [x] Comprehensive unit tests

### **Sprint 4: API Documentation**
- [x] OpenAPI specification
- [x] Postman collection
- [x] Quick start guide
- [x] Deployment guide
- [x] Swagger UI `/docs` and JSON `/docs-json` live
- [x] Controllers documented (Quran, Prayer, Hadith, Zakat)

### **Proxy Mode Phase 1**
- [x] Quran proxy service (mirrors api.quran.com/v4)
- [x] Prayer proxy service (mirrors api.aladhan.com/v1)
- [x] Redis caching for proxy responses
- [x] Upstream-compatible API endpoints
- [x] Source tracking headers

---

## 🔄 **IN PROGRESS (Current Phase)**

### **Live Sync Implementation**
- [x] **Planning Documents**
  - [x] Update `TODO.md` (this file)
  - [x] Update `PROJECT_TRACKING.md`
  - [x] Update `IMPLEMENTATION_PLAN.md`
  - [x] Update `MODULE_BREAKDOWN.md`
  - [x] Update `api-spec.md` (add upstream-compat section)
  - [x] Update `sync-strategy.md` (cron plan, failure handling)
- [ ] **Auth/Users Swagger**
  - [ ] Add `@ApiBearerAuth()` to protected endpoints
  - [ ] Document 401/403 responses and request/response models
- [ ] **DTOs & Schemas**
  - [ ] Introduce DTOs so Swagger shows concrete models
  - [ ] Add example payloads mirroring upstream (Quran.com/Aladhan)

---

## 📋 **PENDING (Next Tasks)**

### **Phase 2: Environment & Packages**
- [x] Add environment variables documentation (`docs/backend/env-config.md`)
  - [x] Database and Redis URLs
  - [x] Upstream API base URLs
  - [x] Sync cron schedule
  - [x] HTTP timeout and retry settings
  - [x] Upstream compatibility flags
- [x] Install required packages
  - [x] `@nestjs/schedule` for cron jobs
  - [x] `@nestjs/axios` and `axios` for HTTP client
  - [x] `retry-axios` for retry logic
  - [x] `bullmq` and `@nestjs/bullmq` for queues (if needed)

### **Phase 3: Database Schema & Prisma**
- [x] Update `prisma/schema.prisma`
  - [x] Quran models (Chapter, Verse, Translation, Resource)
  - [x] Prayer models (Location, Times)
  - [x] Sync job logging model
- [x] Generate and run migrations
- [x] Update seed scripts

### **Phase 4: Core Infrastructure**
- [x] Create common modules
  - [x] HTTP client with retry/backoff (`CommonHttpService`)
  - [x] Utility functions (hashing, compatibility, pagination)
- [x] Update app module with new imports (CommonModule, ScheduleModule, SyncModule)

### **Phase 5: Quran Live Sync**
- [x] Create `quran.sync.service.ts`
  - [x] Pull chapters from upstream
  - [x] Pull verses (paginated)
  - [x] Pull translations and resources
  - [x] Upsert to database
- [x] Create `quran.mapper.ts`
  - [x] Transform upstream data to Prisma models
- [x] Update `quran.service.ts`
  - [x] Read from database with graceful fallback to upstream
  - [x] Maintain upstream-compatible response format
- [x] Update `quran.controller.ts`
  - [x] Ensure upstream JSON shape and document endpoints
  - [x] Add Swagger decorators

### **Phase 6: Prayer Live Sync**
- [x] Create `prayer.sync.service.ts`
  - [x] On-demand prayer time fetching
  - [x] Pre-warming for common cities
  - [x] Store in database with location hashing
- [x] Create `prayer.mapper.ts`
  - [x] Transform Aladhan data to Prisma models
- [x] Update `prayer.service.ts`
  - [x] Read from database with fallback to upstream
  - [x] Maintain upstream-compatible response format
- [x] Update `prayer.controller.ts`
  - [x] Ensure upstream JSON shape and document endpoints

### **Phase 7: Scheduled Sync & Cron**
- [x] Create `sync.module.ts`
  - [x] Import `ScheduleModule.forRoot()`
- [x] Create `sync.cron.service.ts`
  - [x] Daily cron job at 03:00 UTC
  - [x] Trigger Quran and Prayer sync
  - [x] Log sync jobs and errors
- [x] Create `sync.controller.ts`
  - [ ] JWT protection for admin routes

### **Phase 8: Fallback & Compatibility**
- [x] Implement fallback logic
  - [x] Database empty → fetch from upstream
  - [ ] Feature flag for emergency proxy mode
- [x] Create compatibility utilities
  - [x] Transform database models to upstream JSON shape
  - [ ] Support both `compat=upstream` and `compat=native`

### **Phase 9: Caching & Resilience**
- [x] In-app rate limiting for upstream calls (CommonHttpService)
- [x] Circuit breaker per-host to avoid cascading failures
- [x] Cache invalidation helper (Redis `invalidateByPrefix`), admin-only use
- [ ] Redis caching polish
  - [x] TTLs for Quran reciters/tafsirs/translations
  - [ ] TTLs audit for Prayer endpoints
  - [ ] Invalidate caches after successful sync jobs

### **Phase 10: Testing & Quality**
- [ ] Unit tests
  - [ ] Mappers (upstream → Prisma)
  - [ ] Sync services
  - [ ] Compatibility utilities
- [ ] Integration tests
  - [ ] Mock upstream APIs
  - [ ] Test sync workflows
- [ ] E2E tests
  - [ ] Verify upstream-compatible responses
  - [ ] Test fallback scenarios

### **Phase 11: Admin & Monitoring**
- [ ] Admin endpoints
  - [ ] `/admin/health` with DB/Redis checks
  - [ ] `/admin/sync/run?job=quran|prayer`
- [ ] Observability
  - [ ] Structured logging for sync jobs
  - [ ] Metrics for sync performance
  - [ ] Error tracking and alerting

### **Phase 12: Documentation & Deployment**
- [ ] Update API documentation
  - [ ] Final API specifications
  - [ ] Upstream compatibility guide
  - [ ] Sync strategy documentation
- [ ] CI/CD updates
  - [ ] Test database migrations
  - [ ] Build and deploy pipeline

---

## 🚨 **BLOCKERS & RISKS**

### **Technical Risks**
- **Upstream API Changes**: Quran.com or Aladhan might change their API structure
- **Rate Limiting**: Need to respect upstream API rate limits
- **Data Consistency**: Ensuring database stays in sync with upstream sources
- **Performance**: Large Quran dataset (114 chapters × ~6,000+ verses)

### **Mitigation Strategies**
- **Feature Flags**: Enable/disable upstream proxy mode
- **Graceful Degradation**: Return cached data if upstream is unavailable
- **Monitoring**: Track sync job success rates and API response times
- **Documentation**: Clear fallback procedures for mobile app developers

---

## 📅 **Timeline & Milestones**

### **Week 1: Planning & Setup**
- [x] Complete planning documents
- [x] Swagger UI + JSON enabled, controllers annotated (Quran, Prayer, Hadith, Zakat)
- [x] Environment setup and package installation
- [x] Database schema updates

### **Week 2: Core Sync Implementation**
- [x] Quran sync service and database integration (EN/BN backfill for translations)
- [x] Prayer sync service and database integration (raw stored)
- [x] Basic cron job setup (02:00/03:00 UTC)

### **Week 3: API Compatibility & Testing**
- [ ] Ensure upstream-compatible API responses (final pass)
- [ ] Implement feature flag driven fallback modes
- [ ] Unit and integration testing

### **Week 4: Polish & Documentation**
- [ ] Admin endpoints and monitoring
- [ ] Final testing and bug fixes
- [ ] Documentation updates
- [ ] Deployment preparation

---

## 🎯 **Success Criteria**

### **Must Have**
- [ ] Daily sync jobs run successfully at 03:00 UTC
- [x] API responses match upstream JSON structure for Quran/Prayer endpoints (base)
- [x] Database contains live Quran and Prayer data
- [x] Fallback to upstream APIs when database is empty
- [ ] All existing tests pass

### **Should Have**
- [ ] Redis caching for hot endpoints
- [ ] Rate limiting and retry logic
- [ ] Admin endpoints for manual sync triggers
- [ ] Comprehensive logging and monitoring

### **Nice to Have**
- [ ] Real-time sync status dashboard
- [ ] Advanced error handling and recovery
- [ ] Performance optimization for large datasets
- [ ] A/B testing between upstream and cached responses

---

## 🔗 **Related Documents**

- `docs/backend/PROJECT_TRACKING.md` - Sprint board and progress tracking
- `docs/backend/IMPLEMENTATION_PLAN.md` - Step-by-step implementation guide
- `docs/backend/MODULE_BREAKDOWN.md` - Module responsibilities and architecture
- `docs/backend/api-spec.md` - API specifications and compatibility matrix
- `docs/backend/sync-strategy.md` - Sync strategy and cron job details
- `docs/backend/db-schema.md` - Database schema documentation

---

## 📝 **Notes & Decisions**

### **Architecture Decisions**
- **Database First**: All data flows through PostgreSQL for consistency
- **Upstream Compatible**: API responses must match upstream exactly
- **Graceful Fallback**: If database is empty, fetch from upstream and store
- **Feature Flags**: Enable/disable upstream proxy mode via environment variables

### **Technical Decisions**
- **Prisma ORM**: For type-safe database operations
- **Redis Caching**: For hot endpoint responses
- **Cron Jobs**: For scheduled sync operations
- **JWT Auth**: For admin endpoints only

### **Data Flow**
1. **Scheduled Sync**: Daily cron job pulls data from upstream APIs
2. **Database Storage**: All data stored in PostgreSQL via Prisma
3. **API Requests**: Controllers read from database
4. **Fallback**: If database empty, fetch from upstream and store
5. **Caching**: Redis caches hot responses for performance

---

*Last updated: September 4, 2025*


