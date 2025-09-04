# ARCHITECTURE

# 🚀 DeenMate Backend — Implementation Plan

## 🎯 **Current Phase: Live Sync Implementation**

**Phase Goal:** Replace mock data with live data from Quran.com and Aladhan, persist to PostgreSQL, and maintain upstream-compatible APIs  
**Target Completion:** September 25, 2025  
**Current Sprint:** Planning & Documentation

---

## 📋 **Phase Overview**

This phase transforms DeenMate from a mock-data API to a **live, upstream-compatible** service that:

1. **Pulls live data** from Quran.com and Aladhan APIs
2. **Persists data** to PostgreSQL via Prisma
3. **Schedules daily sync** jobs at 03:00 UTC
4. **Maintains exact API compatibility** with upstream services
5. **Provides graceful fallback** when database is empty

---

## 🏗️ **Architecture Principles**

### **Core Design Decisions**
- **Database First**: All data flows through PostgreSQL for consistency and reliability
- **Upstream Compatible**: API responses must match upstream JSON structure exactly
- **Graceful Fallback**: If database is empty, fetch from upstream, store, and return
- **Feature Flags**: Enable/disable upstream proxy mode via environment variables
- **Scheduled Sync**: Daily cron jobs ensure data freshness

### **Data Flow Architecture**
```
Upstream APIs → Sync Services → PostgreSQL → API Controllers → Mobile App
     ↓              ↓            ↓            ↓
  (Quran.com)   (Cron Jobs)   (Prisma)   (Upstream-compat)
  (Aladhan)     (On-demand)   (Redis)    (Fallback logic)
```

---

## 📅 **Implementation Timeline**

### **Week 1: Planning & Setup (Sep 4-8)**
- [x] **Planning Documents** (Current)
- [ ] **Environment & Packages** (Sep 5-6)
- [ ] **Database Schema** (Sep 7-8)

### **Week 2: Quran Live Sync (Sep 9-15)**
- [ ] **Core Infrastructure** (Sep 9-10)
- [ ] **Quran Sync Service** (Sep 11-12)
- [ ] **Quran API Updates** (Sep 13-15)

### **Week 3: Prayer Live Sync (Sep 16-22)**
- [ ] **Prayer Sync Service** (Sep 16-18)
- [ ] **Prayer API Updates** (Sep 19-20)
- [ ] **Integration Testing** (Sep 21-22)

### **Week 4: Scheduled Sync & Polish (Sep 23-29)**
- [ ] **Cron Jobs & Scheduling** (Sep 23-25)
- [ ] **Fallback & Compatibility** (Sep 26-27)
- [ ] **Testing & Documentation** (Sep 28-29)

---

## 🔧 **Detailed Implementation Steps**

### **Phase 1: Planning & Documentation (Sep 4-5)**

#### **1.1 Update Planning Documents**
- [x] Update `TODO.md` with live sync tasks
- [x] Update `PROJECT_TRACKING.md` with sprint board
- [ ] Update `IMPLEMENTATION_PLAN.md` (this file)
- [ ] Update `MODULE_BREAKDOWN.md` with new architecture
- [ ] Update `api-spec.md` with upstream-compatibility section
- [ ] Update `sync-strategy.md` with cron job details

**Deliverables:**
- Complete planning documentation
- Clear task breakdown and timeline
- Architecture decisions documented

---

### **Phase 2: Environment & Packages (Sep 5-6)**

#### **2.1 Environment Variables**
Create `.env.example` with new configuration:

```bash
# Database & Redis
DATABASE_URL=postgresql://user:pass@localhost:5432/deenmate
REDIS_URL=redis://localhost:6379

# Upstream APIs
QURAN_API_BASE=https://api.quran.com/api/v4
ALADHAN_API_BASE=https://api.aladhan.com/v1

# Sync Configuration
SYNC_CRON_DAILY=0 3 * * * # 03:00 UTC daily
HTTP_TIMEOUT_MS=15000
HTTP_MAX_RETRIES=3
HTTP_RETRY_BACKOFF_MS=500

# Upstream Compatibility
UPSTREAM_COMPAT_DEFAULT=true
ENABLE_UPSTREAM_PROXY=true
```

