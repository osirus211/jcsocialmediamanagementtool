# Phase 1B: Runtime Validation Guide

**Date**: 2026-03-04
**Status**: Ready for Manual Execution

---

## PRECONDITIONS

Before starting validation, ensure:

- ✅ Backend running: `npm run dev` (in apps/backend)
- ✅ Redis running: Version >= 6 recommended
- ✅ MongoDB connected
- ✅ BullMQ worker active (check logs for "Distributed token refresh worker started")
- ✅ Scheduler active (check logs for "Token refresh scheduler started")

---

## VALIDATION SEQUENCE

Execute tests in order. Each test is independent but builds understanding progressively.

---

## STEP 1: Circuit Breaker Validation

**Objective**: Verify circuit breaker state transitions and request blocking

**Command**:
```bash
cd apps/backend
node phase1b-test-circuit-breaker.js
```

**Expected Output**:
```
🔧 Phase 1B: Circuit Breaker Test
===================================

🎯 Test Provider: twitter
   Connection ID: [connectionId]

🗑️  Cleared existing circuit state

STEP 1: Triggering 6 consecutive failures...

Attempt 1:
   Circuit State: CLOSED (no state yet)

Attempt 2:
   Circuit State: CLOSED
   Failure Count: 2

...

Attempt 5:
   ✅ Circuit OPENED after 5 failures
   Next Attempt At: [timestamp]

STEP 2: Verifying circuit blocks requests...

✅ Circuit is OPEN
   Cooldown until: [timestamp]
   Cooldown remaining: 60 seconds

✅ Job enqueued (worker should block and re-enqueue)

STEP 3: Queue Statistics...

   Waiting: 0
   Active: 0
   Completed: 0
   Failed: 5
   Delayed: 1

STEP 4: Final Circuit State...

{
  "state": "OPEN",
  "failureCount": 5,
  "successCount": 0,
  "lastFailureTime": [timestamp],
  "lastSuccessTime": null,
  "openedAt": [timestamp],
  "nextAttemptAt": [timestamp]
}

✅ Circuit breaker test complete
```

**Backend Logs to Check**:
```
[INFO] Processing token refresh job
[ERROR] Token refresh failed
[ERROR] Circuit breaker OPEN (threshold reached)
[WARN] Circuit breaker OPEN, blocking request
[WARN] Refresh skipped - circuit breaker OPEN
```

**Redis Verification**:
```bash
redis-cli GET oauth:circuit:twitter
```

**Success Criteria**:
- ✅ Circuit opens after 5 consecutive failures
- ✅ Circuit state stored in Redis
- ✅ Subsequent requests blocked
- ✅ Jobs re-enqueued with 60s delay
- ✅ No crashes or errors

**Metrics to Check**:
- `circuit_open_total`: Should increase by 1
- `circuit_blocked_total`: Should increase for blocked requests
- `refresh_skipped_total`: Should increase for skipped refreshes

---

## STEP 2: Circuit Recovery Validation

**Objective**: Verify HALF_OPEN transition and recovery

**Wait**: 60 seconds after Step 1 completes

**Command**:
```bash
node phase1b-test-circuit-recovery.js
```

**Expected Output**:
```
🔧 Phase 1B: Circuit Recovery Test
====================================

Checking circuit states for all providers...

Provider: twitter
   State: OPEN
   Failure Count: 5
   Success Count: 0
   Opened At: [timestamp]
   Elapsed: 65 seconds
   Next Attempt: [timestamp]
   Remaining: -5 seconds
   ✅ Ready for HALF_OPEN transition

Instructions:
1. If circuit is OPEN and cooldown expired:
   - Next refresh attempt will transition to HALF_OPEN
   - If refresh succeeds → CLOSED
   - If refresh fails → OPEN (120s extended)
```

**Manual Action**:
Trigger a refresh job and watch backend logs for:
```
[INFO] Circuit breaker transitioning to HALF_OPEN
[INFO] Processing token refresh job
[INFO] Token refresh successful
[INFO] Circuit breaker CLOSED (recovered)
```

