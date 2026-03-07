# Phase 1B: Runtime Validation Execution Guide

**Date**: 2026-03-04  
**Status**: Ready for Execution  
**Objective**: Validate Phase 1B provider protection layer behavior at runtime

---

## PREREQUISITES

Before executing validation:

- ✅ Backend running (`npm run dev` in `apps/backend`)
- ✅ Redis running and connected
- ✅ MongoDB running and connected
- ✅ Infrastructure audit passed (`node phase1b-infrastructure-audit.js`)
- ✅ Test accounts seeded (optional, tests will create if needed)

---

## EXECUTION OPTIONS

### Option 1: Automated Full Suite (Recommended)

Run all tests in sequence with automated reporting:

```bash
cd apps/backend
node phase1b-execute-validation.js
```

This will:
1. Execute all 4 validation tests
2. Collect results
3. Generate summary report
4. Save detailed results to `PHASE_1B_VALIDATION_RESULTS.json`

### Option 2: Manual Step-by-Step Execution

Execute tests individually for detailed observation:

```bash
cd apps/backend

# Test 1: Circuit Breaker
node phase1b-test-circuit-breaker.js

# Test 2: Rate Limiter
node phase1b-test-rate-limiter.js

# Test 3: Storm Protection
node phase1b-test-storm-protection.js

# Test 4: Combined Failure
node phase1b-test-combined-failure.js
```

---

## TEST 1: CIRCUIT BREAKER VALIDATION

### Execute

```bash
node phase1b-test-circuit-breaker.js
```

### Expected Behavior

1. **Initial State**: Circuit CLOSED
2. **After 5 Failures**: Circuit transitions to OPEN
3. **During OPEN**: Requests blocked and delayed
4. **After Cooldown**: Circuit transitions to HALF_OPEN
5. **On Success**: Circuit transitions back to CLOSED

### Verification Commands

```bash
# Check circuit state in Redis
redis-cli GET "oauth:circuit:twitter"

# Expected output (when OPEN):
# {"state":"OPEN","failureCount":5,"successCount":0,"nextAttemptAt":1234567890000}
```

### Success Criteria

- ✅ Circuit opens after 5 consecutive failures
- ✅ Redis key `oauth:circuit:{provider}` exists
- ✅ Circuit state is "OPEN"
- ✅ Subsequent requests are blocked
- ✅ Jobs are delayed (not failed)

### Backend Logs to Verify

Look for these log messages:

```
[INFO] Circuit breaker check: CLOSED
[WARN] Circuit breaker failure recorded (count: 1/5)
[WARN] Circuit breaker failure recorded (count: 5/5)
[ERROR] Circuit breaker OPEN for provider: twitter
[WARN] Circuit breaker OPEN, blocking request
[INFO] Refresh skipped - circuit breaker OPEN
```

---

## TEST 2: RATE LIMITER VALIDATION

### Execute

```bash
node phase1b-test-rate-limiter.js
```

### Expected Behavior

1. **Under Limit**: Requests processed normally
2. **At Limit**: 100th request allowed
3. **Over Limit**: 101st+ requests blocked and delayed
4. **Delayed Jobs**: Re-enqueued for next minute

### Verification Commands

```bash
# Check rate limit counter
redis-cli GET "oauth:ratelimit:twitter:$(date +%s | awk '{print int($1/60)}')"

# Check delayed jobs
redis-cli ZCARD "bull:token-refresh-queue:delayed"

# View delayed job timestamps
redis-cli ZRANGE "bull:token-refresh-queue:delayed" 0 -1 WITHSCORES
```

### Success Criteria

- ✅ First 100 requests allowed
- ✅ 101st+ requests blocked
- ✅ Redis key `oauth:ratelimit:{provider}:{minute}` exists
- ✅ Counter increments correctly
- ✅ Blocked jobs moved to delayed queue
- ✅ No jobs lost

### Backend Logs to Verify

```
[INFO] Rate limit check passed (count: 50/100)
[INFO] Rate limit check passed (count: 100/100)
[WARN] Rate limit exceeded for provider: twitter (count: 101/100)
[INFO] Refresh delayed - rate limit exceeded
```

---

