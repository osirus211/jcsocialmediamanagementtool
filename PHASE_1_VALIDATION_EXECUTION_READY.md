# Phase 1: Live Runtime Validation - READY TO EXECUTE

**Status**: ✅ ALL INFRASTRUCTURE READY
**Date**: 2026-03-03

---

## CURRENT STATE

### Prerequisites Status
- ✅ **Redis**: Connected (upgrade to 6+ recommended)
- ✅ **MongoDB**: Connected
- ✅ **Test Data**: 5 accounts seeded, expiring within 1 hour
- ❌ **Backend**: Not running (must be started)

### Test Accounts Seeded
```
PHASE1_TEST_TWITTER_1    - Expires in 30 minutes
PHASE1_TEST_LINKEDIN_2   - Expires in 36 minutes
PHASE1_TEST_FACEBOOK_3   - Expires in 42 minutes
PHASE1_TEST_INSTAGRAM_4  - Expires in 48 minutes
PHASE1_TEST_YOUTUBE_5    - Expires in 54 minutes
```

---

## EXECUTION OPTIONS

### Option 1: Automated Guided Execution (Recommended)

**PowerShell (Windows):**
```powershell
cd apps/backend
.\phase1-execute-validation.ps1
```

**Bash (Linux/Mac):**
```bash
cd apps/backend
chmod +x phase1-execute-validation.sh
./phase1-execute-validation.sh
```

This script will:
- Check prerequisites
- Guide you through each test
- Run automated tests
- Provide instructions for manual tests
- Track timing and results

---

### Option 2: Manual Step-by-Step Execution

Follow the detailed instructions in:
**`PHASE_1_LIVE_VALIDATION_REPORT.md`**

This document contains:
- Detailed execution steps for each test
- Expected outputs
- Success criteria
- Observation templates
- Metrics collection

---

## VALIDATION TESTS OVERVIEW

### Test 1: Scheduler Observation (5 minutes)
**Validates**: Scheduler scans, job enqueueing, worker processing, lock behavior

**Execution**:
1. Start backend
2. Wait 5 minutes
3. Observe logs and Redis
4. Check database for updated tokens

**Success Criteria**:
- ✅ 5 jobs enqueued
- ✅ 5 jobs processed
- ✅ Locks acquired and released
- ✅ Tokens updated

---

### Test 2: Duplicate Prevention (2 minutes)
**Validates**: Job deduplication, lock coordination

**Execution**:
```bash
node phase1-test-duplicate-prevention.js
```

**Success Criteria**:
- ✅ Only 1 job created (same jobId)
- ✅ Only 1 refresh performed
- ✅ No double token update

---

### Test 3: Retry + DLQ (2 minutes)
**Validates**: Retry behavior, exponential backoff, DLQ handling

**Setup Required**:
1. Edit `src/workers/DistributedTokenRefreshWorker.ts`
2. In `refreshToken()` method, add:
   ```typescript
   throw new Error('FORCED_TEST_FAILURE');
   ```
3. Restart backend

**Execution**:
```bash
node phase1-test-retry-dlq.js
```

**Success Criteria**:
- ✅ 3 retry attempts
- ✅ Exponential backoff (5s, 25s, 125s)
- ✅ Job moved to DLQ
- ✅ Account marked REFRESH_FAILED

---

### Test 4: Worker Crash (Manual - 5 minutes)
**Validates**: Lock expiry, crash recovery

**Execution**:
1. Find backend process: `ps aux | grep node`
2. Kill process: `kill -9 [PID]`
3. Wait 2 minutes for lock TTL
4. Restart backend
5. Verify job retries

**Success Criteria**:
- ✅ Lock expires after TTL
- ✅ Job retries safely
- ✅ No permanent deadlock

---

### Test 5: Redis Failure (Manual - 3 minutes)
**Validates**: Fail-closed behavior

**Execution**:
1. Stop Redis: `docker stop redis`
2. Observe backend logs
3. Verify no refresh executed
4. Restart Redis: `docker start redis`
5. Verify recovery

**Success Criteria**:
- ✅ Worker fails closed
- ✅ Clear error messages
- ✅ System recovers automatically

---

## BEFORE YOU START

### 1. Start Backend
```bash
cd apps/backend
npm run dev
```

**Watch for these logs:**
```
✅ MongoDB connected
✅ Redis connected successfully
🔄 Distributed token refresh worker started
📅 Token refresh scheduler started
```

### 2. Verify System Status
```bash
node phase1-check-backend.js
```

**Expected output:**
```
Backend:       ✅ Running
Redis:         ✅ Connected
MongoDB:       ✅ Connected
Test Accounts: 5
```

### 3. Open Monitoring Terminal (Optional)
```bash
# In separate terminal
node phase1-monitor-redis.js
```

This provides real-time view of:
- Queue statistics
- Active locks
- DLQ entries
- Recent jobs

---

## DURING EXECUTION

### What to Monitor

