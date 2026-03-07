# Phase 1: Distributed Token Lifecycle Automation
## Part 3: Worker Flow & Implementation

---

## WORKER FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                      TOKEN REFRESH WORKER FLOW                   │
└─────────────────────────────────────────────────────────────────┘

START
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. SCHEDULER (Every 5 minutes)                                   │
│    - Acquire scheduler lock (oauth:scheduler:lock)               │
│    - Query DB: tokens expiring < 24h                             │
│    - For each token:                                             │
│      • Check job dedup key (oauth:refresh:job:{connId})          │
│      • If not exists → Enqueue job to BullMQ                     │
│      • Set dedup key with 24h TTL                                │
│    - Release scheduler lock                                      │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. BULLMQ QUEUE                                                  │
│    - Job data: { connectionId, provider, attempt }               │
│    - Priority: Based on token expiry (sooner = higher)           │
│    - Retry: 3 attempts with exponential backoff                  │
│    - Timeout: 30 seconds per job                                 │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. WORKER PICKS JOB                                              │
│    - Worker instance receives job from queue                     │
│    - Extract: connectionId, provider, attempt                    │
│    - Start timer for metrics                                     │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ACQUIRE DISTRIBUTED LOCK                                      │
│    - Key: oauth:refresh:lock:{connectionId}                      │
│    - Operation: SET key workerId EX 120 NX                       │
│    - If lock acquired (OK) → Continue                            │
│    - If lock held (null) → Skip job (another worker processing)  │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CHECK CIRCUIT BREAKER                                         │
│    - Key: oauth:circuit:{provider}                               │
│    - Get circuit state                                           │
│    - If OPEN → Skip refresh, schedule retry after cooldown       │
│    - If HALF_OPEN → Allow (testing recovery)                     │
│    - If CLOSED → Continue                                        │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. CHECK RATE LIMIT                                              │
│    - Key: oauth:refresh:ratelimit:{provider}:{window}            │
│    - INCR key                                                    │
│    - If count > limit → Delay request                            │
│    - If count <= limit → Continue                                │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. LOAD CONNECTION FROM DB                                       │
│    - Query: SocialAccount.findById(connectionId)                 │
│    - Select: +refreshToken (encrypted)                           │
│    - Decrypt refresh token                                       │
│    - Validate: token exists and not expired                      │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. CALL PROVIDER REFRESH API                                     │
│    - Provider-specific refresh logic                             │
│    - Timeout: 10 seconds                                         │
│    - Retry: Handled by BullMQ (not here)                         │
│    - Response: { accessToken, refreshToken, expiresIn }          │
└─────────────────────────────────────────────────────────────────┘
  │
  ├─ SUCCESS ──────────────────────────────────────────────────────┐
  │                                                                 │
  ▼                                                                 │
┌─────────────────────────────────────────────────────────────────┐│
│ 9a. UPDATE TOKENS ATOMICALLY                                     ││
│     - Encrypt new tokens                                         ││
│     - Update DB with new tokens + expiry                         ││
│     - Set last refresh timestamp                                 ││
│     - Reset attempt counter                                      ││
│     - Update circuit breaker (success)                           ││
│     - Record metrics (success, latency)                          ││
│     - Release lock                                               ││
│     - Complete job                                               ││
└─────────────────────────────────────────────────────────────────┘│
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
  │
  ├─ FAILURE ──────────────────────────────────────────────────────┐
  │                                                                 │
  ▼                                                                 │
┌─────────────────────────────────────────────────────────────────┐│
│ 9b. HANDLE FAILURE                                               ││
│     - Increment attempt counter                                  ││
│     - Update circuit breaker (failure)                           ││
│     - Record metrics (failure, error type)                       ││
│     - Release lock                                               ││
│     - If attempt < MAX_RETRIES:                                  ││
│       • Throw error → BullMQ retries with backoff                ││
│     - If attempt >= MAX_RETRIES:                                 ││
│       • Move job to DLQ                                          ││
│       • Mark account as TOKEN_EXPIRED                            ││
│       • Send notification to user                                ││
└─────────────────────────────────────────────────────────────────┘│
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
  │
  ▼
END
```

---

## DETAILED STEP BREAKDOWN

### Step 1: Scheduler (Cron)

**Frequency**: Every 5 minutes

**Query**:
```typescript
const refreshThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

