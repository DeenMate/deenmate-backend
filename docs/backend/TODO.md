## Backend TODO Backlog

Last updated: 2025-09-04

| ID | Title | Module | Priority | Assignee | Estimate | Depends on | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| TASK-1 | Ensure daily Quran sync populates DB | Quran | P0 | Backend | 2d | DB up, Prisma migrate | Done | Verified via manual sync: 114 chapters, 6236 verses.
| TASK-2 | Ensure daily Prayer times caching and DB storage | Prayer | P0 | Backend | 2d | Redis, DB | Done | TTLs applied; 45 rows for 3 cities over ±7d populated.
| TASK-3 | Fix any API parity mismatches discovered | Quran/Prayer | P0 | Backend | 1-2d | Upstream parity run | Done | API parity achieved; routes and response shapes match upstream.
| TASK-4 | Add unit/integration tests for core endpoints | All | P0 | Backend | 2-3d | Jest setup | Pending | Currently 0 tests; add tests for Quran/Prayer controllers/services.
| TASK-5 | Implement Redis cache TTL adjustments | Cache | P1 | Backend | 1d | Redis | Done | Prayer TTLs fixed; Quran TTLs implemented.
| TASK-6 | Add admin sync retrigger endpoint & secure it | Sync | P1 | Backend | 1d | Auth | Done | Guard added: `AdminApiKeyGuard` requiring `X-Admin-API-Key`.
| TASK-7 | Add monitoring/alerts for sync failures | Observability | P1 | Backend | 1d | DB logs | Done | Sync job logs verified; 5 recent entries tracked in database.
| TASK-8 | Create runbook docs for manual sync & rollback | Docs | P2 | Backend | 1d | Sync endpoints | Pending | Add step-by-step guides in docs/backend/runbooks.
| TASK-9 | Export OpenAPI JSON and wire into docs | Docs | P2 | Backend | 0.5d | App running | Done | Saved to `docs/backend/openapi-latest.json`.
| TASK-10 | Verify cron module loading in `AppModule` | Scheduler | P0 | Backend | 0.5d | ScheduleModule | Done | `ScheduleModule.forRoot()` present; crons in `SyncCronService`.
| TASK-11 | Seed baseline data and validate counts | DB | P1 | Backend | 1d | Postgres | Done | Seeded and validated counts; see verification report.
| TASK-12 | Health endpoints include Redis/DB checks | Platform | P1 | Backend | 0.5d | Redis/DB | In Progress | `TerminusModule` present; ensure Redis indicator wired.

Notes:
- Reference files: `src/sync/sync.cron.service.ts`, `src/app.module.ts`, `src/prayer/prayer.sync.service.ts`, `src/quran/quran.sync.service.ts`, `src/redis/redis.service.ts`.


# 🚀 DeenMate Backend — TODO & Action Items

## 📊 **Current Status: API Versioning & Compatibility Complete**

**Last Updated:** September 5, 2025  
**Phase:** Production Readiness & Optimization  
**Branch:** `docs/verify-backend-20250904`

---

## 🎯 **Phase Goals**

1. ✅ **Replace mock data** with **live data** from Quran.com and Aladhan
2. ✅ **Persist data** to PostgreSQL via Prisma
3. ✅ **Schedule daily sync** jobs (03:00 UTC)
4. ✅ **Serve API responses** that mirror upstream shapes exactly
5. ✅ **Provide fallback** to upstream APIs when needed
6. ✅ **Expose Swagger/OpenAPI** for consumers (UI + JSON)
7. ✅ **Implement multi-version API** architecture for perfect upstream compatibility

---

## ✅ **COMPLETED (Previous Phases)**

### **Sprint 0: Foundation**
- [x] Project scaffolding and NestJS setup
- [x] Docker infrastructure (PostgreSQL + Redis)
- [x] Basic CI/CD pipeline

### **Critical Fixes & Sync Activation (Sep 5, 2025)**
- [x] **SyncModule Enabled** - Uncommented and added to app.module.ts
- [x] **Test Coverage Improved** - Increased from 1.71% to 9.53% (5x improvement)
- [x] **Controller Consolidation** - Removed duplicate API controllers
- [x] **Application Integration** - All modules working, application starts successfully
- [x] **Dependency Injection Fixed** - Added RedisModule to PrayerModule
- [x] **SyncModule Cleanup** - Removed duplicate service providers
- [x] Health endpoints

### **API Versioning & Compatibility (Sep 5, 2025)**
- [x] **Multi-Version API Architecture** - Implemented URI-based versioning system
- [x] **Prayer API v1** - Perfect Aladhan.com compatibility (`/api/v1/prayer/`)
- [x] **Quran API v4** - Perfect Quran.com compatibility (`/api/v4/quran/`)
- [x] **Parameter Standardization** - Changed `lat`/`lng` to `latitude`/`longitude`
- [x] **Live Data Integration** - All sync services operational with upstream APIs
- [x] **Fallback Logic** - Graceful fallback to upstream APIs when needed
- [x] **Response Format Compatibility** - Identical JSON structure to upstream APIs

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

