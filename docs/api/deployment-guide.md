# DeenMate API Production Deployment Guide

## Overview

This guide covers the production deployment of the DeenMate API, including infrastructure setup, deployment strategies, monitoring, and maintenance.

## Prerequisites

- Docker and Docker Compose installed
- Access to cloud infrastructure (Railway, Fly.io, AWS, etc.)
- Domain name configured
- SSL certificates ready
- Monitoring and logging tools configured

## Infrastructure Requirements

### Minimum Production Specs

- **CPU**: 2 vCPUs
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 100 Mbps bandwidth
- **Database**: PostgreSQL 14+ with connection pooling
- **Cache**: Redis 6+ with persistence

### Recommended Production Specs

- **CPU**: 4 vCPUs
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: 1 Gbps bandwidth
- **Database**: PostgreSQL 15+ with read replicas
- **Cache**: Redis 7+ with cluster mode

## Deployment Options

### Option 1: Railway (Recommended for Startups)

Railway provides a simple, scalable platform with built-in CI/CD.

#### Setup Steps

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Configure Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set DATABASE_URL=postgresql://...
   railway variables set REDIS_URL=redis://...
   railway variables set JWT_SECRET=your-super-secret-key
   ```

5. **Deploy**
   ```bash
   railway up
   ```

#### Railway Configuration

```json
// railway.json
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Option 2: Fly.io (Global Distribution)

Fly.io provides global edge deployment with automatic scaling.

#### Setup Steps

1. **Install Flyctl**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   fly auth login
   ```

3. **Create App**
   ```bash
   fly apps create deenmate-api
   ```

4. **Configure Fly.toml**
   ```toml
   app = "deenmate-api"
   primary_region = "iad"
   
   [build]
     dockerfile = "Dockerfile"
   
   [env]
     NODE_ENV = "production"
   
   [http_service]
     internal_port = 3000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 1
   
   [[http_service.checks]]
     grace_period = "10s"
     interval = "30s"
     method = "GET"
     timeout = "5s"
     path = "/health"
   
   [vm]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 4096
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

### Option 3: AWS ECS (Enterprise)

For enterprise deployments with full control over infrastructure.

#### Infrastructure as Code (Terraform)

```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC and Networking
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "deenmate-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
  single_nat_gateway = true
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "deenmate-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ECS Service
resource "aws_ecs_service" "api" {
  name            = "deenmate-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  
  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs.id]
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "deenmate-api"
    container_port   = 3000
  }
}

# Application Load Balancer
resource "aws_lb" "api" {
  name               = "deenmate-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier = "deenmate-postgres"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  
  db_name  = "deenmate"
  username = "deenmate"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  deletion_protection = true
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "deenmate-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
}
```

## Environment Configuration

### Production Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://username:password@host:port/database
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis
REDIS_URL=redis://username:password@host:port
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# CORS
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true

# External APIs
ALADHAN_API_URL=https://api.aladhan.com
SUNNAH_API_KEY=your-sunnah-api-key
GOLD_PRICE_API_KEY=your-gold-price-api-key

# CDN/Storage
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET=deenmate-audio
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xyz.r2.dev
```

### Environment-Specific Configs

```typescript
// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN, 10) || 5,
      max: parseInt(process.env.DATABASE_POOL_MAX, 10) || 20,
    },
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  monitoring: {
    metrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT, 10) || 9090,
    tracing: process.env.ENABLE_TRACING === 'true',
  },
});
```

## Database Setup

### Production Database Configuration

```sql
-- Create production database
CREATE DATABASE deenmate_prod;

-- Create dedicated user
CREATE USER deenmate_prod WITH PASSWORD 'strong-password-here';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE deenmate_prod TO deenmate_prod;

-- Enable extensions
\c deenmate_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_quran_verses_chapter_id ON quran_verses(chapter_id);
CREATE INDEX CONCURRENTLY idx_hadiths_collection_id ON hadiths(collection_id);
CREATE INDEX CONCURRENTLY idx_prayer_times_location_hash ON prayer_times_cache(location_hash);
CREATE INDEX CONCURRENTLY idx_audio_metadata_reciter ON audio_metadata(reciter_id);

