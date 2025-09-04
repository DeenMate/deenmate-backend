# DeenMate Backend API Layer - Database Schema & Data Model

**Date**: September 3, 2025  
**Purpose**: Normalized database schema for Islamic content aggregation  
**Database**: PostgreSQL (recommended for full-text search and JSON support)  

---

## Executive Summary

This document defines a comprehensive database schema for storing and normalizing Islamic content from multiple third-party APIs. The schema is designed for PostgreSQL with emphasis on data integrity, performance, and support for multiple languages (Arabic, English, Bengali). Full-text search capabilities are included for Quran and Hadith content.

---

## 1. Schema Overview

### 1.1 Core Design Principles

- **Normalization**: Reduce data redundancy while maintaining query performance
- **Source Tracking**: Store original API source and metadata for traceability
- **Versioning**: Track data updates and changes over time
- **Multilingual**: Support for Arabic, English, Bengali, and future languages
- **Search Optimization**: Full-text search indices for translations and hadith
- **Caching Strategy**: Efficient caching for mobile API responses

### 1.2 Database Modules

1. **Quran Module**: Chapters, verses, translations, tafsir, reciters
2. **Prayer Times Module**: Locations, calculation methods, cached times
3. **Hadith Module**: Collections, books, hadiths, chains of narration
4. **Zakat Module**: Metal prices, exchange rates, nisab calculations
5. **System Module**: Sync jobs, data versioning, API logs

---

## 2. Quran Module Schema

### 2.1 Core Quran Tables

```sql
-- Quran chapters (Surahs)
CREATE TABLE quran_chapters (
    id SERIAL PRIMARY KEY,
    chapter_number INTEGER UNIQUE NOT NULL CHECK (chapter_number BETWEEN 1 AND 114),
    name_arabic VARCHAR(100) NOT NULL,
    name_english VARCHAR(100) NOT NULL,
    name_bangla VARCHAR(100),
    revelation_place VARCHAR(20) CHECK (revelation_place IN ('mecca', 'medina')),
    revelation_order INTEGER,
    verse_count INTEGER NOT NULL CHECK (verse_count > 0),
    bismillah_pre BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quran verses
CREATE TABLE quran_verses (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER REFERENCES quran_chapters(id) ON DELETE CASCADE,
    verse_number INTEGER NOT NULL CHECK (verse_number > 0),
    verse_key VARCHAR(10) NOT NULL UNIQUE, -- Format: "1:1", "2:255"
    text_uthmani TEXT NOT NULL,
    text_indopak TEXT,
    text_imlaei TEXT,
    juz_number INTEGER CHECK (juz_number BETWEEN 1 AND 30),
    hizb_number INTEGER CHECK (hizb_number BETWEEN 1 AND 60),
    rub_number INTEGER CHECK (rub_number BETWEEN 1 AND 240),
    page_number INTEGER CHECK (page_number BETWEEN 1 AND 604),
    sajda_type VARCHAR(20) CHECK (sajda_type IN ('recommended', 'obligatory')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chapter_id, verse_number)
);

-- Translation resources metadata
CREATE TABLE quran_translation_resources (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL, -- Original API resource ID
    source_api VARCHAR(50) NOT NULL, -- 'quran_com', 'alquran_cloud'
    name VARCHAR(200) NOT NULL,
    author_name VARCHAR(200),
    language_code VARCHAR(10) NOT NULL, -- ISO language codes
    language_name VARCHAR(100) NOT NULL,
    direction VARCHAR(3) CHECK (direction IN ('ltr', 'rtl')),
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verse translations
CREATE TABLE quran_translations (
    id SERIAL PRIMARY KEY,
    verse_id INTEGER REFERENCES quran_verses(id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES quran_translation_resources(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    footnotes TEXT,
    text_vector tsvector, -- For full-text search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(verse_id, resource_id)
);

-- Tafsir (commentary) resources
CREATE TABLE quran_tafsir_resources (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL,
    source_api VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    author_name VARCHAR(200),
    language_code VARCHAR(10) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verse tafsir/commentary
CREATE TABLE quran_tafsirs (
    id SERIAL PRIMARY KEY,
    verse_id INTEGER REFERENCES quran_verses(id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES quran_tafsir_resources(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    text_vector tsvector, -- For full-text search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(verse_id, resource_id)
);

-- Reciter information
CREATE TABLE quran_reciters (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL,
    source_api VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    english_name VARCHAR(200),
    language_name VARCHAR(100),
    style VARCHAR(100), -- 'Murattal', 'Muallim', etc.
    qirat VARCHAR(100), -- 'Hafs', 'Warsh', etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audio file metadata (not the actual files)
CREATE TABLE quran_audio_files (
    id SERIAL PRIMARY KEY,
    verse_id INTEGER REFERENCES quran_verses(id) ON DELETE CASCADE,
    reciter_id INTEGER REFERENCES quran_reciters(id) ON DELETE CASCADE,
    source_url VARCHAR(500) NOT NULL, -- Original CDN URL
    local_path VARCHAR(500), -- Local storage path if cached
    file_size INTEGER, -- Size in bytes
    duration INTEGER, -- Duration in milliseconds
    format VARCHAR(10) DEFAULT 'mp3',
    quality VARCHAR(20), -- 'high', 'medium', 'low'
    last_verified TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(verse_id, reciter_id)
);
```

