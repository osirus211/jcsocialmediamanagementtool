# Phase 1B: Provider Protection Layer
## Design Document

---

## REDIS KEY DESIGN

### Circuit Breaker Keys
```
oauth:circuit:{provider}
```

**Value Structure (JSON):**
```json
{
  "state": "CLOSED" | "OPEN" | "HALF_OPEN",
  "failureCount": 5,
  "successCount": 0,
  "lastFailureTime": 1709481234567,
  "lastSuccessTime": null,
  "openedAt": 1709481234567,
  "nextAttemptAt": 1709481294567
}
```

**TTL**: 300 seconds (5 minutes)

**States**:
- `CLOSED`: Normal operation, all requests allowed
- `OPEN`: Provider failing, all requests blocked
- `HALF_OPEN`: Testing recovery, limited requests allowed

---

### Rate Limit Keys
```
oauth:ratelimit:{provider}:{minute}
```

**Example**:
```
oauth:ratelimit:twitter:28249687  (minute timestamp)
```

**Value**: Integer counter (incremented per request)

**TTL**: 120 seconds (2 minutes for safety margin)

**Limit**: Configurable per provider (default: 100 requests/minute)

---

## CIRCUIT BREAKER LOGIC

### State Transitions

```
CLOSED
  ↓ (5 consecutive failures)
OPEN (60s cooldown)
  ↓ (cooldown expires)
HALF_OPEN
  ↓ (1 success)
CLOSED

HALF_OPEN
  ↓ (failure)
OPEN (120s extended cooldown)
```

### Rules

**CLOSED → OPEN**:
- Trigger: 5 consecutive refresh failures
- Action: Block all requests for 60 seconds
- Metric: `circuit_open_total++`

**OPEN → HALF_OPEN**:
- Trigger: 60 seconds elapsed
- Action: Allow next request to test recovery
- Log: "Circuit breaker transitioning to HALF_OPEN"

**HALF_OPEN → CLOSED**:
- Trigger: 1 successful refresh
- Action: Resume normal operation
- Log: "Circuit breaker CLOSED (recovered)"

**HALF_OPEN → OPEN**:
- Trigger: Refresh fails in HALF_OPEN
- Action: Block all requests for 120 seconds (extended)
- Log: "Circuit breaker OPEN (retry failed, extended cooldown)"

### Failure Modes

**Redis Unavailable**:
- Behavior: Fail closed (throw error)
- Reason: Cannot coordinate circuit state across instances
- Impact: Refresh blocked until Redis restored

**Circuit OPEN**:
- Behavior: Block refresh, re-enqueue with 60s delay
- Reason: Provider is failing, prevent storm
- Impact: Refresh delayed, no token update
- Metric: `circuit_blocked_total++`, `refresh_skipped_total++`

---

## RATE LIMITER LOGIC

### Sliding Window Algorithm

```
Current minute: 28249687
Key: oauth:ratelimit:twitter:28249687

Request 1: INCR → 1 (allowed)
Request 2: INCR → 2 (allowed)
...
Request 100: INCR → 100 (allowed)
Request 101: INCR → 101 (blocked, retry after 45s)

Next minute: 28249688
Key: oauth:ratelimit:twitter:28249688
Counter resets to 0
```

### Rules

**Rate Limit Check**:
1. Calculate current minute: `Math.floor(Date.now() / 60000)`
2. Increment counter: `INCR oauth:ratelimit:{provider}:{minute}`
3. If first increment, set TTL: `EXPIRE key 120`
4. If count > limit: Block and calculate retry delay
5. If count ≤ limit: Allow

**Rate Limit Exceeded**:
- Behavior: Block refresh, re-enqueue with delay
- Delay: Seconds until next minute window
- Metric: `rate_limit_blocked_total++`, `refresh_skipped_total++`
- Log: "Refresh delayed - rate limit exceeded"

### Per-Provider Limits

```typescript
twitter: 100 requests/minute
facebook: 200 requests/minute
instagram: 200 requests/minute
linkedin: 100 requests/minute
youtube: 100 requests/minute
threads: 100 requests/minute
google-business: 100 requests/minute
tiktok: 100 requests/minute
```

### Failure Modes

**Redis Unavailable**:
- Behavior: Fail closed (throw error)
- Reason: Cannot track rate limit across instances
- Impact: Refresh blocked until Redis restored

**Rate Limit Exceeded**:
- Behavior: Delay job, do not fail
- Action: `job.moveToDelayed(retryAfter * 1000)`
- Impact: Refresh delayed, preserves job

---

## STORM PROTECTION