**Success Criteria**:
- ✅ Circuit transitions to HALF_OPEN after cooldown
- ✅ Successful refresh closes circuit
- ✅ Failed refresh reopens with 120s extended cooldown

---

## STEP 3: Rate Limiter Validation

**Objective**: Verify rate limiting and job re-enqueueing

**Command**:
```bash
node phase1b-test-rate-limiter.js
```

**Expected Output**:
```
🔧 Phase 1B: Rate Limiter Test
================================

🎯 Test Provider: twitter
   Test Accounts: 5

🗑️  Cleared existing rate limit counter

STEP 1: Rate Limit Configuration...

   Provider: twitter
   Default Limit: 100 requests/minute
   Current Minute: [minute]
   Rate Limit Key: oauth:ratelimit:twitter:[minute]

STEP 2: Sending 10 requests (under limit)...

✅ 10 requests enqueued

Rate Limit Counter: 10

STEP 3: Queue Statistics...

   Waiting: 0
   Active: 0
   Completed: 10
   Failed: 0
   Delayed: 0

STEP 4: Simulating rate limit exceeded...

Setting counter to 99 (next request will be 100th)...

Sending 3 requests (100th, 101st, 102nd)...

✅ 3 requests enqueued

Final Rate Limit Counter: 102

STEP 5: Checking delayed jobs...

   Delayed Jobs: 2

✅ Jobs were delayed due to rate limit

Delayed Job Details:
   Job rate-test-limit-twitter-12: Delayed by 45 seconds
   Job rate-test-limit-twitter-13: Delayed by 45 seconds

✅ Rate limiter test complete
```

**Backend Logs to Check**:
```
[DEBUG] Rate limit check passed (count: 10, limit: 100)
[WARN] Rate limit exceeded (count: 101, limit: 100, retryAfter: 45)
[WARN] Refresh delayed - rate limit exceeded
```

**Redis Verification**:
```bash
redis-cli GET oauth:ratelimit:twitter:[minute]
```

**Success Criteria**:
- ✅ Requests under limit succeed
- ✅ Requests over limit are delayed (not failed)
- ✅ Jobs appear in delayed queue
- ✅ Delay calculated correctly (seconds until next minute)
- ✅ Counter resets next minute

**Metrics to Check**:
- `rate_limit_blocked_total`: Should increase for blocked requests
- `refresh_skipped_total`: Should increase for delayed refreshes

---

## STEP 4: Storm Protection Validation

**Objective**: Verify jitter distribution prevents synchronized bursts

**Command**:
```bash
node phase1b-test-storm-protection.js
```

**Expected Output**:
```
🔧 Phase 1B: Storm Protection Test
====================================

STEP 1: Creating 20 test accounts with synchronized expiry...

✅ Created 20 accounts expiring at: [timestamp]

STEP 2: Simulating scheduler with jitter...

   STORM_TEST_1: Jitter +347s → [timestamp]
   STORM_TEST_2: Jitter -123s → [timestamp]
   STORM_TEST_3: Jitter +589s → [timestamp]
   ...

STEP 3: Analyzing jitter distribution...

Jitter Statistics:
   Min: -598s (-9 min)
   Max: +599s (+9 min)
   Avg: +12s (+0 min)

Delay Statistics (non-negative):
   Min: 0s (0 min)
   Max: 599s (9 min)
   Avg: 305s (5 min)

Time Spread:
   Earliest: [timestamp]
   Latest: [timestamp]
   Spread: 19 minutes

STEP 4: Distribution by 5-minute buckets...

   0-5 min        : ████████ (8)
   5-10 min       : ██████ (6)
   10-15 min      : ████ (4)
   15-20 min      : ██ (2)

STEP 5: Validation...

   ✅ Jitter within ±10 minutes
      Min: -9m, Max: +9m
   ✅ No negative delays
      Min delay: 0s
   ✅ Jobs spread over time
      Spread: 19 minutes
   ✅ Distribution not concentrated
      Max in one bucket: 8

✅ Storm protection validation PASSED
```

