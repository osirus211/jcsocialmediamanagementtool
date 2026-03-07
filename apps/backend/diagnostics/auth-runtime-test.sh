#!/bin/bash
# RUNTIME_TRACE Runtime Test Script
# Tests authentication flows with curl

BASE_URL="http://localhost:5000/api/v1"
EMAIL="test-$(date +%s)@example.com"
PASSWORD="TestPassword123!"

echo "=== RUNTIME_TRACE Runtime Tests ==="
echo ""

# Test 1: Register
echo "1. Testing REGISTER..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\"}")
echo "$REGISTER_RESPONSE" | jq '.'
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken')
echo ""

# Test 2: Duplicate Register
echo "2. Testing DUPLICATE REGISTER (should fail)..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\"}" | jq '.'
echo ""

# Test 3: Login
echo "3. Testing LOGIN..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN_RESPONSE" | jq '.'
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
echo ""

# Test 4: Refresh Token
echo "4. Testing REFRESH TOKEN..."
curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# Test 5: Invalid Token
echo "5. Testing INVALID TOKEN..."
curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer invalid_token_here" | jq '.'
echo ""

# Test 6: Protected Route without Workspace
echo "6. Testing PROTECTED ROUTE (no workspace)..."
curl -s -X GET "$BASE_URL/posts" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# Test 7: Logout
echo "7. Testing LOGOUT..."
curl -s -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# Test 8: Metrics Endpoint
echo "8. Testing METRICS ENDPOINT..."
curl -s -X GET "$BASE_URL/metrics" | head -20
echo ""

echo "=== Tests Complete ==="
echo "Check logs for RUNTIME_TRACE entries"
