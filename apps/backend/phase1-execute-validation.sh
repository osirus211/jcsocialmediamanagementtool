#!/bin/bash

# Phase 1: Live Validation Execution Script
# This script guides you through the validation process

echo "═══════════════════════════════════════════════════════════"
echo "     PHASE 1: LIVE RUNTIME VALIDATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check if backend is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is NOT running${NC}"
    echo "   Start backend with: npm run dev"
    exit 1
fi

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    REDIS_VERSION=$(redis-cli INFO | grep redis_version | cut -d: -f2 | tr -d '\r')
    echo -e "${GREEN}✅ Redis is running (version: $REDIS_VERSION)${NC}"
else
    echo -e "${RED}❌ Redis is NOT running${NC}"
    exit 1
fi

# Check MongoDB
if mongo --eval "db.version()" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB is running${NC}"
else
    echo -e "${RED}❌ MongoDB is NOT running${NC}"
    exit 1
fi

# Check test accounts
TEST_ACCOUNTS=$(mongo social-scheduler --quiet --eval "db.socialaccounts.countDocuments({accountName: /^PHASE1_TEST_/})")
echo -e "${GREEN}✅ Test accounts: $TEST_ACCOUNTS${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Scheduler Observation
echo "TEST 1: SCHEDULER OBSERVATION"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "This test observes the scheduler for 5 minutes."
echo ""
echo "What to watch:"
echo "  1. Backend logs for 'Token refresh scan started'"
echo "  2. Jobs being enqueued"
echo "  3. Worker processing jobs"
echo "  4. Locks in Redis"
echo ""
read -p "Press ENTER to start monitoring (or Ctrl+C to skip)..."

echo ""
echo "Starting Redis monitor in background..."
node phase1-monitor-redis.js &
MONITOR_PID=$!

echo "Waiting 5 minutes for scheduler scan..."
echo "(You can watch backend logs in another terminal)"
echo ""

for i in {300..1}; do
    printf "\rTime remaining: %02d:%02d" $((i/60)) $((i%60))
    sleep 1
done

echo ""
echo ""

# Kill monitor
kill $MONITOR_PID 2>/dev/null

echo "Checking results..."
REFRESHED=$(mongo social-scheduler --quiet --eval "db.socialaccounts.countDocuments({accountName: /^PHASE1_TEST_/, lastRefreshedAt: {\$exists: true}})")
echo "Accounts refreshed: $REFRESHED/5"

if [ "$REFRESHED" -eq 5 ]; then
    echo -e "${GREEN}✅ TEST 1 PASSED${NC}"
else
    echo -e "${YELLOW}⚠️  TEST 1 INCOMPLETE (only $REFRESHED/5 refreshed)${NC}"
fi

echo ""
read -p "Press ENTER to continue to Test 2..."
echo ""

# Test 2: Duplicate Prevention
echo "TEST 2: DUPLICATE PREVENTION"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "This test enqueues the same job 5 times and verifies"
echo "only one refresh occurs."
echo ""
read -p "Press ENTER to run test..."

node phase1-test-duplicate-prevention.js

echo ""
read -p "Press ENTER to continue to Test 3..."
echo ""

# Test 3: Retry + DLQ
echo "TEST 3: RETRY + DLQ"
echo "────────────────────────────────────────────────────────────"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This test requires modifying the worker code${NC}"
echo ""
echo "Before running this test:"
echo "  1. Edit: src/workers/DistributedTokenRefreshWorker.ts"
echo "  2. In refreshToken() method, add: throw new Error('FORCED_TEST_FAILURE');"
echo "  3. Restart backend"
echo ""
read -p "Have you modified the code and restarted? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running retry + DLQ test..."
    node phase1-test-retry-dlq.js
else
    echo "Skipping Test 3"
fi

echo ""
read -p "Press ENTER to continue to Test 4..."
echo ""

# Test 4: Worker Crash
echo "TEST 4: WORKER CRASH SIMULATION"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "This test requires manual execution:"
echo ""
echo "  1. Find backend process: ps aux | grep 'node.*server'"
echo "  2. Kill process: kill -9 [PID]"
echo "  3. Wait 2 minutes for lock TTL"
echo "  4. Restart backend: npm run dev"
echo "  5. Verify job retries"
echo ""
echo "This test validates lock expiry and crash recovery."
echo ""
read -p "Press ENTER to continue to Test 5..."
echo ""

# Test 5: Redis Failure
echo "TEST 5: REDIS FAILURE SIMULATION"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "This test requires manual execution:"
echo ""
echo "  1. Stop Redis: docker stop redis (or systemctl stop redis)"
echo "  2. Watch backend logs for errors"
echo "  3. Verify fail-closed behavior (no refresh executed)"
echo "  4. Restart Redis: docker start redis"
echo "  5. Verify recovery"
echo ""
echo "This test validates fail-closed behavior."
echo ""
read -p "Press ENTER to finish..."
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════"
echo "     VALIDATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Review PHASE_1_LIVE_VALIDATION_REPORT.md"
echo "  2. Fill in observations from each test"
echo "  3. Calculate final resilience rating"
echo "  4. Document recommendations"
echo ""
echo "Report location: PHASE_1_LIVE_VALIDATION_REPORT.md"
echo ""