**Success Criteria**:
- ✅ Jitter range: -10 to +10 minutes
- ✅ No negative delays (Math.max(0, jitter))
- ✅ Jobs spread across ~20 minutes
- ✅ No concentration in single time bucket
- ✅ Prevents synchronized execution spike

---

## STEP 5: Combined Failure Scenario

**Objective**: Verify system resilience under combined stress

**Command**:
```bash
node phase1b-test-combined-failure.js
```

**Expected Output**:
```
🔧 Phase 1B: Combined Failure Test
====================================

🎯 Test Provider: twitter
   Test Accounts: 5

SCENARIO: Provider outage + rate limit + high load

🗑️  Cleared existing state

PHASE 1: Triggering circuit breaker (5 failures)...

Circuit State: OPEN
Failure Count: 5

✅ Circuit breaker OPEN

PHASE 2: Sending 20 requests while circuit is OPEN...

✅ 20 requests enqueued

PHASE 3: Checking queue stability...

Queue Statistics:
   Waiting: 0
   Active: 0
   Completed: 0
   Failed: 5
   Delayed: 20

PHASE 4: Analyzing circuit breaker behavior...

Circuit State:
   State: OPEN
   Failure Count: 5
   Success Count: 0
   Cooldown Remaining: 55 seconds

PHASE 5: Checking rate limiter...

Rate Limit Counter: 0

PHASE 6: Verifying no job loss...

Total Jobs: 25
Expected: 25

✅ No significant job loss

PHASE 7: Checking delayed jobs...

✅ 20 jobs delayed (circuit breaker working)

Sample Delayed Jobs:
   Job combined-volume-twitter-1: Delayed by 58 seconds
   Job combined-volume-twitter-2: Delayed by 58 seconds
   ...

PHASE 8: System health check...

   ✅ Redis: OK
   ✅ MongoDB: OK
   ✅ BullMQ Queue: OK

═══════════════════════════════════════

FINAL SUMMARY

═══════════════════════════════════════

Protection Mechanisms:
   ✅ Circuit Breaker: Active
   ✅ Rate Limiter: Active
   ✅ Queue Stability: Stable

✅ Combined failure test PASSED

System demonstrated resilience under:
- Provider outages
- High request volume
- Circuit breaker activation
- Rate limiting
```

**Backend Logs to Check**:
```
[ERROR] Circuit breaker OPEN (threshold reached)
[WARN] Circuit breaker OPEN, blocking request
[WARN] Refresh skipped - circuit breaker OPEN
[INFO] Token refresh job exhausted all retries
```

**Success Criteria**:
- ✅ Circuit breaker activates during failures
- ✅ Rate limiter protects queue
- ✅ Queue depth remains stable
- ✅ No jobs lost (all preserved)
- ✅ System components remain healthy
- ✅ System recovers after failure window

---

## METRICS COLLECTION

After all tests, check worker metrics:

**Backend Endpoint** (if exposed):
```bash
curl http://localhost:3000/api/metrics
```

**Expected Metrics**:
```
refresh_attempt_total: [count]
refresh_success_total: [count]
refresh_failure_total: [count]
circuit_open_total: [count]
circuit_blocked_total: [count]
rate_limit_blocked_total: [count]
refresh_skipped_total: [count]
```

**Calculations**:
- Skip Rate: `refresh_skipped_total / refresh_attempt_total`
- Success Rate: `refresh_success_total / (refresh_success_total + refresh_failure_total)`
- Circuit Activation Rate: `circuit_open_total / refresh_attempt_total`

---

## REDIS STATE INSPECTION

**Check all circuit states**:
```bash
redis-cli KEYS "oauth:circuit:*"
redis-cli GET oauth:circuit:twitter
```

**Check rate limit counters**:
```bash
redis-cli KEYS "oauth:ratelimit:*"
redis-cli GET oauth:ratelimit:twitter:[minute]
```

**Check distributed locks**:
```bash
redis-cli KEYS "oauth:refresh:lock:*"
```

**Check DLQ entries**:
```bash
redis-cli KEYS "oauth:refresh:dlq:*"
```

