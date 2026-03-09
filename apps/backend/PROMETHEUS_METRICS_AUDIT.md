# Prometheus Metrics Export Verification Audit

**Date:** 2026-03-07  
**Auditor:** Kiro AI  
**Purpose:** Verify Prometheus metrics export for Phase 3 monitoring system

---

## Executive Summary

The `/metrics` endpoint exists and exports metrics, but **Redis and Worker-specific metrics are MISSING**. Queue lag metrics are defined but need verification.

**Key Findings:**
- ✅ `/metrics` endpoint: **EXISTS** (configured in server.ts, handled by MetricsController)
- ✅ Queue metrics: **COMPLETE** (depth, active, failed, lag P50/P95/P99)
- ❌ Redis metrics: **MISSING** (connection status, circuit breaker state)
- ❌ Worker metrics: **MISSING** (restart count, running total)

**Recommendation:** **ADD** Redis and Worker metrics to metrics.ts and update MetricsService.

---

## STEP 1 — /metrics Endpoint Verification

### Endpoint Configuration

**Location:** `src/server.ts` (lines 507-563)

**Setup:**
```typescript
// Setup metrics endpoint
const { MetricsCollector } = await import('./services/metrics/MetricsCollector');
const { MetricsService } = await import('./services/metrics/MetricsService');
const { MetricsController } = await import('./controllers/MetricsController');

const collector = new MetricsCollector({
  publishingWorker: workerInstance,
  tokenRefreshWorker: tokenRefreshWorkerInstance,
  backupVerificationWorker: backupVerificationWorkerInstance,
  schedulerService: schedulerService,
  queueManager: queueManager,
  systemMonitor: systemMonitorInstance,
  authService: authMetricsTracker,
  httpMetrics: httpMetricsTracker,
});

const metricsService = new MetricsService(collector);
metricsControllerInstance = new MetricsController(metricsService);

// Set /metrics endpoint handler in app
const { setMetricsHandler } = await import('./app');
setMetricsHandler((req, res) => metricsControllerInstance.getMetrics(req, res));
```

**Status:** ✅ **COMPLETE** - Endpoint exists and is configured

**Endpoint:** `GET /metrics`  
**Handler:** `MetricsController.getMetrics()`  
**Format:** Prometheus text format (`text/plain; version=0.0.4`)

---

## STEP 2 — Queue Metrics Verification

### Defined Metrics

**Location:** `src/config/metrics.ts`

**Queue Depth Metrics:**
```typescript
export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Current queue depth (waiting jobs)',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueActiveJobs = new Gauge({
  name: 'queue_active_jobs',
  help: 'Current number of active jobs',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueFailedJobsTotal = new Counter({
  name: 'queue_failed_jobs_total',
  help: 'Total number of failed jobs',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});
```

**Queue Lag Metrics:**
```typescript
export const queueLagP50 = new Gauge({
  name: 'queue_lag_p50_seconds',
  help: 'Queue lag P50 (median) in seconds',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueLagP95 = new Gauge({
  name: 'queue_lag_p95_seconds',
  help: 'Queue lag P95 in seconds',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const queueLagP99 = new Gauge({
  name: 'queue_lag_p99_seconds',
  help: 'Queue lag P99 in seconds',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});
```

**Update Functions:**
```typescript
export async function updateQueueMetrics(
  queueName: string,
  waiting: number,
  active: number
): Promise<void> {
  queueDepth.set({ queue_name: queueName }, waiting);
  queueActiveJobs.set({ queue_name: queueName }, active);
}

export function updateQueueLagMetrics(
  queueName: string,
  lagP50Ms: number,
  lagP95Ms: number,
  lagP99Ms: number
): void {
  queueLagP50.set({ queue_name: queueName }, lagP50Ms / 1000); // Convert to seconds
  queueLagP95.set({ queue_name: queueName }, lagP95Ms / 1000);
  queueLagP99.set({ queue_name: queueName }, lagP99Ms / 1000);
}
```

**Integration:**

**Location:** `src/services/QueueMonitoringService.ts` (lines 220-235)