#### **2.2 Package Installation**
```bash
# Core packages
npm install @nestjs/schedule @nestjs/axios axios retry-axios

# Development dependencies
npm install -D @types/node

# Optional: Queue management (if needed later)
npm install bullmq @nestjs/bullmq ioredis
```

**Deliverables:**
- Updated environment configuration
- Required packages installed
- Development environment ready

---

### **Phase 3: Database Schema & Prisma (Sep 6-8)**

#### **3.1 Update Prisma Schema**
Update `prisma/schema.prisma` with new models:

```prisma
// Quran Models
model QuranChapter {
  id             Int             @id @default(autoincrement())
  chapterNumber  Int             @unique
  nameArabic     String
  nameSimple     String?
  nameEnglish    String?
  revelationPlace String?
  versesCount    Int
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  verses         QuranVerse[]
}

model QuranVerse {
  id            Int      @id @default(autoincrement())
  chapterNumber Int
  verseNumber   Int
  textUthmani   String?
  textSimple    String?
  pageNumber    Int?
  juzNumber     Int?
  hizbNumber    Int?
  chapter       QuranChapter? @relation(fields: [chapterNumber], references: [chapterNumber])
  translations  VerseTranslation[]
  @@unique([chapterNumber, verseNumber])
  @@index([chapterNumber])
}

model TranslationResource {
  id           Int      @id @default(autoincrement())
  resourceId   Int      @unique // upstream resource id
  languageCode String
  name         String
  authorName   String?
  createdAt    DateTime @default(now())
}

model VerseTranslation {
  id              Int      @id @default(autoincrement())
  verseId         Int
  resourceId      Int
  text            String
  languageCode    String
  verse           QuranVerse @relation(fields: [verseId], references: [id])
  resource        TranslationResource @relation(fields: [resourceId], references: [resourceId])
  @@index([verseId])
  @@index([resourceId])
}

// Prayer Models
model PrayerLocation {
  id         Int      @id @default(autoincrement())
  locKey     String   @unique // hashed bucket key for lat/lng
  lat        Float
  lng        Float
  timezone   String?
  createdAt  DateTime @default(now())
}

model PrayerTimes {
  id         Int      @id @default(autoincrement())
  locKey     String
  date       DateTime
  method     Int
  school     Int? // 0 Shafi, 1 Hanafi
  fajr       DateTime
  sunrise    DateTime
  dhuhr      DateTime
  asr        DateTime
  maghrib    DateTime
  isha       DateTime
  imsak      DateTime?
  midnight   DateTime?
  source     String   // "aladhan"
  lastSynced DateTime @default(now())
  @@unique([locKey, date, method, school])
  @@index([locKey, date])
}

// Sync & Logging
model SyncJobLog {
  id          Int      @id @default(autoincrement())
  jobName     String
  resource    String   // "quran-chapters", "quran-verses", "prayer-times"
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  status      String   // "success" | "failed"
  error       String?
  notes       String?
}
```

#### **3.2 Database Migration**
```bash
# Generate migration
npx prisma migrate dev --name init_quran_prayer_sync

# Apply migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

**Deliverables:**
- Updated database schema
- Migration files created and applied
- Prisma client regenerated

---

### **Phase 4: Core Infrastructure (Sep 7-8)**

#### **4.1 HTTP Client Module**
Create `src/common/http/axios.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: parseInt(process.env.HTTP_TIMEOUT_MS || '15000', 10),
      maxRedirects: 5,
    }),
  ],
  exports: [HttpModule],
})
export class AxiosCommonModule {}
```

#### **4.2 Utility Modules**
Create utility functions for:
- **Hashing**: `src/common/utils/hash.util.ts` - Generate location keys
- **Compatibility**: `src/common/utils/compat.util.ts` - Transform DB models to upstream JSON
- **Pagination**: `src/common/utils/pagination.util.ts` - Handle pagination logic

**Deliverables:**
- HTTP client with retry/backoff support
- Utility functions for common operations
- Common module structure established

---

### **Phase 5: Quran Live Sync (Sep 9-15)**

#### **5.1 Quran Sync Service**
Create `src/quran/quran.sync.service.ts`:

```typescript
@Injectable()
export class QuranSyncService {
  async fullSync(): Promise<void> {
    // 1. Sync chapters
    await this.syncChapters();
    
    // 2. Sync verses (paginated)
    await this.syncVerses();
    
    // 3. Sync translations and resources
    await this.syncTranslations();
  }
  
