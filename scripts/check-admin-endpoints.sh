#!/bin/bash

# DeenMate Admin Endpoints Health Check Script
# Usage: ./scripts/check-admin-endpoints.sh [base_url]

set -e

BASE_URL=${1:-"http://localhost:3000/api/v4"}
ADMIN_KEY="test-admin-key-123"

echo "🔍 DeenMate Admin Endpoints Health Check"
echo "========================================"
echo "Base URL: $BASE_URL"
echo "Admin Key: $ADMIN_KEY"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    
    echo -n "Testing $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "x-admin-api-key: $ADMIN_KEY" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -H "x-admin-api-key: $ADMIN_KEY" -X "$method" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $http_code, expected $expected_status)"
        echo "Response: $body"
        return 1
    fi
}

# Function to check sync endpoint with timeout
check_sync_endpoint() {
    local module=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    # Use gtimeout (GNU timeout) if available, otherwise use curl with max-time
    if command -v gtimeout >/dev/null 2>&1; then
        response=$(gtimeout 30s curl -s -w "\n%{http_code}" -H "x-admin-api-key: $ADMIN_KEY" -X POST "$BASE_URL/admin/sync/$module" || echo -e "\n408")
    else
        response=$(curl -s -w "\n%{http_code}" --max-time 30 -H "x-admin-api-key: $ADMIN_KEY" -X POST "$BASE_URL/admin/sync/$module" || echo -e "\n408")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        return 0
    elif [ "$http_code" = "408" ]; then
        echo -e "${YELLOW}⚠️  TIMEOUT${NC} (Request timed out after 30s)"
        return 1
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Test results tracking
passed=0
failed=0

echo "📊 Testing Admin Endpoints"
echo "-------------------------"

# Health check
if check_endpoint "GET" "/admin/health" "200" "Admin Health Check"; then
    ((passed++))
else
    ((failed++))
fi

# Summary endpoint
if check_endpoint "GET" "/admin/summary" "200" "Admin Summary"; then
    ((passed++))
else
    ((failed++))
fi

# Sync endpoints
echo ""
echo "🔄 Testing Sync Endpoints"
echo "------------------------"

modules=("quran" "hadith" "prayer" "audio" "finance" "zakat")
for module in "${modules[@]}"; do
    if check_sync_endpoint "$module" "Sync $module"; then
        ((passed++))
    else
        ((failed++))
    fi
done

# Sync logs endpoint
echo ""
echo "📋 Testing Log Endpoints"
echo "-----------------------"

if check_endpoint "GET" "/admin/sync-logs?limit=10" "200" "Sync Logs"; then
    ((passed++))
else
    ((failed++))
fi

# Summary
echo ""
echo "📈 Test Summary"
echo "==============="
echo -e "✅ Passed: ${GREEN}$passed${NC}"
echo -e "❌ Failed: ${RED}$failed${NC}"
echo -e "📊 Total: $((passed + failed))"

if [ $failed -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}Some tests failed. Check the output above.${NC}"
    exit 1
fi
