# Phase 3 Step 1 — WorkerManager Integration with RedisRecoveryService

**Date:** 2026-03-07  
**Status:** ✅ COMPLETE  
**Approach:** Integrated WorkerManager with existing RedisRecoveryService

---

## Duplication Check Results

### STEP 1 — Confirm WorkerManager Registration Status

**Search Results:**
- ✅ Searched for `registerService` and `recoveryService.register`
- ✅ Searched for `worker-manager` and `WorkerManager.*register`

**Findings:**
- ❌ WorkerManager NOT registered in `server.ts`
- ❌ WorkerManager NOT registered in `workers-standalone.ts`

**Currently Registered Services (server.ts):**
1. scheduler (SchedulerService)
2. publishing-worker (PublishingWorker)
3. token-refresh-worker (DistributedTokenRefreshWorker)
4. token-refresh-scheduler (TokenRefreshScheduler)
5. system-monitor (SystemMonitor)

**Conclusion:** ✅ WorkerManager is NOT already registered - safe to proceed with implementation

---

## Implementation

### STEP 2 — Register WorkerManager as Recoverable Service

#### 2.1 Add Recovery Interface to WorkerManager

**File:** `src/services/WorkerManager.ts`

**Added Methods:**

1. **`isRunning(): boolean`**
   - Required by RedisRecoveryService
   - Returns `true` if any enabled worker is running
   - Returns `false` if all workers are stopped

2. **`getRedisHealth(): object`**
   - Returns combined Redis health information
   - Includes: connection status, circuit breaker state, recovery service status
   - Handles errors gracefully (returns safe defaults)

3. **`getRunningWorkers(): string[]`**
   - Returns array of running worker names
   - Used for logging and debugging

**Implementation:**
```typescript
/**
 * Check if WorkerManager is running
 * (Required by RedisRecoveryService)
 */
isRunning(): boolean {
  for (const entry of this.workers.values()) {
    if (entry.config.enabled && entry.status.isRunning) {
      return true;
    }
  }
  return false;
}

/**
 * Get Redis health status
 */
getRedisHealth(): {
  isHealthy: boolean;
  circuitBreaker: any;
  recoveryService: any;
} {
  try {
    const { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } = require('../config/redis');
    
    return {
      isHealthy: isRedisHealthy(),
      circuitBreaker: getCircuitBreakerStatus(),
      recoveryService: getRecoveryService()?.getStatus() || null,
    };
  } catch (error: any) {
    logger.error('Error getting Redis health', { error: error.message });
    return {
      isHealthy: false,
      circuitBreaker: null,
      recoveryService: null,
    };
  }
}

/**
 * Get running workers count
 */
getRunningWorkers(): string[] {
  return Array.from(this.workers.values())
    .filter(entry => entry.status.isRunning)
    .map(entry => entry.status.name);
}
```

**Exported Singleton:**
```typescript
// Export singleton instance for convenience
export const workerManager = WorkerManager.getInstance();
```

#### 2.2 Register WorkerManager in server.ts

**File:** `src/server.ts`

**Location:** After system monitor registration, before final log

**Implementation:**
```typescript
// Register WorkerManager for automatic worker restart
try {
  const { WorkerManager } = await import('./services/WorkerManager');
  const workerManager = WorkerManager.getInstance();
  
  recoveryService.registerService({
    name: 'worker-manager',
    isRunning: () => workerManager.isRunning(),
    start: async () => {
      logger.info('WorkerManager restarting after Redis reconnect');
      await workerManager.startAll();
    },
    stop: async () => {
      logger.info('WorkerManager stopping due to Redis disconnect');
      await workerManager.stopAll();
    },
    requiresRedis: true,
  });
  
  logger.info('✅ WorkerManager registered with Redis recovery service');
} catch (error: any) {
  logger.warn('Failed to register WorkerManager with recovery service', {
    error: error.message,
  });
}
```

**Updated Services List:**
```typescript
logger.info('✅ Services registered with Redis recovery service', {
  servicesRegistered: [
    'scheduler',
    workerInstance ? 'publishing-worker' : null,
    tokenRefreshWorkerInstance ? 'token-refresh-worker' : null,
    systemMonitorInstance ? 'system-monitor' : null,
    'worker-manager', // NEW
  ].filter(Boolean),
});
```

#### 2.3 Register WorkerManager in workers-standalone.ts

**File:** `src/workers-standalone.ts`