### Jitter Algorithm

```typescript
// Random delay ±10 minutes
const jitterMs = Math.floor(Math.random() * 1200000) - 600000;
const delay = Math.max(0, jitterMs); // Ensure non-negative

// Enqueue with delay
await tokenRefreshQueue.addRefreshJob(data, delay);
```

### Purpose

**Problem**: Synchronized token expiry
- 1000 tokens expire at 10:00:00
- All refresh jobs enqueued simultaneously
- Provider API overwhelmed

**Solution**: Random spread
- Job 1: Enqueued for 09:55:23 (5 min early)
- Job 2: Enqueued for 10:03:47 (3 min late)
- Job 3: Enqueued for 09:58:12 (2 min early)
- ...spread over 20-minute window

**Impact**:
- Prevents burst load on provider APIs
- Smooths refresh distribution
- Reduces circuit breaker triggers

---

## UPDATED WORKER FLOW

```
Job Received
    ↓
Increment refresh_attempt_total
    ↓
Check Circuit Breaker
    ↓
  OPEN? → Yes → Increment circuit_blocked_total
    ↓           Increment refresh_skipped_total
    No          Re-enqueue with 60s delay
    ↓           Return
Check Rate Limit
    ↓
Exceeded? → Yes → Increment rate_limit_blocked_total
    ↓              Increment refresh_skipped_total
    No             Re-enqueue with delay
    ↓              Return
Acquire Lock
    ↓
Held? → Yes → Skip job
    ↓
    No
    ↓
Fetch Account
    ↓
Call Provider Refresh
    ↓
Success? → No → Record Circuit Failure
    ↓              Throw error (retry)
    Yes
    ↓
Record Circuit Success
    ↓
Update Token
    ↓
Release Lock
    ↓
Increment refresh_success_total
    ↓
Complete
```

---

## METRICS

### New Counters

```typescript
circuit_open_total          // Circuit breaker opened
circuit_blocked_total       // Requests blocked by circuit
rate_limit_blocked_total    // Requests blocked by rate limit
refresh_attempt_total       // Total refresh attempts
refresh_skipped_total       // Refreshes skipped (circuit/rate limit)
```

### Existing Counters

```typescript
refresh_success_total       // Successful refreshes
refresh_failure_total       // Failed refreshes
```

### Monitoring Queries

**Circuit Breaker Status**:
```bash
redis-cli GET oauth:circuit:twitter
```

**Rate Limit Usage**:
```bash
redis-cli GET oauth:ratelimit:twitter:28249687
```

**Metrics**:
```
GET /metrics

# circuit_open_total 3
# circuit_blocked_total 127
# rate_limit_blocked_total 45
# refresh_attempt_total 1523
# refresh_skipped_total 172
# refresh_success_total 1348
# refresh_failure_total 3
```

---

## FAILURE MODE ANALYSIS

### Scenario 1: Provider Outage

**Trigger**: Twitter API returns 503 for 5 consecutive requests

**Behavior**:
1. Failure 1-4: Retry with backoff, circuit stays CLOSED
2. Failure 5: Circuit opens, blocks all Twitter refreshes
3. Next 60 seconds: All Twitter jobs re-enqueued with delay
4. After 60s: Circuit transitions to HALF_OPEN
5. Next job: Tests if Twitter recovered
6. If success: Circuit closes, normal operation resumes
7. If failure: Circuit reopens for 120s (extended)

**Metrics**:
- `circuit_open_total`: +1
- `circuit_blocked_total`: +N (jobs blocked during OPEN)
- `refresh_skipped_total`: +N

**Impact**:
- Twitter refreshes delayed 60-120 seconds
- Other providers unaffected
- No token loss (jobs preserved)

---

### Scenario 2: Rate Limit Exceeded

**Trigger**: 101 Twitter refresh requests in same minute

**Behavior**:
1. Requests 1-100: Allowed, counter increments
2. Request 101: Blocked, retry after 45 seconds
3. Job re-enqueued with 45s delay
4. Next minute: Counter resets, request allowed

**Metrics**:
- `rate_limit_blocked_total`: +1
- `refresh_skipped_total`: +1

**Impact**:
- Single job delayed 45 seconds
- No job loss
- Prevents provider rate limit errors

---

### Scenario 3: Redis Failure

**Trigger**: Redis connection lost

**Behavior**:
1. Circuit breaker check fails: Throws error
2. Rate limiter check fails: Throws error
3. Lock acquisition fails: Throws error
4. Job fails, enters retry queue
5. After 3 retries: Job moves to DLQ

