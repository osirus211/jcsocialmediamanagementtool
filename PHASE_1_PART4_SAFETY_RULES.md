# Phase 1: Distributed Token Lifecycle Automation
## Part 4: Safety Rules & Failure Modes

---

## SAFETY RULES

### Rule 1: Fail-Closed if Redis Unavailable

**Requirement**: If Redis is unavailable, DO NOT process refresh jobs

**Implementation**:
```typescript
async function processRefreshJob(job: Job): Promise<void> {
  const redis = getRedisClientSafe();
  
  // Fail-closed: If Redis unavailable, throw error
  if (!redis) {
    throw new Error('Redis unavailable - cannot process refresh job (fail-closed)');
  }
  
  // Continue with job processing...
}
```

**Behavior**:
- Job fails immediately
- BullMQ retries job later
- No refresh without coordination

---

### Rule 2: Prevent Duplicate Refresh Across Instances

**Requirement**: Only one worker can refresh a token at a time

**Implementation**: Distributed lock (see Part 3, Step 4)

**Verification**:
```typescript
const lockAcquired = await acquireLock(connectionId, workerId);

if (!lockAcquired) {
  logger.info('Lock held by another worker, skipping job', {
    connectionId,
    workerId
  });
  return; // Skip job, don't retry
}

try {
  // Process refresh
} finally {
  await releaseLock(connectionId);
}
```

---

### Rule 3: Prevent Refresh Storms

**Requirement**: Don't refresh all tokens at once

**Strategies**:

**A. Staggered Scheduling**:
```typescript
// Spread jobs over 5-minute window
const delay = Math.floor(Math.random() * 300000); // 0-5 minutes

await tokenRefreshQueue.add('refresh-token', jobData, {
  delay,
  priority: calculatePriority(expiresAt)
});
```

**B. Rate Limiting**:
```typescript
async function checkRateLimit(provider: string): Promise<boolean> {
  const window = Math.floor(Date.now() / 60000); // 1-minute window
  const key = `oauth:refresh:ratelimit:${provider}:${window}`;
  
  const count = await redis.incr(key);
  await redis.expire(key, 60);
  
  const limit = RATE_LIMITS[provider]; // e.g., 50 for Twitter
  
  if (count > limit) {
    logger.warn('Rate limit exceeded', { provider, count, limit });
    return false; // Block request
  }
  
  return true; // Allow request
}
```

**C. Minimum Refresh Interval**:
```typescript
async function checkMinimumInterval(connectionId: string): Promise<boolean> {
  const lastRefreshKey = `oauth:refresh:last:${connectionId}`;
  const lastRefresh = await redis.get(lastRefreshKey);
  
  if (lastRefresh) {
    const timeSinceRefresh = Date.now() - parseInt(lastRefresh);
    const MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    if (timeSinceRefresh < MIN_INTERVAL) {
      logger.info('Refresh too soon, skipping', {
        connectionId,
        timeSinceRefresh
      });
      return false;
    }
  }
  
  return true;
}
```

---

### Rule 4: Prevent Retry Loops

**Requirement**: Limit retry attempts, move to DLQ after max retries

**Implementation**:
```typescript
async function handleJobFailure(job: Job, error: Error): Promise<void> {
  const { connectionId, provider, attempt } = job.data;
  
  // Increment attempt counter
  const attemptKey = `oauth:refresh:attempts:${connectionId}`;
  const attempts = await redis.incr(attemptKey);
  await redis.expire(attemptKey, 3600); // 1 hour TTL
  
  const MAX_RETRIES = 3;
  
  if (attempts >= MAX_RETRIES) {
    logger.error('Max retries exceeded, moving to DLQ', {
      connectionId,
      provider,
      attempts,
      error: error.message
    });
    
    // Move to DLQ
    await deadLetterQueue.add('failed-refresh', {
      connectionId,
      provider,
      error: error.message,
      attempts,
      timestamp: Date.now()
    });
    
    // Mark account as expired
    await SocialAccount.findByIdAndUpdate(connectionId, {
      status: AccountStatus.TOKEN_EXPIRED,
      'metadata.tokenExpiredAt': new Date(),
      'metadata.tokenExpiredReason': error.message
    });
    
    // Send notification to user
    await notificationService.sendTokenExpiredNotification(connectionId);
    
    // Don't retry
    return;
  }
  
  // Retry with exponential backoff
  throw error; // BullMQ will retry
}
```