**Location:** After Redis connection, before worker registration

**Implementation:**
```typescript
// Step 2.5: Register WorkerManager with Redis recovery service
console.log('🔧 Registering WorkerManager with Redis recovery service...');
try {
  const { getRecoveryService } = await import('./config/redis');
  const recoveryService = getRecoveryService();
  
  if (recoveryService) {
    recoveryService.registerService({
      name: 'worker-manager',
      isRunning: () => workerManager.isRunning(),
      start: async () => {
        logger.info('WorkerManager restarting after Redis reconnect');
        await workerManager.startAll();
      },
      stop: async () => {
        logger.info('WorkerManager stopping due to Redis disconnect');
        await workerManager.stopAll();
      },
      requiresRedis: true,
    });
    
    console.log('✅ WorkerManager registered with Redis recovery service\n');
    logger.info('✅ WorkerManager registered with Redis recovery service');
  }
} catch (error: any) {
  console.log('⚠️  Failed to register WorkerManager with recovery service:', error.message);
  logger.warn('Failed to register WorkerManager with recovery service', {
    error: error.message,
  });
}
```

---

### STEP 3 — Restart Safety

**Restart Behavior:**

1. **On Redis Disconnect:**
   ```
   RedisRecoveryService detects disconnect
   ├─ Calls workerManager.stopAll()
   │  ├─ Sets isShuttingDown = true
   │  ├─ Stops backpressure monitoring
   │  └─ Stops all workers gracefully
   └─ Logs: "WorkerManager stopping due to Redis disconnect"
   ```

2. **On Redis Reconnect:**
   ```
   RedisRecoveryService detects reconnect
   ├─ Waits 5 seconds for Redis to stabilize
   ├─ Calls workerManager.startAll()
   │  ├─ Starts all enabled workers
   │  └─ Starts backpressure monitoring
   └─ Logs: "WorkerManager restarting after Redis reconnect"
   ```

**Safety Guarantees:**

✅ **Graceful Stop:**
- Workers finish active jobs before stopping
- BullMQ connections closed cleanly
- Backpressure monitors stopped first

✅ **Idempotent Restart:**
- `isRunning()` check prevents duplicate starts
- Workers check if already running before starting
- No duplicate backpressure monitors

✅ **Shutdown Protection:**
- `isShuttingDown` flag prevents restart during shutdown
- RedisRecoveryService respects shutdown state
- No restart if system is shutting down

✅ **Error Handling:**
- Worker start failures don't crash the system
- Continues starting other workers on failure
- Logs errors for debugging

---

### STEP 4 — Logging

**Log Events:**

1. **Registration:**
   ```
   ✅ WorkerManager registered with Redis recovery service
   ```

2. **Redis Disconnect:**
   ```
   WorkerManager stopping due to Redis disconnect
   Stopping backpressure monitoring
   Stopping all workers gracefully
   ```

3. **Redis Reconnect:**
   ```
   WorkerManager restarting after Redis reconnect
   Starting all enabled workers
   Worker startup complete
   Backpressure monitoring started
   ```

4. **Worker Restart:**
   ```
   Starting worker: {worker_name}
   Worker started successfully: {worker_name}
   ```

5. **Backpressure Monitor Restart:**
   ```
   Backpressure monitoring started
   Backpressure monitor started: {queue_name}
   ```

**Log Levels:**
- `info` - Normal operations (registration, restart)
- `warn` - Registration failures (non-blocking)
- `error` - Worker start failures

---

## Files Modified

1. **`src/services/WorkerManager.ts`**
   - Added `isRunning()` method
   - Added `getRedisHealth()` method
   - Added `getRunningWorkers()` method
   - Exported `workerManager` singleton

2. **`src/server.ts`**
   - Registered WorkerManager with RedisRecoveryService
   - Updated services list log

3. **`src/workers-standalone.ts`**
   - Registered WorkerManager with RedisRecoveryService
   - Added registration step after Redis connection

---

## Verification

### TypeScript Compilation
- ✅ No diagnostics found in WorkerManager.ts
- ✅ No diagnostics found in server.ts
- ✅ No diagnostics found in workers-standalone.ts

### Code Review
- ✅ No new Redis infrastructure services created
- ✅ Reused existing RedisRecoveryService
- ✅ Graceful stop/start behavior
- ✅ Shutdown protection
- ✅ Error handling
- ✅ Comprehensive logging

