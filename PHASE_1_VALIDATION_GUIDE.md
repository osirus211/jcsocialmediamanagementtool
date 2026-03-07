# Phase 1: Distributed Token Lifecycle Automation
## Runtime Validation Guide

---

## OVERVIEW

This guide provides step-by-step instructions for validating the Phase 1 implementation.

**What we're validating:**
- BullMQ queue functionality
- Scheduler database scanning
- Worker job processing
- Redis distributed locks
- Retry with exponential backoff
- Dead Letter Queue handling
- Fail-closed behavior

---

## PREREQUISITES

1. **Backend running** with Redis and MongoDB connected
2. **Redis accessible** at `localhost:6379` (or configured URL)
3. **MongoDB accessible** with test database
4. **Node.js** installed for running test scripts

---

## VALIDATION STEPS

### STEP 1: Seed Test Data

Create 5 test accounts with tokens expiring within 1 hour:

```bash
cd apps/backend
node phase1-seed-test-accounts.js
```

**Expected Output:**
```
✅ Created: PHASE1_TEST_TWITTER_1
   ID: 507f1f77bcf86cd799439011
   Provider: twitter
   Expires: 2024-01-15T10:30:00.000Z
   Minutes until expiry: 45

... (4 more accounts)

📊 Summary:
   Total accounts created: 5
   All tokens expire within 1 hour
   Status: active
   Ready for scheduler scan
```

**Verification:**
- 5 test accounts created
- All have `tokenExpiresAt` within 1 hour
- All have `status: active`
- All have encrypted tokens

---

### STEP 2: Start Backend & Monitor

**Terminal 1 - Start Backend:**
```bash
cd apps/backend
npm run dev
```

**Terminal 2 - Monitor Redis:**
```bash
cd apps/backend
node phase1-monitor-redis.js
```

**Expected Behavior:**
- Scheduler starts and scans every 5 minutes
- Jobs enqueued for expiring tokens
- Worker processes jobs with concurrency=5
- Locks appear and disappear in Redis
- Tokens updated in database

**Watch for:**
```
🔄 Distributed token refresh worker started
📅 Token refresh scheduler started
Token refresh scan started
Token refresh scan found accounts: 5
Token refresh job enqueued
Processing token refresh job
Lock acquired
Token refresh successful
Lock released
```

---

### STEP 3: Functional Validation

Run comprehensive validation:

```bash
cd apps/backend
node phase1-validate-all.js
```

**Expected Output:**
```
📋 TEST 1: Functional Validation
✅ Found 5 test accounts
✅ 5 accounts refreshed
✅ No active locks

📋 TEST 2: Duplicate Prevention
✅ Job deduplication working

📋 TEST 3: Lock Expiry
✅ Lock expired correctly

FINAL HEALTH RATING: 8/10
🟢 EXCELLENT - Production ready
```

---

### STEP 4: Duplicate Prevention Test

Test that duplicate jobs are prevented:

```bash
cd apps/backend
node phase1-test-duplicate-prevention.js
```

**Expected Behavior:**
- Same connectionId enqueued 5 times
- Only 1 job created (same jobId)
- Only 1 refresh performed
- Lock acquired once
- Lock released after completion

**Success Criteria:**
- ✅ Job deduplication via jobId
- ✅ Only one worker processes job
- ✅ No double refresh
- ✅ Lock released properly

---

### STEP 5: Retry + DLQ Test

Test retry behavior and DLQ handling:

```bash
cd apps/backend
node phase1-test-retry-dlq.js
```

**Expected Behavior:**
- Job fails on attempt 1
- Retry after 5 seconds (attempt 2)
- Retry after 25 seconds (attempt 3)
- After 3 failures, move to DLQ
- Account marked as `REFRESH_FAILED`
- Redis DLQ key created

**Success Criteria:**
- ✅ 3 retry attempts
- ✅ Exponential backoff (5s, 25s, 125s)
- ✅ Job moved to DLQ after max retries
- ✅ DLQ job contains error details
- ✅ Redis DLQ key created with 7-day TTL
- ✅ Account status updated

---

### STEP 6: Lock Expiry Test

Verify locks expire after TTL:

**Manual Test:**
1. Check Redis for active locks:
   ```bash
   redis-cli KEYS "oauth:refresh:lock:*"
   ```

2. If locks exist, check TTL:
   ```bash
   redis-cli TTL oauth:refresh:lock:{connectionId}
   ```

3. Wait for TTL to expire

4. Verify lock removed:
   ```bash
   redis-cli EXISTS oauth:refresh:lock:{connectionId}
   ```

**Success Criteria:**
- ✅ Lock TTL = 120 seconds
- ✅ Lock expires after TTL
- ✅ No permanent lock deadlock

---

### STEP 7: Worker Crash Simulation

Test resilience to worker crashes:

**Manual Test:**
1. Start backend
2. Enqueue a job
3. While job is processing, kill worker:
   ```bash
   # Find worker process
   ps aux | grep "node.*server"
   
   # Kill process
   kill -9 <PID>
   ```

