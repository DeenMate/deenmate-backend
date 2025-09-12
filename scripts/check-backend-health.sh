#!/bin/bash

# DeenMate Backend Health Check Script
# Usage: ./scripts/check-backend-health.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:3000"
ADMIN_EMAIL="admin@deenmate.app"
ADMIN_PASSWORD="admin123"

echo "🔍 DeenMate Backend Health Check"
echo "================================="

# Function to check if server is running
check_server() {
    echo -n "Checking server status... "
    if curl -s -f "$API_BASE/api/v4/health" > /dev/null; then
        echo -e "${GREEN}✅ Server is running${NC}"
        return 0
    else
        echo -e "${RED}❌ Server is not responding${NC}"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    echo -n "Checking database connectivity... "
    if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is accessible${NC}"
        return 0
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    echo -n "Checking Redis connectivity... "
    if command -v redis-cli > /dev/null; then
        if redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis is accessible${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️ Redis client not responding${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️ Redis client not installed${NC}"
        return 1
    fi
}

# Function to check API endpoints
check_api_endpoints() {
    echo "Checking critical API endpoints..."
    
    local failed=0
    
    # Check public endpoints
    local endpoints=(
        "GET:/api/v4/quran/chapters"
        "GET:/api/v4/hadith/collections"
        "GET:/api/v4/finance/gold-prices/latest"
        "GET:/api/v4/zakat/nisab"
        "GET:/api/v4/audio/reciters"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local method=$(echo "$endpoint" | cut -d: -f1)
        local path=$(echo "$endpoint" | cut -d: -f2-)
        
        echo -n "  $method $path... "
        if curl -s -f -X "$method" "$API_BASE$path" > /dev/null; then
            echo -e "${GREEN}✅${NC}"
        else
            echo -e "${RED}❌${NC}"
            ((failed++))
        fi
    done
    
    return $failed
}

# Function to check admin authentication
check_admin_auth() {
    echo -n "Checking admin authentication... "
    
    local login_response=$(curl -s -X POST "$API_BASE/api/v4/admin/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
    
    if echo "$login_response" | jq -e '.data.accessToken' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Admin login successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Admin login failed${NC}"
        return 1
    fi
}

# Function to check data freshness
check_data_freshness() {
    echo "Checking data freshness..."
    
    # Check if we have recent sync jobs
    local recent_syncs=$(npx prisma db execute --stdin <<< "
        SELECT COUNT(*) as count 
        FROM sync_job_logs 
        WHERE started_at > NOW() - INTERVAL '24 hours' 
        AND status = 'success';
    " 2>/dev/null | tail -n +2 | tr -d ' ')
    
    if [ "$recent_syncs" -gt 0 ]; then
        echo -e "  Recent successful syncs: ${GREEN}✅ $recent_syncs${NC}"
    else
        echo -e "  Recent successful syncs: ${RED}❌ 0${NC}"
    fi
    
    # Check for stuck jobs
    local stuck_jobs=$(npx prisma db execute --stdin <<< "
        SELECT COUNT(*) as count 
        FROM sync_job_logs 
        WHERE status = 'in_progress' 
        AND started_at < NOW() - INTERVAL '1 hour';
    " 2>/dev/null | tail -n +2 | tr -d ' ')
    
    if [ "$stuck_jobs" -gt 0 ]; then
        echo -e "  Stuck sync jobs: ${RED}❌ $stuck_jobs${NC}"
    else
        echo -e "  Stuck sync jobs: ${GREEN}✅ 0${NC}"
    fi
}

# Function to check test status
check_tests() {
    echo -n "Running tests... "
    if npm test > /dev/null 2>&1; then
        echo -e "${GREEN}✅ All tests passing${NC}"
        return 0
    else
        echo -e "${RED}❌ Some tests failing${NC}"
        return 1
    fi
}

# Main execution
main() {
    local exit_code=0
    
    check_server || ((exit_code++))
    check_database || ((exit_code++))
    check_redis || ((exit_code++))
    check_api_endpoints || ((exit_code++))
    check_admin_auth || ((exit_code++))
    check_data_freshness
    check_tests || ((exit_code++))
    
    echo ""
    echo "================================="
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}🎉 All health checks passed!${NC}"
    else
        echo -e "${RED}⚠️ $exit_code health check(s) failed${NC}"
    fi
    
    exit $exit_code
}

# Run main function
main "$@"