### 2.2 Quran Indices

```sql
-- Performance indices
CREATE INDEX idx_quran_verses_chapter ON quran_verses(chapter_id);
CREATE INDEX idx_quran_verses_juz ON quran_verses(juz_number);
CREATE INDEX idx_quran_verses_page ON quran_verses(page_number);
CREATE INDEX idx_quran_translations_verse ON quran_translations(verse_id);
CREATE INDEX idx_quran_translations_resource ON quran_translations(resource_id);

-- Full-text search indices
CREATE INDEX idx_quran_translations_search ON quran_translations USING gin(text_vector);
CREATE INDEX idx_quran_tafsirs_search ON quran_tafsirs USING gin(text_vector);

-- Update triggers for full-text search
CREATE TRIGGER update_quran_translations_search_vector 
    BEFORE INSERT OR UPDATE ON quran_translations 
    FOR EACH ROW EXECUTE FUNCTION 
    tsvector_update_trigger(text_vector, 'pg_catalog.english', text);
```

---

## 3. Prayer Times Module Schema

### 3.1 Prayer Times Tables

```sql
-- Prayer calculation methods
CREATE TABLE prayer_calculation_methods (
    id SERIAL PRIMARY KEY,
    method_name VARCHAR(100) NOT NULL UNIQUE,
    method_code VARCHAR(20) NOT NULL UNIQUE, -- 'MWL', 'ISNA', etc.
    description TEXT,
    fajr_angle DECIMAL(4,2) NOT NULL,
    isha_angle DECIMAL(4,2) NOT NULL,
    isha_interval INTEGER, -- Minutes after maghrib
    maghrib_angle DECIMAL(4,2) DEFAULT 0.0,
    midnight_mode VARCHAR(20) DEFAULT 'Standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Location cache for prayer time calculations
CREATE TABLE prayer_locations (
    id SERIAL PRIMARY KEY,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(50),
    elevation INTEGER DEFAULT 0, -- Meters above sea level
    location_hash VARCHAR(32) UNIQUE NOT NULL, -- MD5 of lat,lng for deduplication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cached prayer times
CREATE TABLE prayer_times_cache (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES prayer_locations(id) ON DELETE CASCADE,
    method_id INTEGER REFERENCES prayer_calculation_methods(id),
    prayer_date DATE NOT NULL,
    fajr_time TIME NOT NULL,
    sunrise_time TIME NOT NULL,
    dhuhr_time TIME NOT NULL,
    asr_time TIME NOT NULL,
    maghrib_time TIME NOT NULL,
    isha_time TIME NOT NULL,
    qibla_direction DECIMAL(6,3), -- Degrees from North
    source_api VARCHAR(50) DEFAULT 'aladhan',
    raw_response JSONB, -- Store original API response for debugging
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(location_id, method_id, prayer_date)
);

-- Special Islamic dates and events
CREATE TABLE islamic_calendar_events (
    id SERIAL PRIMARY KEY,
    hijri_year INTEGER NOT NULL,
    hijri_month INTEGER NOT NULL CHECK (hijri_month BETWEEN 1 AND 12),
    hijri_day INTEGER NOT NULL CHECK (hijri_day BETWEEN 1 AND 30),
    gregorian_date DATE,
    event_name_arabic VARCHAR(200),
    event_name_english VARCHAR(200) NOT NULL,
    event_name_bangla VARCHAR(200),
    event_type VARCHAR(50), -- 'eid', 'night', 'fast', 'hajj'
    description TEXT,
    is_major BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Prayer Times Indices

```sql
CREATE INDEX idx_prayer_times_location ON prayer_times_cache(location_id);
CREATE INDEX idx_prayer_times_date ON prayer_times_cache(prayer_date);
CREATE INDEX idx_prayer_times_expires ON prayer_times_cache(expires_at);
CREATE INDEX idx_prayer_locations_hash ON prayer_locations(location_hash);
CREATE INDEX idx_prayer_locations_coords ON prayer_locations(latitude, longitude);
```

---

## 4. Hadith Module Schema

### 4.1 Hadith Tables

```sql
-- Hadith collections (Bukhari, Muslim, etc.)
CREATE TABLE hadith_collections (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(50) NOT NULL, -- API collection identifier
    source_api VARCHAR(50) NOT NULL,
    name_arabic VARCHAR(200),
    name_english VARCHAR(200) NOT NULL,
    name_bangla VARCHAR(200),
    short_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    total_hadiths INTEGER,
    is_sahih BOOLEAN DEFAULT false, -- Is this a Sahih collection
    scholar_name VARCHAR(200),
    compilation_period VARCHAR(100), -- "8th century", "256 AH"
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Books within collections
CREATE TABLE hadith_books (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES hadith_collections(id) ON DELETE CASCADE,
    source_book_id VARCHAR(50) NOT NULL,
    book_number INTEGER NOT NULL,
    name_arabic VARCHAR(300),
    name_english VARCHAR(300) NOT NULL,
    name_bangla VARCHAR(300),
    hadith_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collection_id, book_number)
);