  private async syncChapters(): Promise<void> {
    // Pull from QURAN_API_BASE/chapters
    // Upsert to QuranChapter table
  }
  
  private async syncVerses(): Promise<void> {
    // For each chapter, pull verses with pagination
    // Upsert to QuranVerse table
  }
  
  private async syncTranslations(): Promise<void> {
    // Pull translation resources
    // Upsert to TranslationResource and VerseTranslation tables
  }
}
```

#### **5.2 Quran Mapper**
Create `src/quran/quran.mapper.ts`:

```typescript
export class QuranMapper {
  static upstreamChapterToPrisma(upstream: any): Prisma.QuranChapterCreateInput {
    return {
      chapterNumber: upstream.id,
      nameArabic: upstream.name_arabic,
      nameSimple: upstream.name_simple,
      nameEnglish: upstream.name_english,
      revelationPlace: upstream.revelation_place,
      versesCount: upstream.verses_count,
    };
  }
  
  static upstreamVerseToPrisma(upstream: any): Prisma.QuranVerseCreateInput {
    return {
      chapterNumber: upstream.chapter_id,
      verseNumber: upstream.verse_number,
      textUthmani: upstream.text_uthmani,
      textSimple: upstream.text_simple,
      pageNumber: upstream.page_number,
      juzNumber: upstream.juz_number,
      hizbNumber: upstream.hizb_number,
    };
  }
}
```

#### **5.3 Update Quran Service**
Modify `src/quran/quran.service.ts` to:
- Read from database instead of mock data
- Maintain upstream-compatible response format
- Implement fallback to upstream if database is empty

#### **5.4 Update Quran Controller**
Ensure `src/quran/quran.controller.ts` returns:
- Exact upstream JSON structure
- Support for `compat=upstream|native` query parameter
- Proper error handling and status codes

**Deliverables:**
- Quran sync service with upstream integration
- Data mapping utilities
- Updated Quran API with live data
- Upstream-compatible responses

---

### **Phase 6: Prayer Live Sync (Sep 16-22)**

#### **6.1 Prayer Sync Service**
Create `src/prayer/prayer.sync.service.ts`:

```typescript
@Injectable()
export class PrayerSyncService {
  async prewarmDaily(): Promise<void> {
    // Pre-warm prayer times for common cities
    const commonCities = this.getCommonCities();
    
    for (const city of commonCities) {
      await this.syncPrayerTimesForCity(city);
    }
  }
  
  async syncPrayerTimesForCity(city: any): Promise<void> {
    // Generate location key from lat/lng
    // Fetch from Aladhan API
    // Store in PrayerTimes table
  }
}
```

#### **6.2 Prayer Mapper**
Create `src/prayer/prayer.mapper.ts`:

```typescript
export class PrayerMapper {
  static aladhanToPrisma(upstream: any, location: any): Prisma.PrayerTimesCreateInput {
    return {
      locKey: this.generateLocationKey(location.lat, location.lng),
      date: new Date(upstream.date.readable),
      method: upstream.meta.method.id,
      school: upstream.meta.school === 'Shafi' ? 0 : 1,
      fajr: this.parseTime(upstream.timings.Fajr),
      sunrise: this.parseTime(upstream.timings.Sunrise),
      dhuhr: this.parseTime(upstream.timings.Dhuhr),
      asr: this.parseTime(upstream.timings.Asr),
      maghrib: this.parseTime(upstream.timings.Maghrib),
      isha: this.parseTime(upstream.timings.Isha),
      source: 'aladhan',
    };
  }
}
```

#### **6.3 Update Prayer Service & Controller**
Similar updates to prayer module for live data integration.

**Deliverables:**
- Prayer sync service with Aladhan integration
- Data mapping utilities
- Updated Prayer API with live data
- Upstream-compatible responses

---

### **Phase 7: Scheduled Sync & Cron (Sep 23-29)**

#### **7.1 Sync Module**
Create `src/sync/sync.module.ts`:

```typescript
@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ... other imports
  ],
  providers: [SyncCronService, SyncController],
  exports: [SyncCronService],
})
export class SyncModule {}
```

#### **7.2 Cron Service**
Create `src/sync/sync.cron.service.ts`:

```typescript
@Injectable()
export class SyncCronService {
  @Cron(process.env.SYNC_CRON_DAILY || '0 3 * * *')
  async dailySync() {
    this.logger.log('Daily sync started');
    
    try {
      await this.safe('quran-daily', () => this.quranSync.fullSync());
      await this.safe('prayer-prewarm', () => this.prayerSync.prewarmDaily());
      
      this.logger.log('Daily sync completed successfully');
    } catch (error) {
      this.logger.error('Daily sync failed', error);
    }
  }
  
