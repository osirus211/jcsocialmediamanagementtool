# Queue Monitoring Duplication Audit

**Date:** 2026-03-07  
**Purpose:** Identify existing queue monitoring infrastructure before Phase 2 implementation  
**Status:** ✅ AUDIT COMPLETE

---

## Executive Summary

**Finding:** The system already has **COMPREHENSIVE** queue monitoring infrastructure. Phase 2 should **INTEGRATE** with existing systems rather than create new ones.

**Recommendation:** Do NOT implement a new QueueMonitoringService. Instead, enhance and integrate existing components with WorkerManager.

---

## STEP 1 — EXISTING QUEUE MONITORING SERVICES

### ✅ QueueMonitoringService (COMPLETE)

**Location:** `src/services/QueueMonitoringService.ts`

**Features:**
- Monitors all queues (currently: posting-queue, scheduler-queue)
- Collects statistics (waiting, active, failed, delayed, completed)
- Calculates failure rates
- Health classification (healthy, degraded, unhealthy)
- Alert conditions with thresholds
- Historical metrics tracking (last 100 samples)
- Alert cooldown (5 minutes to prevent spam)
- Periodic monitoring (configurable interval, default 30s)

**Alert Conditions:**
1. High queue backlog (>1000 waiting jobs)
2. High failure rate (>5%)
3. Queue unhealthy status

**Interfaces:**
```typescript
interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  completed: number;
  failureRate: number;
  health: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
}

interface AlertCondition {
  name: string;
  check: (stats: QueueStats[]) => boolean;
  message: (stats: QueueStats[]) => string;
  severity: 'warning' | 'error' | 'critical';
}
```

**Methods:**
- `startMonitoring(intervalMs)` - Start periodic monitoring
- `stopMonitoring()` - Stop monitoring
- `getAllQueueStats()` - Get current stats for all queues
- `getQueueStats(queueName)` - Get stats for specific queue
- `getHistory(queueName)` - Get historical metrics
- `getStatus()` - Get monitoring status

**Current Usage:**
- Used in `workers-standalone.ts` (line 84)
- Started with 30-second interval
- Monitors 2 queues (posting-queue, scheduler-queue)

**Gap:** Only monitors 2 queues, needs to monitor all 16+ operational queues from SYSTEM_RUNTIME_CLASSIFICATION.md

---

### ✅ QueueBackpressureMonitor (COMPLETE)

**Location:** `src/services/monitoring/QueueBackpressureMonitor.ts`

**Features:**
- Detects queue overload and system stress early
- Monitors queue health continuously
- Detects backpressure conditions (6 conditions)
- Sends alerts via AlertingService
- Exports metrics for Prometheus
- Non-blocking and production-safe
- Safe in horizontal scaling
- Safe during Redis reconnect
- Safe during shutdown

**Backpressure Conditions:**
1. Waiting jobs exceed threshold
2. Queue growing faster than processing (growth rate)
3. Job processing time spike
4. Failure rate spike
5. Backlog age increasing
6. Queue stalled (waiting jobs but no active processing)

**Configurable Thresholds:**
```typescript
interface QueueBackpressureConfig {
  enabled: boolean;
  pollInterval: number;
  queueName: string;
  waitingJobsThreshold: number;
  growthRateThreshold: number;
  jobTimeThreshold: number;
  failureRateThreshold: number;
  backlogAgeThreshold: number;
  stalledThreshold: number;
}
```

**Metrics Tracked:**
- backpressure_detected (0 or 1)
- backpressure_waiting_jobs
- backpressure_growth_rate (jobs/second)
- backpressure_avg_job_time
- backpressure_backlog_age (seconds)
- backpressure_alerts_sent

**Current Usage:**
- Used in `server.ts` (line 521)
- Started when Redis is connected
- Monitors single queue (configurable)

**Gap:** Only monitors one queue at a time, needs multi-queue support

---

### ✅ QueueManager (COMPLETE)

**Location:** `src/queue/QueueManager.ts`

**Features:**
- Singleton pattern for queue management
- Creates and manages BullMQ queues
- Provides queue statistics
- Health classification

**Queue Stats Methods:**
```typescript
async getQueueStats(queueName: string): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  total: number;
  failureRate: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
}>

async getAllQueueStats(): Promise<Record<string, any>>
```

