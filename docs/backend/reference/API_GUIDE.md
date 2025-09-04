# API_GUIDE

# API Specification

This project exposes REST APIs for Quran, Prayer Times, Hadith, Zakat and more.

## Swagger / OpenAPI

- Swagger UI: `/docs`
- JSON: `/docs-json`
- Global prefix: `/api/v1`
- Bearer Auth is enabled; use `Bearer <token>` in the Authorize dialog

Many responses are upstream-compatible (Quran.com / Aladhan). The Swagger descriptions on the endpoints indicate when shapes mirror upstream APIs to ease client interoperability.

---

## Executive Summary

This document defines the REST API endpoints for the DeenMate backend service. The API is designed to replace direct third-party API calls from the mobile app with a unified, cached, and optimized backend service. **All endpoints return JSON that exactly matches upstream API responses**, ensuring seamless compatibility and allowing the mobile app to switch between our backend and upstream APIs without code changes.

---

## 🔄 **Upstream Compatibility (NEW)**

### **Compatibility Principles**

DeenMate API is designed as a **drop-in replacement** for upstream APIs:

1. **Exact JSON Structure**: All responses match upstream API JSON structure exactly
2. **Same URL Patterns**: Endpoints mirror upstream API paths
3. **Identical Parameters**: Support all query parameters from upstream APIs
4. **Seamless Fallback**: Mobile app can switch to upstream APIs if backend is down

### **Upstream API Sources**

| Service | Base URL | Purpose | Sync Strategy |
|---------|----------|---------|---------------|
| **Quran.com** | `https://api.quran.com/api/v4` | Quran chapters, verses, translations | Daily cron at 03:00 UTC |
| **Aladhan** | `https://api.aladhan.com/v1` | Prayer times, calendar, methods | On-demand + daily pre-warm |

### **Compatibility Query Parameter**

All endpoints support a `compat` query parameter:

- `compat=upstream` (default): Return exact upstream JSON structure
- `compat=native`: Return DeenMate's internal format (if different)

**Example:**
```
GET /api/v1/quran/chapters?compat=upstream
GET /api/v1/quran/chapters?compat=native
```

### **Response Headers**

All responses include additional headers for debugging:

```
X-DeenMate-Source: cache|database|upstream
X-DeenMate-Cache-TTL: 86400
X-Upstream-API: quran.com|aladhan
```

---

## 1. API Overview

### 1.1 Base Configuration

```yaml
openapi: 3.1.0
info:
  title: DeenMate API
  version: 1.0.0
  description: Islamic content API for DeenMate mobile application with upstream compatibility
servers:
  - url: https://api.deenmate.app/v1
    description: Production server
  - url: https://staging-api.deenmate.app/v1
    description: Staging server
```

### 1.2 Authentication

**API Key Authentication**:
```http
Authorization: Bearer <api_key>
X-API-Key: <api_key>
```

**Anonymous Access**:
- Most read endpoints are publicly accessible
- Rate limiting applies to anonymous users
- Enhanced features require authentication

### 1.3 Common Response Format

**Upstream-Compatible Format (Default)**:
```json
{
  "code": 200,
  "status": "OK",
  "data": { /* exact upstream response structure */ }
}
```

**DeenMate Native Format** (when `compat=native`):
```json
{
  "success": true,
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2025-09-04T10:30:00Z",
    "version": "1.0.0",
    "request_id": "req_123456",
    "source": "cache|database|upstream"
  },
  "pagination": { /* if applicable */ }
}
```

