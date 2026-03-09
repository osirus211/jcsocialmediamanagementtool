# Phase 2 — Backpressure Monitoring Integration

**Status:** ✅ COMPLETE

**Date:** 2026-03-07

---

## Overview

Integrated multi-queue backpressure monitoring into WorkerManager, making it the single lifecycle owner of all monitoring infrastructure. Removed the existing single-queue monitor instantiation from `server.ts`.

---

## Changes Made

### 1. Removed Existing Instantiation from `server.ts`

**Removed:**
- `backpressureMonitorInstance` variable declaration
- QueueBackpressureMonitor instantiation (lines 515-580)
- Monitor stop call in graceful shutdown handler
- Monitor registration with Redis recovery service
- Monitor reference in MetricsCollector

**Impact:**
- `server.ts` no longer manages backpressure monitoring
- Monitoring lifecycle is now fully owned by WorkerManager

### 2. Enhanced `WorkerManager.ts`

**Added Imports:**
```typescript
import { QueueBackpressureMonitor } from './monitoring/QueueBackpressureMonitor';
import { getEnabledBackpressureConfigs } from '../config/backpressure.config';
import { QueueManager } from '../queue/QueueManager';
import { AlertingService } from './alerting/AlertingService';
import { ConsoleAlertAdapter } from './alerting/ConsoleAlertAdapter';
import { WebhookAlertAdapter } from './alerting/WebhookAlertAdapter';
import { config } from '../config';
```

**Added Private Fields:**
```typescript
private backpressureMonitors: QueueBackpressureMonitor[] = [];
private isBackpressureMonitoringStarted: boolean = false;
```

**Added Methods:**

1. **`startBackpressureMonitoring()`** (private)
   - Gets enabled configs from `getEnabledBackpressureConfigs()`
   - Gets QueueManager instance
   - Creates AlertingService if alerting is enabled
   - Instantiates one QueueBackpressureMonitor per queue
   - Stores monitors in `backpressureMonitors` array
   - Calls `start()` on each monitor
   - Sets `isBackpressureMonitoringStarted` flag
   - Logs: "Backpressure monitoring started for X queues"

2. **`stopBackpressureMonitoring()`** (private)
   - Iterates through `backpressureMonitors` array
   - Calls `stop()` on each monitor
   - Clears `backpressureMonitors` array
   - Resets `isBackpressureMonitoringStarted` flag
   - Logs: "Backpressure monitoring stopped"

**Integration Points:**
- `startBackpressureMonitoring()` called at END of `startAll()` method
- `stopBackpressureMonitoring()` called at START of `stopAll()` method

---

## Queue Coverage

Backpressure monitoring now covers **11 critical queues** (from `backpressure.config.ts`):

### CRITICAL (7 queues)
- `scheduler-queue` (lowest threshold - must process quickly)
- `facebook-publish-queue`
- `instagram-publish-queue`
- `twitter-publish-queue`
- `linkedin-publish-queue`
- `tiktok-publish-queue`
- `token-refresh-queue`

### HIGH (2 queues)
- `media-processing-queue`
- `email-queue`

### MEDIUM (2 queues)
- `analytics-collection-queue`
- `notification-queue`

---

## Architecture Benefits

### Single Lifecycle Owner
- WorkerManager is now the ONLY component that manages monitoring infrastructure
- No duplicate instantiations across `server.ts`, `workers-standalone.ts`, etc.
- Consistent startup/shutdown behavior

### Multi-Queue Monitoring
- Monitors 11 queues instead of 1 (posting-queue)
- Queue-specific thresholds based on queue type
- Comprehensive backpressure detection across the system

### Graceful Shutdown
- Backpressure monitors stop BEFORE workers stop
- Prevents false alerts during shutdown
- Clean resource cleanup

### Error Handling
- Monitor failures don't crash the system
- Continues starting other monitors if one fails
- Logs errors for debugging

---

## Startup Sequence

```
1. WorkerManager.startAll()
   ├─ Start all enabled workers
   └─ startBackpressureMonitoring()
      ├─ Get enabled configs (11 queues)
      ├─ Get QueueManager instance
      ├─ Create AlertingService (if enabled)
      └─ For each queue:
         ├─ Create QueueBackpressureMonitor
         ├─ Call monitor.start()
         └─ Store in backpressureMonitors array
```

---

## Shutdown Sequence

```
1. WorkerManager.stopAll()
   ├─ stopBackpressureMonitoring()
   │  ├─ For each monitor:
   │  │  └─ Call monitor.stop()
   │  └─ Clear backpressureMonitors array
   └─ Stop all workers
```

