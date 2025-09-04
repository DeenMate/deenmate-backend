# DeenMate API Proxy Mode Setup Guide

## Overview

This guide explains how to set up and configure the DeenMate API in proxy mode, which mirrors third-party APIs for Quran and Prayer Times data.

## Environment Configuration

Create a `.env` file in your project root with the following configuration:

```bash
# DeenMate API Configuration

# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database (for existing modules)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/deenmate

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_ENABLED=true

# Upstream API Configuration
QURAN_API_BASE=https://api.quran.com/v4
PRAYER_API_BASE=https://api.aladhan.com/v1

# JWT Authentication (for future use)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting (for future use)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# CORS (for future use)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring (for future use)
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true

# External APIs (for future use)
ALADHAN_API_URL=https://api.aladhan.com
SUNNAH_API_KEY=your-sunnah-api-key-here
GOLD_PRICE_API_KEY=your-gold-price-api-key-here

# CDN/Storage (for future use)
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key-here
CLOUDFLARE_R2_BUCKET=deenmate-audio
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xyz.r2.dev
```

## Key Configuration Variables

### Upstream API Configuration
- **`QURAN_API_BASE`**: Base URL for the Quran API (default: `https://api.quran.com/v4`)
- **`PRAYER_API_BASE`**: Base URL for the Prayer Times API (default: `https://api.aladhan.com/v1`)

### Redis Configuration
- **`REDIS_ENABLED`**: Enable/disable Redis caching (default: `false`)
- **`REDIS_URL`**: Redis connection string
- **`REDIS_PASSWORD`**: Redis password (if required)
- **`REDIS_DB`**: Redis database number

## Installation and Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Infrastructure Services
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 10
```

### 3. Set Up Database
```bash
# Generate Prisma client
npm run db:generate

# Run migrations (if any)
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### 4. Start the Application
```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

## Testing the Proxy Endpoints

### Quran API Endpoints

#### Get All Chapters
```bash
curl "http://localhost:3000/api/v1/quran/chapters"
```

#### Get Verses by Chapter
```bash
curl "http://localhost:3000/api/v1/quran/verses/by_chapter/1?page=1&per_page=10"
```

#### Get Specific Verse
```bash
curl "http://localhost:3000/api/v1/quran/verses/by_id/1"
```

#### Search Quran
```bash
curl "http://localhost:3000/api/v1/quran/search?q=bismillah&size=10&page=1"
```

#### Get Juz Information
```bash
curl "http://localhost:3000/api/v1/quran/juz/1"
```

#### Get Hizb Information
```bash
curl "http://localhost:3000/api/v1/quran/hizb/1"
```

#### Get Page Information
```bash
curl "http://localhost:3000/api/v1/quran/page/1"
```

### Prayer API Endpoints

#### Get Prayer Times by Coordinates
```bash
curl "http://localhost:3000/api/v1/prayer/timings?latitude=23.8103&longitude=90.4125&date=04-09-2025"
```

#### Get Prayer Times by City
```bash
curl "http://localhost:3000/api/v1/prayer/timingsByCity?city=Dhaka&country=Bangladesh&date=04-09-2025"
```

#### Get Prayer Calendar
```bash
curl "http://localhost:3000/api/v1/prayer/calendar?latitude=23.8103&longitude=90.4125&month=9&year=2025"
```

#### Get Qibla Direction
```bash
curl "http://localhost:3000/api/v1/prayer/qibla?latitude=23.8103&longitude=90.4125"
```

#### Get Prayer Methods
```bash
curl "http://localhost:3000/api/v1/prayer/methods"
```

#### Get Current Time
```bash
curl "http://localhost:3000/api/v1/prayer/currentTime"
```

## Response Headers

All responses include a `X-DeenMate-Source` header indicating the data source:
- **`upstream`**: Data fetched from the third-party API
- **`cache`**: Data returned from Redis cache

## Caching Strategy

### Quran Data
- **Chapters, Verses, Translations, Reciters**: 24 hours (86400 seconds)
- **Search Results**: 1 hour (3600 seconds)
- **Juz, Hizb, Page Information**: 24 hours (86400 seconds)

### Prayer Data
- **Prayer Times**: Dynamic TTL based on current time (until next prayer)
- **Prayer Calendar**: 24 hours (86400 seconds)
- **Qibla Direction**: 24 hours (86400 seconds)
- **Prayer Methods**: 24 hours (86400 seconds)
- **Current Time**: 1 minute (60 seconds)

## Fallback Behavior

The API is designed as a **drop-in replacement** for the upstream APIs:

1. **If our backend is up**: Returns data from cache or upstream API
2. **If our backend is down**: Mobile apps can directly call upstream APIs without code changes
3. **Same URL structure**: All endpoints mirror the upstream API structure
4. **Same JSON schema**: Responses maintain the exact same format

## Monitoring and Debugging

### Logs
The application logs all API calls with source information:
```
[QuranService] Fetching chapters from upstream API
[QuranService] Fetched 114 chapters from upstream
[PrayerService] Returning prayer timings for 23.8103,90.4125 from cache
```

### Response Headers
Check the `X-DeenMate-Source` header to see if data came from cache or upstream.

### Health Checks
```bash
# Application health
curl "http://localhost:3000/health"

# Application readiness
curl "http://localhost:3000/ready"
```

## Troubleshooting

### Common Issues

#### 1. Upstream API Unavailable
**Symptoms**: 500 errors, timeout errors
**Solution**: Check if the upstream APIs are accessible from your network

#### 2. Redis Connection Issues
**Symptoms**: Cache not working, Redis connection errors
**Solution**: 
- Verify Redis is running: `docker ps | grep redis`
- Check Redis connection: `redis-cli ping`
- Verify `.env` configuration

#### 3. Invalid Parameters
**Symptoms**: 400 Bad Request errors
**Solution**: Check parameter validation in the controllers

#### 4. CORS Issues
**Symptoms**: Browser blocking requests
**Solution**: Configure CORS settings in your environment

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## Performance Considerations

### Caching Benefits
- **Reduced Latency**: Cached responses are much faster
- **Reduced Load**: Fewer calls to upstream APIs
- **Better Reliability**: Cached data available even if upstream is slow

### Cache Warming
Consider implementing cache warming for frequently accessed data:
- Quran chapters and translations
- Prayer calculation methods
- Popular prayer time locations

### Rate Limiting
The upstream APIs may have rate limits. Monitor your usage and implement appropriate rate limiting if needed.

## Security Considerations

### Input Validation
All parameters are validated before being passed to upstream APIs:
- Numeric parameters are parsed and validated
- String parameters are checked for required values
- Array parameters are properly split and parsed

### Error Handling
Errors from upstream APIs are properly handled and don't expose internal system information.

### Headers
The `X-DeenMate-Source` header is for debugging purposes only and doesn't expose sensitive information.

## Next Steps

### Phase 2: Enhanced Caching
- Implement cache warming strategies
- Add cache invalidation policies
- Monitor cache hit ratios

### Phase 3: Authentication
- Add JWT-based authentication
- Implement user-specific caching
- Add rate limiting per user

### Phase 4: Data Storage
- Store frequently accessed data locally
- Implement data synchronization
- Add offline capabilities

---

*This proxy mode implementation provides a solid foundation for building a comprehensive Islamic API while maintaining compatibility with existing third-party services.*