**Error Response Format**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid chapter number. Must be between 1 and 114.",
    "details": {
      "field": "chapter_id",
      "value": "115"
    }
  },
  "meta": {
    "timestamp": "2025-09-04T10:30:00Z",
    "request_id": "req_123456"
  }
}
```

---

## 2. Quran API Endpoints (Upstream-Compatible)

### 2.1 Get Quran Chapters

**Endpoint**: `GET /quran/chapters`

**Description**: Retrieve list of all Quran chapters with metadata

**Parameters**: 
- `compat` (optional): `upstream` (default) or `native`

**Upstream-Compatible Response** (default):
```json
{
  "code": 200,
  "status": "OK",
  "data": {
    "chapters": [
      {
        "id": 1,
        "name_arabic": "الفاتحة",
        "name_simple": "Al-Fatihah",
        "name_english": "The Opening",
        "revelation_place": "Mecca",
        "verses_count": 7
      }
    ]
  }
}
```

**DeenMate Native Response** (when `compat=native`):
```json
{
  "success": true,
  "data": {
    "chapters": [
      {
        "chapterNumber": 1,
        "nameArabic": "الفاتحة",
        "nameSimple": "Al-Fatihah",
        "nameEnglish": "The Opening",
        "revelationPlace": "Mecca",
        "versesCount": 7
      }
    ]
  },
  "meta": {
    "timestamp": "2025-09-04T10:30:00Z",
    "version": "1.0.0",
    "source": "database"
  }
}
```

### 2.2 Get Verses by Chapter

**Endpoint**: `GET /quran/verses/by_chapter/:id`

**Description**: Retrieve verses for a specific chapter with pagination

**Parameters**:
- `id` (path): Chapter number (1-114)
- `page` (query): Page number (default: 1)
- `per_page` (query): Verses per page (default: 50)
- `language` (query): Language code (e.g., "en", "ar")
- `translations` (query): Comma-separated translation resource IDs
- `compat` (query): `upstream` (default) or `native`

**Upstream-Compatible Response**:
```json
{
  "code": 200,
  "status": "OK",
  "data": {
    "verses": [
      {
        "id": 1,
        "verse_number": 1,
        "chapter_id": 1,
        "text_uthmani": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        "text_simple": "bismillāhi r-raḥmāni r-raḥīm",
        "page_number": 1,
        "juz_number": 1,
        "hizb_number": 1
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 50,
      "total_pages": 1,
      "total_count": 7
    }
  }
}
```

### 2.3 Get Translation Resources

**Endpoint**: `GET /quran/resources/translations`

**Description**: Retrieve available translation resources

**Parameters**:
- `compat` (query): `upstream` (default) or `native`

**Upstream-Compatible Response**:
```json
{
  "code": 200,
  "status": "OK",
  "data": {
    "translations": [
      {
        "id": 131,
        "name": "The Clear Quran",
        "author_name": "Dr. Mustafa Khattab",
        "language_name": "English",
        "language_code": "en"
      }
    ]
  }
}
```

---

## 3. Prayer API Endpoints (Upstream-Compatible)

### 3.1 Get Prayer Times

**Endpoint**: `GET /prayer/timings`

**Description**: Retrieve prayer times by coordinates

**Parameters**:
- `latitude` (query): Latitude coordinate (required)
- `longitude` (query): Longitude coordinate (required)
- `date` (query): Date in DD-MM-YYYY format (default: today)
- `method` (query): Calculation method ID (default: 1)
- `school` (query): School of thought (0: Shafi, 1: Hanafi)
- `compat` (query): `upstream` (default) or `native`

**Upstream-Compatible Response**:
```json
{
  "code": 200,
  "status": "OK",
  "data": {
    "timings": {
      "Fajr": "05:30",
      "Sunrise": "07:15",
      "Dhuhr": "12:30",
      "Asr": "15:45",
      "Sunset": "17:45",
      "Maghrib": "18:00",
      "Isha": "19:30"
    },
    "date": {
      "readable": "04 Sep 2025",
      "timestamp": "1630752000",
      "gregorian": {
        "date": "04-09-2025",
        "format": "DD-MM-YYYY",
        "day": "04",
        "weekday": {
          "en": "Thursday"
        },
        "month": {
          "number": 9,
          "en": "September"
        },
        "year": "2025"
      },
      "hijri": {
        "date": "22-02-1447",
        "format": "DD-MM-YYYY",
        "day": "22",
        "weekday": {
          "en": "Al Khamees"
        },
        "month": {
          "number": 2,
          "en": "Safar"
        },
        "year": "1447"
      }
    },
    "meta": {
      "latitude": 23.8103,
      "longitude": 90.4125,
      "timezone": "Asia/Dhaka",
      "method": {
        "id": 1,
        "name": "Muslim World League",
        "params": {
          "Fajr": 18,
          "Isha": 17
        }
      },
      "latitudeAdjustmentMethod": "ANGLE_BASED",
      "midnightMode": "STANDARD",
      "school": "STANDARD",
      "offset": {}
    }
  }
}
```

### 3.2 Get Prayer Times by City

**Endpoint**: `GET /prayer/timingsByCity`

**Description**: Retrieve prayer times by city name

**Parameters**:
- `city` (query): City name (required)
- `country` (query): Country name (required)
- `state` (query): State/province (optional)
- `date` (query): Date in DD-MM-YYYY format (default: today)
- `method` (query): Calculation method ID (default: 1)
- `school` (query): School of thought (0: Shafi, 1: Hanafi)
- `compat` (query): `upstream` (default) or `native`

**Response**: Same structure as `/prayer/timings`

### 3.3 Get Calculation Methods

**Endpoint**: `GET /prayer/methods`

**Description**: Retrieve available calculation methods

**Parameters**:
- `compat` (query): `upstream` (default) or `native`

**Upstream-Compatible Response**:
```json
{
  "code": 200,
  "status": "OK",
  "data": {
    "methods": [
      {
        "id": 1,
        "name": "Muslim World League",
        "params": {
          "Fajr": 18,
          "Isha": 17
        },
        "location": {
          "latitude": 21.4225,
          "longitude": 39.8262
        }
      }
    ]
  }
}
```

---

## 4. Fallback Behavior

### 4.1 Database Empty Scenario

When the database is empty (bootstrap phase or after reset):

1. **Automatic Fallback**: API automatically fetches from upstream
2. **Store & Return**: Data is stored in database and returned to client
3. **Source Header**: `X-DeenMate-Source: upstream` indicates data came from upstream
4. **Future Requests**: Subsequent requests will use cached database data

### 4.2 Upstream Unavailable Scenario

When upstream APIs are unavailable:

1. **Cached Data**: Return cached data if available
2. **Graceful Error**: Return appropriate error message
3. **Retry Logic**: Automatic retry with exponential backoff
4. **Monitoring**: Log failures for investigation

### 4.3 Feature Flags

Environment variables control fallback behavior:

```bash
# Enable/disable upstream proxy mode
ENABLE_UPSTREAM_PROXY=true

# Default compatibility mode
UPSTREAM_COMPAT_DEFAULT=upstream

# Sync job scheduling
SYNC_CRON_DAILY="0 3 * * *"
```

---

## 5. Rate Limiting & Caching

### 5.1 Rate Limits

| Endpoint Type | Anonymous | Authenticated | Notes |
|---------------|-----------|---------------|-------|
| **Quran** | 100 req/min | 1000 req/min | Static data, heavy caching |
| **Prayer** | 60 req/min | 600 req/min | Time-sensitive, moderate caching |
| **Search** | 30 req/min | 300 req/min | Resource-intensive |

### 5.2 Caching Strategy

| Data Type | TTL | Invalidation | Storage |
|-----------|-----|---------------|---------|
| **Quran Chapters** | 24 hours | On sync completion | Redis + Database |
| **Quran Verses** | 1 hour | On sync completion | Redis + Database |
| **Prayer Times** | 12 hours | Daily at 03:00 UTC | Redis + Database |
| **Translation Resources** | 24 hours | On sync completion | Redis + Database |

### 5.3 Cache Headers

All responses include appropriate cache headers:

```http
Cache-Control: public, max-age=3600
ETag: "abc123"
Last-Modified: Thu, 04 Sep 2025 10:30:00 GMT
```

---

## 6. Error Handling

### 6.1 HTTP Status Codes

| Status | Description | Usage |
|--------|-------------|-------|
| **200** | Success | Normal responses |
| **400** | Bad Request | Invalid parameters |
| **404** | Not Found | Resource not found |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server errors |
| **503** | Service Unavailable | Upstream unavailable |

### 6.2 Error Response Format

**Upstream-Compatible Errors**:
```json
{
  "code": 400,
  "status": "Bad Request",
  "data": null
}
```

**DeenMate Native Errors**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid chapter number",
    "details": {
      "field": "chapter_id",
      "value": "115"
    }
  },
  "meta": {
    "timestamp": "2025-09-04T10:30:00Z",
    "request_id": "req_123456"
  }
}
```

---

## 7. Testing & Validation

### 7.1 Upstream Compatibility Tests

Automated tests ensure API responses match upstream exactly:

```typescript
describe('Quran API - Upstream Compatibility', () => {
  it('should return identical structure to Quran.com', async () => {
    const upstreamResponse = await fetch('https://api.quran.com/api/v4/chapters');
    const ourResponse = await request(app).get('/api/v1/quran/chapters');
    
    expect(ourResponse.body.code).toBe(upstreamResponse.code);
    expect(ourResponse.body.status).toBe(upstreamResponse.status);
    expect(ourResponse.body.data.chapters).toHaveLength(
      upstreamResponse.data.chapters.length
    );
  });
});
```

### 7.2 Response Validation

- **Schema Validation**: Ensure JSON structure matches upstream
- **Field Validation**: Verify all required fields are present
- **Type Validation**: Check data types match upstream
- **Performance Testing**: Ensure response times are acceptable

---

## 8. Migration & Deployment

### 8.1 Mobile App Migration

The mobile app can seamlessly migrate to DeenMate API:

1. **No Code Changes**: API responses are identical to upstream
2. **Gradual Rollout**: Feature flag to switch between providers
3. **Fallback Support**: Automatic fallback to upstream if needed
4. **Performance Monitoring**: Track response times and error rates

### 8.2 Deployment Strategy

1. **Staging Testing**: Validate upstream compatibility
2. **Gradual Rollout**: Start with small user percentage
3. **Monitoring**: Track API usage and performance
4. **Rollback Plan**: Quick fallback to upstream if issues arise

---

## 9. Future Enhancements

### 9.1 Additional Upstream APIs

Future integration targets:

- **Hadith**: Sunnah.com API integration
- **Zakat**: Metal price APIs for Nisab calculations
- **Audio**: CDN integration for Quran recitations

### 9.2 Advanced Features

- **Real-time Sync**: WebSocket updates for data changes
- **A/B Testing**: Compare upstream vs. cached performance
- **Advanced Caching**: Predictive cache warming
- **Analytics**: Detailed usage analytics and insights

---

## 10. Error Codes & Status Codes

### 6.1 HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid API key |
| 403 | Forbidden | Rate limit exceeded |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Maintenance mode |

### 6.2 Custom Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CHAPTER` | Chapter number out of range (1-114) |
| `INVALID_VERSE` | Verse number invalid for chapter |
| `INVALID_COORDINATES` | Latitude/longitude out of range |
| `INVALID_DATE` | Date format invalid or out of range |
| `TRANSLATION_NOT_FOUND` | Requested translation not available |
| `RECITER_NOT_FOUND` | Requested reciter not available |
| `COLLECTION_NOT_FOUND` | Hadith collection not found |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `SEARCH_QUERY_TOO_SHORT` | Search query must be at least 3 characters |

---

## 7. Rate Limiting

### 7.1 Rate Limit Headers

All responses include rate limiting headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1693737600
```

### 7.2 Rate Limit Tiers

| User Type | Requests/Hour | Burst Limit |
|-----------|---------------|-------------|
| Anonymous | 100 | 20/minute |
| Authenticated | 1000 | 50/minute |
| Premium | 5000 | 100/minute |
| Enterprise | Custom | Custom |

---

## 8. Caching Strategy

### 8.1 Cache Headers

```http
Cache-Control: public, max-age=3600
ETag: "e1ca502697e5c9317743dc1f8c6b4ec2"
Last-Modified: Tue, 03 Sep 2025 10:30:00 GMT
```

### 8.2 Cache TTL by Endpoint

| Endpoint | TTL | CDN Cache |
|----------|-----|-----------|
| `/quran/chapters` | 24 hours | Yes |
| `/quran/chapters/{id}/verses` | 1 hour | Yes |
| `/prayer/times` | Until midnight | No |
| `/hadith/collections` | 24 hours | Yes |
| `/zakat/nisab` | 1 hour | No |

---

## 9. Pagination

### 9.1 Standard Pagination

```http
GET /quran/chapters/2/verses?page=2&per_page=50
```

**Response**:
```json
{
  "pagination": {
    "current_page": 2,
    "per_page": 50,
    "total_pages": 6,
    "total_items": 286,
    "has_next": true,
    "has_previous": true,
    "next_page": 3,
    "previous_page": 1
  }
}
```

---

## 10. Webhooks (Future)

### 10.1 Data Update Notifications

**Endpoint**: `POST /webhooks/data-updates`

**Payload**:
```json
{
  "event": "translation_updated",
  "resource": "quran_translations",
  "resource_id": 131,
  "timestamp": "2025-09-03T10:30:00Z"
}
```

---

**API Specification Completed**: September 3, 2025  
**Version**: 1.0.0  
**Total Endpoints**: 15+ core endpoints across 4 modules  
**Ready for Implementation**: Yes, with complete request/response examples

---

## 🔗 **Related Documents**

- `docs/backend/TODO.md` - Implementation tasks and progress
- `docs/backend/PROJECT_TRACKING.md` - Sprint board and timeline
- `docs/backend/IMPLEMENTATION_PLAN.md` - Detailed implementation steps
- `docs/backend/MODULE_BREAKDOWN.md` - Module architecture and responsibilities
- `docs/backend/sync-strategy.md` - Sync strategy and cron job details

---

*Last updated: September 4, 2025*


---

See also: docs/api/openapi.yaml, docs/api/quickstart.md, docs/api/deployment-guide.md