  private async safe(jobName: string, fn: () => Promise<any>) {
    const start = Date.now();
    try {
      await fn();
      await this.logSyncJob(jobName, 'success');
    } catch (error) {
      await this.logSyncJob(jobName, 'failed', error.message);
      throw error;
    } finally {
      this.logger.log(`${jobName} took ${Date.now() - start}ms`);
    }
  }
}
```

#### **7.3 Admin Controller**
Create `src/sync/sync.controller.ts`:

```typescript
@Controller('admin/sync')
export class SyncController {
  @Post('run')
  @UseGuards(JwtAuthGuard)
  async runSync(@Query('job') job: string) {
    switch (job) {
      case 'quran':
        return this.quranSync.fullSync();
      case 'prayer':
        return this.prayerSync.prewarmDaily();
      default:
        throw new BadRequestException('Invalid job type');
    }
  }
  
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getSyncStatus() {
    // Return recent sync job statuses
  }
}
```

**Deliverables:**
- Scheduled sync infrastructure
- Daily cron jobs at 03:00 UTC
- Admin endpoints for manual sync triggers
- Sync job logging and monitoring

---

### **Phase 8: Fallback & Compatibility (Sep 26-27)**

#### **8.1 Fallback Logic**
Implement graceful fallback when database is empty:

```typescript
async getChapters(): Promise<any> {
  // 1. Try database first
  const dbChapters = await this.prisma.quranChapter.findMany();
  
  if (dbChapters.length > 0) {
    return this.transformToUpstreamFormat(dbChapters);
  }
  
  // 2. Database empty - fetch from upstream
  if (process.env.ENABLE_UPSTREAM_PROXY === 'true') {
    const upstreamChapters = await this.fetchFromUpstream();
    
    // Store in database for future use
    await this.storeChapters(upstreamChapters);
    
    return upstreamChapters;
  }
  
  // 3. No fallback available
  throw new ServiceUnavailableException('No data available');
}
```

#### **8.2 Compatibility Utilities**
Create utilities to transform database models to upstream JSON shape:

```typescript
export class CompatibilityUtil {
  static quranChaptersToUpstream(chapters: QuranChapter[]): any {
    return {
      chapters: chapters.map(chapter => ({
        id: chapter.chapterNumber,
        name_arabic: chapter.nameArabic,
        name_simple: chapter.nameSimple,
        name_english: chapter.nameEnglish,
        revelation_place: chapter.revelationPlace,
        verses_count: chapter.versesCount,
      }))
    };
  }
}
```

**Deliverables:**
- Graceful fallback to upstream APIs
- Upstream-compatible JSON transformation
- Feature flags for fallback behavior

---

### **Phase 9: Testing & Quality (Sep 28-29)**

#### **9.1 Unit Tests**
- Test mappers (upstream → Prisma)
- Test sync services
- Test compatibility utilities

#### **9.2 Integration Tests**
- Mock upstream APIs
- Test sync workflows
- Verify database persistence

#### **9.3 E2E Tests**
- Verify upstream-compatible responses
- Test fallback scenarios
- Validate API behavior

**Deliverables:**
- Comprehensive test coverage
- Integration test suite
- E2E test validation

---

### **Phase 10: Documentation & Deployment (Sep 30-Oct 3)**

#### **10.1 Final Documentation**
- Update API specifications
- Document sync strategy
- Create deployment guides

#### **10.2 CI/CD Updates**
- Test database migrations
- Build and deploy pipeline
- Staging environment setup

**Deliverables:**
- Complete documentation
- Production-ready deployment
- Monitoring and alerting setup

---

## 🎯 **Acceptance Criteria**

### **Must Have**
- [ ] Daily sync jobs run successfully at 03:00 UTC
- [ ] API responses match upstream JSON structure exactly
- [ ] Database contains live Quran and Prayer data
- [ ] Fallback to upstream APIs when database is empty
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

## 🚨 **Risks & Mitigation**

### **Technical Risks**
- **Upstream API Changes**: Monitor endpoints, implement feature flags
- **Rate Limiting**: Implement exponential backoff and respect upstream limits
- **Data Consistency**: Daily sync jobs with error logging and retry logic
- **Performance**: Redis caching and database indexing strategies

### **Mitigation Strategies**
- **Feature Flags**: Enable/disable upstream proxy mode
- **Graceful Degradation**: Return cached data if upstream is unavailable
- **Monitoring**: Track sync job success rates and API response times
- **Documentation**: Clear fallback procedures for mobile app developers

---

## 🔗 **Related Documents**

- `docs/backend/TODO.md` - Detailed task breakdown
- `docs/backend/PROJECT_TRACKING.md` - Sprint board and progress tracking
- `docs/backend/MODULE_BREAKDOWN.md` - Module architecture and responsibilities
- `docs/backend/api-spec.md` - API specifications and compatibility matrix
- `docs/backend/sync-strategy.md` - Sync strategy and cron job details

---

*Last updated: September 4, 2025*


---

# MODULES

# 🏗️ DeenMate Backend — Module Breakdown & Architecture

## 🎯 **Current Phase: Live Sync Implementation**

**Architecture Goal:** Transform from mock-data API to live, upstream-compatible service with database persistence and scheduled sync  
**Last Updated:** September 4, 2025

---

## 🏛️ **High-Level Architecture**

### **System Overview**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Upstream APIs │    │   DeenMate      │    │   Mobile App    │
│                 │    │   Backend       │    │                 │
│ • Quran.com     │◄──►│ • Sync Services │◄──►│ • API Calls     │
│ • Aladhan       │    │ • Database      │    │ • Responses     │
│                 │    │ • Controllers   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   + Redis       │
                       │   + Cron Jobs   │
                       └─────────────────┘
```

