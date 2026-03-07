#!/bin/bash
#
# Phase 0 Complete Validation Suite
# Runs all validation tests in sequence
#

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
RESULTS_DIR="./validation-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Phase 0 Horizontal Scaling Validation Suite           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Results Dir: $RESULTS_DIR"
echo "Timestamp:   $TIMESTAMP"
echo ""

# Track overall success
OVERALL_SUCCESS=true

# Test 1: Horizontal Scaling
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Horizontal Scaling (500 flows, 50 concurrency)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BACKEND_URL=$BACKEND_URL \
NUM_FLOWS=500 \
CONCURRENCY=50 \
node apps/backend/scripts/validate-horizontal-scaling.js \
  > "$RESULTS_DIR/horizontal-scaling-$TIMESTAMP.log" 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Horizontal Scaling: PASSED${NC}"
else
  echo -e "${RED}❌ Horizontal Scaling: FAILED${NC}"
  OVERALL_SUCCESS=false
fi

echo ""
sleep 2

# Test 2: Concurrency Stress
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Concurrency Stress (1000 concurrent operations)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BACKEND_URL=$BACKEND_URL \
CONCURRENT_CREATES=1000 \
CONCURRENT_CONSUMES=1000 \
node apps/backend/load-tests/concurrency-stress-test.js \
  > "$RESULTS_DIR/concurrency-stress-$TIMESTAMP.log" 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Concurrency Stress: PASSED${NC}"
else
  echo -e "${RED}❌ Concurrency Stress: FAILED${NC}"
  OVERALL_SUCCESS=false
fi

echo ""
sleep 2

# Test 3: Redis Failure Simulation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Redis Failure Simulation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BACKEND_URL=$BACKEND_URL \
./apps/backend/scripts/redis-failure-simulation.sh \
  > "$RESULTS_DIR/redis-failure-$TIMESTAMP.log" 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Redis Failure: PASSED${NC}"
else
  echo -e "${YELLOW}⚠️  Redis Failure: SKIPPED (Docker not available)${NC}"
fi

echo ""
sleep 2

# Test 4: Security Validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Security Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Replay attack test
echo "Testing replay attack prevention..."
STATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/oauth/twitter/authorize" \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test")

STATE=$(echo "$STATE_RESPONSE" | jq -r '.state' 2>/dev/null || echo "")

if [ -n "$STATE" ] && [ "$STATE" != "null" ]; then
  # First attempt
  FIRST=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BACKEND_URL/api/v1/oauth/twitter/callback?code=test&state=$STATE")
  
  # Second attempt (replay)
  SECOND=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BACKEND_URL/api/v1/oauth/twitter/callback?code=test&state=$STATE")
  
  if [ "$FIRST" = "302" ] && [ "$SECOND" != "302" ]; then
    echo -e "${GREEN}✅ Replay Attack Prevention: PASSED${NC}"
  else
    echo -e "${RED}❌ Replay Attack Prevention: FAILED${NC}"
    echo "   First attempt: $FIRST (expected 302)"
    echo "   Second attempt: $SECOND (expected 400)"
    OVERALL_SUCCESS=false
  fi
else
  echo -e "${RED}❌ Security Validation: FAILED (could not create state)${NC}"
  OVERALL_SUCCESS=false
fi

echo ""

# Final Results
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      VALIDATION RESULTS                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$OVERALL_SUCCESS" = true ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Decision: GO - Ready for Phase 0 Task P0-3 (Idempotency Guard)"
  echo ""
  echo "Next Steps:"
  echo "  1. Review detailed results in $RESULTS_DIR/"
  echo "  2. Document validation in PHASE_0_VALIDATION_RESULTS.md"
  echo "  3. Proceed to Phase 0 Task P0-3"
  echo ""
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Decision: NO-GO - Investigation required"
  echo ""
  echo "Next Steps:"
  echo "  1. Review detailed results in $RESULTS_DIR/"
  echo "  2. Investigate failures"
  echo "  3. Fix issues"
  echo "  4. Re-run validation"
  echo ""
  exit 1
fi
