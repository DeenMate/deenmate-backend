# DeenMate Backend API Layer - Code Audit Report

**Date**: September 3, 2025  
**Analyst**: Backend Architecture Team  
**Scope**: Third-party API usage, integration patterns, and app-side requirements

---

## Executive Summary

DeenMate currently operates as a **client-side only** mobile application with direct integrations to multiple third-party APIs. The app implements sophisticated caching and offline-first architecture using Hive, but lacks a centralized backend API layer. This audit identifies all external API calls and establishes the foundation for designing a unified backend API strategy.

---

## 1. Third-Party API Inventory

### 1.1 Quran Data APIs

| **File** | **Line** | **API Endpoint** | **Purpose** |
|----------|----------|------------------|-------------|
| `lib/core/env/app_config.dart` | 4 | `https://api.quran.com/api/v4` | Primary Quran API - chapters, verses, translations |
| `lib/features/quran/data/api/verses_api.dart` | 28-29 | `/verses/by_chapter/{id}` | Fetch verses with translations |
| `lib/features/quran/data/api/resources_api.dart` | 18 | `/resources/translations` | Available translation resources |
| `lib/features/quran/data/api/resources_api.dart` | 66 | `/resources/recitations` | Reciter/audio metadata |
| `lib/features/quran/data/api/resources_api.dart` | 86 | `/resources/tafsirs` | Tafsir commentary resources |
| `lib/features/quran/domain/services/audio_service.dart` | 508 | `https://audio.qurancdn.com/` | Audio file CDN for recitations |

**Configuration**:
- Base URL: `https://api.quran.com/api/v4`
- No API key required (public API)
- Request headers: `Accept: application/json`, `User-Agent: DeenMate/1.0.0`

### 1.2 Prayer Times APIs

| **File** | **Line** | **API Endpoint** | **Purpose** |
|----------|----------|------------------|-------------|
| `lib/features/prayer_times/data/datasources/aladhan_api.dart` | 16 | `https://api.aladhan.com/v1` | Base URL for prayer calculations |
| `lib/features/prayer_times/data/datasources/aladhan_api.dart` | 27 | `/timings/{date}` | Single day prayer times |
| `lib/features/prayer_times/data/datasources/aladhan_api.dart` | 90 | `/calendar/{year}/{month}` | Monthly prayer times |
| `lib/features/prayer_times/data/datasources/aladhan_api.dart` | 141 | `/addressToTiming/{date}` | Prayer times by address |
| `lib/features/prayer_times/data/datasources/aladhan_api.dart` | 176 | `/qibla/{lat}/{lng}` | Qibla direction calculation |
| `lib/features/prayer_times/data/datasources/aladhan_api.dart` | 458 | `/status` | API health check |
| `lib/features/prayer_times/data/datasources/aladhan_api.dart` | 473 | `/methods` | Available calculation methods |

**Configuration**:
- Base URL: `https://api.aladhan.com/v1`
- No API key required
- Timeout: 20 seconds
- Headers: `Accept: application/json`, `User-Agent: DeenMate/1.0.0`

### 1.3 Gold/Metal Prices APIs

| **File** | **Line** | **API Endpoint** | **Purpose** |
|----------|----------|------------------|-------------|
| `lib/features/zakat/data/api/metal_prices_api_client.dart` | 12 | `https://api.metals.live/v1/spot` | Real-time precious metal prices |
| `lib/features/zakat/data/api/metal_prices_api_client.dart` | 24 | `/gold,silver` | Current gold and silver rates |
| `lib/features/zakat/data/api/metal_prices_api_client.dart` | 58 | `/gold,silver/{date}` | Historical prices for specific date |

**Configuration**:
- Base URL: `https://api.metals.live/v1/spot`
- No API key detected
- Timeout: 10 seconds
- Headers: `Content-Type: application/json`, `Accept: application/json`

### 1.4 Hadith APIs (Planned/Mock Implementation)

| **File** | **Line** | **API Endpoint** | **Purpose** |
|----------|----------|------------------|-------------|
| `docs/HADITH_API_SETUP.md` | 11 | `https://api.sunnah.com/v1` | Hadith collections from Sunnah.com |
| `lib/core/env/app_config.dart` | 7-10 | N/A | API key configuration (not implemented) |

**Configuration**:
- Base URL: `https://api.sunnah.com/v1` (documented, not implemented)
- API Key: Environment variable `SUNNAH_API_KEY` (pending approval)
- Status: Mock data implementation currently used

---

## 2. Environment Variables & Configuration

### 2.1 Detected Configuration Keys

