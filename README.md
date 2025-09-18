# 🕌 DeenMate API - Unified Monolithic Backend

Production backend for DeenMate — Islamic content APIs with unified monolithic architecture.

## 📚 **Documentation**

**⚠️ IMPORTANT**: This project has **TWO** single sources of truth:

1. **[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)** - Comprehensive project context, architecture, and development guidelines
2. **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Project tracking, sprint management, module status, and development progress

## 🎯 **Current Status: PRODUCTION READY** ✅

**Last Updated**: September 17, 2025  
**Status**: Production Ready - All Systems Operational with Enhanced Aladhan API Integration

### ✅ **Major Completed Features:**
- **Monolithic Architecture**: Successfully unified all microservices into single NestJS application
- **Admin Dashboard**: Full-featured Next.js admin interface with JWT authentication
- **JWT Authentication**: Secure admin authentication system with refresh tokens and role-based access
- **Security Headers**: Comprehensive security headers middleware (CSP, XSS protection, HSTS)
- **Password Policy**: Strong password complexity requirements with validation
- **Audio URL Validation**: Comprehensive URL validation with trusted domain checking
- **Comprehensive Test Coverage**: 100% test success rate (23/23 tests passing, 6/6 test suites passing)
- **Module Organization**: Clean separation with `src/modules/` structure  
- **Database Integration**: PostgreSQL + Redis working perfectly
- **API Compatibility**: 100% backward compatible with existing endpoints
- **Build System**: All TypeScript compilation errors resolved
- **Application Startup**: Successfully running on http://localhost:3000
- **Admin Dashboard**: Running on http://localhost:3001 with full sync capabilities
- **Gold Price Parser**: Fixed and working with accurate Bajus website parsing
- **Hadith Sync**: Local database sync working (bypassing external API issues)
- **Cron Jobs**: All scheduled tasks operational with BullMQ queue system
- **Enhanced Aladhan API Integration**: Complete P0/P1 priority features implemented
- **High Latitude Adjustments**: Support for Arctic/Antarctic regions
- **Prayer Time Tuning**: Minute-level adjustments for local preferences
- **Timezone String Support**: Proper IANA timezone handling
- **Calendar Endpoints**: Bulk monthly syncing for efficiency
- **Hijri Calendar Integration**: Islamic calendar support
- **Date Conversion Utilities**: Gregorian-Hijri conversion
- **Asma Al Husna API**: Names of Allah integration

### 🔐 **Latest Security Improvements (September 2025):**
- **JWT Token Refresh**: Implemented secure refresh token mechanism with 15-minute access tokens
- **Security Headers**: Added comprehensive security headers middleware (CSP, XSS protection, HSTS)
- **Password Policy**: Implemented strong password complexity requirements with 8+ validation rules
- **Audio URL Validation**: Added trusted domain checking and format validation for audio URLs
- **Change Password API**: Added secure password change functionality with current password verification

### 🎵 **Audio Module Completion (September 2025):**
- **Complete Chapter Coverage**: All 114 chapters verified and working
- **Audio Files**: 12,744 audio files synced across all reciters
- **Reciter Coverage**: 12 active reciters fully synced
- **API Endpoints**: All audio endpoints functional and tested
- **Verification**: Comprehensive testing across all chapters (1, 2, 3, 10, 25, 50, 75, 100, 110, 114)

### 🕌 **Enhanced Aladhan API Integration (September 2025):**
- **High Latitude Adjustments**: Support for Arctic/Antarctic regions (0=None, 1=Middle, 2=OneSeventh, 3=AngleBased)
- **Prayer Time Tuning**: Minute-level adjustments for local preferences ("fajr,sunrise,dhuhr,asr,maghrib,isha")
- **Timezone String Support**: Proper IANA timezone handling ("Asia/Dhaka", "America/New_York")
- **Calendar Endpoints**: Bulk monthly syncing for efficiency (30x reduction in API calls)
- **Hijri Calendar Integration**: Islamic calendar support for Hijri date syncing
- **Date Conversion Utilities**: Gregorian-Hijri date conversion using Aladhan API
- **Asma Al Husna API**: 99 beautiful names of Allah integration
- **Enhanced Error Handling**: Comprehensive error handling and logging
- **Database Schema Updates**: New fields for latitudeAdjustmentMethod, tune, timezone, midnightMode
- **API Endpoints**: All new admin endpoints properly registered and accessible