**Metrics**:
- `refresh_failure_total`: +1 per attempt

**Impact**:
- All refreshes blocked (fail-closed)
- Jobs preserved in queue
- After Redis restored: Jobs retry automatically

---

### Scenario 4: Synchronized Expiry Storm

**Trigger**: 1000 tokens expire at same time

**Without Jitter**:
- All 1000 jobs enqueued simultaneously
- Worker processes 5 concurrently
- 200 jobs/minute hit provider
- Rate limit exceeded
- Circuit breaker may open

**With Jitter**:
- Jobs spread over 20-minute window
- ~50 jobs/minute
- Under rate limit
- Circuit breaker stays closed
- Smooth processing

**Impact**:
- Prevents provider overload
- Reduces circuit breaker triggers
- Maintains steady throughput

---

## CONFIGURATION

### Circuit Breaker

```typescript
FAILURE_THRESHOLD = 5           // Failures to open circuit
SUCCESS_THRESHOLD = 1           // Successes to close circuit
OPEN_DURATION_MS = 60000        // 60 seconds
OPEN_DURATION_EXTENDED_MS = 120000  // 120 seconds
```

### Rate Limiter

```typescript
// Per-provider limits (requests/minute)
twitter: 100
facebook: 200
instagram: 200
linkedin: 100
youtube: 100
threads: 100
google-business: 100
tiktok: 100
```

### Storm Protection

```typescript
JITTER_RANGE_MS = 1200000       // ±10 minutes (±600000 ms)
```

---

## INTEGRATION POINTS

### Files Modified

1. **CircuitBreakerService.ts** (new)
   - Circuit state management
   - State transitions
   - Redis coordination

2. **RateLimiterService.ts** (new)
   - Sliding window rate limiting
   - Per-provider limits
   - Redis counters

3. **DistributedTokenRefreshWorker.ts** (modified)
   - Circuit breaker checks
   - Rate limiter checks
   - Metrics tracking
   - Job re-enqueueing

4. **TokenRefreshScheduler.ts** (modified)
   - Jitter calculation
   - Delayed job enqueueing

5. **TokenRefreshQueue.ts** (modified)
   - Support for delayed jobs
   - Delay parameter

---

## TESTING STRATEGY

### Circuit Breaker Tests

1. **Trigger OPEN**: Force 5 consecutive failures
2. **Verify BLOCK**: Confirm requests blocked for 60s
3. **Test HALF_OPEN**: Verify transition after cooldown
4. **Test Recovery**: Confirm CLOSED after success
5. **Test Extended**: Confirm 120s after HALF_OPEN failure

### Rate Limiter Tests

1. **Under Limit**: Send 50 requests, all allowed
2. **At Limit**: Send 100 requests, all allowed
3. **Over Limit**: Send 101 requests, last blocked
4. **Window Reset**: Verify counter resets next minute
5. **Multiple Providers**: Verify independent limits

### Storm Protection Tests

1. **Jitter Range**: Verify delays within ±10 minutes
2. **Distribution**: Verify jobs spread evenly
3. **No Negative Delays**: Verify Math.max(0, jitter)

---

## DEPLOYMENT CHECKLIST

- [ ] Circuit breaker service deployed
- [ ] Rate limiter service deployed
- [ ] Worker updated with protection checks
- [ ] Scheduler updated with jitter
- [ ] Queue updated for delayed jobs
- [ ] Metrics endpoint updated
- [ ] Redis keys documented
- [ ] Monitoring alerts configured
- [ ] Rate limits tuned per provider
- [ ] Circuit breaker thresholds validated

---

## MONITORING

### Alerts

**Circuit Breaker Opened**:
- Trigger: `circuit_open_total` increases
- Action: Investigate provider health
- Severity: WARNING

**High Circuit Block Rate**:
- Trigger: `circuit_blocked_total` > 100/hour
- Action: Check provider status
- Severity: WARNING

**High Rate Limit Blocks**:
- Trigger: `rate_limit_blocked_total` > 50/hour
- Action: Increase rate limit or add workers
- Severity: INFO

**High Skip Rate**:
- Trigger: `refresh_skipped_total / refresh_attempt_total` > 10%
- Action: Investigate circuit/rate limit issues
- Severity: WARNING

---

## CONCLUSION

Phase 1B adds production-grade protection against:
- Provider outages (circuit breaker)
- API rate limits (rate limiter)
- Synchronized expiry storms (jitter)

All coordination is Redis-based, distributed-safe, and fail-closed.

**Status**: ✅ IMPLEMENTATION COMPLETE
