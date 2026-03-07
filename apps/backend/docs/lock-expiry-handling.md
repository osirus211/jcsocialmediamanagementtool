# Lock Expiry Handling

## Overview

The DistributedLockService provides robust lock expiry handling to ensure system reliability when workers crash or become unresponsive. This document describes the lock expiry mechanisms, monitoring capabilities, and best practices.

## Features

### 1. Automatic Lock Expiry

Locks automatically expire after their TTL (Time To Live) if not explicitly released. This prevents deadlocks when workers crash.

**How it works:**
- Locks are stored in Redis with a TTL using `SET key value PX milliseconds NX`
- Redis automatically removes the lock after the TTL expires
- Other workers can then acquire the lock and process the job

**Example:**
```typescript
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 120000, // 2 minutes
});

// If worker crashes here, lock expires after 2 minutes
// Another worker can then acquire the lock
```

### 2. Lock Renewal for Long-Running Operations

For operations that may exceed the initial TTL, locks can be renewed to prevent premature expiry.

**Manual Renewal:**
```typescript
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 60000, // 1 minute
});

// Perform some work...

// Renew lock for another minute
await distributedLockService.renewLock(lock, 60000);

// Continue work...
```

**Automatic Renewal:**
```typescript
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 120000, // 2 minutes
  renewInterval: 60000, // Renew every 1 minute
});

// Lock is automatically renewed every minute
// No manual renewal needed
```

### 3. Lock Timeout Monitoring

The service tracks lock timeouts and provides metrics for monitoring system health.

**Metrics Available:**
- `totalAcquired`: Total locks acquired
- `totalReleased`: Total locks released
- `totalRenewed`: Total lock renewals
- `totalExpired`: Total locks that expired
- `totalTimeouts`: Total lock timeout events
- `activeLocks`: Current number of active locks
- `averageLockDuration`: Average time locks are held

**Getting Metrics:**
```typescript
const metrics = distributedLockService.getMetrics();
console.log('Lock metrics:', metrics);
```

### 4. Alerts for Frequent Lock Timeouts

The service automatically alerts when lock timeouts become frequent, indicating potential system issues.

**Alert Threshold:**
- Triggers when 5+ timeouts occur within 1 minute
- Logs error with details about affected resources
- Helps identify problematic operations or system degradation

**Alert Example:**
```
ERROR: Frequent lock timeouts detected
{
  totalTimeouts: 6,
  windowMinutes: 1,
  threshold: 5,
  topResources: [
    { resource: 'lock:post:123', count: 3 },
    { resource: 'lock:post:456', count: 2 },
    { resource: 'lock:post:789', count: 1 }
  ]
}
```

## Worker Crash Scenarios

### Scenario 1: Worker Crashes While Holding Lock

**What happens:**
1. Worker acquires lock with 2-minute TTL
2. Worker crashes before releasing lock
3. Lock expires after 2 minutes
4. Another worker acquires lock and processes job

**Code Example:**
```typescript
// Worker 1
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 120000,
});

// Worker crashes here (no explicit release)
// Lock expires after 2 minutes

// Worker 2 (after 2 minutes)
const lock2 = await distributedLockService.acquireLock('post:123', {
  ttl: 120000,
});
// Successfully acquires lock and processes job
```

### Scenario 2: Long-Running Operation with Auto-Renewal

**What happens:**
1. Worker acquires lock with auto-renewal
2. Operation takes longer than initial TTL
3. Lock is automatically renewed
4. If worker crashes, renewal stops and lock expires

**Code Example:**
```typescript
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 120000, // 2 minutes
  renewInterval: 60000, // Renew every 1 minute
});

// Long-running operation (3 minutes)
await processLongRunningJob();

// Lock is renewed automatically at 1 minute mark
// If worker crashes, renewal stops and lock expires after TTL
```

### Scenario 3: Multiple Workers Competing for Same Lock

**What happens:**
1. Multiple workers try to acquire the same lock
2. Only one worker succeeds (atomic operation)
3. Other workers either retry or skip the job

**Code Example:**
```typescript
// 5 workers try to acquire the same lock
const workers = [1, 2, 3, 4, 5];

await Promise.all(workers.map(async (workerId) => {
  const lock = await distributedLockService.acquireLock('post:123', {
    ttl: 120000,
    retryAttempts: 1, // Don't retry if lock is held
  });

  if (lock) {
    console.log(`Worker ${workerId} acquired lock`);
    // Process job
    await distributedLockService.releaseLock(lock);
  } else {
    console.log(`Worker ${workerId} skipped (lock held by another worker)`);
  }
}));

// Only one worker acquires the lock
```