### 🧪 **Comprehensive Test Coverage Completion (September 2025):**
- **Test Success Rate**: 100% (23/23 tests passing)
- **Test Suite Success**: 100% (6/6 test suites passing)
- **Coverage Areas**: All critical modules (Finance, Prayer, Quran, Sync, Hadith, BullMQ)
- **Quality Assurance**: Comprehensive testing of all major functionality
- **Production Readiness**: High confidence in system stability and reliability
- **Maintainability**: Well-tested codebase for future development

### ✅ **Admin Dashboard Features:**
- **Secure Login**: JWT-based authentication with admin user management
- **Module Overview**: Real-time dashboard showing all module statuses
- **Manual Sync**: Trigger sync jobs for Quran, Hadith, Prayer, Audio, Finance
- **System Health**: Monitor database, Redis, and external API connections
- **Queue Management**: View and monitor background job processing
- **Responsive UI**: Modern interface built with Next.js, Tailwind CSS, and shadcn/ui

### ✅ **Admin Dashboard Updates (Sep 11, 2025):**
- **Content Management (Primary)**: Restored original page with tabs — **Browse, Edit, Import, Export**, top **Search**, and **Add New**; server-side pagination with accurate totals
- **User Management**: Complete CRUD operations for admin users with roles and permissions
- **Security Features**: Audit logging, session management, and rate limiting
- **Module Detail Modal**: Optional manage-only flow with CRUD and pagination (not the default)
- **UX Improvements**: Breadcrumbs, active navigation states, and consistent layouts
- **Security Fixes**: Removed hardcoded credentials and fixed runtime errors

### ✅ **All Critical Systems Operational:**
- **Zakat API**: ✅ **FULLY OPERATIONAL** - All endpoints returning 200 status codes
- **Audio API**: ✅ **FULLY OPERATIONAL** - All 114 chapters synced (12,744 audio files)
- **Test Coverage**: ✅ **100% SUCCESS RATE** - All 23 tests passing, 6/6 test suites
- **BullMQ Processors**: ✅ **IMPLEMENTED** - All sync job processors working
- **Security**: ✅ **COMPREHENSIVE** - Security headers, password policy, JWT refresh

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation
```bash
# Clone and setup
git clone <repository>
cd deenmate-api

# Environment setup
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure
docker-compose up -d postgres redis

# Install dependencies
npm install

# Database setup
npx prisma migrate deploy
npx prisma generate

# Build and start
npm run build
npm run start:dev
```

### Access Points
- **API Base**: `http://localhost:3000/api`
- **Admin Dashboard**: `http://localhost:3001` (Next.js frontend)
- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI JSON**: `http://localhost:3000/docs-json`
- **Health Check**: `http://localhost:3000/api/v4/health`
- **System Ready**: `http://localhost:3000/api/v4/ready`

### 🧪 **Quick Test**
```bash
# Test health endpoint
curl http://localhost:3000/api/v4/health

# Test working APIs
curl http://localhost:3000/api/v4/quran/chapters                    # Quran chapters (114 chapters synced)
curl http://localhost:3000/api/v4/quran/verses/by_chapter/1         # Quran verses (6,236 verses synced)
curl http://localhost:3000/api/v1/prayer/timings?latitude=23.8103&longitude=90.4125  # Prayer times (working)
curl http://localhost:3000/api/v4/finance/gold-prices/latest        # Gold prices (working - fixed parser)
curl http://localhost:3000/api/v4/admin/summary                     # Admin summary (JWT protected)

# Hadith (served from DB - imported)
curl "http://localhost:3000/api/v4/hadith/collections?lang=en"
curl "http://localhost:3000/api/v4/hadith/collections/1/books?lang=en"               # Bukhari (id=1)
curl "http://localhost:3000/api/v4/hadith/collections/1/books/1/hadiths?per_page=5"  # Bukhari Book 1
curl "http://localhost:3000/api/v4/hadith/4647?lang=en"                               # Get by ID example
curl "http://localhost:3000/api/v4/hadith/collections/bukhari/1?lang=en"             # Get by collection/name

# Admin Dashboard (JWT Authentication Required)
# 1. Login to get JWT token
curl -X POST http://localhost:3000/api/v4/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@deenmate.app","password":"admin123"}'

# 2. Use JWT token for admin endpoints
curl -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3000/api/v4/admin/summary
curl -X POST -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3000/api/v4/admin/sync/quran

# Test all APIs (all working)
curl http://localhost:3000/api/v4/zakat/nisab                       # Zakat API (✅ working - 200 status)
curl http://localhost:3000/api/v4/audio/reciters                    # Audio API (✅ working - all 114 chapters synced)
```

## 📚 API Modules

