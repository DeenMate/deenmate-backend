#!/bin/bash

# Test script to reproduce prayer sync over-syncing issue
# This script tests the exact scenario described in the issue

set -e

# Configuration
API_BASE_URL="http://localhost:3000"
ADMIN_TOKEN_FILE=".admin-token"
TEST_LOCATION_LAT="23.8103"
TEST_LOCATION_LNG="90.4125"
TEST_METHOD_CODE="MWL"
TEST_DAYS=1

echo "🧪 Prayer Sync Over-Syncing Test Script"
echo "========================================"
echo ""

# Check if server is running
echo "📡 Checking if server is running..."
if ! curl -s "$API_BASE_URL/api/v4/admin/health" > /dev/null; then
    echo "❌ Server is not running. Please start the server first:"
    echo "   npm run start:dev"
    exit 1
fi
echo "✅ Server is running"

# Get admin token
echo "🔐 Getting admin token..."
if [ ! -f "$ADMIN_TOKEN_FILE" ]; then
    echo "❌ Admin token file not found. Please login first:"
    echo "   curl -X POST $API_BASE_URL/api/v4/admin/auth/login \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"email\":\"admin@deenmate.app\",\"password\":\"admin123\"}'"
    exit 1
fi

ADMIN_TOKEN=$(cat "$ADMIN_TOKEN_FILE")
echo "✅ Admin token loaded"

# Clear existing prayer times for test location
echo "🧹 Clearing existing prayer times for test location..."
LOC_KEY=$(echo -n "${TEST_LOCATION_LAT},${TEST_LOCATION_LNG}" | md5sum | cut -d' ' -f1)
echo "   Location Key: $LOC_KEY"

# Count existing records before sync
echo "📊 Counting existing prayer times records..."
BEFORE_COUNT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE_URL/api/v4/admin/content/prayer_times?limit=1000" | \
    jq '.data.items | length' 2>/dev/null || echo "0")
echo "   Records before sync: $BEFORE_COUNT"

# Trigger prayer sync for 1 day
echo "🔄 Triggering prayer sync for $TEST_DAYS day(s)..."
echo "   Location: $TEST_LOCATION_LAT, $TEST_LOCATION_LNG"
echo "   Method: $TEST_METHOD_CODE"
echo "   Days: $TEST_DAYS"

SYNC_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_BASE_URL/api/v4/admin/sync/prayer/times?lat=$TEST_LOCATION_LAT&lng=$TEST_LOCATION_LNG&methodCode=$TEST_METHOD_CODE&days=$TEST_DAYS&force=true")

echo "   Sync Response: $SYNC_RESPONSE"

# Wait for sync to complete
echo "⏳ Waiting for sync to complete..."
sleep 5

# Count records after sync
echo "📊 Counting prayer times records after sync..."
AFTER_COUNT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_BASE_URL/api/v4/admin/content/prayer_times?limit=1000" | \
    jq '.data.items | length' 2>/dev/null || echo "0")
echo "   Records after sync: $AFTER_COUNT"

# Calculate difference
DIFF=$((AFTER_COUNT - BEFORE_COUNT))
echo "   Records added: $DIFF"

# Check if the issue is reproduced
echo ""
echo "🔍 Analysis Results:"
echo "==================="

if [ "$DIFF" -eq "$TEST_DAYS" ]; then
    echo "✅ SUCCESS: Exactly $TEST_DAYS day(s) synced as expected"
    echo "   Expected: $TEST_DAYS day(s)"
    echo "   Actual: $DIFF day(s)"
    exit 0
elif [ "$DIFF" -gt "$TEST_DAYS" ]; then
    echo "❌ BUG REPRODUCED: Over-syncing detected!"
    echo "   Expected: $TEST_DAYS day(s)"
    echo "   Actual: $DIFF day(s)"
    echo "   Over-synced by: $((DIFF - TEST_DAYS)) day(s)"
    exit 1
else
    echo "⚠️  UNDER-SYNCING: Fewer days synced than expected"
    echo "   Expected: $TEST_DAYS day(s)"
    echo "   Actual: $DIFF day(s)"
    echo "   Under-synced by: $((TEST_DAYS - DIFF)) day(s)"
    exit 1
fi