# Phase 1: Execute Runtime Validation
## Step-by-Step Execution Guide

---

## PREREQUISITES VERIFIED ✅

- ✅ Redis connected (3.0.504 - upgrade recommended)
- ✅ MongoDB connected
- ✅ Test data seeded (5 accounts)
- ✅ Validation scripts created
- ❌ Backend not running (ready to start)

---

## EXECUTION STEPS

### STEP 1: Start Backend

```bash
cd apps/backend
npm run dev
```

**Watch for these log messages:**
```
✅ MongoDB connected
✅ Redis connected successfully
🔄 Distributed token refresh worker started
📅 Token refresh scheduler started
🚀 Server running on port 3000
```

**If you see errors:**
- Check Redis connection
- Check MongoDB connection
- Check port 3000 not in use

---

### STEP 2: Verify System Status

```bash
# In new terminal
cd apps/backend
node phase1-check-backend.js
```

**Expected output:**
```
Backend:       ✅ Running
Redis:         ✅ Connected
MongoDB:       ✅ Connected
Test Accounts: 5
```

**If backend not running:**
- Check previous terminal for errors
- Verify npm run dev succeeded
- Check logs for startup failures

---

### STEP 3: Monitor Redis (Optional)

```bash
# In new terminal
cd apps/backend
node phase1-monitor-redis.js
```

**Watch for:**
- Queue depth changes
- Active locks appearing/disappearing
- Jobs being processed
- DLQ entries (if failures occur)

**Press Ctrl+C to stop monitoring**

---

### STEP 4: Wait for First Scheduler Scan

**Timeline:**
- Scheduler runs immediately on startup
- Then every 5 minutes
- First scan should complete within 1 minute

**Watch backend logs for:**
```
Token refresh scan started
Token refresh scan found accounts: 5
Token refresh job enqueued (x5)
Processing token refresh job
Lock acquired
Token refresh successful
Lock released
```

**If no logs appear:**
- Check Redis connection
- Check scheduler started
- Check test accounts exist

---

### STEP 5: Verify Jobs Processed

```bash
# Check database
cd apps/backend
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler')
  .then(async () => {
    const db = mongoose.connection.db;
    const accounts = await db.collection('socialaccounts')
      .find({ accountName: /^PHASE1_TEST_/ })
      .project({ accountName: 1, lastRefreshedAt: 1, status: 1 })
      .toArray();
    
    console.log('Test Accounts Status:');
    accounts.forEach(a => {
      console.log(\`  \${a.accountName}: \${a.lastRefreshedAt ? '✅ Refreshed' : '❌ Not Refreshed'}\`);
    });
    
    await mongoose.disconnect();
  });
"
```

**Expected:**
```
Test Accounts Status:
  PHASE1_TEST_TWITTER_1: ✅ Refreshed
  PHASE1_TEST_LINKEDIN_2: ✅ Refreshed
  PHASE1_TEST_FACEBOOK_3: ✅ Refreshed
  PHASE4_TEST_INSTAGRAM_4: ✅ Refreshed
  PHASE1_TEST_YOUTUBE_5: ✅ Refreshed
```

---

### STEP 6: Test Duplicate Prevention

```bash
cd apps/backend
node phase1-test-duplicate-prevention.js
```

**Expected output:**
```
🎯 Test Account: PHASE1_TEST_TWITTER_1
📤 Enqueuing same connectionId 5 times...
⏳ Waiting 10 seconds for processing...
✅ Lock released (expected)
✅ Job deduplication working
✅ Account refreshed once
```

**Success criteria:**
- Only 1 job created (same jobId)
- Only 1 refresh performed
- Lock released properly

---

### STEP 7: Test Retry + DLQ

```bash
cd apps/backend
node phase1-test-retry-dlq.js
```

**Expected output:**
```
📤 Enqueuing job with invalid connectionId (will fail)...
⏳ Monitoring job attempts (waiting 30 seconds)...
   [2s] Attempt 1/3 - State: failed
   [7s] Attempt 2/3 - State: failed
   [32s] Attempt 3/3 - State: failed
✅ Redis DLQ key found
✅ DLQ job contains error details
```

**Success criteria:**
- 3 retry attempts
- Exponential backoff delays
- Job moved to DLQ
- Redis DLQ key created

---

### STEP 8: Run Comprehensive Validation

```bash
cd apps/backend
node phase1-validate-all.js
```

**Expected output:**
```
═══════════════════════════════════════
     PHASE 1 VALIDATION FINAL REPORT
═══════════════════════════════════════

TEST RESULTS:
1. Functional Validation: ✅ PASS
2. Duplicate Prevention: ✅ PASS
3. Retry + DLQ: ✅ PASS
4. Lock Expiry: ✅ PASS
5. Redis Failure: ⚠️  MANUAL TEST

METRICS:
Queue Completed: 5
Queue Failed: 0
Success Rate: 100%

FINAL HEALTH RATING: 8/10
🟢 EXCELLENT - Production ready
```

---

### STEP 9: Manual Redis Failure Test

**Test fail-closed behavior:**

