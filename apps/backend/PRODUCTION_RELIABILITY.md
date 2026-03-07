# Production Reliability Infrastructure

## Overview

Production-grade reliability features without changing business logic:
- Health endpoint for monitoring
- Graceful shutdown handling
- Stalled job auto-recovery
- Alert logging system
- System monitoring

---

## 1. Health Endpoint

**File**: `src/controllers/HealthController.ts`

### Endpoint

```
GET /health
```

### Response

```json
{
  "status": "ok" | "degraded",
  "uptime": 12345,
  "timestamp": "2024-01-15T10:00:00Z",
  "memory": {
    "used": 256,
    "total": 512,
    "percentage": 50.0
  },
  "dependencies": {
    "db": "ok" | "fail",
    "redis": "ok" | "fail",
    "queue": "ok" | "fail",
    "worker": "ok" | "fail"
  }
}
```

### Status Codes

- **200 OK**: All systems operational
- **503 Service Unavailable**: System degraded

### Features

- **Never crashes**: Returns response even if checks fail
- **Timeout protection**: Each check has 5s timeout
- **Parallel checks**: All dependencies checked simultaneously
- **Worker heartbeat**: Checks if worker is alive (< 120s)
- **Memory monitoring**: Reports heap usage

### Dependency Checks

**Database**:
```typescript
// Ping MongoDB with timeout
await mongoose.connection.db.admin().ping();
```

**Redis**:
```typescript
// Ping Redis with timeout
await redisClient.ping();
```

**Queue**:
```typescript
// Get queue stats to verify responsiveness
await queueManager.getQueueStats();
```

**Worker**:
```typescript
// Check heartbeat timestamp from Redis
const heartbeat = await redisClient.get('worker:heartbeat');
const timeSinceHeartbeat = now - heartbeat;
// Fail if > 120 seconds
```

### Usage

**Kubernetes Liveness Probe**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Docker Health Check**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1
```

---

## 2. Graceful Shutdown

**File**: `src/utils/gracefulShutdown.ts`

### Signals Handled

- **SIGTERM**: Docker/Kubernetes shutdown
- **SIGINT**: Ctrl+C (development)
- **uncaughtException**: Unhandled errors
- **unhandledRejection**: Unhandled promise rejections

### Shutdown Sequence

```
1. Stop accepting new HTTP requests
   ↓
2. Stop scheduler (no new jobs enqueued)
   ↓
3. Stop worker (finish active jobs, max 30s)
   ↓
4. Close queue connections
   ↓
5. Close Redis connection
   ↓
6. Close database connection
   ↓
7. Exit process (code 0)
```

### Timeout Protection

- **30 second timeout**: Forces exit if shutdown takes too long
- **Prevents hanging**: Ensures process terminates

### Implementation

```typescript
// In server.ts
import { registerShutdownHandlers } from './utils/gracefulShutdown';

const server = app.listen(PORT);
registerShutdownHandlers(server);
```

### Logs

```
[INFO] SIGTERM signal received
[INFO] Graceful shutdown initiated
[INFO] Stopping HTTP server...
[INFO] HTTP server closed
[INFO] Stopping scheduler...
[INFO] Scheduler stopped
[INFO] Stopping worker...
[INFO] Worker stopped
[INFO] Closing queue...
[INFO] Queue closed
[INFO] Closing Redis connection...
[INFO] Redis connection closed
[INFO] Closing database connection...
[INFO] Database connection closed
[INFO] Graceful shutdown completed successfully
```

### Error Handling

If any step fails:
- Logs error
- Continues to next step
- Ensures cleanup completes
- Exits with code 1 if errors occurred

---

## 3. Stalled Job Auto-Recovery

**File**: `src/utils/stalledJobRecovery.ts`

### Problem

Worker crashes can leave jobs in "active" state:
- Job never completes
- Post stuck in "publishing" status
- No retry attempted

### Solution

Automatic detection and recovery of stalled jobs.

### Detection Logic

```typescript
// Job is stalled if:
1. State is "active"
2. No lock exists OR lock is > 10 minutes old
3. Worker not processing it
```

### Recovery Flow

```
Detect stalled job
    ↓
Check if post was published
    ↓ (yes)
Mark job as completed
    ↓ (no)
Check retry count
    ↓ (< max)
Requeue job (preserve retry count)
    ↓ (>= max)
Mark job as failed
Update post status
```

### Features

**Prevents Double Publishing**:
```typescript
// Check if post has platformPostIds
if (post.platformPostIds && Object.keys(post.platformPostIds).length > 0) {
  // Already published, mark job as completed
  await job.moveToCompleted({ success: true, recovered: true });
}
```

**Preserves Retry Count**:
```typescript
// Requeue with same attempt count
await job.retry('stalled');
// attemptsMade is preserved
```

**Handles Max Retries**:
```typescript
if (job.attemptsMade >= maxAttempts) {
  // Mark as failed, don't retry
  await job.moveToFailed(new Error('Job stalled after max attempts'));
}
```

### Usage

**On Worker Startup**:
```typescript
import { StalledJobRecovery } from './utils/stalledJobRecovery';