---

## Expected Behavior

### Scenario 1: Redis Disconnects

```
1. Redis connection lost
   ├─ RedisRecoveryService detects disconnect
   ├─ Calls workerManager.stopAll()
   │  ├─ Stops backpressure monitors
   │  └─ Stops all workers
   └─ System continues running (API still available)

2. Workers stopped
   ├─ No new jobs processed
   ├─ Active jobs finish gracefully
   └─ Queue connections closed
```

### Scenario 2: Redis Reconnects

```
1. Redis connection restored
   ├─ RedisRecoveryService detects reconnect
   ├─ Waits 5 seconds for stability
   └─ Calls workerManager.startAll()

2. Workers restarted
   ├─ All enabled workers start
   ├─ Backpressure monitors start
   └─ Job processing resumes

3. System fully operational
   ├─ Workers processing jobs
   ├─ Monitoring active
   └─ No manual intervention required
```

### Scenario 3: System Shutdown During Recovery

```
1. Redis reconnects
   ├─ Recovery scheduled
   └─ Waiting 5 seconds...

2. SIGTERM received
   ├─ isShuttingDown = true
   ├─ Recovery cancelled
   └─ System shuts down gracefully

3. No restart attempted
   ├─ RedisRecoveryService respects shutdown
   └─ Clean exit
```

---

## Integration with Backpressure Monitoring

**Automatic Integration:**

Since backpressure monitors are started in `WorkerManager.startAll()` and stopped in `WorkerManager.stopAll()`, they automatically benefit from Redis recovery:

```
Redis Disconnect:
├─ workerManager.stopAll()
│  ├─ stopBackpressureMonitoring()
│  │  ├─ Stop all 11 monitors
│  │  └─ Clear monitors array
│  └─ Stop all workers

Redis Reconnect:
├─ workerManager.startAll()
│  ├─ Start all workers
│  └─ startBackpressureMonitoring()
│     ├─ Get enabled configs (11 queues)
│     ├─ Create monitors
│     └─ Start all monitors
```

**No Additional Registration Required:**
- ❌ Do NOT register backpressure monitors separately
- ✅ They restart automatically via WorkerManager
- ✅ Lifecycle managed by WorkerManager

---

## Testing Recommendations

### Manual Testing

1. **Start System:**
   ```bash
   npm run dev
   # Verify: "WorkerManager registered with Redis recovery service"
   ```

2. **Stop Redis:**
   ```bash
   docker stop redis
   # Verify: "WorkerManager stopping due to Redis disconnect"
   # Verify: All workers stopped
   ```

3. **Start Redis:**
   ```bash
   docker start redis
   # Wait 5 seconds
   # Verify: "WorkerManager restarting after Redis reconnect"
   # Verify: All workers restarted
   ```

4. **Check Health:**
   ```bash
   curl http://localhost:3000/health/workers
   # Verify: All workers running
   ```

### Integration Testing

Create test in `src/__tests__/integration/redis-reconnect.test.ts`:

```typescript
describe('WorkerManager Redis Recovery', () => {
  it('should register with recovery service', () => {
    const recoveryService = getRecoveryService();
    const status = recoveryService.getStatus();
    expect(status.servicesRegistered).toBeGreaterThan(0);
  });

  it('should restart workers after Redis reconnect', async () => {
    const workerManager = WorkerManager.getInstance();
    const recoveryService = getRecoveryService();
    
    // Force recovery
    await recoveryService.forceRecovery();
    
    // Verify workers running
    expect(workerManager.isRunning()).toBe(true);
  });
});
```

---

## Conclusion

WorkerManager is now integrated with RedisRecoveryService. Workers will automatically restart after Redis reconnects, with no manual intervention required.

**Key Benefits:**
- ✅ Automatic worker restart on Redis reconnect
- ✅ Graceful stop on Redis disconnect
- ✅ Backpressure monitors restart automatically
- ✅ Shutdown protection
- ✅ No new infrastructure created (reused existing)

**Status:** ✅ STEP 1 COMPLETE

**Next Step:** STEP 2 - Register QueueMonitoringService with RedisRecoveryService

---

## Sign-Off

**Implemented By:** Kiro AI  
**Date:** 2026-03-07  
**Status:** ✅ COMPLETE  
**Verified:** TypeScript compilation passes, no diagnostics  
**Next:** Proceed to Phase 3 Step 2