| **Key** | **File** | **Purpose** | **Status** |
|---------|----------|-------------|-----------|
| `SUNNAH_API_KEY` | `lib/core/env/app_config.dart` | Sunnah.com API authentication | Not set |
| `TOKEN_PROXY` | `lib/core/env/app_config.dart` | Authentication proxy endpoint | Default: `https://auth.deenmate.app/token` |

### 2.2 Hardcoded Endpoints

- **Quran.com API**: `https://api.quran.com/api/v4` (hardcoded in AppConfig)
- **Aladhan API**: `https://api.aladhan.com/v1` (hardcoded in AladhanApi)
- **Metals API**: `https://api.metals.live/v1/spot` (hardcoded in MetalPricesApiClient)
- **Quran Audio CDN**: `https://audio.qurancdn.com/` (hardcoded in audio service)

---

## 3. Current Offline Storage Patterns

### 3.1 Hive Database Schema

The app uses extensive Hive-based caching with the following boxes:

| **Box Name** | **File** | **Purpose** | **Data Type** |
|--------------|----------|-------------|---------------|
| `quran_chapters` | `lib/core/storage/hive_boxes.dart` | Chapter metadata | Chapter entities |
| `quran_verses_v4` | `lib/core/storage/hive_boxes.dart` | Cached verses with translations | Verse entities |
| `quran_prefs` | `lib/core/storage/hive_boxes.dart` | User Quran preferences | Settings |
| `quran_bookmarks` | `lib/core/storage/hive_boxes.dart` | User bookmarks | Bookmark entities |
| `quran_last_read` | `lib/core/storage/hive_boxes.dart` | Reading position tracking | Position data |
| `quran_downloads` | `lib/core/storage/hive_boxes.dart` | Downloaded content metadata | Download status |
| `prayer_times_box` | `lib/features/prayer_times/data/datasources/prayer_times_local_storage.dart` | Cached prayer times | Prayer data |
| `qibla_directions` | `lib/features/qibla/data/datasources/qibla_local_storage.dart` | Qibla calculation cache | Direction data |

### 3.2 Caching Strategies

- **Prayer Times**: Cache daily, TTL-based expiration
- **Quran Data**: Permanent cache with version checks
- **Qibla**: Location-based cache with cleanup (max 100 entries)
- **Metal Prices**: No persistent cache detected, real-time fetching

---

## 4. App-Side Data Requirements

### 4.1 Quran Module Expectations

**Verses API Response Structure** (from `lib/features/quran/data/api/verses_api.dart`):
```json
{
  "verses": [
    {
      "verse_key": "1:1",
      "verse_number": 1,
      "text_uthmani": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      "translations": [
        {
          "text": "In the name of Allah...",
          "resource_id": 131,
          "language_name": "english"
        }
      ],
      "audio": {
        "url": "/7/1_1.mp3"
      }
    }
  ]
}
```

**Translation Resources Expected** (from `lib/features/quran/data/api/resources_api.dart`):
```json
{
  "translations": [
    {
      "id": 131,
      "name": "Saheeh International",
      "author_name": "Saheeh International",
      "language_name": "english",
      "direction": "ltr"
    }
  ]
}
```

### 4.2 Prayer Times Module Expectations

**Prayer Times Response** (from `lib/features/prayer_times/data/datasources/aladhan_api.dart`):
```json
{
  "data": {
    "timings": {
      "Fajr": "05:30",
      "Sunrise": "06:45",
      "Dhuhr": "12:30",
      "Asr": "15:45",
      "Maghrib": "18:15",
      "Isha": "19:30"
    },
    "date": {
      "readable": "03 Sep 2025",
      "hijri": {
        "date": "12-03-1447",
        "month": {
          "en": "Rabi' al-thani"
        }
      }
    },
    "meta": {
      "method": {
        "id": 2,
        "name": "Islamic Society of North America (ISNA)"
      }
    }
  }
}
```

### 4.3 Metal Prices Module Expectations

**Metal Prices Response** (from `lib/features/zakat/data/api/metal_prices_api_client.dart`):
```json
[
  {
    "metal": "gold",
    "price": 65.50,
    "currency": "USD",
    "unit": "gram",
    "timestamp": "2025-09-03T10:30:00Z"
  },
  {
    "metal": "silver", 
    "price": 0.85,
    "currency": "USD",
    "unit": "gram",
    "timestamp": "2025-09-03T10:30:00Z"
  }
]
```

---

## 5. Network Layer Analysis

### 5.1 HTTP Client Configuration

**Base Dio Setup** (from `lib/core/providers/network_providers.dart`):
```dart
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio();
  dio.options.connectTimeout = const Duration(seconds: 30);
  dio.options.receiveTimeout = const Duration(seconds: 30);
  dio.options.headers = {
    'Accept': 'application/json',
    'User-Agent': 'DeenMate/1.0.0',
  };
  
  // Interceptors: logging then retry
  dio.interceptors.add(LogInterceptor(...));
  dio.interceptors.add(RetryInterceptor(dio: dio));
  
  return dio;
});
```