```typescript
// Export to Prometheus
await updateQueueMetrics(queueName, queueStats.waiting, queueStats.active);

// Export lag metrics to Prometheus if available
if (queueStats.lagP50 !== undefined && queueStats.lagP95 !== undefined && queueStats.lagP99 !== undefined) {
  updateQueueLagMetrics(queueName, queueStats.lagP50, queueStats.lagP95, queueStats.lagP99);
}
```

**Status:** ✅ **COMPLETE** - Queue metrics are defined and updated

**Exported Metrics:**
- `queue_depth{queue_name="..."}` - Waiting jobs
- `queue_active_jobs{queue_name="..."}` - Active jobs
- `queue_failed_jobs_total{queue_name="..."}` - Failed jobs total
- `queue_lag_p50_seconds{queue_name="..."}` - Median lag
- `queue_lag_p95_seconds{queue_name="..."}` - 95th percentile lag
- `queue_lag_p99_seconds{queue_name="..."}` - 99th percentile lag

---

## STEP 3 — Redis Metrics Verification

### Required Metrics

According to Phase 3 requirements, we need:

1. **`redis_connection_status`** - Redis connection status (1=connected, 0=disconnected)
2. **`circuit_breaker_state`** - Circuit breaker state (0=closed, 1=open, 2=half-open)

### Current Status

**Search Results:**
- ❌ `redis_connection_status` - NOT FOUND in metrics.ts
- ⚠️ `circuit_breaker_state` - EXISTS but for OAuth providers, NOT for Redis

**Existing Circuit Breaker Metric:**
```typescript
export const circuitBreakerStateGauge = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['provider', 'operation'],
  registers: [metricsRegistry],
});
```

**Issue:** This metric is for OAuth providers, not Redis connection.

### Missing Metrics

**Need to Add:**

1. **Redis Connection Status:**
```typescript
export const redisConnected = new Gauge({
  name: 'redis_connected',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  registers: [metricsRegistry],
});
```

2. **Redis Circuit Breaker State:**
```typescript
export const redisCircuitBreakerState = new Gauge({
  name: 'redis_circuit_breaker_state',
  help: 'Redis circuit breaker state (0 = closed, 1 = open, 2 = half-open)',
  labelNames: ['state'],
  registers: [metricsRegistry],
});
```

3. **Redis Circuit Breaker Errors:**
```typescript
export const redisCircuitBreakerErrors = new Gauge({
  name: 'redis_circuit_breaker_errors_total',
  help: 'Total Redis circuit breaker errors',
  registers: [metricsRegistry],
});
```

4. **Redis Circuit Breaker Successes:**
```typescript
export const redisCircuitBreakerSuccesses = new Gauge({
  name: 'redis_circuit_breaker_successes_total',
  help: 'Total Redis circuit breaker successes',
  registers: [metricsRegistry],
});
```

5. **Redis Recovery Metrics:**
```typescript
export const redisRecoveryDisconnects = new Counter({
  name: 'redis_recovery_disconnects_total',
  help: 'Total Redis disconnect events',
  registers: [metricsRegistry],
});

export const redisRecoveryReconnects = new Counter({
  name: 'redis_recovery_reconnects_total',
  help: 'Total Redis reconnect events',
  registers: [metricsRegistry],
});

export const redisRecoveryAttempts = new Counter({
  name: 'redis_recovery_attempts_total',
  help: 'Total Redis recovery attempts',
  registers: [metricsRegistry],
});

export const redisRecoverySuccess = new Counter({
  name: 'redis_recovery_success_total',
  help: 'Total successful Redis recoveries',
  registers: [metricsRegistry],
});

export const redisRecoveryFailed = new Counter({
  name: 'redis_recovery_failed_total',
  help: 'Total failed Redis recoveries',
  registers: [metricsRegistry],
});
```

6. **Update Function:**
```typescript
export function updateRedisMetrics(): void {
  const { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } = require('./redis');
  
  // Connection status
  redisConnected.set(isRedisHealthy() ? 1 : 0);
  
  // Circuit breaker
  const cbStatus = getCircuitBreakerStatus();
  const stateValue = cbStatus.state === 'closed' ? 0 : cbStatus.state === 'open' ? 1 : 2;
  redisCircuitBreakerState.set({ state: cbStatus.state }, stateValue);
  redisCircuitBreakerErrors.set(cbStatus.errors);
  redisCircuitBreakerSuccesses.set(cbStatus.successes);
  
  // Recovery service
  const recoveryService = getRecoveryService();
  if (recoveryService) {
    const status = recoveryService.getStatus();
    // Note: Counters should be incremented, not set
    // This is a limitation - we'll need to track deltas
  }
}
```