## ✅ **CRITICAL BLOCKERS RESOLVED**

### **Sync Module Activation** ✅ **COMPLETED**
- [x] **Enable Sync Module** - Uncommented `SyncModule` in `app.module.ts`
- [x] **Test Sync Jobs** - Verified cron jobs work when enabled
- [x] **Sync Integration Testing** - Application starts successfully, all modules loaded

### **Test Coverage Crisis** ✅ **SIGNIFICANTLY IMPROVED**
- [x] **Add Basic Tests** - Coverage improved from 1.71% to 9.53% (5x improvement)
- [x] **Quran Module Tests** - Controller tests added
- [x] **Prayer Module Tests** - Controller tests added
- [x] **Sync Module Tests** - Controller tests added

### **Code Quality Issues** ✅ **RESOLVED**
- [x] **Controller Consolidation** - Removed duplicate controllers (api/ vs modules/)
- [x] **API Versioning Cleanup** - Standardized on /api/v4 endpoints
- [ ] **Error Handling** - Robust error handling in sync services (next phase)

## 🔄 **NEXT PHASE: Production Readiness**

### **Production Deployment**
- [ ] **Environment Configuration** - Production environment variables and secrets
- [ ] **Database Migration Strategy** - Production database setup and migration
- [ ] **Docker Production Images** - Optimized production Docker containers
- [ ] **CI/CD Pipeline** - Automated deployment pipeline
- [ ] **Health Monitoring** - Production health checks and monitoring

### **Performance Optimization**
- [ ] **Caching Strategy** - Redis caching optimization for production load
- [ ] **Database Optimization** - Query optimization and indexing
- [ ] **API Rate Limiting** - Implement rate limiting for production use
- [ ] **Error Handling** - Comprehensive error handling and logging
- [ ] **Load Testing** - Performance testing under production load

### **Documentation & Support**
- [ ] **API Documentation** - Complete API documentation with examples
- [ ] **Deployment Guide** - Production deployment documentation
- [ ] **Monitoring Setup** - Application monitoring and alerting
- [ ] **Backup Strategy** - Database backup and recovery procedures

---

## 📋 **PENDING (Next Tasks)**

### **Phase 2: Environment & Packages** ✅ **COMPLETED**
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

### **Phase 3: Database Schema & Prisma** ✅ **COMPLETED**
- [x] Update `prisma/schema.prisma`
  - [x] Quran models (Chapter, Verse, Translation, Resource)
  - [x] Prayer models (Location, Times)
  - [x] Sync job logging model
  - [x] Gold price models
- [x] Generate and run migrations
- [x] Update seed scripts

### **Phase 4: Core Infrastructure** ✅ **COMPLETED**
- [x] Create common modules
  - [x] HTTP client with retry/backoff (`CommonHttpService`)
  - [x] Utility functions (hashing, compatibility, pagination)
- [x] Update app module with new imports (CommonModule, ScheduleModule, SyncModule)

### **Phase 5: Quran Live Sync** 🔄 **STRUCTURE COMPLETE**
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
- [ ] **Live Integration** - Connect to actual Quran.com API

### **Phase 6: Prayer Live Sync** 🔄 **STRUCTURE COMPLETE**
- [x] Create `prayer.sync.service.ts`
  - [x] On-demand prayer time fetching
  - [x] Pre-warming for common cities
  - [x] Store in database with location hashing
- [x] Create `prayer.mapper.ts`
  - [x] Transform Aladhan data to Prisma models
- [x] Update `prayer.service.ts`
  - [x] Read from database with fallback to upstream
  - [x] Maintain upstream-compatible response format
  - [x] **Local calculation removal** - All local calc code removed
- [x] Update `prayer.controller.ts`
  - [x] Ensure upstream JSON shape and document endpoints
- [ ] **Live Integration** - Connect to actual Aladhan API

### **Phase 7: Scheduled Sync & Cron** 🚨 **BLOCKED**
- [x] Create `sync.module.ts`
  - [x] Import `ScheduleModule.forRoot()`
- [x] Create `sync.cron.service.ts`
  - [x] Daily cron job at 03:00 UTC
  - [x] Trigger Quran and Prayer sync
  - [x] Log sync jobs and errors
- [x] Create `sync.controller.ts`
  - [x] Admin endpoints for manual sync
- [ ] **Module Activation** - Uncomment SyncModule in app.module.ts
- [ ] **Integration Testing** - Test cron jobs work when enabled

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

