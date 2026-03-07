#!/bin/bash
#
# Redis Failure Simulation Script
# Tests fail-closed behavior when Redis becomes unavailable
#

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
REDIS_CONTAINER="${REDIS_CONTAINER:-redis}"
TEST_WORKSPACE="failure-test-workspace"
TEST_USER="failure-test-user"

echo "🔴 Redis Failure Simulation Test"
echo "=================================="
echo ""

# Function to test OAuth authorization
test_authorization() {
  local expected_status=$1
  local description=$2
  
  echo "Testing: $description"
  
  response=$(curl -s -w "\n%{http_code}" -X POST \
    "$BACKEND_URL/api/v1/oauth/twitter/authorize" \
    -H "Authorization: Bearer test-token" \
    -H "X-Workspace-ID: $TEST_WORKSPACE" \
    -H "X-User-ID: $TEST_USER" \
    2>/dev/null)
  
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$status" -eq "$expected_status" ]; then
    echo "  ✅ Status: $status (expected $expected_status)"
    return 0
  else
    echo "  ❌ Status: $status (expected $expected_status)"
    echo "  Response: $body"
    return 1
  fi
}

# Test 1: Normal operation (Redis available)
echo "📊 Test 1: Normal Operation"
echo "----------------------------"
test_authorization 200 "OAuth authorization with Redis available"
echo ""

# Test 2: Stop Redis
echo "📊 Test 2: Redis Unavailable"
echo "----------------------------"
echo "Stopping Redis container..."
docker stop $REDIS_CONTAINER >/dev/null 2>&1 || echo "  ⚠️  Could not stop Redis (may not be running in Docker)"

sleep 2

# Should fail with 503 (fail-closed)
test_authorization 503 "OAuth authorization with Redis unavailable (should fail-closed)"
echo ""

# Test 3: Restart Redis
echo "📊 Test 3: Redis Recovery"
echo "----------------------------"
echo "Starting Redis container..."
docker start $REDIS_CONTAINER >/dev/null 2>&1 || echo "  ⚠️  Could not start Redis"

sleep 5

# Should succeed again
test_authorization 200 "OAuth authorization after Redis recovery"
echo ""

# Test 4: Redis restart mid-flow
echo "📊 Test 4: Redis Restart Mid-Flow"
echo "----------------------------"

# Create state
echo "Creating OAuth state..."
response=$(curl -s -X POST \
  "$BACKEND_URL/api/v1/oauth/twitter/authorize" \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: $TEST_WORKSPACE" \
  -H "X-User-ID: $TEST_USER")

state=$(echo "$response" | jq -r '.state' 2>/dev/null || echo "")

if [ -z "$state" ] || [ "$state" = "null" ]; then
  echo "  ❌ Failed to create state"
else
  echo "  ✅ State created: ${state:0:20}..."
  
  # Restart Redis
  echo "Restarting Redis..."
  docker restart $REDIS_CONTAINER >/dev/null 2>&1
  sleep 5
  
  # Try to consume state (should fail - state lost)
  echo "Attempting to consume state after Redis restart..."
  callback_response=$(curl -s -w "\n%{http_code}" \
    "$BACKEND_URL/api/v1/oauth/twitter/callback?code=test-code&state=$state" \
    2>/dev/null)
  
  callback_status=$(echo "$callback_response" | tail -n1)
  
  if [ "$callback_status" -eq 302 ] || [ "$callback_status" -eq 400 ]; then
    echo "  ✅ State not found after Redis restart (expected)"
  else
    echo "  ❌ Unexpected status: $callback_status"
  fi
fi

echo ""
echo "=================================="
echo "✅ Redis Failure Simulation Complete"
echo "=================================="
