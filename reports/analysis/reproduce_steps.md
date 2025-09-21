# Prayer Sync Failure Reproduction Steps

## Prerequisites

1. Docker and Docker Compose installed
2. Node.js and npm installed
3. Access to the deenmate-backend repository

## Step-by-Step Reproduction

### 1. Environment Setup

```bash
# Clone and navigate to repository
cd /path/to/deenmate-backend

# Start database services
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 10

# Install dependencies
npm ci --legacy-peer-deps

# Build the application
npm run build
```

### 2. Database Setup

```bash
# Run database migrations
npm run db:migrate

# Seed the database
npm run db:seed

# Verify database state
docker exec deenmate-backend-postgres-1 psql -U postgres -d deenmate -c "
SELECT 
  (SELECT COUNT(*) FROM prayer_calculation_methods) as methods_count,
  (SELECT COUNT(*) FROM prayer_locations) as locations_count,
  (SELECT COUNT(*) FROM prayer_times) as times_count;
"
```

Expected output:
```
 methods_count | locations_count | times_count 
---------------+-----------------+-------------
             2 |               2 |           0
```

### 3. Start Application

```bash
# Start the application
node dist/main.js > app.log 2>&1 &

# Wait for startup
sleep 5

# Verify application is running
curl -s http://localhost:3000/api/v4/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "nestjs-docs": {
      "status": "up"
    }
  }
}
```

### 4. Authenticate as Admin

```bash
# Login as admin
curl -X POST "http://localhost:3000/api/v4/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@deenmate.app","password":"admin123"}' \
  -o login_response.json

# Extract token
TOKEN=$(cat login_response.json | jq -r '.data.accessToken')
echo "Token: $TOKEN"
```

### 5. Trigger Prayer Sync

```bash
# Trigger prayer sync
curl -X POST "http://localhost:3000/api/v4/admin/sync/prayer?mode=now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -o sync_response.json

# Check response
cat sync_response.json
```

Expected response:
```json
{
  "success": true,
  "message": "Prayer sync queued successfully",
  "data": {
    "module": "prayer"
  }
}
```

### 6. Monitor Job Processing

```bash
# Check application logs for job queuing
grep -i "prayer.*sync.*queued" app.log

# Check Redis for queued jobs
docker exec deenmate-backend-redis-1 redis-cli keys "bull:sync-queue:*"

# Monitor job processing
tail -f app.log | grep -E "(prayer|sync|job)"
```

### 7. Verify Failure

Wait 10+ minutes, then check:

```bash
# Check prayer times count (should still be 0)
docker exec deenmate-backend-postgres-1 psql -U postgres -d deenmate -c "
SELECT COUNT(*) as prayer_times_count FROM prayer_times;
"

# Check for prayer sync processing logs
grep -i "prayer.*sync.*process" app.log

# Check job status in database
docker exec deenmate-backend-postgres-1 psql -U postgres -d deenmate -c "
SELECT * FROM sync_job_logs WHERE \"jobName\" LIKE '%prayer%' ORDER BY started_at DESC LIMIT 5;
"
```

## Expected Failure Scenarios

### Scenario 1: Job Queue Blocking
- **Symptom**: Prayer sync job queued but never processed
- **Evidence**: No prayer sync processing logs after 10+ minutes
- **Cause**: Long-running Quran sync job blocking the queue

### Scenario 2: Instant Success Response
- **Symptom**: API returns success immediately
- **Evidence**: Response shows "queued successfully" not "completed successfully"
- **Cause**: Controller returns success after enqueueing, not after completion

### Scenario 3: Missing Prerequisites
- **Symptom**: Sync fails or produces incomplete data
- **Evidence**: Only 2 methods and 2 locations in database
- **Cause**: Insufficient prerequisite data for comprehensive sync

## Verification Commands

### Check Job Queue Status
```bash
# Redis queue status
docker exec deenmate-backend-redis-1 redis-cli llen "bull:sync-queue:waiting"
docker exec deenmate-backend-redis-1 redis-cli llen "bull:sync-queue:active"
docker exec deenmate-backend-redis-1 redis-cli llen "bull:sync-queue:completed"
```

### Check Database State
```bash
# Prayer data counts
docker exec deenmate-backend-postgres-1 psql -U postgres -d deenmate -c "
SELECT 
  'methods' as table_name, COUNT(*) as count FROM prayer_calculation_methods
UNION ALL
SELECT 
  'locations' as table_name, COUNT(*) as count FROM prayer_locations  
UNION ALL
SELECT 
  'times' as table_name, COUNT(*) as count FROM prayer_times;
"
```

### Check Application Logs
```bash
# Prayer sync related logs
grep -i "prayer" app.log | tail -20

# Job processing logs
grep -i "sync.*job" app.log | tail -20

# Error logs
grep -i "error" app.log | tail -20
```

## Cleanup

```bash
# Stop application
pkill -f "node dist/main.js"

# Stop database services
docker-compose down

# Clean up log files
rm -f app.log login_response.json sync_response.json
```

## Troubleshooting

### If Database Connection Fails
```bash
# Check if containers are running
docker ps

# Check container logs
docker logs deenmate-backend-postgres-1
docker logs deenmate-backend-redis-1

# Restart services if needed
docker-compose restart postgres redis
```

### If Application Won't Start
```bash
# Check for port conflicts
lsof -i :3000

# Check application logs
tail -f app.log

# Verify environment variables
cat .env
```

### If Authentication Fails
```bash
# Verify admin user exists
docker exec deenmate-backend-postgres-1 psql -U postgres -d deenmate -c "
SELECT email, role FROM admin_users WHERE email = 'admin@deenmate.app';
"

# Re-seed admin user if needed
npx ts-node scripts/seed-admin-user.ts
```

This reproduction guide allows anyone to consistently reproduce the prayer sync failures and verify the fixes once implemented.
