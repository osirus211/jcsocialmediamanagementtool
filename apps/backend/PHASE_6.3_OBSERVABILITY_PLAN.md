# Phase 6.3 — Publishing Observability & Monitoring - Implementation Plan

**Date**: March 7, 2026  
**Status**: PLANNING  
**Goal**: Add comprehensive observability to the publishing system without changing publishing logic

---

## OVERVIEW

Phase 6.1 and 6.2 are complete. The publishing engine now has:
- ✅ Multi-platform fanout (Phase 6.1)
- ✅ Platform-specific idempotency (Phase 6.1)
- ✅ SchedulerWorker (BullMQ-based) (Phase 6.2)
- ✅ Media pipeline separation (Phase 6.2)

Phase 6.3 adds observability so the system can be safely deployed to production.

---

## IMPLEMENTATION STEPS

### STEP 1 — Scheduler Metrics ✅ (Already Implemented)

**Status**: ✅ COMPLETE

**Current Implementation**:
- SchedulerWorker already tracks metrics:
  - `scheduler_runs_total`
  - `posts_processed_total` (equivalent to postsFound)
  - `jobs_created_total`
  - `errors_total`
- Logs structured metrics after each run

**Example Log** (already implemented):
```typescript
logger.info('Scheduler run completed', {
  worker: 'scheduler',
  runId,
  postsProcessed: posts.length,
  duration_ms: duration,
  metrics: { ...this.metrics },
});
```

**No Changes Needed**: SchedulerWorker already has complete metrics.

---

### STEP 2 — Queue Metrics ✅ (Already Implemented)

**Status**: ✅ COMPLETE

**Current Implementation**:
- QueueManager already provides `getQueueStats()`:
  - `waiting`
  - `active`
  - `failed`
  - `delayed`
  - `completed`
  - `health` status
- PublishingWorker already monitors queue health every 30 seconds

**Example Log** (already implemented):
```typescript
logger.info('Queue health monitor', {
  queue: 'posting-queue',
  waiting: stats.waiting,
  active: stats.active,
  completed: stats.completed,
  failed: stats.failed,
  delayed: stats.delayed,
  total: stats.total,
  failureRate: stats.failureRate,
  health: stats.health,
  timestamp: new Date().toISOString(),
});
```

**No Changes Needed**: Queue metrics already complete.

---

### STEP 3 — Worker Success Metrics ✅ (Already Implemented)

**Status**: ✅ COMPLETE

**Current Implementation**:
- PublishingWorker already tracks:
  - `publish_success_total`
  - `publish_failed_total`
  - `publish_retry_total`
  - `publish_skipped_total`
- Logs structured success events with duration

**Example Log** (already implemented):
```typescript
logger.info('Post published successfully', {
  postId,
  platform: account.provider,
  platformPostId: result.platformPostId,
  publish_duration_ms: duration,
  attempt: currentAttempt,
  status: 'success',
});
```

**No Changes Needed**: Success metrics already complete.

---

### STEP 4 — Worker Failure Logs ✅ (Already Implemented)

**Status**: ✅ COMPLETE

**Current Implementation**:
- PublishingWorker already logs structured failure events
- Uses `classifyError()` for error categorization
- Logs include:
  - `postId`
  - `platform`
  - `error_classification` (retryable/permanent)
  - `currentAttempt`
  - `maxAttempts`
  - `publish_duration_ms`

**Example Log** (already implemented):
```typescript
logger.error('Publishing job failed', {
  jobId: job.id,
  postId,
  error: error.message,
  stack: error.stack,
  currentAttempt,
  maxAttempts,
  publish_duration_ms: duration,
  error_classification: errorClassification,
});
```

**No Changes Needed**: Failure logs already complete.

---

### STEP 5 — Dead Letter Queue Detection ⚠️ (Needs Enhancement)

**Status**: ⚠️ PARTIAL - Needs explicit DLQ event logging

**Current Implementation**:
- PublishingWorker logs final failures
- Sentry captures final failures with `finalFailure: 'true'` tag

**Enhancement Needed**:
Add explicit "dead letter" event log when job exhausts all retries.

**Implementation**:
```typescript
// In PublishingWorker.processJob() catch block
if (currentAttempt === maxAttempts) {
  // Existing code...
  
  // NEW: Explicit dead letter event
  logger.error('Job moved to dead letter queue', {
    event: 'publish_dead_letter',
    postId,
    platform: account.provider,
    error: error.message,
    error_classification: errorClassification,
    attempts: maxAttempts,
    timestamp: new Date().toISOString(),
  });
}
```

---

### STEP 6 — Health Endpoint ⚠️ (Needs Enhancement)

**Status**: ⚠️ PARTIAL - Needs publishing-specific health endpoint

**Current Implementation**:
- `/health` - Basic health check (200/503)
- `/health/detailed` - Comprehensive health (Redis, MongoDB, workers, memory)
- HealthCheckService already checks worker health via QueueManager

**Enhancement Needed**:
Add `/internal/publishing-health` endpoint with publishing-specific metrics.