**BullMQ Retry Configuration**:
```typescript
const worker = new Worker('token-refresh', processRefreshJob, {
  connection: redis,
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 1000
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential backoff with jitter
      const baseDelay = 1000 * Math.pow(2, attemptsMade); // 1s, 2s, 4s
      const jitter = Math.random() * 1000; // 0-1s jitter
      return baseDelay + jitter;
    }
  }
});
```

---

### Rule 5: Log Correlation ID

**Requirement**: All logs must include correlation ID for tracing

**Implementation**:
```typescript
async function processRefreshJob(job: Job): Promise<void> {
  const correlationId = job.id || crypto.randomBytes(8).toString('hex');
  
  logger.info('Processing refresh job', {
    correlationId,
    connectionId: job.data.connectionId,
    provider: job.data.provider,
    attempt: job.data.attempt
  });
  
  try {
    // Process job...
    
    logger.info('Refresh successful', {
      correlationId,
      connectionId: job.data.connectionId,
      provider: job.data.provider
    });
  } catch (error) {
    logger.error('Refresh failed', {
      correlationId,
      connectionId: job.data.connectionId,
      provider: job.data.provider,
      error: error.message
    });
    throw error;
  }
}
```

---

### Rule 6: Record Metrics

**Requirement**: Track all refresh operations for observability

**Metrics to Track**:
- `oauth_refresh_total` (counter) - Total refresh attempts
- `oauth_refresh_success_total` (counter) - Successful refreshes
- `oauth_refresh_failure_total` (counter) - Failed refreshes
- `oauth_refresh_duration_seconds` (histogram) - Refresh latency
- `oauth_refresh_circuit_open_total` (counter) - Circuit breaker opens
- `oauth_refresh_rate_limited_total` (counter) - Rate limit hits

**Implementation**:
```typescript
import { Counter, Histogram } from 'prom-client';

const refreshTotal = new Counter({
  name: 'oauth_refresh_total',
  help: 'Total OAuth token refresh attempts',
  labelNames: ['provider', 'status']
});

const refreshDuration = new Histogram({
  name: 'oauth_refresh_duration_seconds',
  help: 'OAuth token refresh duration',
  labelNames: ['provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

async function processRefreshJob(job: Job): Promise<void> {
  const startTime = Date.now();
  const { provider } = job.data;
  
  try {
    // Process refresh...
    
    refreshTotal.inc({ provider, status: 'success' });
    refreshDuration.observe({ provider }, (Date.now() - startTime) / 1000);
  } catch (error) {
    refreshTotal.inc({ provider, status: 'failure' });
    throw error;
  }
}
```

---

### Rule 7: No In-Memory Flags

**Requirement**: All coordination must use Redis (no in-memory state)

**Forbidden**:
```typescript
// ❌ BAD: In-memory flag
let isRefreshing = false;

if (isRefreshing) return;
isRefreshing = true;
// ...
isRefreshing = false;
```

**Required**:
```typescript
// ✅ GOOD: Redis-based lock
const lockAcquired = await acquireLock(connectionId, workerId);
if (!lockAcquired) return;

try {
  // ...
} finally {
  await releaseLock(connectionId);
}
```

---

### Rule 8: No Synchronous Refresh in Request Path

**Requirement**: Never refresh tokens during API requests

**Forbidden**:
```typescript
// ❌ BAD: Synchronous refresh in request handler
app.post('/api/posts', async (req, res) => {
  const account = await getAccount(req.user.id);
  
  if (isTokenExpired(account.tokenExpiresAt)) {
    await refreshToken(account); // BLOCKS REQUEST!
  }
  
  await publishPost(account, req.body);
  res.json({ success: true });
});
```

**Required**:
```typescript
// ✅ GOOD: Async refresh via queue
app.post('/api/posts', async (req, res) => {
  const account = await getAccount(req.user.id);
  
  if (isTokenExpired(account.tokenExpiresAt)) {
    return res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Please reconnect your account'
    });
  }
  
  await publishPost(account, req.body);
  res.json({ success: true });
});

// Refresh happens asynchronously via worker
```

---

### Rule 9: No Event Loop Blocking

**Requirement**: All operations must be async, no blocking calls

**Implementation**:
- Use `async/await` for all I/O
- No `fs.readFileSync()` or blocking operations
- Use connection pooling for DB/Redis
- Set timeouts on all external API calls

```typescript
async function callProviderAPI(provider: string, refreshToken: string): Promise<TokenResponse> {
  const timeout = 10000; // 10 seconds
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(PROVIDER_URLS[provider], {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: controller.signal
    });
    
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