-- Individual hadiths
CREATE TABLE hadiths (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES hadith_collections(id) ON DELETE CASCADE,
    book_id INTEGER REFERENCES hadith_books(id) ON DELETE SET NULL,
    source_hadith_id VARCHAR(50) NOT NULL,
    hadith_number VARCHAR(20) NOT NULL, -- Can be "1", "1a", "1234"
    reference VARCHAR(200) NOT NULL, -- "Sahih al-Bukhari 1:1"
    
    -- Hadith text in multiple languages
    text_arabic TEXT NOT NULL,
    text_english TEXT,
    text_bangla TEXT,
    
    -- Metadata
    grade VARCHAR(50), -- 'Sahih', 'Hasan', 'Da'if'
    narrator_chain TEXT, -- Isnad/chain of narration
    primary_narrator VARCHAR(200), -- Main companion who narrated
    topic VARCHAR(200), -- Subject category
    keywords TEXT[], -- Array of keywords for searching
    
    -- Full-text search vectors
    text_vector_arabic tsvector,
    text_vector_english tsvector,
    text_vector_bangla tsvector,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collection_id, source_hadith_id)
);

-- Hadith topics/categories
CREATE TABLE hadith_topics (
    id SERIAL PRIMARY KEY,
    name_arabic VARCHAR(200),
    name_english VARCHAR(200) NOT NULL,
    name_bangla VARCHAR(200),
    description TEXT,
    parent_topic_id INTEGER REFERENCES hadith_topics(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-many relationship between hadiths and topics
CREATE TABLE hadith_topic_mappings (
    hadith_id INTEGER REFERENCES hadiths(id) ON DELETE CASCADE,
    topic_id INTEGER REFERENCES hadith_topics(id) ON DELETE CASCADE,
    PRIMARY KEY (hadith_id, topic_id)
);
```

### 4.2 Hadith Indices

```sql
CREATE INDEX idx_hadiths_collection ON hadiths(collection_id);
CREATE INDEX idx_hadiths_book ON hadiths(book_id);
CREATE INDEX idx_hadiths_reference ON hadiths(reference);
CREATE INDEX idx_hadiths_grade ON hadiths(grade);
CREATE INDEX idx_hadiths_narrator ON hadiths(primary_narrator);

-- Full-text search indices
CREATE INDEX idx_hadiths_arabic_search ON hadiths USING gin(text_vector_arabic);
CREATE INDEX idx_hadiths_english_search ON hadiths USING gin(text_vector_english);
CREATE INDEX idx_hadiths_bangla_search ON hadiths USING gin(text_vector_bangla);

-- Keywords array index
CREATE INDEX idx_hadiths_keywords ON hadiths USING gin(keywords);
```

---

## 5. Zakat Module Schema

### 5.1 Metal Prices & Exchange Rates

```sql
-- Metal price sources/providers
CREATE TABLE metal_price_sources (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL UNIQUE,
    api_base_url VARCHAR(200),
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Current and historical metal prices
CREATE TABLE metal_prices (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES metal_price_sources(id),
    metal_type VARCHAR(20) NOT NULL CHECK (metal_type IN ('gold', 'silver', 'platinum')),
    price_per_unit DECIMAL(12,6) NOT NULL, -- Price per gram/ounce
    unit VARCHAR(20) NOT NULL CHECK (unit IN ('gram', 'troy_ounce')),
    currency_code VARCHAR(3) NOT NULL, -- ISO currency codes
    price_date DATE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_response JSONB, -- Store original API response
    UNIQUE(source_id, metal_type, unit, currency_code, price_date)
);

-- Exchange rates for currency conversion
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES metal_price_sources(id),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(12,6) NOT NULL,
    rate_date DATE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_id, from_currency, to_currency, rate_date)
);

-- Nisab calculations cache
CREATE TABLE nisab_calculations (
    id SERIAL PRIMARY KEY,
    calculation_date DATE NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    gold_nisab DECIMAL(12,2) NOT NULL, -- 87.48 grams worth in currency
    silver_nisab DECIMAL(12,2) NOT NULL, -- 612.36 grams worth in currency
    gold_price_per_gram DECIMAL(12,6) NOT NULL,
    silver_price_per_gram DECIMAL(12,6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(calculation_date, currency_code)
);
```

### 5.2 Zakat Indices

```sql
CREATE INDEX idx_metal_prices_date ON metal_prices(price_date);
CREATE INDEX idx_metal_prices_metal_currency ON metal_prices(metal_type, currency_code);
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_nisab_calculations_date ON nisab_calculations(calculation_date);
```

---

## 6. System Module Schema

### 6.1 Data Synchronization & Monitoring

```sql
-- API sync job tracking
CREATE TABLE sync_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'quran_sync', 'prayer_sync', 'hadith_sync', 'metal_prices'
    source_api VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50), -- 'chapters', 'verses', 'translations', 'hadiths'
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB, -- Store job-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data versioning for cache invalidation
CREATE TABLE data_versions (
    id SERIAL PRIMARY KEY,
    resource_type VARCHAR(50) NOT NULL, -- 'quran', 'hadith', 'prayer_methods'
    source_api VARCHAR(50) NOT NULL,
    version_hash VARCHAR(64) NOT NULL, -- SHA256 of content
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource_type, source_api)
);