---

## Configuration

Backpressure monitoring uses `backpressure.config.ts`:

```typescript
export const backpressureConfigs: Record<string, QueueBackpressureConfig> = {
  'scheduler-queue': {
    enabled: true,
    pollInterval: 30000,
    queueName: 'scheduler-queue',
    waitingJobsThreshold: 100,
    growthRateThreshold: 5,
    jobTimeThreshold: 30,
    failureRateThreshold: 2,
    backlogAgeThreshold: 120,
    stalledThreshold: 50,
  },
  // ... 10 more queues
};
```

**Helper Functions:**
- `getEnabledBackpressureConfigs()` - Returns all enabled configs
- `getBackpressureConfig(queueName)` - Returns config for specific queue
- `getCriticalQueueNames()` - Returns list of critical queue names

---

## Alerting Integration

If `config.alerting.enabled` is true, WorkerManager creates an AlertingService with:

**Adapters:**
- `ConsoleAlertAdapter` (always included)
- `WebhookAlertAdapter` (if `config.alerting.webhookUrl` is set)

**Configuration:**
- `enabled`: From `config.alerting.enabled`
- `cooldownMinutes`: From `config.alerting.cooldownMinutes`
- `adapters`: Array of alert adapters

This AlertingService is passed to all QueueBackpressureMonitor instances.

---

## Safety Guarantees

### No Queue Modification
- Monitors are read-only
- No job manipulation
- No queue configuration changes

### Non-Blocking
- Monitor failures don't crash workers
- Continues starting other monitors if one fails
- Graceful degradation

### Shutdown Safety
- Monitors stop before workers
- No false alerts during shutdown
- Clean resource cleanup

### Horizontal Scaling Safe
- Each instance monitors independently
- Alert deduplication via Redis (in AlertingService)
- No coordination required between instances

---

## Testing Recommendations

### Unit Tests
- Test `startBackpressureMonitoring()` with various configs
- Test `stopBackpressureMonitoring()` cleanup
- Test error handling when QueueManager unavailable
- Test error handling when monitor fails to start

### Integration Tests
- Test full startup sequence with WorkerManager
- Test graceful shutdown sequence
- Test monitor behavior during Redis reconnect
- Test alert delivery through AlertingService

### Manual Testing
```bash
# Start server and verify monitors start
npm run dev

# Check logs for:
# "Backpressure monitoring started" with queue list
# "Backpressure monitor started" for each queue

# Trigger shutdown and verify monitors stop
# CTRL+C or kill -SIGTERM <pid>

# Check logs for:
# "Stopping backpressure monitoring"
# "Backpressure monitoring stopped"
```

---

## Files Modified

1. **`apps/backend/src/server.ts`**
   - Removed `backpressureMonitorInstance` variable
   - Removed QueueBackpressureMonitor instantiation
   - Removed monitor stop call in shutdown handler
   - Removed monitor registration with recovery service
   - Removed monitor reference in MetricsCollector

2. **`apps/backend/src/services/WorkerManager.ts`**
   - Added imports for backpressure monitoring
   - Added private fields for monitor tracking
   - Added `startBackpressureMonitoring()` method
   - Added `stopBackpressureMonitoring()` method
   - Integrated monitoring into `startAll()` and `stopAll()`

---

## Next Steps

### Phase 3: Redis Connection Resilience (Tasks 9-12)
- Implement connection health monitoring
- Add automatic reconnection logic
- Handle Redis failures gracefully
- Test recovery scenarios

### Phase 4: Health Endpoints (Tasks 13-15)
- Add `/health/workers` endpoint
- Add `/health/queues` endpoint
- Add `/health/system` endpoint
- Integrate with WorkerManager status

---

## Verification Checklist

- [x] Removed all references to `backpressureMonitorInstance` from `server.ts`
- [x] Added backpressure monitoring to WorkerManager
- [x] Monitors start after workers in `startAll()`
- [x] Monitors stop before workers in `stopAll()`
- [x] Error handling prevents crashes
- [x] Logging provides visibility
- [x] TypeScript compilation passes
- [x] No duplicate monitor instantiations

---

## Conclusion

WorkerManager is now the single lifecycle owner of backpressure monitoring infrastructure. The system monitors 11 critical queues with queue-specific thresholds, providing comprehensive backpressure detection across the entire publishing pipeline.

**Status:** ✅ READY FOR PHASE 3