-- Set up connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
```

### Database Migration Strategy

```bash
# Production migration script
#!/bin/bash

echo "Starting production database migration..."

# Backup current database
echo "Creating backup..."
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
echo "Running migrations..."
npm run db:migrate:deploy

# Verify migration
echo "Verifying migration..."
npm run db:verify

# Update Prisma client
echo "Generating Prisma client..."
npm run db:generate

echo "Migration completed successfully!"
```

## Monitoring and Observability

### Prometheus Metrics

```typescript
// src/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  
  // Request metrics
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDuration: Histogram;
  
  // Business metrics
  private readonly quranRequestsTotal: Counter;
  private readonly prayerRequestsTotal: Counter;
  private readonly hadithRequestsTotal: Counter;
  private readonly zakatRequestsTotal: Counter;
  private readonly audioRequestsTotal: Counter;
  
  // System metrics
  private readonly activeConnections: Gauge;
  private readonly cacheHitRatio: Gauge;
  private readonly databaseConnections: Gauge;

  constructor() {
    this.registry = new Registry();
    
    // Initialize metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
    
    // Business metrics
    this.quranRequestsTotal = new Counter({
      name: 'quran_requests_total',
      help: 'Total number of Quran API requests',
      registers: [this.registry],
    });
    
    this.prayerRequestsTotal = new Counter({
      name: 'prayer_requests_total',
      help: 'Total number of Prayer API requests',
      registers: [this.registry],
    });
    
    // System metrics
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      registers: [this.registry],
    });
    
    this.cacheHitRatio = new Gauge({
      name: 'cache_hit_ratio',
      help: 'Cache hit ratio percentage',
      registers: [this.registry],
    });
  }

  recordHttpRequest(method: string, route: string, status: number, duration: number) {
    this.httpRequestsTotal.inc({ method, route, status });
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  recordQuranRequest() {
    this.quranRequestsTotal.inc();
  }

  recordPrayerRequest() {
    this.prayerRequestsTotal.inc();
  }

  setActiveConnections(count: number) {
    this.activeConnections.set(count);
  }

  setCacheHitRatio(ratio: number) {
    this.cacheHitRatio.set(ratio);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "DeenMate API Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      },
      {
        "title": "Cache Hit Ratio",
        "type": "singlestat",
        "targets": [
          {
            "expr": "cache_hit_ratio",
            "legendFormat": "Cache Hit %"
          }
        ]
      }
    ]
  }
}
```

## Security Configuration

### Security Headers

```typescript
// src/security/security.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'"
    ].join('; '));
    
    next();
  }
}
```

### Rate Limiting

```typescript
// src/security/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    // Use IP address for rate limiting
    return req.ip;
  }
}
```

## Backup and Recovery

### Automated Backup Script

```bash
#!/bin/bash

# Production backup script
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "Starting backup at $(date)"

# Database backup
echo "Backing up database..."
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Redis backup
echo "Backing up Redis..."
redis-cli --rdb "$BACKUP_DIR/redis_backup_$DATE.rdb"

# Application logs backup
echo "Backing up logs..."
tar -czf "$BACKUP_DIR/logs_backup_$DATE.tar.gz" /var/log/deenmate/

# Cleanup old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $(date)"
```

### Recovery Procedures

```bash
#!/bin/bash

# Database recovery script
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

echo "Starting database recovery from $BACKUP_FILE..."

# Stop application
echo "Stopping application..."
systemctl stop deenmate-api

# Restore database
echo "Restoring database..."
gunzip -c "$BACKUP_FILE" | psql $DATABASE_URL

# Verify restoration
echo "Verifying restoration..."
psql $DATABASE_URL -c "SELECT COUNT(*) FROM quran_chapters;"

# Start application
echo "Starting application..."
systemctl start deenmate-api

echo "Recovery completed!"
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: railway/deploy@v1
        with:
          service: api
          token: ${{ secrets.RAILWAY_TOKEN }}
      
      - name: Run database migrations
        run: |
          npm ci
          npm run db:migrate:deploy
      
      - name: Verify deployment
        run: |
          sleep 30
          curl -f https://api.deenmate.com/api/v1/health
      
      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          text: 'DeenMate API deployment ${{ job.status }}'