**Health Classification:**
- healthy: failureRate < 5%
- degraded: 5% <= failureRate < 20%
- unhealthy: failureRate >= 20%

**Current Usage:**
- Used by QueueMonitoringService
- Used by QueueBackpressureMonitor
- Used throughout the application

---

## STEP 2 — OBSERVABILITY INTEGRATION

### ✅ Prometheus Metrics (COMPLETE)

**Location:** `src/config/metrics.ts`

**Queue Metrics Defined:**
```typescript
// Gauges
queueDepth                  // Current queue depth (waiting jobs)
queueActiveJobs             // Current number of active jobs

// Counters
queueCompletedJobsTotal     // Total completed jobs
queueFailedJobsTotal        // Total failed jobs

// Histograms
jobProcessingDuration       // Job processing duration (ms)

// Gauges
jobSuccessRate              // Job success rate (percentage)
```

**Helper Functions:**
```typescript
updateQueueMetrics(queueName, waiting, active)
recordJobCompletion(queueName, jobName, status, durationMs)
```

**Labels:**
- queue_name
- job_name
- status (success/error)

**Buckets (jobProcessingDuration):**
- [10, 50, 100, 500, 1000, 5000, 10000, 30000] milliseconds

**Current Usage:**
- Metrics defined but not actively updated by QueueMonitoringService
- Need integration to export queue stats to Prometheus

**Gap:** QueueMonitoringService doesn't export metrics to Prometheus

---

### ✅ OpenTelemetry (COMPLETE)

**Location:** `src/config/telemetry.ts`

**Features:**
- NodeSDK with auto-instrumentation
- Jaeger exporter for distributed tracing
- Traces HTTP requests, database queries
- Context propagation across services

**Auto-Instrumentation:**
- HTTP (Express)
- MongoDB
- Redis
- DNS
- Net

**Current Usage:**
- Initialized in server.ts
- Traces all HTTP requests
- Traces database operations

**Gap:** No explicit queue job tracing (relies on auto-instrumentation)

---

### ✅ Sentry (COMPLETE)

**Location:** `src/monitoring/sentry.ts`

**Features:**
- Error tracking and alerting
- Breadcrumbs for context
- User context
- Release tracking
- Performance monitoring

**Current Usage:**
- Integrated in Express middleware
- Integrated in worker error handlers
- Captures unhandled rejections

**Gap:** No explicit queue monitoring integration (workers already report errors)

---

## STEP 3 — REUSABLE COMPONENTS

### ✅ Fully Reusable

1. **QueueMonitoringService** - Complete, needs queue list update
2. **QueueBackpressureMonitor** - Complete, needs multi-queue support
3. **QueueManager.getQueueStats()** - Complete, already used
4. **Prometheus metrics** - Complete, needs integration
5. **AlertingService** - Complete, already used by backpressure monitor
6. **Logger** - Complete, structured logging with context

### ⚠️ Partially Reusable

1. **OpenTelemetry** - Auto-instrumentation works, but no explicit queue spans
2. **Sentry** - Error tracking works, but no queue-specific context

### ❌ Not Reusable

None - all components are reusable

---

## STEP 4 — GAP ANALYSIS

### COMPLETE ✅

1. **Queue Statistics Collection**
   - QueueManager.getQueueStats() ✅
   - QueueManager.getAllQueueStats() ✅
   - Historical tracking ✅

2. **Backpressure Detection**
   - QueueBackpressureMonitor ✅
   - 6 backpressure conditions ✅
   - Growth rate calculation ✅
   - Backlog age tracking ✅

3. **Alerting**
   - AlertingService integration ✅
   - Alert cooldown ✅
   - Severity levels ✅

4. **Health Classification**
   - healthy/degraded/unhealthy ✅
   - Failure rate calculation ✅

5. **Prometheus Metrics**
   - Metrics defined ✅
   - Helper functions ✅

### PARTIAL ⚠️

1. **Queue Coverage**
   - **Current:** 2 queues (posting-queue, scheduler-queue)
   - **Required:** 16+ queues from SYSTEM_RUNTIME_CLASSIFICATION.md
   - **Gap:** Need to add all operational queues

2. **Prometheus Integration**
   - **Current:** Metrics defined but not exported
   - **Required:** QueueMonitoringService should export to Prometheus
   - **Gap:** Need to call `updateQueueMetrics()` in monitoring loop