**Backend Logs:**
- Token refresh scan messages
- Job processing logs
- Lock acquisition/release
- Error messages

**Redis Keys:**
```bash
# Check locks
redis-cli KEYS "oauth:refresh:lock:*"

# Check DLQ
redis-cli KEYS "oauth:refresh:dlq:*"

# Check queue depth
redis-cli LLEN bull:token-refresh-queue:waiting
```

**Database:**
```bash
# Check refreshed accounts
mongo social-scheduler --eval "
  db.socialaccounts.find(
    { accountName: /^PHASE1_TEST_/ },
    { accountName: 1, lastRefreshedAt: 1, status: 1 }
  ).pretty()
"
```

---

## AFTER EXECUTION

### 1. Fill in Validation Report
Open: **`PHASE_1_LIVE_VALIDATION_REPORT.md`**

Fill in:
- Observations from each test
- Metrics captured
- Anomalies detected
- Lock behavior
- Retry timings
- DLQ behavior

### 2. Calculate Resilience Rating

**Rating Formula:**
- Functional tests: 40 points
- Safety tests: 30 points
- Performance: 20 points
- No anomalies: 10 points

**Total**: X/100 → Convert to X/10

### 3. Document Recommendations

Based on results:
- Immediate actions required
- Before production checklist
- Phase 1B features to prioritize

---

## EXPECTED TIMELINE

| Time | Activity |
|------|----------|
| T+0 | Start backend, verify status |
| T+5min | Test 1: Scheduler observation complete |
| T+7min | Test 2: Duplicate prevention complete |
| T+10min | Test 3: Retry + DLQ complete |
| T+15min | Test 4: Worker crash complete |
| T+18min | Test 5: Redis failure complete |
| T+20min | Fill in validation report |
| T+25min | Calculate rating |
| T+30min | Document recommendations |

**Total Time**: 30-45 minutes

---

## SUCCESS CRITERIA

### Minimum (6/10 rating)
- ✅ Scheduler scans and enqueues jobs
- ✅ Worker processes jobs
- ✅ Tokens updated in database
- ✅ Locks released properly
- ✅ No duplicate refresh

### Production Ready (8/10 rating)
- ✅ All minimum criteria
- ✅ Retry behavior correct
- ✅ DLQ handling correct
- ✅ Fail-closed verified
- ✅ No critical anomalies

---

## TROUBLESHOOTING

### Backend won't start
- Check Redis connection
- Check MongoDB connection
- Check port 3000 not in use
- Check environment variables

### Scheduler not running
- Check logs for "Token refresh scheduler started"
- Verify Redis connected
- Check `redisConnected = true` in startup

### Worker not processing
- Check logs for "Distributed token refresh worker started"
- Verify Redis connected
- Check queue name matches

### No jobs enqueued
- Verify test accounts exist
- Check tokens expire within 24 hours
- Wait full 5 minutes for scan

---

## DELIVERABLES

After validation, you will have:

1. **PHASE_1_LIVE_VALIDATION_REPORT.md** (completed)
   - All test results
   - Metrics captured
   - Anomalies documented
   - Final rating calculated

2. **Recommendations Document**
   - Immediate actions
   - Production checklist
   - Phase 1B priorities

3. **Production Readiness Assessment**
   - GO/NO-GO decision
   - Risk assessment
   - Deployment plan

---

## NEXT STEPS AFTER VALIDATION

### If Rating >= 8/10 (Production Ready)
1. Implement real provider refresh logic
2. Deploy to staging environment
3. Monitor production metrics
4. Gradual rollout

### If Rating 6-7/10 (Needs Fixes)
1. Address identified issues
2. Re-run failed tests
3. Update validation report
4. Re-calculate rating

### If Rating < 6/10 (Not Ready)
1. Investigate critical failures
2. Fix root causes
3. Full re-validation required
4. Consider design changes

---

## SUPPORT

### If You Encounter Issues

1. **Capture Evidence**:
   - Full backend logs
   - Redis keys: `redis-cli --scan --pattern "oauth:*"`
   - Database state
   - Error messages

2. **Document Behavior**:
   - What you expected
   - What actually happened
   - Steps to reproduce
   - Frequency of occurrence

3. **Check Known Issues**:
   - Redis version < 6.0
   - Mock refresh logic
   - Port conflicts
   - Environment variables

---

## FINAL CHECKLIST

Before starting validation:
- [ ] Backend code is up to date
- [ ] Redis is running (version 6+)
- [ ] MongoDB is running
- [ ] Test accounts are seeded (5 accounts)
- [ ] Backend is ready to start
- [ ] Monitoring terminal ready (optional)
- [ ] Validation report template open
- [ ] 30-45 minutes available

---

**Status**: 🟢 READY TO EXECUTE

**Next Action**: Start backend and run validation script

**Estimated Time**: 30-45 minutes

**Expected Outcome**: Production readiness assessment with resilience rating

---

**Good luck with the validation!** 🚀