### **Data Flow Architecture**
```
Upstream APIs → Sync Services → PostgreSQL → API Controllers → Mobile App
     ↓              ↓            ↓            ↓
  (Quran.com)   (Cron Jobs)   (Prisma)   (Upstream-compat)
  (Aladhan)     (On-demand)   (Redis)    (Fallback logic)
```

---

## 📦 **Module Structure**

### **Core Application Modules**
```
src/
├── app.module.ts                 # Root module with all imports
├── main.ts                       # Application entry point
├── common/                       # Shared utilities and modules
│   ├── http/                     # HTTP client configuration
│   │   ├── axios.module.ts       # Axios with retry/backoff
│   │   └── http.service.ts       # HTTP client wrapper
│   └── utils/                    # Common utility functions
│       ├── hash.util.ts          # Location hashing utilities
│       ├── compat.util.ts        # Upstream compatibility
│       └── pagination.util.ts    # Pagination helpers
├── database/                     # Database configuration
│   ├── database.module.ts        # Prisma module
│   └── prisma.service.ts         # Prisma client service
├── redis/                        # Redis configuration
│   ├── redis.module.ts           # Redis module
│   └── redis.service.ts          # Redis client service
├── quran/                        # Quran module (live data)
│   ├── quran.module.ts           # Quran module definition
│   ├── quran.controller.ts       # API endpoints
│   ├── quran.service.ts          # Business logic (DB reads)
│   ├── quran.sync.service.ts     # Sync from upstream
│   └── quran.mapper.ts           # Data transformation
├── prayer/                       # Prayer module (live data)
│   ├── prayer.module.ts          # Prayer module definition
│   ├── prayer.controller.ts      # API endpoints
│   ├── prayer.service.ts         # Business logic (DB reads)
│   ├── prayer.sync.service.ts    # Sync from upstream
│   └── prayer.mapper.ts          # Data transformation
├── sync/                         # Sync and scheduling
│   ├── sync.module.ts            # Sync module definition
│   ├── sync.cron.service.ts      # Scheduled cron jobs
│   └── sync.controller.ts        # Admin endpoints
├── hadith/                       # Hadith module (existing)
├── zakat/                        # Zakat module (existing)
├── audio/                        # Audio module (existing)
└── workers/                      # Background workers (existing)
```

---

## 🔧 **Module Responsibilities**

### **1. Common Module (`src/common/`)**