4. Restart backend
5. Verify job retries

**Success Criteria:**
- ✅ Lock expires after TTL
- ✅ Job retries on next worker start
- ✅ No permanent job loss
- ✅ No lock deadlock

---

### STEP 8: Redis Failure Simulation

Test fail-closed behavior:

**Manual Test:**
1. Start backend with Redis running
2. Stop Redis:
   ```bash
   # Docker
   docker stop redis
   
   # Or service
   sudo systemctl stop redis
   ```

3. Attempt to enqueue job
4. Check logs for errors

**Expected Behavior:**
- Worker throws error: "Redis unavailable - cannot acquire lock (fail-closed)"
- No refresh attempts proceed
- Errors logged clearly
- System fails closed (safe)

**Success Criteria:**
- ✅ Worker fails closed
- ✅ No refresh without Redis
- ✅ Clear error messages
- ✅ No silent failures

---

## METRICS TO CAPTURE

### Queue Metrics
- `refresh_success_total` - Total successful refreshes
- `refresh_failure_total` - Total failed refreshes
- Queue depth (waiting jobs)
- Active jobs
- Completed jobs
- Failed jobs

### Lock Metrics
- Active locks count
- Lock contention events
- Lock expiry events

### DLQ Metrics
- DLQ entries count
- DLQ job details
- Account failure rate

### Performance Metrics
- Job processing time
- Queue lag
- Retry count distribution

---

## VALIDATION CHECKLIST

### Functional Requirements
- [ ] Scheduler scans database every 5 minutes
- [ ] Jobs enqueued for tokens expiring within 24h
- [ ] Worker processes jobs with concurrency=5
- [ ] Tokens updated in database
- [ ] Distributed locks prevent duplicate refresh

### Retry Behavior
- [ ] Jobs retry 3 times on failure
- [ ] Exponential backoff (5s, 25s, 125s)
- [ ] Failed jobs move to DLQ after max retries
- [ ] DLQ contains error details

### Safety Guarantees
- [ ] Fail-closed if Redis unavailable
- [ ] No duplicate refresh across instances
- [ ] Locks expire after TTL (120s)
- [ ] No permanent lock deadlock
- [ ] All operations logged with correlation IDs

### Database Updates
- [ ] `lastRefreshedAt` updated on success
- [ ] `tokenExpiresAt` updated with new expiry
- [ ] `status` set to `REFRESH_FAILED` on permanent failure
- [ ] `lastError` and `lastErrorAt` populated on failure

---

## EXPECTED ANOMALIES (Non-Critical)

These are expected behaviors, not bugs:

1. **Lock held briefly** - Normal during job processing
2. **Jobs in delayed state** - Normal for retry backoff
3. **Test accounts not refreshed immediately** - Scheduler runs every 5 minutes
4. **Mock refresh always succeeds** - Real provider integration pending

---

## CRITICAL ISSUES (Must Fix)

Report immediately if observed:

1. **Double refresh** - Same connection refreshed twice
2. **Lock deadlock** - Lock never released
3. **Silent failures** - Errors not logged
4. **Fail-open behavior** - Refresh proceeds without Redis
5. **Job loss** - Jobs disappear without DLQ entry
6. **Race conditions** - Inconsistent state across workers

---

## HEALTH RATING CRITERIA

**10/10 - Perfect**
- All tests pass
- No anomalies
- Production ready

**8-9/10 - Excellent**
- All critical tests pass
- Minor non-critical issues
- Production ready with monitoring

**6-7/10 - Good**
- Most tests pass
- Some issues to address
- Needs fixes before production

**4-5/10 - Fair**
- Significant issues found
- Requires investigation
- Not production ready

**0-3/10 - Poor**
- Critical failures
- Major issues
- Requires redesign

---

## TROUBLESHOOTING

### Scheduler not running
- Check Redis connection
- Check logs for startup errors
- Verify `redisConnected = true` in server.ts

### Worker not processing jobs
- Check Redis connection
- Check queue name matches
- Verify worker started successfully

### Locks not released
- Check lock TTL in Redis
- Verify worker completes successfully
- Check for worker crashes

### Jobs not retrying
- Check queue retry configuration
- Verify job throws error (not returns error)
- Check BullMQ version compatibility

### DLQ not receiving jobs
- Check worker failed event handler
- Verify max attempts reached
- Check DLQ queue name

---

## NEXT STEPS AFTER VALIDATION

1. **Real Provider Integration**
   - Replace mock refresh logic
   - Implement provider-specific refresh
   - Use existing OAuth provider classes

2. **Production Deployment**
   - Deploy to staging environment
   - Monitor metrics
   - Gradual rollout

3. **Phase 1B Features** (Future)
   - Circuit breaker per provider
   - Rate limiting
   - Job deduplication improvements
   - Advanced staggering

---

## SUPPORT

If validation fails or critical issues found:
1. Capture full logs
2. Export Redis keys
3. Document observed behavior
4. Report with reproduction steps