### Prayer API (v1) - Aladhan.com Compatible
```
/api/v1/prayer/
├── timings                    # Prayer times
├── timingsByCity             # Prayer times by city
├── calendar                  # Monthly calendar
├── methods                   # Calculation methods
└── qibla                     # Qibla direction
```

### Quran API (v4) - Quran.com Compatible
```
/api/v4/quran/
├── verses/by_chapter/:id     # Chapter verses (snake_case fields, includes text variants)
├── verses/:verseKey          # Specific verse (camelCase fields, includes text variants)
├── verses/:verseKey/translations           # Verse translations (db-first, upstream fallback)
├── tafsirs?language=en       # Tafsir resources (cached fallback)
├── verses/:verseKey/tafsir?tafsirId=169                # Single tafsir
├── verses/:verseKey/tafsir?tafsirIds=169,168[&plain=true]  # Multi-tafsir; optional plain text
├── reciters[?language=en]    # Reciters list (cached fallback)
├── recitations/:id/by_chapter/:chapterId[?page&per_page]   # Verse-by-verse audio (full URLs)
├── recitations/:id/by_ayah/:verseKey                     # Single-ayah audio (full URL)
├── chapters                  # Chapters list
├── search                    # Search verses
└── juzs                      # Juz divisions
```

Planned enhancements:
- Text variants: support `text_simple`, `text_indopak`, `text_imlaei` in sync + fallback
- Audio QA: verify per-ayah/per-chapter audio across key reciters (in progress)
- Tafsir: exposed resources list and per-verse tafsir; supports multi-ID and plain text option

### Hadith API (v4) - Sunnah.com Integration (via imported data)
```
/api/v4/hadith/
├── collections               # Hadith collections
├── collections/:id/books     # Collection books
├── collections/:collectionId/books/:bookId/hadiths  # Hadith list for a book (paginated)
├── collections/:collectionName/:hadithNumber       # Get hadith by collection and number
├── search                    # Search hadiths (basic)
└── :id                       # Specific hadith
```

Notes:
- Data source for read endpoints is our Postgres DB, populated from Sunnah.com's SQL dump.
- Sunnah.com live API access (for your key):
  - Working: `/v1/collections`, `/v1/collections/{collection}/books`, `/v1/collections/{collection}/books/{bookNumber}/hadiths`
  - Not exposed for key: `/v1/collections/{collection}/hadiths`


### Admin API (v4) - JWT Protected
```
/api/v4/admin/
├── auth/
│   ├── login                 # Admin login (returns JWT)
│   ├── logout                # Admin logout
│   ├── profile               # Get admin profile
│   ├── refresh               # Refresh JWT token
│   ├── change-password       # Change admin password
│   └── password-requirements # Get password requirements
├── summary                   # System overview dashboard
├── health                    # System health check
├── sync/:module              # Trigger module sync (quran, hadith, prayer, audio, finance)
├── sync-logs                 # View sync job logs
├── queue-stats               # BullMQ queue statistics
├── cache/clear               # Clear system cache
├── users/                    # User management (CRUD operations)
└── content/:module           # Content management (CRUD operations)
```

### Enhanced Prayer API (v4) - Aladhan Integration
```
/api/v4/admin/sync/prayer/
├── times                     # Enhanced prayer times sync with Aladhan parameters
├── calendar                  # Monthly calendar sync (bulk efficiency)
└── hijri-calendar           # Hijri calendar sync

/api/v4/admin/prayer/
├── convert/
│   ├── gregorian-to-hijri   # Convert Gregorian to Hijri date
│   └── hijri-to-gregorian   # Convert Hijri to Gregorian date
├── current-time             # Get current time in timezone
└── asma-al-husna           # Get 99 names of Allah
```

**Enhanced Parameters:**
- `latitudeAdjustmentMethod`: High latitude adjustments (0=None, 1=Middle, 2=OneSeventh, 3=AngleBased)
- `tune`: Minute offsets for prayer times ("fajr,sunrise,dhuhr,asr,maghrib,isha")
- `timezonestring`: IANA timezone support ("Asia/Dhaka", "America/New_York")

### Other APIs (v4)
```
/api/v4/zakat/                # Zakat calculations
/api/v4/audio/                # Quran audio recitations
/api/v4/finance/              # Gold/silver prices
```

Finance (Gold) notes:
- Parser fixed and working with accurate Bajus website parsing
- Categories: 22K, 21K, 18K, TRADITIONAL for both Gold and Silver
- API supports unit conversion between Gram and Vori (11.664 grams per vori)
- Real-time prices from official BAJUS website

## 🏗️ Architecture