#### **HTTP Module (`src/common/http/`)**
**Purpose:** Configure HTTP client with retry logic and timeouts

**Components:**
- `axios.module.ts` - NestJS HTTP module configuration
- `http.service.ts` - HTTP client wrapper with retry/backoff

**Responsibilities:**
- Configure Axios with environment-based timeouts
- Implement retry logic with exponential backoff
- Handle HTTP errors and rate limiting
- Provide consistent HTTP client interface

**Dependencies:**
- `@nestjs/axios`
- `axios`
- `retry-axios`

**Configuration:**
```typescript
// Environment variables
HTTP_TIMEOUT_MS=15000
HTTP_MAX_RETRIES=3
HTTP_RETRY_BACKOFF_MS=500
```

#### **Utils Module (`src/common/utils/`)**
**Purpose:** Provide common utility functions across modules

**Components:**
- `hash.util.ts` - Location hashing for prayer times
- `compat.util.ts` - Transform DB models to upstream JSON
- `pagination.util.ts` - Handle pagination logic

**Responsibilities:**
- Generate consistent location keys from lat/lng
- Transform database entities to upstream-compatible format
- Handle pagination with proper metadata
- Provide type-safe utility functions

---

### **2. Database Module (`src/database/`)**

**Purpose:** Database connection and Prisma client management

**Components:**
- `database.module.ts` - Database module definition
- `prisma.service.ts` - Prisma client service

**Responsibilities:**
- Manage Prisma client lifecycle
- Handle database connections
- Provide database health checks
- Manage database migrations

**Dependencies:**
- `@prisma/client`
- `prisma`

---

### **3. Redis Module (`src/redis/`)**

**Purpose:** Redis caching and session management

**Components:**
- `redis.module.ts` - Redis module definition
- `redis.service.ts` - Redis client service

**Responsibilities:**
- Manage Redis connections
- Provide caching operations
- Handle Redis health checks
- Support BullMQ queues (if needed)

**Dependencies:**
- `ioredis`
- `@nestjs/redis`

---

### **4. Quran Module (`src/quran/`)**

**Purpose:** Quran data management with live sync from upstream

**Components:**
- `quran.module.ts` - Module definition and dependencies
- `quran.controller.ts` - API endpoints (upstream-compatible)
- `quran.service.ts` - Business logic and database operations
- `quran.sync.service.ts` - Sync from api.quran.com
- `quran.mapper.ts` - Data transformation utilities

**Responsibilities:**
- **Controller**: Expose upstream-compatible API endpoints
- **Service**: Read from database with fallback logic
- **Sync Service**: Pull data from upstream APIs
- **Mapper**: Transform upstream data to Prisma models

**API Endpoints:**
```
GET /api/v1/quran/chapters                    # All chapters
GET /api/v1/quran/verses/by_chapter/:id       # Verses by chapter
GET /api/v1/quran/verses/by_id/:id            # Specific verse
GET /api/v1/quran/resources/translations      # Available translations
GET /api/v1/quran/resources/recitations       # Available reciters
GET /api/v1/quran/search                      # Search functionality
GET /api/v1/quran/juz/:number                 # Juz information
GET /api/v1/quran/hizb/:number                # Hizb information
GET /api/v1/quran/page/:number                # Page information
GET /api/v1/quran/chapters/:id                # Specific chapter
```

**Data Models:**
- `QuranChapter` - Chapter information
- `QuranVerse` - Verse content and metadata
- `TranslationResource` - Translation resources
- `VerseTranslation` - Verse translations

**Sync Strategy:**
- Daily cron job at 03:00 UTC
- Pull chapters, verses, and translations
- Paginated verse fetching
- Idempotent upserts

---

### **5. Prayer Module (`src/prayer/`)**

**Purpose:** Prayer times management with live sync from Aladhan

**Components:**
- `prayer.module.ts` - Module definition and dependencies
- `prayer.controller.ts` - API endpoints (upstream-compatible)
- `prayer.service.ts` - Business logic and database operations
- `prayer.sync.service.ts` - Sync from api.aladhan.com
- `prayer.mapper.ts` - Data transformation utilities

**Responsibilities:**
- **Controller**: Expose upstream-compatible API endpoints
- **Service**: Read from database with fallback logic
- **Sync Service**: Pull data from upstream APIs
- **Mapper**: Transform Aladhan data to Prisma models

