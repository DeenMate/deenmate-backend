# DeenMate API Documentation

## Overview

DeenMate API is a comprehensive Islamic application backend that provides access to Quran, Hadith, Prayer Times, Zakat calculations, and Islamic audio content. This API is designed to serve Islamic applications, websites, and mobile apps with accurate, reliable, and well-structured Islamic data.

## Base URL

```
Production: https://api.deenmate.app/api/v1
Staging: https://staging-api.deenmate.app/api/v1
Local: http://localhost:3000/api/v1
```

## Authentication

Currently, the API operates in read-only mode without authentication. Future versions will include JWT-based authentication for user-specific features.

## Rate Limiting

- **Public Endpoints**: 100 requests per minute per IP
- **Authenticated Endpoints**: 1000 requests per minute per user
- **Premium Tier**: 5000 requests per minute per user

## Response Format

All API responses follow a consistent structure:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "meta": {
    // Metadata, pagination, cache info
  }
}
```

## Error Responses

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

## HTTP Status Codes

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Endpoints

### Quran Module

#### Get All Chapters
```http
GET /quran/chapters
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chapters": [
      {
        "id": 1,
        "chapterNumber": 1,
        "nameArabic": "الفاتحة",
        "nameEnglish": "Al-Fatihah",
        "versesCount": 7,
        "revelationType": "Meccan"
      }
    ]
  },
  "meta": {
    "totalChapters": 114,
    "cacheTtl": 86400
  }
}
```

#### Get Chapter Verses
```http
GET /quran/chapters/{id}/verses?page={page}&per_page={per_page}
```

**Parameters:**
- `id` (path): Chapter ID (1-114)
- `page` (query): Page number (default: 1)
- `per_page` (query): Verses per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "verses": [
      {
        "id": 1,
        "verseNumber": 1,
        "textUthmani": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        "textIndopak": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        "juz": 1,
        "hizb": 1,
        "page": 1
      }
    ],
    "pagination": {
      "currentPage": 1,
      "perPage": 50,
      "totalPages": 1,
      "totalVerses": 7
    }
  }
}
```

#### Get Translations
```http
GET /quran/translations
```

#### Get Reciters
```http
GET /quran/reciters
```

#### Get Verse Audio
```http
GET /quran/audio/{reciterId}/{chapterId}/{verseNumber}?quality={quality}
```

**Parameters:**
- `reciterId` (path): Reciter ID
- `chapterId` (path): Chapter ID
- `verseNumber` (path): Verse number
- `quality` (query): Audio quality (64kbps, 128kbps, 192kbps, 320kbps)

### Prayer Module

#### Get Prayer Times
```http
GET /prayer/times?latitude={lat}&longitude={lng}&date={date}&method={method}
```

**Parameters:**
- `latitude` (required): Latitude coordinate
- `longitude` (required): Longitude coordinate
- `date` (optional): Date in YYYY-MM-DD format (default: today)
- `method` (optional): Calculation method ID (default: 1 - Muslim World League)

**Response:**
```json
{
  "success": true,
  "data": {
    "fajr": "05:30",
    "sunrise": "06:45",
    "dhuhr": "12:30",
    "asr": "15:45",
    "maghrib": "18:15",
    "isha": "19:45",
    "method": "Muslim World League"
  },
  "meta": {
    "cacheTtl": "until midnight",
    "calculationMethod": "Muslim World League"
  }
}
```

#### Get Prayer Calendar
```http
GET /prayer/calendar?latitude={lat}&longitude={lng}&month={month}&year={year}&method={method}
```

#### Get Qibla Direction
```http
GET /prayer/qibla?latitude={lat}&longitude={lng}
```

#### Get Calculation Methods
```http
GET /prayer/methods
```

### Hadith Module

#### Get Collections
```http
GET /hadith/collections
```

#### Get Books in Collection
```http
GET /hadith/collections/{id}/books
```

#### Get Hadiths in Book
```http
GET /hadith/collections/{collectionId}/books/{bookId}/hadiths?page={page}&per_page={per_page}
```

#### Search Hadiths
```http
GET /hadith/search?q={query}&collection={collectionId}&page={page}&per_page={per_page}
```

#### Get Hadith by ID
```http
GET /hadith/{id}
```

### Zakat Module

#### Get Nisab Values
```http
GET /zakat/nisab?currency={currency}
```

**Parameters:**
- `currency` (optional): Currency code (default: USD)