```bash
# 1. Stop Redis
docker stop redis
# OR
sudo systemctl stop redis

# 2. Watch backend logs for errors

# 3. Attempt to enqueue job (should fail)

# 4. Restart Redis
docker start redis
# OR
sudo systemctl start redis

# 5. Verify recovery
```

**Expected behavior:**
- Worker throws error: "Redis unavailable - cannot acquire lock (fail-closed)"
- No refresh attempts proceed
- Clear error logging
- System fails closed (safe)

---

### STEP 10: Capture Metrics

**Queue metrics:**
```bash
# Check Redis monitor output
# OR query directly
redis-cli
> KEYS "bull:token-refresh-queue:*"
> LLEN bull:token-refresh-queue:completed
> LLEN bull:token-refresh-queue:failed
```

**Lock metrics:**
```bash
redis-cli
> KEYS "oauth:refresh:lock:*"
> TTL oauth:refresh:lock:{connectionId}
```

**DLQ metrics:**
```bash
redis-cli
> KEYS "oauth:refresh:dlq:*"
> GET oauth:refresh:dlq:{connectionId}
```

---

## VALIDATION REPORT TEMPLATE

After completing all steps, create **PHASE_1_VALIDATION_REPORT.md**:

```markdown
# Phase 1 Validation Report

## Execution Date
[Date and time]

## Test Results

### 1. Functional Validation
- Status: [PASS/FAIL]
- Accounts refreshed: [X/5]
- Locks released: [YES/NO]
- Details: [Observations]

### 2. Duplicate Prevention
- Status: [PASS/FAIL]
- Job deduplication: [YES/NO]
- Double refresh: [YES/NO]
- Details: [Observations]

### 3. Retry + DLQ
- Status: [PASS/FAIL]
- Retry attempts: [X/3]
- Backoff delays: [Observed timings]
- DLQ handling: [YES/NO]
- Details: [Observations]

### 4. Lock Expiry
- Status: [PASS/FAIL]
- Lock TTL: [Seconds]
- Expiry verified: [YES/NO]
- Details: [Observations]

### 5. Redis Failure
- Status: [PASS/FAIL]
- Fail-closed: [YES/NO]
- Error logging: [CLEAR/UNCLEAR]
- Details: [Observations]

## Metrics Captured

### Queue Metrics
- Completed: [X]
- Failed: [X]
- Success Rate: [X%]

### Lock Metrics
- Active locks: [X]
- Lock contention: [X events]

### DLQ Metrics
- DLQ entries: [X]
- Error types: [List]

## Anomalies Found
[List any unexpected behavior]

## Race Conditions
[List any race conditions observed]

## Lock Leaks
[List any locks that didn't release]

## Retry Anomalies
[List any retry behavior issues]

## DLQ Inconsistencies
[List any DLQ handling issues]

## Final Health Rating
[X/10]

## Recommendation
[Production ready / Needs fixes / Requires redesign]

## Next Steps
[List recommended actions]
```

---

## TROUBLESHOOTING

### Backend won't start
```bash
# Check logs
npm run dev

# Common issues:
# - Port 3000 in use
# - Redis not connected
# - MongoDB not connected
# - Missing environment variables
```

### Scheduler not running
```bash
# Check logs for:
# "Token refresh scheduler started"

# If missing:
# - Verify Redis connected
# - Check redisConnected = true
# - Restart backend
```

### Worker not processing
```bash
# Check logs for:
# "Distributed token refresh worker started"

# If missing:
# - Verify Redis connected
# - Check queue name matches
# - Restart backend
```

### No jobs enqueued
```bash
# Verify test accounts exist
node phase1-check-backend.js

# Check token expiry
# Tokens must expire within 24 hours

# Wait for scheduler scan (5 minutes)
```

### Jobs stuck in queue
```bash
# Check worker is running
# Check Redis connection
# Check for errors in logs

# Manually inspect queue
redis-cli
> LRANGE bull:token-refresh-queue:waiting 0 -1
```

---

## SUCCESS CRITERIA

### Minimum Requirements (Health Rating >= 6/10)
- ✅ Scheduler scans database
- ✅ Jobs enqueued
- ✅ Worker processes jobs
- ✅ Tokens updated
- ✅ Locks released
- ✅ No duplicate refresh

### Production Ready (Health Rating >= 8/10)
- ✅ All minimum requirements
- ✅ Retry behavior correct
- ✅ DLQ handling correct
- ✅ Fail-closed verified
- ✅ No anomalies found

---

## COMPLETION CHECKLIST

- [ ] Backend started successfully
- [ ] System status verified
- [ ] First scheduler scan completed
- [ ] Jobs processed successfully
- [ ] Duplicate prevention test passed
- [ ] Retry + DLQ test passed
- [ ] Lock expiry verified
- [ ] Redis failure test completed
- [ ] Metrics captured
- [ ] Validation report created
- [ ] Health rating calculated
- [ ] Recommendations documented

---

## FINAL DELIVERABLE

**PHASE_1_VALIDATION_REPORT.md** with:
- Complete test results
- Metrics captured
- Anomalies found
- Health rating (1-10)
- Production readiness assessment
- Recommendations

---

**Status**: 🟢 READY TO EXECUTE
**Estimated Time**: 30-45 minutes
**Next Action**: Start backend and begin Step 1
