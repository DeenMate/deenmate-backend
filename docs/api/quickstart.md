# DeenMate API Quick Start Guide

## Getting Started

Welcome to the DeenMate API! This guide will help you get up and running quickly with our comprehensive Islamic application backend.

## Prerequisites

- Basic knowledge of HTTP/REST APIs
- A programming language of your choice (JavaScript, Python, PHP, etc.)
- An HTTP client (Postman, cURL, or your preferred tool)

## Base URLs

```
Production: https://api.deenmate.app/api/v1
Staging:   https://staging-api.deenmate.app/api/v1
Local:     http://localhost:3000/api/v1
```

## Your First API Call

Let's start with a simple health check to ensure the API is running:

```bash
curl https://api.deenmate.app/api/v1/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-09-04T10:30:00Z",
    "uptime": 86400
  }
}
```

## Quick Examples

### 1. Get Quran Chapters

```bash
curl https://api.deenmate.app/api/v1/quran/chapters
```

### 2. Get Prayer Times

```bash
curl "https://api.deenmate.app/api/v1/prayer/times?latitude=23.8103&longitude=90.4125&date=2025-09-04"
```

### 3. Calculate Zakat

```bash
curl -X POST https://api.deenmate.app/api/v1/zakat/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "gold": 1000,
    "cash": 5000,
    "currency": "USD"
  }'
```

## Code Examples

### JavaScript/Node.js

```javascript
// Using fetch (Node.js 18+ or browser)
async function getPrayerTimes(lat, lng) {
  const response = await fetch(
    `https://api.deenmate.app/api/v1/prayer/times?latitude=${lat}&longitude=${lng}`
  );
  const data = await response.json();
  return data;
}

// Example usage
getPrayerTimes(23.8103, 90.4125)
  .then(result => console.log(result.data.prayerTimes))
  .catch(error => console.error('Error:', error));
```

### Python

```python
import requests

def get_prayer_times(lat, lng):
    url = "https://api.deenmate.app/api/v1/prayer/times"
    params = {"latitude": lat, "longitude": lng}
    
    response = requests.get(url, params=params)
    data = response.json()
    return data

# Example usage
result = get_prayer_times(23.8103, 90.4125)
print(result["data"]["prayerTimes"])
```

### PHP

```php
<?php
function getPrayerTimes($lat, $lng) {
    $url = "https://api.deenmate.app/api/v1/prayer/times";
    $params = http_build_query([
        'latitude' => $lat,
        'longitude' => $lng
    ]);
    
    $response = file_get_contents($url . '?' . $params);
    return json_decode($response, true);
}

// Example usage
$result = getPrayerTimes(23.8103, 90.4125);
echo json_encode($result['data']['prayerTimes'], JSON_PRETTY_PRINT);
?>
```

### cURL Examples

#### Get Quran Chapter Verses
```bash
curl "https://api.deenmate.app/api/v1/quran/chapters/1/verses?page=1&per_page=10"
```

#### Get Qibla Direction
```bash
curl "https://api.deenmate.app/api/v1/prayer/qibla?latitude=23.8103&longitude=90.4125"
```

#### Search Hadiths
```bash
curl "https://api.deenmate.app/api/v1/hadith/search?q=intention&page=1&per_page=20"
```

#### Get Audio Metadata
```bash
curl "https://api.deenmate.app/api/v1/audio/verse/1/1/1?quality=128kbps"
```

## Response Format

All API responses follow a consistent structure:

```json
{
  "success": true,
  "data": {
    // Your requested data here
  },
  "meta": {
    // Metadata, pagination, cache info
  }
}
```

## Error Handling

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

## Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request (check your parameters)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error (try again later)

## Rate Limiting

- **Public Endpoints**: 100 requests per minute per IP
- **Authenticated Endpoints**: 1000 requests per minute per user (future)
- **Premium Tier**: 5000 requests per minute per user (future)

## Caching

The API implements intelligent caching. Check the `meta.cacheTtl` field in responses to understand cache duration:

- **Quran Data**: 24 hours
- **Prayer Times**: Until midnight
- **Zakat Nisab**: 1 hour
- **Audio Metadata**: 1 hour

## Best Practices

1. **Always check the `success` field** before processing data
2. **Handle errors gracefully** - check HTTP status codes and error responses
3. **Implement retry logic** for failed requests
4. **Cache responses** when appropriate to reduce API calls
5. **Use appropriate user agents** in your requests
6. **Respect rate limits** to avoid being blocked

## Testing

### Postman Collection

Download our complete Postman collection:
- [DeenMate API Collection](docs/api/postman-collection.json)

### Local Testing

If you're running the API locally:

```bash
# Start the API
npm run start:dev

# Test health endpoint
curl http://localhost:3000/api/v1/health
```

## Next Steps

1. **Explore the full API documentation** in the main README
2. **Download the Postman collection** for easy testing
3. **Check out our SDKs** (coming soon)
4. **Join our developer community** on Discord

## Need Help?

- **Documentation**: [https://docs.deenmate.app](https://docs.deenmate.app)
- **API Status**: [https://status.deenmate.app](https://status.deenmate.app)
- **Support Email**: api-support@deenmate.app
- **Developer Discord**: [https://discord.gg/deenmate](https://discord.gg/deenmate)

## SDKs (Coming Soon)

We're working on official SDKs for popular programming languages:

- **JavaScript/TypeScript**: `npm install @deenmate/api-client`
- **Python**: `pip install deenmate-api`
- **PHP**: `composer require deenmate/api-client`
- **Java**: Maven dependency
- **C#**: NuGet package

---

*Happy coding! May your applications bring benefit to the Ummah.*
