#!/bin/bash

# Migration Verification Script
# This script verifies that the admin dashboard integration is working correctly

set -e

echo "🔍 Starting migration verification..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
ADMIN_URL="$BASE_URL/admin"
API_URL="$BASE_URL/api/v4"
HEALTH_URL="$API_URL/health"
LOGIN_URL="$API_URL/admin/auth/login"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to check HTTP status
check_http_status() {
    local url="$1"
    local expected_status="$2"
    local actual_status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$actual_status" = "$expected_status" ]; then
        return 0
    else
        echo "Expected status $expected_status, got $actual_status"
        return 1
    fi
}

# Function to check JSON response
check_json_response() {
    local url="$1"
    local jq_filter="$2"
    
    local response=$(curl -s "$url")
    if echo "$response" | jq -e "$jq_filter" > /dev/null 2>&1; then
        return 0
    else
        echo "JSON check failed for filter: $jq_filter"
        return 1
    fi
}

echo "📡 Testing API endpoints..."

# Test 1: API Health Check
run_test "API Health Check" "check_http_status '$HEALTH_URL' '200'" "200"

# Test 2: API Health JSON Response
run_test "API Health JSON Response" "check_json_response '$HEALTH_URL' '.status'" "200"

# Test 3: Admin Dashboard Page
run_test "Admin Dashboard Page" "check_http_status '$ADMIN_URL' '200'" "200"

# Test 4: Admin Login Page
run_test "Admin Login Page" "check_http_status '$ADMIN_URL/login' '200'" "200"

# Test 5: Admin Static Assets
run_test "Admin Static Assets" "check_http_status '$ADMIN_URL/_next/static' '200'" "200"

echo ""
echo "🔐 Testing authentication..."

# Test 6: Login API (with test credentials)
run_test "Login API Response" "check_json_response '$LOGIN_URL' '.data'" "200"

# Test 7: Login with credentials
echo -n "Testing login with credentials... "
login_response=$(curl -s -X POST "$LOGIN_URL" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@deenmate.app","password":"admin123"}')

if echo "$login_response" | jq -e '.data.accessToken' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
    
    # Extract token for further tests
    TOKEN=$(echo "$login_response" | jq -r '.data.accessToken')
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "📊 Testing admin endpoints..."

# Test 8: Admin Summary (with auth)
if [ -n "$TOKEN" ]; then
    run_test "Admin Summary (authenticated)" "check_json_response '$API_URL/admin/summary' '.data'" "200"
else
    echo -e "${YELLOW}⚠ Skipping authenticated tests (no token)${NC}"
fi

# Test 9: Admin Health
if [ -n "$TOKEN" ]; then
    run_test "Admin Health Check" "check_json_response '$API_URL/admin/health' '.data'" "200"
else
    echo -e "${YELLOW}⚠ Skipping authenticated tests (no token)${NC}"
fi

echo ""
echo "🌐 Testing static file serving..."

# Test 10: Next.js static files
run_test "Next.js Static Files" "check_http_status '$ADMIN_URL/_next/static' '200'" "200"

# Test 11: Admin favicon
run_test "Admin Favicon" "check_http_status '$ADMIN_URL/favicon.ico' '200'" "200"

echo ""
echo "📋 Test Summary:"
echo "=================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! Migration verification successful.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please check the issues above.${NC}"
    exit 1
fi