const connections = await SocialAccount.find({
  status: AccountStatus.ACTIVE,
  tokenExpiresAt: { 
    $lt: refreshThreshold,
    $ne: null 
  }
})
.select('_id provider tokenExpiresAt')
.sort({ tokenExpiresAt: 1 }) // Soonest expiry first
.limit(10000); // Process max 10K per run
```

**Enqueue Logic**:
```typescript
for (const conn of connections) {
  const dedupKey = `oauth:refresh:job:${conn._id}`;
  
  // Check if job already queued
  const exists = await redis.exists(dedupKey);
  if (exists) continue;
  
  // Enqueue job
  await tokenRefreshQueue.add('refresh-token', {
    connectionId: conn._id.toString(),
    provider: conn.provider,
    expiresAt: conn.tokenExpiresAt,
    attempt: 0
  }, {
    priority: calculatePriority(conn.tokenExpiresAt),
    jobId: `refresh-${conn._id}`,
    removeOnComplete: true,
    removeOnFail: false
  });
  
  // Set dedup key
  await redis.set(dedupKey, Date.now(), 'EX', 86400);
}
```

**Priority Calculation**:
```typescript
function calculatePriority(expiresAt: Date): number {
  const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
  
  if (hoursUntilExpiry < 1) return 1;  // Critical (< 1 hour)
  if (hoursUntilExpiry < 6) return 2;  // High (< 6 hours)
  if (hoursUntilExpiry < 12) return 3; // Medium (< 12 hours)
  return 4;                             // Low (< 24 hours)
}
```

---

### Step 4: Acquire Distributed Lock

**Purpose**: Prevent multiple workers from refreshing same token

**Implementation**:
```typescript
async function acquireLock(connectionId: string, workerId: string): Promise<boolean> {
  const lockKey = `oauth:refresh:lock:${connectionId}`;
  const lockValue = `${workerId}:${Date.now()}`;
  
  const result = await redis.set(lockKey, lockValue, 'EX', 120, 'NX');
  return result === 'OK';
}
```

**Lock Release**:
```typescript
async function releaseLock(connectionId: string): Promise<void> {
  const lockKey = `oauth:refresh:lock:${connectionId}`;
  await redis.del(lockKey);
}
```

---

### Step 5: Check Circuit Breaker

**Purpose**: Prevent cascading failures when provider API is down

**Implementation**:
```typescript
async function checkCircuitBreaker(provider: string): Promise<'allow' | 'block'> {
  const circuitKey = `oauth:circuit:${provider}`;
  const circuit = await redis.get(circuitKey);
  
  if (!circuit) return 'allow'; // No circuit state = allow
  
  const state = JSON.parse(circuit);
  
  if (state.state === 'open') {
    // Check if cooldown period passed
    if (Date.now() < state.nextAttemptAt) {
      return 'block'; // Still in cooldown
    }
    
    // Transition to half-open
    state.state = 'half-open';
    await redis.set(circuitKey, JSON.stringify(state));
    return 'allow';
  }
  
  return 'allow'; // closed or half-open
}
```

**Update Circuit on Success**:
```typescript
async function recordSuccess(provider: string): Promise<void> {
  const circuitKey = `oauth:circuit:${provider}`;
  const circuit = await redis.get(circuitKey);
  
  const state = circuit ? JSON.parse(circuit) : {
    state: 'closed',
    failureCount: 0,
    successCount: 0
  };
  
  state.successCount++;
  state.failureCount = 0;
  state.lastSuccessTime = Date.now();
  
  // If in half-open and 3 successes, close circuit
  if (state.state === 'half-open' && state.successCount >= 3) {
    state.state = 'closed';
    state.successCount = 0;
  }
  
  await redis.set(circuitKey, JSON.stringify(state));
}
```

**Update Circuit on Failure**:
```typescript
async function recordFailure(provider: string): Promise<void> {
  const circuitKey = `oauth:circuit:${provider}`;
  const circuit = await redis.get(circuitKey);
  
  const state = circuit ? JSON.parse(circuit) : {
    state: 'closed',
    failureCount: 0,
    successCount: 0
  };
  
  state.failureCount++;
  state.successCount = 0;
  state.lastFailureTime = Date.now();
  
  // Open circuit after 5 consecutive failures
  if (state.failureCount >= 5) {
    state.state = 'open';
    state.openedAt = Date.now();
    state.nextAttemptAt = Date.now() + 60000; // 60 second cooldown
  }
  
  await redis.set(circuitKey, JSON.stringify(state));
}
```

---

