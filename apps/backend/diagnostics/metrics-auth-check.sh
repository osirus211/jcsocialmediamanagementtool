#!/bin/bash
# RUNTIME_TRACE Metrics Verification Script
# Compares metrics before and after auth operations

METRICS_URL="http://localhost:5000/api/v1/metrics"
BASE_URL="http://localhost:5000/api/v1"

echo "=== RUNTIME_TRACE Metrics Check ==="
echo ""

# Capture baseline metrics
echo "1. Capturing baseline metrics..."
BASELINE=$(curl -s "$METRICS_URL")
BASELINE_REGISTER=$(echo "$BASELINE" | grep "auth_register_total" | awk '{print $2}')
BASELINE_LOGIN=$(echo "$BASELINE" | grep "auth_login_total" | awk '{print $2}')
echo "   Register count: ${BASELINE_REGISTER:-0}"
echo "   Login count: ${BASELINE_LOGIN:-0}"
echo ""

# Perform auth operations
echo "2. Performing auth operations..."
EMAIL="metrics-test-$(date +%s)@example.com"
PASSWORD="TestPassword123!"

# Register
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"Metrics\",\"lastName\":\"Test\"}" > /dev/null

# Login
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null

echo "   Operations complete"
echo ""

# Wait for metrics to update
sleep 2

# Capture new metrics
echo "3. Capturing updated metrics..."
UPDATED=$(curl -s "$METRICS_URL")
UPDATED_REGISTER=$(echo "$UPDATED" | grep "auth_register_total" | awk '{print $2}')
UPDATED_LOGIN=$(echo "$UPDATED" | grep "auth_login_total" | awk '{print $2}')
echo "   Register count: ${UPDATED_REGISTER:-0}"
echo "   Login count: ${UPDATED_LOGIN:-0}"
echo ""

# Compare
echo "4. Comparison:"
REGISTER_DIFF=$((${UPDATED_REGISTER:-0} - ${BASELINE_REGISTER:-0}))
LOGIN_DIFF=$((${UPDATED_LOGIN:-0} - ${BASELINE_LOGIN:-0}))

if [ "$REGISTER_DIFF" -ge 1 ]; then
  echo "   ✓ PASS: Register metrics increased by $REGISTER_DIFF"
else
  echo "   ✗ FAIL: Register metrics did not increase"
fi

if [ "$LOGIN_DIFF" -ge 1 ]; then
  echo "   ✓ PASS: Login metrics increased by $LOGIN_DIFF"
else
  echo "   ✗ FAIL: Login metrics did not increase"
fi

echo ""
echo "=== Metrics Check Complete ==="