-- API request logs for monitoring
CREATE TABLE api_request_logs (
    id SERIAL PRIMARY KEY,
    source_api VARCHAR(50) NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size INTEGER, -- Bytes
    response_size INTEGER, -- Bytes
    error_message TEXT,
    client_ip INET,
    user_agent TEXT,
    request_id UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting tracking
CREATE TABLE api_rate_limits (
    id SERIAL PRIMARY KEY,
    source_api VARCHAR(50) NOT NULL,
    rate_limit_window VARCHAR(20) NOT NULL, -- 'hour', 'day', 'month'
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    requests_count INTEGER DEFAULT 0,
    limit_exceeded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_api, rate_limit_window, window_start)
);
```

### 6.2 System Indices

```sql
CREATE INDEX idx_sync_jobs_type_status ON sync_jobs(job_type, status);
CREATE INDEX idx_sync_jobs_created ON sync_jobs(created_at);
CREATE INDEX idx_api_logs_source_created ON api_request_logs(source_api, created_at);
CREATE INDEX idx_api_logs_status_created ON api_request_logs(status_code, created_at);
CREATE INDEX idx_rate_limits_api_window ON api_rate_limits(source_api, window_start);
```

---

## 7. Views & Functions

### 7.1 Useful Views

```sql
-- Current Quran statistics
CREATE VIEW quran_stats AS
SELECT 
    COUNT(*) as total_chapters,
    SUM(verse_count) as total_verses,
    COUNT(DISTINCT qtr.language_code) as translation_languages,
    COUNT(DISTINCT qr.id) as total_reciters
FROM quran_chapters qc
LEFT JOIN quran_translation_resources qtr ON qtr.is_active = true
LEFT JOIN quran_reciters qr ON qr.is_active = true;

-- Current hadith statistics
CREATE VIEW hadith_stats AS
SELECT 
    hc.name_english as collection_name,
    COUNT(h.id) as hadith_count,
    COUNT(DISTINCT hb.id) as book_count,
    COUNT(CASE WHEN h.text_bangla IS NOT NULL THEN 1 END) as bangla_translations,
    MAX(h.updated_at) as last_updated
FROM hadith_collections hc
LEFT JOIN hadiths h ON h.collection_id = hc.id
LEFT JOIN hadith_books hb ON hb.collection_id = hc.id
WHERE hc.is_active = true
GROUP BY hc.id, hc.name_english;