### 5.2 Error Handling Patterns

- **Network failures**: Graceful fallback to cached data
- **API rate limits**: Retry logic with exponential backoff
- **Data corruption**: Cache invalidation and re-fetch
- **Offline mode**: Full offline functionality maintained

---

## 6. Authentication & Authorization

### 6.1 Current State

- **No authentication required** for current APIs (Quran.com, Aladhan, metals.live)
- **API key placeholder** exists for Sunnah.com but not implemented
- **Token proxy endpoint** configured but not actively used
- **Anonymous usage** - no user accounts or personal data transmission

### 6.2 Security Patterns

- **HTTPS only** for all API communications
- **No sensitive data** transmitted to external APIs
- **Local storage only** for user preferences and bookmarks
- **Certificate pinning** not implemented

---

## 7. Integration Patterns

### 7.1 Repository Pattern

Each feature follows clean architecture with:
- **API Layer**: Direct HTTP client calls (Dio-based)
- **Repository Layer**: Caching logic and fallback handling
- **Domain Layer**: Business entities and use cases
- **Presentation Layer**: Riverpod state management

### 7.2 Provider Architecture

**Example Provider Chain** (from `lib/features/quran/presentation/state/providers.dart`):
```dart
final dioQfProvider = Provider((ref) => ref.watch(dioProvider));
final chaptersApiProvider = Provider((ref) => ChaptersApi(ref.watch(dioQfProvider)));
final quranRepoProvider = Provider((ref) => QuranRepository(
  ref.watch(chaptersApiProvider),
  ref.watch(versesApiProvider),
  ref.watch(resourcesApiProvider),
  Hive,
));
```

---

## 8. Identified Pain Points

### 8.1 Direct API Dependencies

- **Single points of failure**: Direct dependency on external APIs
- **Rate limiting risk**: No server-side request coalescing
- **Version coupling**: App tied to specific API versions
- **Limited control**: Cannot modify or enhance third-party responses

### 8.2 Missing Features

- **API aggregation**: No unified interface for Islamic data
- **Cross-cutting concerns**: No centralized logging, monitoring, or analytics
- **Data enrichment**: Cannot add custom Islamic content or Bengali translations
- **User features**: No user accounts, synchronization, or personalization across devices

### 8.3 Scalability Concerns

- **Client-side caching**: Limited by device storage
- **Network efficiency**: Multiple API calls from mobile clients
- **Update mechanisms**: No centralized way to push content updates
- **Analytics**: No usage analytics or performance monitoring

---

## 9. Backend API Requirements (Derived)

### 9.1 Essential Endpoints Needed

Based on current app usage patterns:

```
GET /api/v1/quran/chapters
GET /api/v1/quran/verses/{chapter}?translations=1,2&reciter=7
GET /api/v1/quran/translations
GET /api/v1/quran/reciters
GET /api/v1/prayer/times?lat={lat}&lng={lng}&date={date}&method={method}
GET /api/v1/prayer/qibla?lat={lat}&lng={lng}
GET /api/v1/zakat/nisab?currency={currency}&date={date}
GET /api/v1/hadith/collections
GET /api/v1/hadith/collection/{id}/books
GET /api/v1/hadith/search?q={query}&collection={collection}
```

### 9.2 Data Sync Requirements

- **Quran data**: Version-controlled, rarely changing
- **Prayer times**: Location-based, daily updates
- **Metal prices**: Real-time, hourly updates  
- **Hadith data**: Static collections, occasional updates

---

## 10. Next Steps & Recommendations

### 10.1 Immediate Actions

1. **API Gateway Setup**: Proxy existing third-party APIs through DeenMate backend
2. **Authentication Layer**: Implement API key management for Sunnah.com
3. **Monitoring Setup**: Add request logging and error tracking
4. **Documentation**: Create OpenAPI specs for planned backend endpoints

### 10.2 Migration Strategy

1. **Phase 1**: Backend proxies current APIs with minimal changes
2. **Phase 2**: Add caching, rate limiting, and data normalization
3. **Phase 3**: Enhanced features (Bengali translations, user accounts)
4. **Phase 4**: Advanced features (AI-powered search, personalization)

---

**Report Completed**: September 3, 2025  
**Total APIs Identified**: 4 primary sources (Quran.com, Aladhan, Metals.live, Sunnah.com)  
**Total Endpoints**: 15+ distinct endpoints across all modules  
**Readiness for Backend**: High - clear patterns and requirements identified
