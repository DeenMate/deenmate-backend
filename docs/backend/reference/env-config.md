# 🔧 DeenMate Backend — Environment Configuration

## 🎯 **Current Phase: Live Sync Implementation**

**Purpose:** Document all required environment variables for the Live Sync implementation  
**Last Updated:** September 4, 2025

---

## 📋 **Environment Variables Reference**

### **Database Configuration**
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/deenmate"
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=deenmate
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
```

### **Redis Configuration**
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### **Application Configuration**
```bash
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
```

### **Upstream APIs**
```bash
QURAN_API_BASE=https://api.quran.com/api/v4
ALADHAN_API_BASE=https://api.aladhan.com/v1
QURAN_API_KEY=
ALADHAN_API_KEY=
```

### **Sync Configuration**
```bash
SYNC_CRON_DAILY="0 3 * * *"
SYNC_ENABLED=true
SYNC_MAX_RETRIES=3
SYNC_RETRY_DELAY_MS=1000
```

### **HTTP Configuration**
```bash
HTTP_TIMEOUT_MS=15000
HTTP_MAX_RETRIES=3
HTTP_RETRY_BACKOFF_MS=500
HTTP_RATE_LIMIT_DELAY_MS=100
```

### **Feature Flags**
```bash
ENABLE_UPSTREAM_PROXY=true
ENABLE_CIRCUIT_BREAKER=true
ENABLE_RATE_LIMITING=true
ENABLE_BATCH_PROCESSING=true
```

### **Upstream Compatibility**
```bash
UPSTREAM_COMPAT_DEFAULT=true
```

### **Cloudflare R2 (for future use)**
```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

### **Monitoring & Observability (for future use)**
```bash
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
```

---

## 🔧 **Setup Instructions**

### **1. Copy Environment Template**
```bash
# Copy the example file
cp .env.example .env

# Or create manually if .env.example doesn't exist
touch .env
```

### **2. Configure Required Variables**
```bash
# Database (update with your actual credentials)
DATABASE_URL="postgresql://username:password@host:port/database"

# Redis (update with your actual Redis instance)
REDIS_URL=redis://host:port

# JWT Secret (generate a strong secret)
JWT_SECRET=$(openssl rand -base64 32)

# Upstream APIs (leave empty if no API keys required)
QURAN_API_BASE=https://api.quran.com/api/v4
ALADHAN_API_BASE=https://api.aladhan.com/v1
```

### **3. Validate Configuration**
```bash
# Test database connection
npm run db:test

# Test Redis connection
npm run redis:test

# Validate environment variables
npm run config:validate
```

---

## ⚠️ **Security Notes**

1. **Never commit `.env` files** to version control
2. **Use strong JWT secrets** in production
3. **Rotate API keys** regularly
4. **Use environment-specific** configurations
5. **Validate all inputs** before use

---

## 🔄 **Environment-Specific Configs**

### **Development**
```bash
NODE_ENV=development
SYNC_ENABLED=false  # Disable cron jobs in dev
ENABLE_UPSTREAM_PROXY=true
```

### **Staging**
```bash
NODE_ENV=staging
SYNC_ENABLED=true
SYNC_CRON_DAILY="0 4 * * *"  # 4 AM UTC for staging
ENABLE_UPSTREAM_PROXY=true
```

### **Production**
```bash
NODE_ENV=production
SYNC_ENABLED=true
SYNC_CRON_DAILY="0 3 * * *"  # 3 AM UTC for production
ENABLE_UPSTREAM_PROXY=false  # Disable in production initially
```

---

*Last updated: September 4, 2025*