const recovery = new StalledJobRecovery(queue);
await recovery.recoverStalledJobs();
```

**Periodic Monitoring**:
```typescript
import { startStalledJobMonitoring } from './utils/stalledJobRecovery';

// Monitor every 5 minutes
const interval = startStalledJobMonitoring(queue);
```

### Logs

```
[INFO] Starting stalled job recovery...
[INFO] Found potentially stalled jobs: 3
[INFO] Recovering stalled job: jobId=123, postId=abc, attemptsMade=1
[INFO] Requeuing stalled job: jobId=123
[INFO] Stalled job recovered successfully
[INFO] Stalled job recovery completed: total=3, recovered=2, skipped=1
```

---

## 4. Alert Logging System

**File**: `src/utils/alertLogger.ts`

### Severity Levels

- **CRITICAL**: System down, immediate action required
- **HIGH**: Major issue, action required soon
- **MEDIUM**: Warning, monitor closely
- **LOW**: Informational, no action required

### Alert Types

**Worker Heartbeat Stopped**:
```typescript
alertLogger.workerHeartbeatStopped(timeSinceLastHeartbeat);
// [ALERT][CRITICAL] Worker heartbeat stopped
```

**Queue Failed Threshold**:
```typescript
alertLogger.queueFailedThreshold(failedCount, threshold);
// [ALERT][HIGH] Queue failed jobs exceeded threshold
```

**Queue Waiting Growing**:
```typescript
alertLogger.queueWaitingGrowing(waitingCount, previousCount);
// [ALERT][MEDIUM] Queue waiting jobs growing rapidly
```

**Billing Webhook Error**:
```typescript
alertLogger.billingWebhookError(eventType, error);
// [ALERT][HIGH] Billing webhook processing failed
```

**Token Refresh Failed**:
```typescript
alertLogger.tokenRefreshFailed(accountId, platform, error);
// [ALERT][MEDIUM] Token refresh failed
```

**Database Connection Lost**:
```typescript
alertLogger.databaseConnectionLost(error);
// [ALERT][CRITICAL] Database connection lost
```

**Redis Connection Lost**:
```typescript
alertLogger.redisConnectionLost(error);
// [ALERT][CRITICAL] Redis connection lost
```

**High Memory Usage**:
```typescript
alertLogger.highMemoryUsage(usedMB, totalMB, percentage);
// [ALERT][HIGH] High memory usage detected
```

**Stalled Jobs Detected**:
```typescript
alertLogger.stalledJobsDetected(count);
// [ALERT][MEDIUM] Stalled jobs detected
```

**Scheduler Stopped**:
```typescript
alertLogger.schedulerStopped(error);
// [ALERT][CRITICAL] Scheduler stopped unexpectedly
```

### Log Format

```json
{
  "alert": true,
  "severity": "CRITICAL",
  "message": "Worker heartbeat stopped",
  "timestamp": "2024-01-15T10:00:00Z",
  "timeSinceLastHeartbeat": 180,
  "threshold": 120,
  "unit": "seconds"
}
```

### Integration Points

**In Worker**:
```typescript
// If heartbeat fails
alertLogger.workerHeartbeatStopped(timeSinceHeartbeat);
```

**In Queue Manager**:
```typescript
// If failed jobs exceed threshold
if (stats.failed > 100) {
  alertLogger.queueFailedThreshold(stats.failed, 100);
}
```

**In Webhook Controller**:
```typescript
catch (error) {
  alertLogger.billingWebhookError(event.type, error.message);
}
```

**In Token Service**:
```typescript
catch (error) {
  alertLogger.tokenRefreshFailed(accountId, platform, error.message);
}
```

### External Integration

Extend to send alerts to:
- **PagerDuty**: Critical alerts
- **Slack**: All alerts
- **Email**: High/Critical alerts
- **SMS**: Critical alerts only

```typescript
// In alertLogger.ts
private async sendToMonitoring(alert: AlertLog): Promise<void> {
  // Send to PagerDuty
  if (alert.severity === AlertSeverity.CRITICAL) {
    await pagerDuty.trigger(alert);
  }
  
  // Send to Slack
  await slack.send(alert);
  
  // Send email
  if (alert.severity === AlertSeverity.HIGH || alert.severity === AlertSeverity.CRITICAL) {
    await email.send(alert);
  }
}
```

---

## 5. System Monitoring

**File**: `src/services/MonitoringService.ts`

### Features

- **Worker heartbeat monitoring**: Checks every 60s
- **Queue health monitoring**: Tracks failed/waiting jobs
- **Memory usage monitoring**: Alerts if > 85%
- **Automatic alerting**: Triggers alerts on thresholds

### Monitoring Checks

**Worker Heartbeat**:
```typescript
// Check if heartbeat > 120 seconds
if (timeSinceHeartbeat > 120000) {
  alertLogger.workerHeartbeatStopped(timeSinceHeartbeat);
}
```

**Queue Failed Jobs**:
```typescript
// Alert if failed jobs > 100
if (stats.failed > 100) {
  alertLogger.queueFailedThreshold(stats.failed, 100);
}
```

**Queue Waiting Growth**:
```typescript
// Alert if waiting jobs increased > 50%
if (currentWaiting > previousWaiting * 1.5) {
  alertLogger.queueWaitingGrowing(currentWaiting, previousWaiting);
}
```

**Memory Usage**:
```typescript
// Alert if memory > 85%
if (percentage > 85) {
  alertLogger.highMemoryUsage(usedMB, totalMB, percentage);
}
```

### Usage

**Start Monitoring**:
```typescript
import { monitoringService } from './services/MonitoringService';