### **Phase 10: Testing & Quality** 🚨 **CRITICAL**
- [ ] **Unit tests** (Current coverage: 1.71%)
  - [ ] Quran module tests (controller, service, mapper)
  - [ ] Prayer module tests (controller, service, mapper)
  - [ ] Sync module tests (cron service, sync services)
  - [ ] Finance module tests (already has some coverage)
- [ ] **Integration tests**
  - [ ] Mock upstream APIs
  - [ ] Test sync workflows
  - [ ] Database integration tests
- [ ] **E2E tests**
  - [ ] Verify upstream-compatible responses
  - [ ] Test fallback scenarios
  - [ ] Test cron job execution

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

## 🔮 **FUTURE ENHANCEMENTS (Post-Production)**

### **Metal Price Scraper Module**
- [ ] **HTML Parser for Bajus Website**
  - [ ] Parse https://www.bajus.org/gold-price structure
  - [ ] Extract gold/silver prices by category (22K, 21K, 18K, Traditional)
  - [ ] Handle different units (Vori, Gram)
  - [ ] Normalize price data format
- [ ] **Price Change Detection**
  - [ ] Compare with previous day's prices
  - [ ] Mark changes as "Up", "Down", or "Unchanged"
  - [ ] Store historical price trends
- [ ] **API Endpoints**
  - [ ] `GET /finance/gold-prices/latest` - Latest prices with change status
  - [ ] `GET /finance/gold-prices/history` - Historical prices with date filters
  - [ ] `POST /admin/sync/gold-prices` - Manual scraping trigger
- [ ] **Scheduled Scraping**
  - [ ] Daily cron job at 10:00 AM BDT (04:00 UTC)
  - [ ] Append-only data storage (no overwrites)
  - [ ] Sync job logging and error handling
- [ ] **Swagger Documentation**
  - [ ] Document all metal price endpoints
  - [ ] Include data source and update schedule notes
  - [ ] Add request/response examples

---

## 🚨 **BLOCKERS & RISKS**

### **Current Critical Risks**
- **🚨 Sync Module Disabled**: Core functionality not active - prevents all sync operations
- **🚨 Test Coverage Crisis**: 1.71% coverage - high risk of regressions and bugs
- **🚨 Duplicate Controllers**: API versioning confusion between api/ and module controllers
- **Upstream API Changes**: Quran.com or Aladhan might change their API structure
- **Rate Limiting**: Need to respect upstream API rate limits
- **Data Consistency**: Ensuring database stays in sync with upstream sources

### **Mitigation Strategies**
- **Immediate**: Enable sync module and add basic tests
- **Feature Flags**: Enable/disable upstream proxy mode
- **Graceful Degradation**: Return cached data if upstream is unavailable
- **Monitoring**: Track sync job success rates and API response times
- **Documentation**: Clear fallback procedures for mobile app developers

---

## 📅 **Timeline & Milestones**

### **Week 1: Critical Fixes (Sep 5-6)**
- [x] Complete planning documents
- [x] Swagger UI + JSON enabled, controllers annotated (Quran, Prayer, Hadith, Zakat)
- [x] Environment setup and package installation
- [x] Database schema updates
- [x] Local prayer calculation removal
- [ ] **Enable sync module** (critical blocker)
- [ ] **Add basic tests** (coverage crisis)

### **Week 2: Sync Activation & Testing (Sep 9-13)**
- [x] Quran sync service and database integration (structure complete)
- [x] Prayer sync service and database integration (structure complete)
- [x] Basic cron job setup (02:00/03:00 UTC)
- [ ] **Sync module activation and testing**
- [ ] **Live data integration** (Quran.com, Aladhan)

### **Week 3: Quality & Polish (Sep 16-20)**
- [ ] Ensure upstream-compatible API responses (final pass)
- [ ] Implement feature flag driven fallback modes
- [ ] **Comprehensive testing** (unit, integration, E2E)
- [ ] **Controller consolidation** (remove duplicates)

### **Week 4: Production Readiness (Sep 23-27)**
- [ ] Admin endpoints and monitoring
- [ ] Final testing and bug fixes
- [ ] Documentation updates
- [ ] Deployment preparation

---

## 🎯 **Success Criteria**

### **Must Have**
- [ ] **Daily sync jobs run successfully at 03:00 UTC** (blocked - sync module disabled)
- [x] API responses match upstream JSON structure for Quran/Prayer endpoints (base)
- [x] Database contains live Quran and Prayer data (structure ready)
- [x] Fallback to upstream APIs when database is empty
- [ ] **All existing tests pass** (critical - 1.71% coverage)
- [ ] **Sync module enabled and functional**

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

*Last updated: September 5, 2025 — Updated for critical blockers, local prayer calc removal, and project analysis*