**Implementation**:
Create new endpoint that returns:
```typescript
{
  scheduler: {
    status: "healthy",
    metrics: {
      runs: number,
      postsProcessed: number,
      jobsCreated: number,
      errors: number
    }
  },
  publishQueue: {
    waiting: number,
    active: number,
    failed: number,
    delayed: number,
    completed: number,
    health: "healthy" | "degraded" | "unhealthy"
  },
  workers: {
    publishingWorker: {
      status: "healthy",
      metrics: {
        success: number,
        failed: number,
        retries: number,
        skipped: number
      }
    }
  }
}
```

---

### STEP 7 — Logging Standard ✅ (Already Implemented)

**Status**: ✅ COMPLETE

**Current Implementation**:
All logs already use structured logging format with:
- `timestamp` (automatic via logger)
- `event` or descriptive message
- `postId`
- `platform`
- `worker`
- `duration_ms` (for timed operations)

**Example** (already implemented):
```typescript
logger.info('Scheduler run completed', {
  worker: 'scheduler',
  runId,
  postsProcessed: posts.length,
  duration_ms: duration,
  metrics: { ...this.metrics },
});
```

**No Changes Needed**: Logging standard already followed.

---

## IMPLEMENTATION SUMMARY

### Already Complete ✅
1. ✅ Scheduler metrics (Step 1)
2. ✅ Queue metrics (Step 2)
3. ✅ Worker success metrics (Step 3)
4. ✅ Worker failure logs (Step 4)
5. ✅ Logging standard (Step 7)

### Needs Implementation ⚠️
1. ⚠️ Dead letter queue explicit event (Step 5)
2. ⚠️ Publishing-specific health endpoint (Step 6)

---

## FILES TO MODIFY

### 1. PublishingWorker.ts
**Change**: Add explicit dead letter event log
**Location**: `processJob()` catch block, final failure section
**Lines**: ~1150-1170

### 2. Create PublishingHealthService.ts (NEW)
**Purpose**: Aggregate publishing system health
**Methods**:
- `getPublishingHealth()` - Returns publishing-specific health status
- Queries SchedulerWorker, QueueManager, PublishingWorker for metrics

### 3. Create publishing-health.routes.ts (NEW)
**Purpose**: Expose `/internal/publishing-health` endpoint
**Route**: `GET /internal/publishing-health`

### 4. Update server.ts
**Change**: Register new publishing health route
**Location**: Route registration section

---

## TESTING CHECKLIST

### Scheduler Metrics
- [x] Metrics logged after each run
- [x] Includes postsProcessed, jobsCreated, duration
- [x] Errors tracked

### Queue Metrics
- [x] Queue stats available via QueueManager
- [x] Health monitor logs every 30 seconds
- [x] Includes waiting, active, failed counts

### Worker Metrics
- [x] Success/failure counters work
- [x] Duration tracked for each publish
- [x] Retry counter increments

### Failure Logs
- [x] Structured error logs
- [x] Error classification included
- [x] Platform and postId logged

### Dead Letter Queue
- [ ] Explicit DLQ event logged on final failure
- [ ] Event includes all required fields

### Health Endpoint
- [ ] `/internal/publishing-health` returns correct structure
- [ ] Scheduler status included
- [ ] Queue stats included
- [ ] Worker metrics included
- [ ] Returns 200 when healthy

---

## DEPLOYMENT STEPS

### 1. Deploy Code
```bash
# Modified files
- src/workers/PublishingWorker.ts (add DLQ event)

# New files
- src/services/PublishingHealthService.ts
- src/routes/internal/publishing-health.routes.ts
```

### 2. Update server.ts
```typescript
// Add publishing health route
import publishingHealthRoutes from './routes/internal/publishing-health.routes';
app.use('/internal', publishingHealthRoutes);
```

### 3. Test Health Endpoint
```bash
curl http://localhost:3000/internal/publishing-health
```

### 4. Monitor Logs
- Check for DLQ events in failed jobs
- Verify structured logging format
- Monitor queue health logs

---

## METRICS TO MONITOR

### Scheduler Metrics
```typescript
{
  scheduler_runs_total: number,
  posts_processed_total: number,
  jobs_created_total: number,
  errors_total: number
}
```

### Queue Metrics
```typescript
{
  waiting: number,
  active: number,
  failed: number,
  delayed: number,
  completed: number,
  health: "healthy" | "degraded" | "unhealthy"
}
```

### Worker Metrics
```typescript
{
  publish_success_total: number,
  publish_failed_total: number,
  publish_retry_total: number,
  publish_skipped_total: number
}
```

### Dead Letter Queue
```typescript
{
  event: "publish_dead_letter",
  postId: string,
  platform: string,
  error: string,
  attempts: number
}
```

---

## CONCLUSION

**Status**: Most observability already implemented in Phase 6.1 and 6.2

**Remaining Work**:
1. Add explicit DLQ event logging (5 minutes)
2. Create publishing health endpoint (30 minutes)

**Total Effort**: ~35 minutes

**Ready for**: Implementation

---

**Plan Version**: 1.0  
**Last Updated**: March 7, 2026  
**Status**: READY FOR IMPLEMENTATION