**Response:**
```json
{
  "success": true,
  "data": {
    "nisabValues": {
      "gold": 5000,
      "silver": 500,
      "currency": "USD",
      "lastUpdated": "2025-09-03"
    }
  },
  "meta": {
    "currency": "USD",
    "cacheTtl": "1 hour",
    "source": "Islamic calculation based on current gold prices"
  }
}
```

#### Calculate Zakat
```http
POST /zakat/calculate
```

**Request Body:**
```json
{
  "gold": 1000,
  "silver": 0,
  "cash": 5000,
  "investments": 2000,
  "other": 0,
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "calculation": {
      "totalWealth": 8000,
      "zakatAmount": 200,
      "zakatPercentage": 2.5,
      "nisabThreshold": 5000,
      "calculationDate": "2025-09-03",
      "breakdown": {
        "gold": 1000,
        "silver": 0,
        "cash": 5000,
        "investments": 2000,
        "other": 0
      }
    }
  },
  "meta": {
    "calculationDate": "2025-09-03",
    "nisabThreshold": 5000,
    "zakatRate": "2.5%"
  }
}
```

#### Get Gold Price
```http
GET /zakat/gold-price?currency={currency}
```

#### Get Supported Currencies
```http
GET /zakat/currencies
```

#### Get Zakat History
```http
GET /zakat/history?userId={userId}
```

### Audio Module

#### Get Verse Audio
```http
GET /audio/verse/{reciterId}/{chapterId}/{verseNumber}?quality={quality}
```

#### Get Chapter Audio
```http
GET /audio/chapter/{reciterId}/{chapterId}?quality={quality}
```

#### Get Available Qualities
```http
GET /audio/qualities
```

#### Get Reciter Stats
```http
GET /audio/reciter/{reciterId}/stats
```

#### Search Audio
```http
GET /audio/search?q={query}&reciter={reciterId}&quality={quality}&page={page}&per_page={per_page}
```

#### Validate Audio URL
```http
GET /audio/validate?url={url}
```

## Health & Status

#### Health Check
```http
GET /health
```

#### Readiness Check
```http
GET /ready
```

## Caching

The API implements intelligent caching strategies:

- **Quran Data**: 24 hours (86400 seconds)
- **Prayer Times**: Until midnight
- **Prayer Calendar**: 30 days
- **Hadith Data**: 24 hours
- **Zakat Nisab**: 1 hour
- **Gold Prices**: 30 minutes
- **Audio Metadata**: 1 hour
- **Search Results**: 30 minutes

## Data Sources

- **Quran**: Multiple authentic sources with cross-verification
- **Prayer Times**: Astronomical calculations with multiple calculation methods
- **Hadith**: Authentic collections (Bukhari, Muslim, etc.)
- **Zakat**: Islamic jurisprudence standards with current market prices
- **Audio**: Licensed recitations from verified sources

## SDKs & Libraries

### JavaScript/TypeScript
```bash
npm install @deenmate/api-client
```

```javascript
import { DeenMateAPI } from '@deenmate/api-client';

const api = new DeenMateAPI({
  baseURL: 'https://api.deenmate.app/api/v1'
});

// Get prayer times
const prayerTimes = await api.prayer.getTimes({
  latitude: 23.8103,
  longitude: 90.4125
});
```

### Python
```bash
pip install deenmate-api
```

```python
from deenmate_api import DeenMateAPI

api = DeenMateAPI(base_url="https://api.deenmate.app/api/v1")

# Get prayer times
prayer_times = api.prayer.get_times(
    latitude=23.8103,
    longitude=90.4125
)
```

## Postman Collection

Download the complete Postman collection:
- [DeenMate API Collection](https://api.deenmate.app/postman/deenmate-api.json)

## Support

- **Documentation**: [https://docs.deenmate.app](https://docs.deenmate.app)
- **API Status**: [https://status.deenmate.app](https://status.deenmate.app)
- **Support Email**: api-support@deenmate.app
- **Developer Discord**: [https://discord.gg/deenmate](https://discord.gg/deenmate)

## Changelog

### v1.0.0 (Current)
- Initial API release
- Quran, Hadith, Prayer, Zakat, and Audio modules
- Comprehensive caching and optimization
- Production-ready infrastructure

## License

This API is provided under the [MIT License](LICENSE) for educational and commercial use.

---

*Last updated: September 4, 2025*