**Status:** ❌ **MISSING** - Redis metrics not defined

---

## STEP 4 — Worker Metrics Verification

### Required Metrics

According to Phase 3 requirements, we need:

1. **`worker_restart_count`** - Worker restart count per worker
2. **`worker_running_total`** - Total running workers

### Current Status

**Search Results:**
- ❌ `worker_restart_count` - NOT FOUND in metrics.ts
- ❌ `worker_running_total` - NOT FOUND in metrics.ts

**Existing Worker Metrics:**
```typescript
// Only basic worker alive status
export const workerAlive = new Gauge({
  name: 'worker_alive',
  help: 'Publishing worker alive status (1=alive, 0=dead)',
});
```

**Issue:** Only tracks if worker is alive, not restart counts or running totals.

### Missing Metrics

**Need to Add:**

1. **Worker Restart Count:**
```typescript
export const workerRestartCount = new Gauge({
  name: 'worker_restart_count',
  help: 'Worker restart count',
  labelNames: ['worker_name'],
  registers: [metricsRegistry],
});
```

2. **Worker Running Total:**
```typescript
export const workerRunningTotal = new Gauge({
  name: 'worker_running_total',
  help: 'Total number of running workers',
  registers: [metricsRegistry],
});
```

3. **Worker Enabled Total:**
```typescript
export const workerEnabledTotal = new Gauge({
  name: 'worker_enabled_total',
  help: 'Total number of enabled workers',
  registers: [metricsRegistry],
});
```

4. **Worker Status:**
```typescript
export const workerStatus = new Gauge({
  name: 'worker_status',
  help: 'Worker status (1=running, 0=stopped)',
  labelNames: ['worker_name'],
  registers: [metricsRegistry],
});
```

5. **Update Function:**
```typescript
export function updateWorkerMetrics(): void {
  const { WorkerManager } = require('../services/WorkerManager');
  const workerManager = WorkerManager.getInstance();
  
  const statuses = workerManager.getStatus();
  
  // Update per-worker metrics
  for (const status of statuses) {
    workerRestartCount.set({ worker_name: status.name }, status.restartCount);
    workerStatus.set({ worker_name: status.name }, status.isRunning ? 1 : 0);
  }
  
  // Update totals
  const runningCount = statuses.filter(s => s.isRunning).length;
  const enabledCount = statuses.filter(s => s.isEnabled).length;
  
  workerRunningTotal.set(runningCount);
  workerEnabledTotal.set(enabledCount);
}
```

**Status:** ❌ **MISSING** - Worker metrics not defined

---

## STEP 5 — MetricsService Integration

### Current Metrics Export

**Location:** `src/services/metrics/MetricsService.ts`

**Exported Metrics:**
- Process metrics (uptime, memory, CPU)
- Worker metrics (alive, success/failed publishes)
- Scheduler metrics (alive, runs)
- Queue metrics (waiting, active, completed, failed, delayed)
- Token refresh metrics
- Backup verification metrics
- Auth metrics
- HTTP metrics
- Alerting metrics (optional)
- Backpressure metrics (optional)

**Missing:**
- ❌ Redis connection metrics
- ❌ Redis circuit breaker metrics
- ❌ Redis recovery metrics
- ❌ Worker restart count metrics
- ❌ Worker running total metrics

### Required Changes

**Need to Update:**

1. **Add Redis metrics to MetricsService.formatPrometheusMetrics():**
```typescript
// Redis connection metrics
lines.push('# HELP redis_connected Redis connection status (1=connected, 0=disconnected)');
lines.push('# TYPE redis_connected gauge');
lines.push(`redis_connected ${metrics.redis_connected}`);
lines.push('');

lines.push('# HELP redis_circuit_breaker_state Redis circuit breaker state (0=closed, 1=open, 2=half-open)');
lines.push('# TYPE redis_circuit_breaker_state gauge');
lines.push(`redis_circuit_breaker_state ${metrics.redis_circuit_breaker_state}`);
lines.push('');
```