3. **Multi-Queue Backpressure**
   - **Current:** QueueBackpressureMonitor monitors one queue
   - **Required:** Monitor all critical queues
   - **Gap:** Need to instantiate multiple monitors or refactor for multi-queue

4. **Worker Event Listeners**
   - **Current:** Workers handle errors internally
   - **Required:** WorkerManager should listen for worker events
   - **Gap:** Need EventEmitter pattern in workers

### MISSING ❌

1. **WorkerManager Integration**
   - QueueMonitoringService not integrated with WorkerManager
   - WorkerManager doesn't know about queue health
   - Need bidirectional integration

2. **Queue Lag Metrics**
   - Tested in chaos tests but not in production monitoring
   - Need to track time between job creation and processing start
   - Need P50, P95, P99 percentiles

3. **Stalled Job Detection**
   - BullMQ has built-in stalled job detection
   - Not exposed in monitoring service
   - Need to track and alert on stalled jobs

4. **Dead-Letter Queue Monitoring**
   - DLQ exists but not monitored
   - Need to track DLQ depth
   - Need to alert when DLQ exceeds threshold

---

## STEP 5 — RECOMMENDED ARCHITECTURE

### DO NOT CREATE NEW SERVICES ❌

The following should NOT be implemented:
- ❌ New QueueMonitoringService (already exists)
- ❌ New QueueHealthService (functionality exists in QueueManager)
- ❌ New BackpressureDetector (already exists)
- ❌ New AlertingService (already exists)

### RECOMMENDED MINIMAL IMPLEMENTATION ✅

**Phase 2 should focus on INTEGRATION, not creation:**

#### 1. Enhance QueueMonitoringService

**File:** `src/services/QueueMonitoringService.ts`

**Changes:**
```typescript
// Add all operational queues from SYSTEM_RUNTIME_CLASSIFICATION.md
private queueNames: string[] = [
  // CORE_RUNTIME queues
  'scheduler-queue',
  'facebook-publish-queue',
  'instagram-publish-queue',
  'twitter-publish-queue',
  'linkedin-publish-queue',
  'tiktok-publish-queue',
  'token-refresh-queue',
  
  // FEATURE_RUNTIME queues
  'media-processing-queue',
  'email-queue',
  'notification-queue',
  'analytics-collection-queue',
  
  // OPERATIONAL queues
  'dead-letter-queue',
];

// Add Prometheus integration
private async collectMetrics(): Promise<void> {
  // ... existing code ...
  
  // Export to Prometheus
  updateQueueMetrics(queueName, queueStats.waiting, queueStats.active);
  
  // ... existing code ...
}

// Add queue lag tracking
private async calculateQueueLag(queueName: string): Promise<number> {
  // Get oldest waiting job timestamp
  // Calculate lag = now - oldestJobTimestamp
  // Return lag in milliseconds
}
```

**Effort:** LOW (1-2 hours)

---

#### 2. Integrate with WorkerManager

**File:** `src/services/WorkerManager.ts`

**Changes:**
```typescript
import { queueMonitoringService } from './QueueMonitoringService';

export class WorkerManager {
  // ... existing code ...
  
  /**
   * Get queue health for all workers
   */
  async getQueueHealth(): Promise<QueueStats[]> {
    return await queueMonitoringService.getAllQueueStats();
  }
  
  /**
   * Check if queues are healthy
   */
  async areQueuesHealthy(): Promise<boolean> {
    const stats = await this.getQueueHealth();
    return stats.every(s => s.health !== 'unhealthy');
  }
}
```

**Effort:** LOW (1 hour)

---

#### 3. Multi-Queue Backpressure Monitoring

**File:** `src/services/monitoring/QueueBackpressureMonitor.ts`

**Option A: Multiple Instances (RECOMMENDED)**
```typescript
// In workers-standalone.ts or server.ts
const criticalQueues = [
  'scheduler-queue',
  'facebook-publish-queue',
  'instagram-publish-queue',
  'twitter-publish-queue',
  'linkedin-publish-queue',
  'tiktok-publish-queue',
  'token-refresh-queue',
];

const monitors = criticalQueues.map(queueName => {
  return new QueueBackpressureMonitor({
    enabled: true,
    pollInterval: 30000,
    queueName,
    waitingJobsThreshold: 500,
    growthRateThreshold: 10,
    jobTimeThreshold: 60,
    failureRateThreshold: 5,
    backlogAgeThreshold: 300,
    stalledThreshold: 100,
  }, queueManager, alertingService);
});

monitors.forEach(m => m.start());
```