```

## Performance Optimization

### Caching Strategy

```typescript
// src/cache/cache.service.ts
@Injectable()
export class CacheService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redisService.setex(key, ttl, serialized);
    } else {
      await this.redisService.set(key, serialized);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redisService.keys(pattern);
    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
  }

  // Cache warming for frequently accessed data
  async warmCache(): Promise<void> {
    // Warm Quran chapters cache
    const chapters = await this.quranService.getChapters();
    await this.set('quran:chapters', chapters, 86400);
    
    // Warm prayer calculation methods
    const methods = await this.prayerService.getCalculationMethods();
    await this.set('prayer:methods', methods, 86400);
    
    // Warm hadith collections
    const collections = await this.hadithService.getCollections();
    await this.set('hadith:collections', collections, 86400);
  }
}
```

### Database Query Optimization

```typescript
// src/database/database.service.ts
@Injectable()
export class DatabaseService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuranChaptersWithVersesCount() {
    return this.prisma.$queryRaw`
      SELECT 
        c.id,
        c.chapter_number,
        c.name_arabic,
        c.name_english,
        c.verses_count,
        c.revelation_type,
        COUNT(v.id) as actual_verses_count
      FROM quran_chapters c
      LEFT JOIN quran_verses v ON c.id = v.chapter_id
      GROUP BY c.id
      ORDER BY c.chapter_number
    `;
  }

  async getPrayerTimesWithCaching(lat: number, lng: number, date: string) {
    // Use materialized view for better performance
    return this.prisma.$queryRaw`
      SELECT * FROM prayer_times_materialized_view
      WHERE latitude = ${lat}
        AND longitude = ${lng}
        AND date = ${date}::date
    `;
  }
}
```

## Maintenance Procedures

### Health Check Endpoints

```typescript
// src/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.checkExternalApis(),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.checkDatabaseMigrations(),
    ]);
  }

  private async checkExternalApis() {
    try {
      // Check Aladhan API
      const aladhanResponse = await fetch('https://api.aladhan.com/v1/timings/...');
      if (!aladhanResponse.ok) throw new Error('Aladhan API unavailable');
      
      return { externalApis: { status: 'up' } };
    } catch (error) {
      return { externalApis: { status: 'down', error: error.message } };
    }
  }
}
```

### Log Rotation

```bash
# /etc/logrotate.d/deenmate-api
/var/log/deenmate/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 deenmate deenmate
    postrotate
        systemctl reload deenmate-api
    endscript
}
```

## Troubleshooting

### Common Issues and Solutions

#### High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Check for memory leaks
node --inspect app.js
```

#### Database Connection Issues
```bash
# Check database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection pool
psql -c "SHOW max_connections;"
```

#### Redis Performance Issues
```bash
# Check Redis memory usage
redis-cli info memory

# Check Redis slow queries
redis-cli slowlog get 10
```

#### API Response Time Issues
```bash
# Check application logs
tail -f /var/log/deenmate/api.log | grep "slow"

# Check database query performance
psql -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Support and Maintenance

### Monitoring Alerts

```typescript
// src/monitoring/alerts.service.ts
@Injectable()
export class AlertsService {
  async sendAlert(level: 'info' | 'warning' | 'error', message: string) {
    // Send to monitoring system (PagerDuty, Slack, etc.)
    console.log(`[${level.toUpperCase()}] ${message}`);
    
    if (level === 'error') {
      await this.sendEmergencyAlert(message);
    }
  }

  private async sendEmergencyAlert(message: string) {
    // Implementation for emergency notifications
  }
}
```

### Maintenance Windows

- **Database Maintenance**: Sundays 2:00-4:00 AM UTC
- **Application Updates**: Tuesdays 6:00-8:00 AM UTC
- **Security Patches**: As needed, with 24-hour notice
- **Backup Verification**: Daily at 3:00 AM UTC

---

*This deployment guide should be updated regularly as infrastructure and requirements evolve.*