### Monolithic Structure
```
src/
├── main.ts                   # Application entry point
├── app.module.ts            # Root module
├── database/                # Database infrastructure
├── redis/                   # Redis infrastructure
├── common/                  # Shared utilities
├── utils/                   # Utility services
├── workers/                 # Background workers
└── modules/                 # Feature modules
    ├── quran/              # Quran API
    ├── prayer/             # Prayer API
    ├── hadith/             # Hadith API
    ├── zakat/              # Zakat API
    ├── audio/              # Audio API
    ├── finance/            # Finance API
    ├── admin/              # Admin API + JWT Auth
    └── common/             # Shared module utilities

admin-dashboard/             # Next.js Admin Frontend
├── src/
│   ├── app/                # Next.js 13+ app router
│   │   ├── login/          # Admin login page
│   │   ├── dashboard/      # Main dashboard
│   │   └── layout.tsx      # Root layout
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   └── layout/         # Layout components
│   └── lib/                # Utilities and API client
└── package.json            # Frontend dependencies
```

### Key Features
- ✅ **Unified Architecture**: Single monolithic application
- ✅ **Module Separation**: Each feature logically separated
- ✅ **API Compatibility**: 100% backward compatible
- ✅ **Multi-Version Support**: v1 (Prayer) and v4 (Others)
- ✅ **Live Data Sync**: Real-time data from upstream APIs
- ✅ **Scheduled Tasks**: Unified cron job management with BullMQ
- ✅ **Admin Dashboard**: Full-featured Next.js admin interface
- ✅ **JWT Authentication**: Secure admin authentication system
- ✅ **Queue Management**: Asynchronous job processing
- ✅ **Production Ready**: PostgreSQL, Redis, monitoring

## 🔧 Development

### Scripts
```bash
# Backend (NestJS)
npm run start:dev          # Development server
npm run build              # Build application
npm run test               # Run tests
npm run lint               # Lint code
npm run db:studio          # Database GUI
npm run db:migrate         # Run migrations

# Admin Dashboard (Next.js)
cd admin-dashboard
npm run dev                # Start admin dashboard (port 3001)
npm run build              # Build admin dashboard
npm run lint               # Lint admin dashboard
```

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/deenmate

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# External APIs
SUNNAH_API_KEY=your_api_key

# Application
NODE_ENV=development
APP_PORT=3000

# JWT Authentication
JWT_SECRET=your_jwt_secret_key

# Admin User (for seeding)
ADMIN_EMAIL=admin@deenmate.app
ADMIN_PASSWORD=admin123
ADMIN_ROLE=super_admin
```

## 📖 Documentation

- **Architecture**: `docs/backend/MONOLITHIC_ARCHITECTURE.md`
- **Hadith Integration**: `docs/backend/HADITH_INTEGRATION.md`
- **API Reference**: `docs/api/`
- **Deployment**: `docs/api/deployment-guide.md`

## 🚀 Deployment

### Docker
```bash
# Build and run
docker-compose up -d

# Or build custom image
docker build -t deenmate-api .
docker run -p 3000:3000 deenmate-api
```

### Production Checklist
- [x] Environment variables configured
- [x] Database migrations applied
- [x] Redis instance running
- [x] External API keys configured
- [x] Application startup successful
- [x] Core APIs working (Quran, Prayer, Gold Price, Admin)
- [x] Quran data synced (114 chapters, 6,236 verses)
- [x] Prayer data working (real-time with fallback)
- [x] Gold price data working (real-time from BAJUS - parser fixed)
- [x] Admin monitoring working (comprehensive stats)
- [x] Admin dashboard operational (Next.js frontend)
- [x] JWT authentication implemented
- [x] BullMQ queue system working
- [x] Cron jobs operational
- [x] Hadith sync working (local database)
- [x] **Zakat API working** (all endpoints returning 200 status codes)
- [x] **Audio API working** (all 114 chapters synced - 12,744 audio files)
- [x] **Test coverage complete** (100% success rate - 23/23 tests passing)
- [x] **Security implemented** (comprehensive headers, password policy, JWT refresh)
- [x] **BullMQ processors implemented** (all sync job processors working)
- [ ] SSL certificates installed
- [ ] Production monitoring configured
- [ ] Backup strategy implemented

## 🔍 Monitoring

### Health Checks
- **System Health**: `GET /api/v4/health`
- **System Ready**: `GET /api/v4/ready` (includes Redis check)
- **Database**: Automatic connection monitoring
- **Redis**: Connection status tracking
- **External APIs**: Upstream service monitoring

### Logging
- **Structured Logging**: JSON format for production
- **Module Loggers**: Separate loggers per module
- **Error Tracking**: Comprehensive error logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information
4. Contact the development team