2. **Add Worker metrics to MetricsService.formatPrometheusMetrics():**
```typescript
// Worker metrics
lines.push('# HELP worker_running_total Total number of running workers');
lines.push('# TYPE worker_running_total gauge');
lines.push(`worker_running_total ${metrics.worker_running_total}`);
lines.push('');

lines.push('# HELP worker_restart_count Worker restart count');
lines.push('# TYPE worker_restart_count gauge');
for (const [workerName, restartCount] of Object.entries(metrics.worker_restart_counts)) {
  lines.push(`worker_restart_count{worker_name="${workerName}"} ${restartCount}`);
}
lines.push('');
```

3. **Update MetricsCollector to collect Redis and Worker metrics**

**Status:** ⚠️ **NEEDS UPDATE** - MetricsService needs Redis and Worker metrics

---

## STEP 6 — Implementation Plan

### DO NOT CREATE

- ❌ New metrics services
- ❌ New metrics collectors
- ❌ New metrics endpoints

### DO ADD

1. **Add Redis metrics to metrics.ts** (REQUIRED)
   - `redisConnected` gauge
   - `redisCircuitBreakerState` gauge
   - `redisCircuitBreakerErrors` gauge
   - `redisCircuitBreakerSuccesses` gauge
   - `redisRecovery*` counters
   - `updateRedisMetrics()` function

2. **Add Worker metrics to metrics.ts** (REQUIRED)
   - `workerRestartCount` gauge
   - `workerRunningTotal` gauge
   - `workerEnabledTotal` gauge
   - `workerStatus` gauge
   - `updateWorkerMetrics()` function

3. **Update MetricsCollector** (REQUIRED)
   - Collect Redis metrics
   - Collect Worker metrics
   - Add to CollectedMetrics interface

4. **Update MetricsService** (REQUIRED)
   - Format Redis metrics in Prometheus format
   - Format Worker metrics in Prometheus format

5. **Call update functions periodically** (REQUIRED)
   - Call `updateRedisMetrics()` in metrics collection
   - Call `updateWorkerMetrics()` in metrics collection

---

## STEP 7 — Metrics Update Strategy

### Option 1: Update in MetricsCollector (RECOMMENDED)

**Approach:** Call update functions in MetricsCollector.collect()

**Advantages:**
- ✅ Centralized metrics collection
- ✅ Consistent with existing architecture
- ✅ Metrics updated on every scrape

**Implementation:**
```typescript
async collect(): Promise<CollectedMetrics> {
  // Update Prometheus metrics
  updateRedisMetrics();
  updateWorkerMetrics();
  
  // Collect metrics
  const metrics = await this.collectMetrics();
  return metrics;
}
```

### Option 2: Update in Background Task

**Approach:** Update metrics every N seconds in background

**Advantages:**
- ✅ Doesn't block metrics scraping
- ✅ Can control update frequency

**Disadvantages:**
- ⚠️ Requires additional background task
- ⚠️ Metrics may be stale

**Not Recommended:** Adds complexity without significant benefit.

---

## Conclusion

The `/metrics` endpoint exists and exports queue metrics correctly. However, **Redis and Worker metrics are MISSING** and need to be added.

**Required Actions:**
1. ✅ Queue metrics - Already complete
2. ❌ Redis metrics - Need to add to metrics.ts
3. ❌ Worker metrics - Need to add to metrics.ts
4. ⚠️ MetricsService - Need to update to export new metrics
5. ⚠️ MetricsCollector - Need to update to collect new metrics

**Estimated Effort:** 40% of original scope (queue metrics complete, need Redis/Worker)

**Status:** ⚠️ PARTIAL - Queue metrics complete, Redis/Worker metrics missing

**Next Step:** Add Redis and Worker metrics to metrics.ts and update MetricsService

---

## Sign-Off

**Audited By:** Kiro AI  
**Date:** 2026-03-07  
**Status:** ⚠️ PARTIAL COMPLETE  
**Recommendation:** ADD Redis and Worker metrics  
**Next:** Implement missing metrics in Phase 3 Step 4