## TEST 3: STORM PROTECTION VALIDATION

### Execute

```bash
node phase1b-test-storm-protection.js
```

### Expected Behavior

1. **Jitter Applied**: Each job gets ±10 minute random delay
2. **Distribution**: Jobs spread across 20-minute window
3. **No Synchronization**: No two jobs scheduled at same time
4. **Buckets**: Jobs distributed across 5-minute buckets

### Verification Commands

```bash
# Check delayed jobs distribution
redis-cli ZRANGE "bull:token-refresh-queue:delayed" 0 -1 WITHSCORES

# Count jobs in delayed queue
redis-cli ZCARD "bull:token-refresh-queue:delayed"
```

### Success Criteria

- ✅ Jitter within ±10 minutes (-600s to +600s)
- ✅ No negative delays (all delays ≥ 0)
- ✅ Jobs spread over at least 5 minutes
- ✅ No more than 10 jobs in any 5-minute bucket
- ✅ Distribution is not concentrated

### Test Output Analysis

The test will show:
- Jitter statistics (min, max, avg)
- Delay statistics
- Time spread (earliest to latest)
- Distribution by 5-minute buckets
- Validation results

---

## TEST 4: COMBINED FAILURE SCENARIO

### Execute

```bash
node phase1b-test-combined-failure.js
```

### Expected Behavior

1. **Phase 1**: Circuit breaker opens (5 failures)
2. **Phase 2**: High volume requests (20 jobs)
3. **Phase 3**: Circuit blocks requests
4. **Phase 4**: Rate limiter activates
5. **Phase 5**: Queue remains stable
6. **Phase 6**: No job loss
7. **Phase 7**: System components healthy

### Verification Commands

```bash
# Check circuit state
redis-cli GET "oauth:circuit:twitter"

# Check rate limit
redis-cli GET "oauth:ratelimit:twitter:$(date +%s | awk '{print int($1/60)}')"

# Check queue health
redis-cli LLEN "bull:token-refresh-queue:wait"
redis-cli LLEN "bull:token-refresh-queue:active"
redis-cli ZCARD "bull:token-refresh-queue:delayed"
redis-cli ZCARD "bull:token-refresh-queue:completed"
redis-cli ZCARD "bull:token-refresh-queue:failed"

# Check for dead letter queue entries
redis-cli KEYS "oauth:refresh:dlq:*"
```

### Success Criteria

- ✅ Circuit breaker opens after failures
- ✅ Subsequent requests blocked
- ✅ Rate limiter activates under load
- ✅ Queue remains stable (no crashes)
- ✅ No job loss (all jobs accounted for)
- ✅ Redis connection stable
- ✅ MongoDB connection stable
- ✅ BullMQ queue operational

### Backend Logs to Verify

```
[ERROR] Circuit breaker OPEN for provider: twitter
[WARN] Circuit breaker OPEN, blocking request
[WARN] Rate limit exceeded for provider: twitter
[INFO] Refresh delayed - circuit breaker OPEN
[INFO] Refresh delayed - rate limit exceeded
```

---

## STEP 5: RUNTIME SAFETY CHECK

### Check Backend Logs for Critical Failures

```bash
# View recent logs
tail -n 100 logs/combined.log | grep -E "(ERROR|FATAL|UnhandledPromiseRejection)"

# Check for Redis errors
tail -n 100 logs/combined.log | grep -i "redis"

# Check for BullMQ errors
tail -n 100 logs/combined.log | grep -i "bullmq"

# Check for memory warnings
tail -n 100 logs/combined.log | grep -i "memory"
```

### Critical Issues to Look For

- ❌ UnhandledPromiseRejection
- ❌ Redis connection errors
- ❌ BullMQ stalled jobs
- ❌ Memory leak warnings
- ❌ Process crashes
- ❌ Deadlocks

### Success Criteria

- ✅ No unhandled promise rejections
- ✅ No Redis connection errors
- ✅ No stalled jobs
- ✅ No memory warnings
- ✅ Process remains stable
- ✅ No deadlocks

---

## STEP 6: PRODUCE VALIDATION REPORT

### Automated Report

If you ran `phase1b-execute-validation.js`, the report is saved to:

```
apps/backend/PHASE_1B_VALIDATION_RESULTS.json
```

### Manual Report Template

Create a report with these sections:

#### 1. Circuit Breaker Behavior

- State transitions observed: CLOSED → OPEN → HALF_OPEN → CLOSED
- Failure threshold: 5 failures
- Cooldown period: 60 seconds
- Blocking behavior: ✅ Working / ❌ Not working
- Redis persistence: ✅ Working / ❌ Not working

#### 2. Rate Limiter Behavior

- Request limit: 100 requests/minute
- Blocking behavior: ✅ Working / ❌ Not working
- Job re-enqueueing: ✅ Working / ❌ Not working
- Redis persistence: ✅ Working / ❌ Not working
- Sliding window: ✅ Working / ❌ Not working

#### 3. Storm Protection Behavior

- Jitter range: ±10 minutes
- Distribution: ✅ Spread / ❌ Concentrated
- No synchronization: ✅ Confirmed / ❌ Failed
- Bucket distribution: ✅ Balanced / ❌ Unbalanced

#### 4. Combined Failure Scenario

- Circuit breaker activation: ✅ / ❌
- Rate limiter activation: ✅ / ❌
- Queue stability: ✅ / ❌
- No job loss: ✅ / ❌
- System health: ✅ / ❌

#### 5. Queue Safety Status

- Waiting jobs: [count]
- Active jobs: [count]
- Delayed jobs: [count]
- Completed jobs: [count]
- Failed jobs: [count]
- Dead letter queue: [count]

#### 6. Worker Stability

- Worker status: ✅ Running / ❌ Stopped
- Concurrency: 5
- No crashes: ✅ / ❌
- No deadlocks: ✅ / ❌
- Memory stable: ✅ / ❌

---

## FINAL ASSESSMENT

### Phase 1B Protection Layer Status

**PASS Criteria** (all must be true):
- ✅ Circuit breaker transitions correctly
- ✅ Rate limiter blocks excess requests
- ✅ Storm protection distributes load
- ✅ Combined failure scenario handled
- ✅ No job loss
- ✅ Queue remains stable
- ✅ No critical errors in logs
- ✅ System components healthy

**FAIL Criteria** (any is true):
- ❌ Circuit breaker doesn't open
- ❌ Rate limiter doesn't block
- ❌ Jobs lost during failures
- ❌ Queue crashes or deadlocks
- ❌ Critical errors in logs
- ❌ System components unhealthy

### Resilience Rating Scale

- **9-10**: Production ready - All protections working perfectly
- **7-8**: Minor tuning needed - Small issues but functional
- **5-6**: Structural issues - Significant problems detected
- **<5**: Redesign required - Critical failures

---

## TROUBLESHOOTING

### Issue: Tests Fail to Connect

**Solution**:
```bash
# Verify Redis
redis-cli ping

# Verify MongoDB
mongosh --eval "db.adminCommand('ping')"

# Check .env file
cat .env | grep -E "(REDIS_URL|MONGODB_URI)"
```

### Issue: No Test Accounts Found

**Solution**:
```bash
# Seed test accounts
node phase1-seed-test-accounts.js
```

### Issue: Circuit Breaker Doesn't Open

**Possible Causes**:
- Worker not processing jobs
- Mock errors not triggering
- Circuit breaker service not loaded

**Solution**:
- Check backend logs for worker activity
- Verify CircuitBreakerService is imported
- Restart backend

### Issue: Rate Limiter Doesn't Block

**Possible Causes**:
- Rate limit counter not incrementing
- Threshold too high
- RateLimiterService not loaded

**Solution**:
- Check Redis keys: `redis-cli KEYS "oauth:ratelimit:*"`
- Verify RateLimiterService is imported
- Check rate limit configuration

---

## NEXT STEPS

After validation passes:

1. **Document Results**: Save validation report
2. **Review Metrics**: Check `/metrics` endpoint
3. **Monitor Production**: Deploy with confidence
4. **Set Up Alerts**: Configure alerting for circuit breaker events
5. **Tune Thresholds**: Adjust based on actual provider behavior

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-04  
**Status**: Ready for execution