**API Endpoints:**
```
GET /api/v1/prayer/timings                    # Prayer times by coordinates
GET /api/v1/prayer/timingsByCity              # Prayer times by city
GET /api/v1/prayer/calendar                    # Monthly calendar by coordinates
GET /api/v1/prayer/calendarByCity              # Monthly calendar by city
GET /api/v1/prayer/qibla                       # Qibla direction
GET /api/v1/prayer/methods                     # Calculation methods
GET /api/v1/prayer/hijriCalendar               # Hijri calendar
GET /api/v1/prayer/gregorianCalendar           # Gregorian calendar
GET /api/v1/prayer/currentTime                 # Current time
GET /api/v1/prayer/dateConversion              # Date conversion
```

**Data Models:**
- `PrayerLocation` - Location information with hashed keys
- `PrayerTimes` - Daily prayer times

**Sync Strategy:**
- On-demand fetching for requested locations
- Optional pre-warming for common cities
- Location-based caching with hashed keys
- Support for multiple calculation methods

---

### **6. Sync Module (`src/sync/`)**

**Purpose:** Manage scheduled sync jobs and admin operations

**Components:**
- `sync.module.ts` - Module definition with ScheduleModule
- `sync.cron.service.ts` - Scheduled cron jobs
- `sync.controller.ts` - Admin endpoints

**Responsibilities:**
- **Cron Service**: Execute scheduled sync jobs
- **Admin Controller**: Manual sync triggers and status
- **Job Logging**: Track sync job success/failure
- **Error Handling**: Graceful failure handling

**Cron Jobs:**
```
0 3 * * *  # Daily at 03:00 UTC - Quran and Prayer sync
```

**Admin Endpoints:**
```
POST /admin/sync/run?job=quran|prayer    # Manual sync trigger
GET  /admin/sync/status                  # Sync job status
GET  /admin/health                       # Health with DB/Redis checks
```

**Dependencies:**
- `@nestjs/schedule`
- `@nestjs/terminus`

---

### **7. Existing Modules (Maintained)**

#### **Hadith Module (`src/hadith/`)**
- Maintains existing functionality
- Future: Integration with Sunnah.com API
- Current: Mock data with search capabilities

#### **Zakat Module (`src/zakat/`)**
- Maintains existing functionality
- Future: Integration with metal price APIs
- Current: Mock data with calculation logic

#### **Audio Module (`src/audio/`)**
- Maintains existing functionality
- Future: Integration with CDN/R2 storage
- Current: Mock data with URL signing

#### **Workers Module (`src/workers/`)**
- Maintains existing functionality
- Future: Integration with BullMQ queues
- Current: Basic background job management

---

## 🔄 **Data Flow Patterns**

### **1. Quran Data Flow**
```
api.quran.com → QuranSyncService → Prisma → QuranService → Controller → Mobile App
     ↓              ↓                ↓          ↓           ↓
  (Chapters)    (Transform)     (Store)    (Read)     (Format)    (Response)
  (Verses)      (Upsert)        (Cache)    (Cache)    (Compat)    (JSON)
  (Translations)
```

### **2. Prayer Data Flow**
```
api.aladhan.com → PrayerSyncService → Prisma → PrayerService → Controller → Mobile App
      ↓               ↓                ↓          ↓            ↓
   (Timings)      (Transform)      (Store)    (Read)      (Format)    (Response)
   (Calendar)     (Hash Key)       (Cache)    (Cache)     (Compat)    (JSON)
```

### **3. Fallback Flow**
```
Request → Database Check → Empty? → Upstream Fetch → Store → Return
   ↓           ↓           ↓           ↓           ↓       ↓
Controller   Service    Yes/No     SyncService   DB     Response
```

---

## 🔐 **Security & Access Control**

### **Public Endpoints**
- All Quran and Prayer API endpoints
- Health check endpoints
- Basic information endpoints

### **Protected Endpoints**
- Admin sync endpoints (`/admin/sync/*`)
- Health endpoints with detailed information
- Manual sync triggers

### **Authentication**
- JWT-based authentication for admin endpoints
- Rate limiting for public endpoints
- IP-based restrictions for admin access

---

## 📊 **Performance & Caching**