---

## ANOMALY DETECTION

Watch for these issues:

**Circuit Breaker**:
- ❌ Circuit doesn't open after 5 failures
- ❌ Circuit doesn't transition to HALF_OPEN after cooldown
- ❌ Circuit doesn't close after successful retry
- ❌ Jobs fail instead of being delayed

**Rate Limiter**:
- ❌ Counter doesn't increment
- ❌ Requests not blocked when limit exceeded
- ❌ Jobs fail instead of being delayed
- ❌ Counter doesn't reset next minute

**Storm Protection**:
- ❌ Jitter outside ±10 minute range
- ❌ Negative delays observed
- ❌ Jobs concentrated in single time window
- ❌ All jobs execute simultaneously

**Queue Stability**:
- ❌ Jobs lost during failures
- ❌ Queue depth grows unbounded
- ❌ Worker crashes or deadlocks
- ❌ Redis connection failures

---

## RESILIENCE RATING CRITERIA

Rate system resilience (1-10):

**10/10 - Excellent**:
- All tests pass
- No anomalies detected
- Metrics within expected ranges
- System recovers gracefully
- No job loss

**8-9/10 - Good**:
- All tests pass
- Minor anomalies (e.g., timing variations)
- Metrics mostly within ranges
- System recovers with delays

**6-7/10 - Acceptable**:
- Most tests pass
- Some anomalies detected
- Metrics show stress
- System recovers eventually

**4-5/10 - Poor**:
- Some tests fail
- Multiple anomalies
- Metrics show instability
- System struggles to recover

**1-3/10 - Critical**:
- Multiple test failures
- Severe anomalies
- System crashes or deadlocks
- Job loss detected

---

## TROUBLESHOOTING

**Circuit breaker not opening**:
- Check if refreshToken() is actually failing
- Verify recordFailure() is being called
- Check Redis connection
- Verify FAILURE_THRESHOLD = 5

**Rate limiter not blocking**:
- Check if checkRateLimit() is being called
- Verify Redis INCR working
- Check rate limit configuration
- Verify current minute calculation

**Jobs not being delayed**:
- Check job.moveToDelayed() implementation
- Verify BullMQ delayed queue support
- Check Redis connection
- Review worker logs for errors

**System crashes**:
- Check Redis connection stability
- Verify MongoDB connection
- Review error logs
- Check memory usage

---

## NEXT STEPS AFTER VALIDATION

**If validation passes**:
1. Document results in PHASE_1B_VALIDATION_REPORT.md
2. Tune thresholds based on observations
3. Set up monitoring alerts
4. Proceed to production deployment

**If validation fails**:
1. Document failures and anomalies
2. Review implementation against design
3. Fix identified issues
4. Re-run validation

---

## VALIDATION REPORT TEMPLATE

After completing all tests, document results:

```markdown
# Phase 1B Validation Report

**Date**: [date]
**Tester**: [name]
**Environment**: Development

## Test Results

### Circuit Breaker
- State transitions: ✅/❌
- Request blocking: ✅/❌
- Recovery: ✅/❌
- Anomalies: [list]

### Rate Limiter
- Under limit: ✅/❌
- Over limit: ✅/❌
- Job delay: ✅/❌
- Anomalies: [list]

### Storm Protection
- Jitter range: ✅/❌
- Distribution: ✅/❌
- No negative delays: ✅/❌
- Anomalies: [list]

### Combined Failure
- Circuit activation: ✅/❌
- Queue stability: ✅/❌
- No job loss: ✅/❌
- System health: ✅/❌
- Anomalies: [list]

## Metrics

- refresh_attempt_total: [count]
- refresh_success_total: [count]
- refresh_failure_total: [count]
- circuit_open_total: [count]
- circuit_blocked_total: [count]
- rate_limit_blocked_total: [count]
- refresh_skipped_total: [count]

## Resilience Rating

**Score**: [1-10]/10

**Justification**: [explanation]

## Recommendations

[list recommendations]

## Conclusion

[summary]
```

---

**Validation infrastructure complete. Ready for manual execution.**