**Option B: Refactor for Multi-Queue (ALTERNATIVE)**
```typescript
// Refactor QueueBackpressureMonitor to accept multiple queues
constructor(
  config: QueueBackpressureConfig[],  // Array of configs
  queueManager: QueueManager | null = null,
  alertingService: AlertingService | null = null
) {
  // Monitor all queues in single instance
}
```

**Effort:** LOW (Option A: 1 hour, Option B: 2-3 hours)

---

#### 4. Add Queue Lag Metrics

**File:** `src/services/QueueMonitoringService.ts`

**Changes:**
```typescript
interface QueueStats {
  // ... existing fields ...
  lagP50?: number;  // Median lag (ms)
  lagP95?: number;  // 95th percentile lag (ms)
  lagP99?: number;  // 99th percentile lag (ms)
}

private async calculateQueueLag(queueName: string): Promise<{
  p50: number;
  p95: number;
  p99: number;
}> {
  // Get waiting jobs with timestamps
  // Calculate lag for each job
  // Return percentiles
}
```

**Effort:** MEDIUM (2-3 hours)

---

#### 5. Dead-Letter Queue Monitoring

**File:** `src/services/QueueMonitoringService.ts`

**Changes:**
```typescript
// Add DLQ-specific alert condition
{
  name: 'dlq_threshold_exceeded',
  check: (stats) => {
    const dlq = stats.find(s => s.name === 'dead-letter-queue');
    return dlq && dlq.waiting > 100;  // Alert if DLQ > 100 jobs
  },
  message: (stats) => {
    const dlq = stats.find(s => s.name === 'dead-letter-queue');
    return `Dead-letter queue has ${dlq?.waiting} failed jobs requiring manual intervention`;
  },
  severity: 'critical',
}
```

**Effort:** LOW (30 minutes)

---

### INTEGRATION SUMMARY

**Total Effort:** 6-9 hours (LOW complexity)

**Files to Modify:**
1. `src/services/QueueMonitoringService.ts` - Add queues, Prometheus, lag tracking
2. `src/services/WorkerManager.ts` - Add queue health methods
3. `src/workers-standalone.ts` - Instantiate backpressure monitors for all critical queues
4. `src/server.ts` - Same as workers-standalone.ts

**Files NOT to Create:**
- ❌ New QueueMonitoringService
- ❌ New QueueHealthService
- ❌ New BackpressureDetector
- ❌ New metrics configuration

---

## RECOMMENDED PHASE 2 IMPLEMENTATION PLAN

### Task 1: Enhance QueueMonitoringService (2 hours)
- Add all 13 operational queues
- Integrate Prometheus metrics export
- Add DLQ monitoring alert

### Task 2: Add Queue Lag Tracking (3 hours)
- Implement lag calculation
- Add P50, P95, P99 percentiles
- Export to Prometheus

### Task 3: Multi-Queue Backpressure (1 hour)
- Instantiate monitors for 7 critical queues
- Configure thresholds per queue type

### Task 4: WorkerManager Integration (1 hour)
- Add queue health methods
- Integrate with health endpoint

### Task 5: Testing (2 hours)
- Unit tests for new functionality
- Integration tests for monitoring
- Verify Prometheus metrics export

**Total Effort:** 9 hours

---

## CONCLUSION

**Status:** ✅ COMPREHENSIVE MONITORING INFRASTRUCTURE EXISTS

**Recommendation:** **DO NOT** implement new queue monitoring services. Instead:

1. ✅ **REUSE** existing QueueMonitoringService
2. ✅ **ENHANCE** with all operational queues
3. ✅ **INTEGRATE** with Prometheus metrics
4. ✅ **EXTEND** with queue lag tracking
5. ✅ **INSTANTIATE** multiple QueueBackpressureMonitors
6. ✅ **CONNECT** to WorkerManager

**Benefits:**
- No code duplication
- Leverages existing, tested infrastructure
- Minimal implementation effort (9 hours vs 20+ hours for new service)
- Consistent with existing architecture
- Production-safe (existing services already battle-tested)

**Next Steps:**
1. Review and approve this audit
2. Proceed with Phase 2 implementation using recommended architecture
3. Focus on integration, not creation

---

**End of Duplication Audit**
