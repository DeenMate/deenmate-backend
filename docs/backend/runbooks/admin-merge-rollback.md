# Admin Dashboard Merge Rollback Guide

This document provides step-by-step instructions for rolling back the admin dashboard merge if issues arise.

## Quick Rollback Commands

### 1. Code Rollback

```bash
# Option A: Reset to main branch (destructive)
git checkout main
git reset --hard origin/main

# Option B: Revert specific commits (safer)
git checkout main
git revert <merge-commit-hash>

# Option C: Revert specific commits by range
git checkout main
git revert <first-commit>..<last-commit>
```

### 2. Container Rollback

```bash
# Stop current container
docker stop deenmate-api

# Pull previous image
docker pull registry/deenmate-api:previous-tag

# Run previous container
docker run --rm -d \
  --name deenmate-api \
  -p 3000:3000 \
  -e DATABASE_URL="your-db-url" \
  -e REDIS_HOST="your-redis-host" \
  registry/deenmate-api:previous-tag
```

### 3. Database Rollback

```bash
# If database schema changes were made
pg_restore -d $DB_NAME /path/to/backup.dump

# Or restore from specific backup
psql -d $DB_NAME -f /path/to/backup.sql
```

## Detailed Rollback Procedures

### Pre-Rollback Checklist

1. **Identify the issue**
   - Check application logs: `docker logs deenmate-api`
   - Verify database connectivity
   - Test API endpoints: `curl http://localhost:3000/api/v4/health`
   - Test admin dashboard: `curl http://localhost:3000/admin`

2. **Backup current state**
   ```bash
   # Backup database
   pg_dump $DB_NAME > backup-$(date +%Y%m%d-%H%M%S).sql
   
   # Backup current code
   git tag rollback-backup-$(date +%Y%m%d-%H%M%S)
   ```

### Rollback Steps

#### Step 1: Stop Services

```bash
# Stop the application
docker stop deenmate-api

# Or if running with PM2
pm2 stop deenmate-api

# Or if running directly
pkill -f "node dist/main.js"
```

#### Step 2: Rollback Code

```bash
# Navigate to project directory
cd /path/to/deenmate-api

# Check current branch
git branch

# Rollback to main branch
git checkout main
git reset --hard origin/main

# Verify rollback
git log --oneline -5
```

#### Step 3: Rollback Dependencies

```bash
# Remove new dependencies
npm uninstall @nestjs/serve-static

# Restore original package.json
git checkout main -- package.json package-lock.json

# Reinstall dependencies
npm ci
```

#### Step 4: Rollback Configuration

```bash
# Restore original app.module.ts
git checkout main -- src/app.module.ts

# Restore original Dockerfile
git checkout main -- Dockerfile

# Restore original package.json scripts
git checkout main -- package.json
```

#### Step 5: Rebuild and Deploy

```bash
# Build the application
npm run build

# Build Docker image
docker build -t deenmate-api:rollback .

# Run the container
docker run --rm -d \
  --name deenmate-api \
  -p 3000:3000 \
  -e DATABASE_URL="your-db-url" \
  -e REDIS_HOST="your-redis-host" \
  deenmate-api:rollback
```

#### Step 6: Verify Rollback

```bash
# Wait for application to start
sleep 10

# Test API health
curl -f http://localhost:3000/api/v4/health

# Test admin dashboard (should return 404 or redirect)
curl -I http://localhost:3000/admin

# Check application logs
docker logs deenmate-api
```

## Troubleshooting Rollback Issues

### Issue: Database Connection Errors

```bash
# Check database status
pg_isready -h localhost -p 5432

# Restart database if needed
sudo systemctl restart postgresql

# Check database logs
sudo journalctl -u postgresql -f
```

### Issue: Redis Connection Errors

```bash
# Check Redis status
redis-cli ping

# Restart Redis if needed
sudo systemctl restart redis

# Check Redis logs
sudo journalctl -u redis -f
```

### Issue: Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
docker run -p 3001:3000 deenmate-api:rollback
```

### Issue: Missing Environment Variables

```bash
# Check environment variables
docker exec deenmate-api env | grep -E "(DATABASE|REDIS|API)"

# Set missing variables
docker run -e DATABASE_URL="your-url" deenmate-api:rollback
```

## Post-Rollback Verification

### 1. API Endpoints

```bash
# Health check
curl http://localhost:3000/api/v4/health

# Quran endpoints
curl http://localhost:3000/api/v4/quran/chapters

# Prayer endpoints
curl http://localhost:3000/api/v4/prayer/methods
```

### 2. Admin Functionality

```bash
# Admin login (should work with original endpoints)
curl -X POST http://localhost:3000/api/v4/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@deenmate.app","password":"admin123"}'

# Admin summary
curl http://localhost:3000/api/v4/admin/summary
```

### 3. Database Integrity

```bash
# Check table counts
psql -d $DB_NAME -c "SELECT COUNT(*) FROM quran_chapters;"
psql -d $DB_NAME -c "SELECT COUNT(*) FROM quran_verses;"
psql -d $DB_NAME -c "SELECT COUNT(*) FROM prayer_times;"
psql -d $DB_NAME -c "SELECT COUNT(*) FROM hadith_items;"
```

## Prevention for Future Migrations

1. **Always create backup branches**
2. **Test in staging environment first**
3. **Use feature flags for gradual rollout**
4. **Monitor application metrics during deployment**
5. **Have rollback plan ready before deployment**

## Emergency Contacts

- **DevOps Team**: devops@deenmate.app
- **Backend Team**: backend@deenmate.app
- **Database Team**: db@deenmate.app

## Related Documentation

- [Deployment Guide](../deployment.md)
- [Database Migration Guide](../database-migrations.md)
- [Monitoring and Alerting](../monitoring.md)
