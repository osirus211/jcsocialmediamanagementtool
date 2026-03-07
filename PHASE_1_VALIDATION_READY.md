# Phase 1: Distributed Token Lifecycle Automation
## Validation Infrastructure - READY

---

## STATUS: READY FOR RUNTIME VALIDATION

All validation scripts and test infrastructure are in place.

---

## CURRENT SYSTEM STATE

✅ **Redis**: Connected and accessible
✅ **MongoDB**: Connected and accessible  
✅ **Test Data**: 5 test accounts seeded
❌ **Backend**: Not currently running

---

## TEST ACCOUNTS SEEDED

```
PHASE1_TEST_TWITTER_1    - Expires in 30 minutes
PHASE1_TEST_LINKEDIN_2   - Expires in 36 minutes
PHASE1_TEST_FACEBOOK_3   - Expires in 42 minutes
PHASE1_TEST_INSTAGRAM_4  - Expires in 48 minutes
PHASE1_TEST_YOUTUBE_5    - Expires in 54 minutes
```

All accounts have:
- Encrypted access tokens
- Encrypted refresh tokens
- `status: active`
- `tokenExpiresAt` within 1 hour

---

## VALIDATION SCRIPTS CREATED

### 1. System Status Check
```bash
node phase1-check-backend.js
```
Checks if backend, Redis, MongoDB are running and test accounts exist.

### 2. Seed Test Data
```bash
node phase1-seed-test-accounts.js
```
Creates 5 test accounts with tokens expiring within 1 hour.

### 3. Redis Monitor
```bash
node phase1-monitor-redis.js
```
Real-time monitoring of Redis keys, queue stats, locks, and DLQ entries.

### 4. Duplicate Prevention Test
```bash
node phase1-test-duplicate-prevention.js
```
Enqueues same connectionId 5 times and verifies only one refresh occurs.

### 5. Retry + DLQ Test
```bash
node phase1-test-retry-dlq.js
```
Simulates refresh failure and verifies retry behavior and DLQ handling.

### 6. Comprehensive Validation
```bash
node phase1-validate-all.js
```
Runs all tests and produces final health rating report.

---

## VALIDATION WORKFLOW

### Step 1: Start Backend
```bash
cd apps/backend
npm run dev
```

### Step 2: Verify System Status
```bash
node phase1-check-backend.js
```

Expected output:
```
Backend:       ✅ Running
Redis:         ✅ Connected
MongoDB:       ✅ Connected
Test Accounts: 5
```

### Step 3: Monitor Redis (Optional)
```bash
# In separate terminal
node phase1-monitor-redis.js
```

Watch for:
- Jobs being enqueued
- Locks being acquired/released
- Queue depth changes
- DLQ entries

### Step 4: Wait for Scheduler
The scheduler runs every 5 minutes. Wait for first scan.

Watch backend logs for:
```
Token refresh scan started
Token refresh scan found accounts: 5
Token refresh job enqueued
Processing token refresh job
Lock acquired
Token refresh successful
Lock released
```

### Step 5: Run Validation Tests
```bash
# Test duplicate prevention
node phase1-test-duplicate-prevention.js

# Test retry + DLQ (requires worker to be running)
node phase1-test-retry-dlq.js

# Run comprehensive validation
node phase1-validate-all.js
```

---

## EXPECTED BEHAVIOR

### Scheduler
- Scans database every 5 minutes
- Finds 5 test accounts with tokens expiring within 24h
- Enqueues 5 refresh jobs

### Worker
- Processes jobs with concurrency=5
- Acquires distributed lock before refresh
- Calls mock refresh (always succeeds)
- Updates token in database
- Releases lock
- Logs success with correlation ID

### Queue
- Jobs deduplicated by jobId
- Retry 3 times on failure (5s, 25s, 125s backoff)
- Move to DLQ after max retries

### Database
- `lastRefreshedAt` updated
- `tokenExpiresAt` updated
- `status` remains `active` (or `refresh_failed` on permanent failure)