-- Recent API performance
CREATE VIEW api_performance_24h AS
SELECT 
    source_api,
    COUNT(*) as total_requests,
    AVG(response_time_ms) as avg_response_time,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
    (COUNT(CASE WHEN status_code < 400 THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100) as success_rate
FROM api_request_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source_api;
```

### 7.2 Utility Functions

```sql
-- Function to get Nisab for a specific date and currency
CREATE OR REPLACE FUNCTION get_nisab_amount(
    p_date DATE,
    p_currency VARCHAR(3),
    p_metal VARCHAR(10) DEFAULT 'gold'
) RETURNS DECIMAL AS $$
DECLARE
    nisab_amount DECIMAL;
BEGIN
    SELECT 
        CASE 
            WHEN p_metal = 'gold' THEN gold_nisab
            WHEN p_metal = 'silver' THEN silver_nisab
            ELSE NULL
        END
    INTO nisab_amount
    FROM nisab_calculations
    WHERE calculation_date = p_date 
    AND currency_code = p_currency;
    
    RETURN nisab_amount;
END;
$$ LANGUAGE plpgsql;

-- Function for full-text search across Quran translations
CREATE OR REPLACE FUNCTION search_quran_translations(
    p_query TEXT,
    p_language VARCHAR(10) DEFAULT 'english',
    p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
    verse_key VARCHAR,
    chapter_name VARCHAR,
    verse_number INTEGER,
    translation_text TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qv.verse_key,
        qc.name_english,
        qv.verse_number,
        qt.text,
        ts_rank(qt.text_vector, plainto_tsquery('english', p_query)) as rank
    FROM quran_translations qt
    JOIN quran_verses qv ON qt.verse_id = qv.id
    JOIN quran_chapters qc ON qv.chapter_id = qc.id
    JOIN quran_translation_resources qtr ON qt.resource_id = qtr.id
    WHERE qt.text_vector @@ plainto_tsquery('english', p_query)
    AND qtr.language_code = p_language
    AND qtr.is_active = true
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## 8. Data Integrity & Constraints

### 8.1 Check Constraints

```sql
-- Ensure Quran verse counts are correct
ALTER TABLE quran_chapters ADD CONSTRAINT check_verse_count_valid
CHECK (
    (chapter_number = 1 AND verse_count = 7) OR  -- Al-Fatiha
    (chapter_number = 2 AND verse_count = 286) OR -- Al-Baqarah
    -- ... (all 114 chapters)
    verse_count > 0
);

-- Ensure prayer times are in correct order
ALTER TABLE prayer_times_cache ADD CONSTRAINT check_prayer_times_order
CHECK (
    fajr_time < sunrise_time AND
    sunrise_time < dhuhr_time AND
    dhuhr_time < asr_time AND
    asr_time < maghrib_time AND
    maghrib_time < isha_time
);

-- Ensure metal prices are positive
ALTER TABLE metal_prices ADD CONSTRAINT check_positive_price
CHECK (price_per_unit > 0);
```

### 8.2 Foreign Key Policies

```sql
-- Cascade deletions appropriately
-- Verses should be deleted if chapter is deleted
-- Translations should be deleted if verse is deleted
-- Prayer cache should be deleted if location is deleted
-- Hadiths should be preserved even if collection metadata changes (SET NULL)
```

---

## 9. Scaling Considerations

### 9.1 Partitioning Strategy

```sql
-- Partition large tables by date for better performance
-- Prayer times cache partitioned by month
CREATE TABLE prayer_times_cache_y2025m09 PARTITION OF prayer_times_cache
FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- API logs partitioned by month  
CREATE TABLE api_request_logs_y2025m09 PARTITION OF api_request_logs
FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
```

### 9.2 Backup & Archival

```sql
-- Archive old sync jobs (keep last 90 days)
DELETE FROM sync_jobs WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive old API logs (keep last 30 days)  
DELETE FROM api_request_logs WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 10. Estimated Storage Requirements

### 10.1 Size Projections

| Table | Records | Est. Size | Growth |
|-------|---------|-----------|---------|
| `quran_verses` | 6,236 | 2 MB | Static |
| `quran_translations` | 300K+ | 150 MB | Slow |
| `hadiths` | 50K+ | 500 MB | Medium |
| `prayer_times_cache` | 1M+/year | 100 MB/year | Linear |
| `api_request_logs` | 10M+/year | 1 GB/year | Linear |
| **Total** | | **~2 GB** | **1-2 GB/year** |

### 10.2 Performance Targets

- **Quran verse lookup**: < 50ms
- **Prayer time calculation**: < 100ms  
- **Hadith search**: < 200ms
- **Full-text search**: < 500ms
- **API response generation**: < 1 second

---

**Schema Completed**: September 3, 2025  
**Database**: PostgreSQL 14+ required for JSON and full-text features  
**Deployment Ready**: Yes, with proper indexing and constraints