## Best Practices

### 1. Choose Appropriate TTL

- **Short operations (< 30s)**: Use 30-60 second TTL
- **Medium operations (30s - 2min)**: Use 2-minute TTL
- **Long operations (> 2min)**: Use auto-renewal with 2-minute TTL

### 2. Always Release Locks

Use try-finally to ensure locks are released even if errors occur:

```typescript
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 120000,
});

try {
  // Process job
  await processJob();
} finally {
  // Always release lock
  if (lock) {
    await distributedLockService.releaseLock(lock);
  }
}
```

### 3. Verify Lock Ownership

Before critical operations, verify the lock is still held:

```typescript
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 120000,
});

// Some work...

// Verify lock is still held before critical operation
const isHeld = await distributedLockService.isLockHeld(lock);
if (!isHeld) {
  throw new Error('Lock expired - aborting operation');
}

// Proceed with critical operation
```

### 4. Handle Lock Acquisition Failures

Always handle the case where lock acquisition fails:

```typescript
const lock = await distributedLockService.acquireLock('post:123', {
  ttl: 120000,
  retryAttempts: 3,
});

if (!lock) {
  logger.warn('Could not acquire lock - another worker may be processing', {
    postId: '123',
  });
  return { success: false, skipped: true };
}

// Proceed with processing
```

### 5. Monitor Lock Metrics

Regularly check lock metrics to identify issues:

```typescript
// In monitoring endpoint
app.get('/metrics/locks', (req, res) => {
  const metrics = distributedLockService.getMetrics();
  res.json(metrics);
});
```

## Testing

### Unit Tests

Run unit tests to verify lock behavior:

```bash
npm test -- DistributedLockService.test.ts
```

### Integration Tests

Run integration tests (requires Redis):

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Run tests
npm test -- lock-expiry-worker-crash.test.ts
```

### Manual Testing

Test worker crash scenario manually:

1. Start worker and acquire lock
2. Kill worker process (Ctrl+C or kill -9)
3. Wait for TTL to expire
4. Start another worker
5. Verify second worker acquires lock and processes job

## Troubleshooting

### Issue: Locks Not Expiring

**Symptoms:**
- Jobs stuck in "publishing" status
- Workers unable to acquire locks

**Possible Causes:**
1. Redis not running or unreachable
2. TTL set too high
3. Auto-renewal preventing expiry

**Solutions:**
1. Check Redis connection: `redis-cli ping`
2. Reduce TTL for faster recovery
3. Disable auto-renewal if not needed

### Issue: Frequent Lock Timeouts

**Symptoms:**
- Alert: "Frequent lock timeouts detected"
- High `totalTimeouts` metric

**Possible Causes:**
1. Operations taking longer than TTL
2. Redis connection issues
3. System overload

**Solutions:**
1. Increase TTL or enable auto-renewal
2. Check Redis health and network
3. Scale workers or reduce load

### Issue: Duplicate Processing

**Symptoms:**
- Same post published multiple times
- Duplicate platform posts

**Possible Causes:**
1. Lock not acquired before processing
2. Lock released too early
3. Race condition in status check

**Solutions:**
1. Always acquire lock before processing
2. Use try-finally to ensure proper release
3. Use atomic status updates with optimistic locking

## Configuration

### Environment Variables

```bash
# Redis connection (required for distributed locks)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Lock configuration (optional)
LOCK_DEFAULT_TTL=120000  # 2 minutes
LOCK_RETRY_ATTEMPTS=3
LOCK_RETRY_DELAY=100
```

### Code Configuration

```typescript
// Configure lock service
const lock = await distributedLockService.acquireLock('resource', {
  ttl: 120000,           // Lock TTL in milliseconds
  retryAttempts: 3,      // Number of retry attempts
  retryDelay: 100,       // Delay between retries in ms
  renewInterval: 60000,  // Auto-renewal interval in ms
});
```

## Related Documentation

- [Distributed Lock Service](./distributed-lock-service.md)
- [Publishing Worker](./publishing-worker.md)
- [Queue Reliability](./queue-reliability.md)
- [Redis Configuration](./redis-configuration.md)