// Start on server startup
monitoringService.start();
```

**Stop Monitoring**:
```typescript
// Stop on graceful shutdown
monitoringService.stop();
```

**Get Stats**:
```typescript
const stats = await monitoringService.getStats();
// Returns: workerHeartbeat, queue, memory
```

---

## 6. Integration Guide

### Server Startup

```typescript
// src/server.ts
import { registerShutdownHandlers } from './utils/gracefulShutdown';
import { startStalledJobMonitoring } from './utils/stalledJobRecovery';
import { monitoringService } from './services/MonitoringService';

// Start server
const server = app.listen(PORT);

// Register shutdown handlers
registerShutdownHandlers(server);

// Start stalled job monitoring
startStalledJobMonitoring(postingQueue);

// Start system monitoring
monitoringService.start();
```

### Health Route

```typescript
// src/routes/health.routes.ts
import { Router } from 'express';
import { healthController } from '../controllers/HealthController';

const router = Router();

router.get('/health', (req, res) => healthController.getHealth(req, res));

export default router;
```

### Worker Heartbeat

```typescript
// In PublishingWorker
setInterval(async () => {
  await redisClient.set('worker:heartbeat', Date.now().toString());
}, 60000); // Every 60 seconds
```

---

## 7. Monitoring Dashboard

### Metrics to Track

1. **Health Status**: ok/degraded
2. **Uptime**: Process uptime in seconds
3. **Memory Usage**: Used/Total/Percentage
4. **Worker Heartbeat**: Last heartbeat timestamp
5. **Queue Stats**: Waiting/Active/Completed/Failed
6. **Alert Count**: By severity level

### Grafana Dashboard

```json
{
  "panels": [
    {
      "title": "Health Status",
      "targets": [
        { "expr": "health_status" }
      ]
    },
    {
      "title": "Memory Usage",
      "targets": [
        { "expr": "memory_percentage" }
      ]
    },
    {
      "title": "Queue Stats",
      "targets": [
        { "expr": "queue_waiting" },
        { "expr": "queue_failed" }
      ]
    },
    {
      "title": "Worker Heartbeat",
      "targets": [
        { "expr": "worker_heartbeat_age" }
      ]
    }
  ]
}
```

---

## 8. Testing

### Health Endpoint

```bash
# Test health endpoint
curl http://localhost:5000/health

# Expected: 200 OK with JSON response
```

### Graceful Shutdown

```bash
# Send SIGTERM
kill -TERM <pid>

# Check logs for shutdown sequence
# Expected: Clean shutdown in < 30s
```

### Stalled Job Recovery

```bash
# Simulate worker crash
kill -9 <worker-pid>

# Restart worker
npm run worker

# Check logs for recovery
# Expected: Stalled jobs detected and recovered
```

### Alert Logging

```bash
# Trigger alert
# Stop worker for > 120s

# Check logs
grep "[ALERT]" logs/app.log

# Expected: Worker heartbeat stopped alert
```

---

## 9. Production Checklist

- [ ] Health endpoint configured
- [ ] Kubernetes liveness probe added
- [ ] Graceful shutdown handlers registered
- [ ] Stalled job monitoring started
- [ ] System monitoring started
- [ ] Alert logging integrated
- [ ] External monitoring configured (PagerDuty/Slack)
- [ ] Grafana dashboard created
- [ ] Log aggregation configured (ELK/Datadog)
- [ ] Backup and recovery tested

---

## Summary

Production reliability infrastructure:
- ✅ Health endpoint (never crashes, 5s timeout)
- ✅ Graceful shutdown (30s max, clean cleanup)
- ✅ Stalled job recovery (auto-detect, preserve retries)
- ✅ Alert logging (4 severity levels, extensible)
- ✅ System monitoring (60s interval, automatic alerts)

All features are non-invasive and don't change business logic.
Ready for production deployment! 🚀