---

## VALIDATION CRITERIA

### ✅ PASS Criteria
- All 5 test accounts refreshed
- No duplicate refreshes
- Locks acquired and released properly
- No lock deadlocks
- Retry behavior correct (3 attempts)
- DLQ receives permanently failed jobs
- Fail-closed if Redis unavailable

### ❌ FAIL Criteria
- Double refresh of same account
- Lock never released
- Silent failures (no logs)
- Fail-open behavior
- Job loss without DLQ entry
- Race conditions

---

## KNOWN LIMITATIONS

### Redis Version
Current Redis version: 3.0.504
BullMQ requires: >= 5.0.0

**Impact**: BullMQ queue operations may fail with version error.

**Resolution Options**:
1. Upgrade Redis to version 5.0+
2. Use Docker Redis image (recommended):
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

### Mock Refresh Logic
Worker currently uses mock refresh that always succeeds.

**Impact**: Cannot test real provider failures.

**Next Step**: Implement real provider refresh logic.

---

## TROUBLESHOOTING

### Backend won't start
- Check Redis connection
- Check MongoDB connection
- Check environment variables
- Check port 3000 not in use

### Scheduler not running
- Check Redis connected
- Check logs for "Token refresh scheduler started"
- Verify `redisConnected = true` in startup

### Worker not processing
- Check Redis connected
- Check logs for "Distributed token refresh worker started"
- Verify queue name matches

### No jobs enqueued
- Check test accounts exist
- Check tokens expire within 24h
- Wait for scheduler scan (5 minutes)

---

## METRICS TO OBSERVE

### Queue Metrics
- Waiting jobs
- Active jobs
- Completed jobs
- Failed jobs
- Delayed jobs (retry backoff)

### Lock Metrics
- Active locks count
- Lock TTL values
- Lock contention

### DLQ Metrics
- DLQ entries count
- Error messages
- Failed account IDs

### Performance
- Job processing time
- Queue lag
- Retry distribution

---

## NEXT STEPS AFTER VALIDATION

### If Validation Passes (Health Rating >= 8/10)
1. Implement real provider refresh logic
2. Deploy to staging environment
3. Monitor production metrics
4. Gradual rollout

### If Validation Fails (Health Rating < 6/10)
1. Capture full logs
2. Export Redis keys
3. Document observed behavior
4. Fix critical issues
5. Re-run validation

### Phase 1B Features (Future)
- Circuit breaker per provider
- Rate limiting per provider
- Advanced job deduplication
- Staggered refresh scheduling
- Provider-specific retry strategies

---

## VALIDATION CHECKLIST

- [ ] Backend started successfully
- [ ] Redis connected
- [ ] MongoDB connected
- [ ] Test accounts seeded (5 accounts)
- [ ] Scheduler running (logs confirm)
- [ ] Worker running (logs confirm)
- [ ] First scan completed (wait 5 minutes)
- [ ] Jobs enqueued (check Redis monitor)
- [ ] Jobs processed (check logs)
- [ ] Tokens updated (check database)
- [ ] Locks released (check Redis)
- [ ] Duplicate prevention test passed
- [ ] Retry behavior verified
- [ ] DLQ handling verified
- [ ] Health rating calculated

---

## FINAL DELIVERABLE

After validation, produce:

**PHASE_1_VALIDATION_REPORT.md** containing:
- Observed behavior
- Test results (pass/fail)
- Metrics captured
- Race conditions (if any)
- Lock leaks (if any)
- Retry anomalies (if any)
- DLQ inconsistencies (if any)
- Final health rating (1-10)
- Recommendations

---

## SUPPORT CONTACTS

If critical issues found:
1. Capture full backend logs
2. Export Redis keys: `redis-cli --scan --pattern "oauth:*"`
3. Export test account data
4. Document reproduction steps
5. Report with evidence

---

**Status**: ✅ READY FOR VALIDATION
**Next Action**: Start backend and begin validation workflow