### **Redis Caching Strategy**
```
Endpoint Type          TTL         Invalidation
─────────────────────────────────────────────────
Quran Chapters        24 hours    On sync completion
Quran Verses          1 hour      On sync completion
Quran Search          1 hour      On sync completion
Prayer Times          12 hours    Daily at 03:00 UTC
Prayer Calendar       24 hours    Daily at 03:00 UTC
Translation Resources 24 hours    On sync completion
```

### **Database Indexing**
```sql
-- Quran
CREATE INDEX idx_quran_verse_chapter ON quran_verse(chapter_number);
CREATE INDEX idx_quran_verse_page ON quran_verse(page_number);

-- Prayer
CREATE INDEX idx_prayer_times_location_date ON prayer_times(loc_key, date);
CREATE INDEX idx_prayer_times_method ON prayer_times(method);

-- Sync
CREATE INDEX idx_sync_job_status ON sync_job_log(status, started_at);
```

---

## 🚨 **Error Handling & Resilience**

### **Sync Job Resilience**
- Exponential backoff for upstream API failures
- Graceful degradation when sync fails
- Fallback to cached data when available
- Comprehensive error logging and monitoring

### **API Resilience**
- Graceful fallback to upstream APIs
- Rate limiting and circuit breaker patterns
- Timeout handling for slow responses
- Consistent error response formats

---

## 📈 **Monitoring & Observability**

### **Metrics to Track**
- Sync job success/failure rates
- API response times and error rates
- Database query performance
- Redis cache hit/miss rates
- Upstream API availability

### **Health Checks**
- Database connectivity
- Redis connectivity
- Upstream API availability
- Sync job status
- Overall system health

---

## 🔗 **Dependencies & Integration**

### **External Dependencies**
- **Quran.com API**: Chapters, verses, translations
- **Aladhan API**: Prayer times, calendar, methods
- **PostgreSQL**: Primary data storage
- **Redis**: Caching and session management

### **Internal Dependencies**
- **Prisma**: Database ORM and migrations
- **NestJS Schedule**: Cron job management
- **Axios**: HTTP client with retry logic
- **JWT**: Authentication for admin endpoints

---

## 📝 **Configuration Management**

### **Environment Variables**
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/deenmate
REDIS_URL=redis://localhost:6379

# Upstream APIs
QURAN_API_BASE=https://api.quran.com/api/v4
ALADHAN_API_BASE=https://api.aladhan.com/v1

# Sync Configuration
SYNC_CRON_DAILY=0 3 * * *
HTTP_TIMEOUT_MS=15000
HTTP_MAX_RETRIES=3
HTTP_RETRY_BACKOFF_MS=500

# Features
UPSTREAM_COMPAT_DEFAULT=true
ENABLE_UPSTREAM_PROXY=true
```

---

## 🎯 **Module Readiness Matrix**

| Module | Design | DB Models | API | Sync | Cache | Tests | Status |
|--------|--------|-----------|-----|------|-------|-------|---------|
| **Common** | ✅ | N/A | N/A | N/A | N/A | ⏳ | 🔄 In Progress |
| **Database** | ✅ | ✅ | N/A | N/A | N/A | ✅ | ✅ Complete |
| **Redis** | ✅ | N/A | N/A | N/A | ✅ | ✅ | ✅ Complete |
| **Quran** | ✅ | ⏳ | ✅ | ⏳ | ✅ | ✅ | 🔄 In Progress |
| **Prayer** | ✅ | ⏳ | ✅ | ⏳ | ✅ | ✅ | 🔄 In Progress |
| **Sync** | ✅ | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ Pending |
| **Hadith** | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ✅ Complete |
| **Zakat** | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ✅ Complete |
| **Audio** | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ✅ Complete |
| **Workers** | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ✅ Complete |

**Legend:** ✅ Complete, 🔄 In Progress, ⏳ Pending, N/A Not Applicable

---

## 🔗 **Related Documents**

- `docs/backend/TODO.md` - Detailed task breakdown
- `docs/backend/PROJECT_TRACKING.md` - Sprint board and progress tracking
- `docs/backend/IMPLEMENTATION_PLAN.md` - Step-by-step implementation guide
- `docs/backend/api-spec.md` - API specifications and compatibility matrix
- `docs/backend/sync-strategy.md` - Sync strategy and cron job details

---

*Last updated: September 4, 2025*
