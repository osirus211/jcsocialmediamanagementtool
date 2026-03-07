# Phase 6.5 — Production Hardening - Implementation Plan

**Date**: March 7, 2026  
**Status**: PLANNING  
**Goal**: Prepare publishing system for stable production operation

---

## OVERVIEW

Phase 6.1-6.4 are complete:
- ✅ Multi-platform fanout & idempotency (6.1)
- ✅ SchedulerWorker & media pipeline (6.2)
- ✅ Observability & monitoring (6.3)
- ✅ Load testing tools (6.4)

Phase 6.5 focuses on production reliability and operational safety:
- Worker management and crash recovery
- Queue monitoring and alerting
- Redis resilience
- Docker deployment

---

## IMPLEMENTATION STEPS

### STEP 1 — Worker Manager

**Purpose**: Centralized worker lifecycle management

**File**: `src/services/WorkerManager.ts`

**Features**:
- Start all workers (PublishingWorker, SchedulerWorker, MediaProcessingWorker, TokenRefreshWorker)
- Graceful shutdown (stop accepting jobs, finish active jobs)
- Worker crash detection and restart
- Health status reporting
- Coordinated startup/shutdown

**Workers to Manage**:
1. PublishingWorker - Publishes posts to platforms
2. SchedulerWorker - Schedules posts for publishing
3. MediaProcessingWorker - Processes media uploads
4. TokenRefreshWorker - Refreshes OAuth tokens

**Methods**:
- `startAll()` - Start all workers
- `stopAll()` - Gracefully stop all workers
- `restartWorker(name)` - Restart specific worker
- `getStatus()` - Get all worker statuses
- `handleCrash(name, error)` - Handle worker crash

**Crash Recovery**:
- Detect worker crashes via error events
- Log crash details
- Attempt restart (max 3 retries)
- Alert if restart fails

---

### STEP 2 — Queue Monitoring Service

**Purpose**: Monitor queue health and expose metrics

**File**: `src/services/QueueMonitoringService.ts`

**Features**:
- Monitor all queues (posting, media, token-refresh, scheduler)
- Collect queue statistics
- Expose metrics endpoint
- Alert on threshold violations
- Historical metrics tracking

**Queues to Monitor**:
1. posting-queue - Publishing jobs
2. media-queue - Media processing jobs
3. token-refresh-queue - Token refresh jobs
4. scheduler-queue - Scheduler jobs

**Metrics per Queue**:
- waiting - Jobs waiting to be processed
- active - Jobs currently being processed
- failed - Jobs that failed
- delayed - Jobs scheduled for future
- completed - Jobs completed successfully
- failureRate - Percentage of failed jobs

**Methods**:
- `startMonitoring()` - Start periodic monitoring
- `stopMonitoring()` - Stop monitoring
- `getQueueStats(queueName)` - Get stats for specific queue
- `getAllQueueStats()` - Get stats for all queues
- `checkAlertConditions()` - Check if alerts should fire

---

### STEP 3 — Alert Conditions

**Purpose**: Log warnings when thresholds exceeded

**Implementation**: Add to QueueMonitoringService

**Alert Conditions**:
1. **High Queue Backlog**
   - Condition: `publishQueue.waiting > 1000`
   - Log: `{ alert: "high_queue_backlog", queue: "posting-queue", waiting: 1500 }`

2. **High Scheduler Errors**
   - Condition: `schedulerErrors > 5` (in last hour)
   - Log: `{ alert: "high_scheduler_errors", errors: 7, period: "1h" }`

3. **High Publish Failure Rate**
   - Condition: `publishFailureRate > 5%`
   - Log: `{ alert: "high_failure_rate", rate: 7.5, threshold: 5 }`

4. **Queue Stalled**
   - Condition: No jobs processed in 5 minutes
   - Log: `{ alert: "queue_stalled", queue: "posting-queue", lastActivity: "5m ago" }`

5. **Worker Crash**
   - Condition: Worker exits unexpectedly
   - Log: `{ alert: "worker_crashed", worker: "publishing-worker", error: "..." }`

**Structured Logging Format**:
```typescript
logger.warn('Alert triggered', {
  alert: 'high_queue_backlog',
  severity: 'warning',
  queue: 'posting-queue',
  metric: 'waiting',
  value: 1500,
  threshold: 1000,
  timestamp: new Date().toISOString(),
});
```

---

### STEP 4 — Redis Resilience

**Purpose**: Improve Redis connection reliability

**File**: `src/config/redis.ts` (modify existing)

**Improvements**:
1. **Connection Retry**
   - Retry on connection failure
   - Exponential backoff (1s, 2s, 4s, 8s, 16s)
   - Max retries: 10
   - Log each retry attempt

2. **Connection Health Logging**
   - Log connection events (connect, ready, error, close)
   - Track connection uptime
   - Monitor reconnection attempts

3. **Graceful Degradation**
   - Continue operation if Redis temporarily unavailable
   - Queue operations for retry
   - Alert on extended outage

4. **Connection Pool**
   - Configure connection pool size
   - Monitor pool utilization
   - Prevent connection exhaustion

**Configuration**:
```typescript
{
  retryStrategy: (times) => {
    if (times > 10) return null; // Stop retrying
    return Math.min(times * 1000, 16000); // Exponential backoff
  },
  reconnectOnError: (err) => {
    logger.error('Redis error', { error: err.message });
    return true; // Always try to reconnect
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
}
```

---

### STEP 5 — Worker Crash Recovery

**Purpose**: Ensure workers restart on failures

**Implementation**: Add to WorkerManager

**Recovery Strategies**:

1. **Redis Disconnect Recovery**
   - Listen for Redis disconnect events
   - Pause workers (stop accepting jobs)
   - Wait for Redis reconnection
   - Resume workers when Redis ready

2. **Worker Error Recovery**
   - Listen for worker error events
   - Log error details
   - Attempt restart (max 3 times)
   - Alert if restart fails

3. **Stalled Job Recovery**
   - Listen for stalled job events
   - Log stalled job details
   - Job automatically retried by BullMQ
   - Alert if jobs frequently stall

4. **Failed Job Recovery**
   - Listen for failed job events
   - Log failure details
   - Check if permanent or transient
   - Move to DLQ if permanent

**Event Listeners**:
```typescript
worker.on('error', (error) => {
  logger.error('Worker error', { worker: name, error: error.message });
  this.handleWorkerError(name, error);
});

worker.on('stalled', (jobId) => {
  logger.warn('Job stalled', { worker: name, jobId });
  this.metrics.stalledJobs++;
});

worker.on('failed', (job, error) => {
  logger.error('Job failed', { worker: name, jobId: job?.id, error: error.message });
  this.handleJobFailure(name, job, error);
});
```

---

### STEP 6 — Docker Deployment

**Purpose**: Production-ready Docker deployment

**File**: `docker-compose.prod.yml`

**Containers**:
1. **api** - Express API server
2. **workers** - All background workers
3. **redis** - Redis cache/queue
4. **mongo** - MongoDB database

**Key Features**:
- Workers run independently from API
- Health checks for all services
- Restart policies (always restart)
- Resource limits (CPU, memory)
- Volume mounts for persistence
- Network isolation
- Environment variables

**docker-compose.prod.yml**:
```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/social-scheduler
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  workers:
    build:
      context: .
      dockerfile: Dockerfile.workers
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/social-scheduler
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    restart: always
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: always
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  redis-data:
  mongo-data:
```

**Dockerfile.workers**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "dist/workers-standalone.js"]
```

---

## DIRECTORY STRUCTURE

```
apps/backend/
├── src/
│   ├── services/
│   │   ├── WorkerManager.ts (NEW)
│   │   └── QueueMonitoringService.ts (NEW)
│   ├── config/
│   │   └── redis.ts (MODIFY)
│   └── workers-standalone.ts (NEW)
├── docker-compose.prod.yml (NEW)
├── Dockerfile.api (NEW)
└── Dockerfile.workers (NEW)
```

---

## IMPLEMENTATION CHECKLIST

### Step 1: Worker Manager
- [ ] Create WorkerManager.ts
- [ ] Implement startAll()
- [ ] Implement stopAll()
- [ ] Implement crash detection
- [ ] Implement restart logic
- [ ] Add health status reporting
- [ ] Test graceful shutdown

### Step 2: Queue Monitoring Service
- [ ] Create QueueMonitoringService.ts
- [ ] Implement periodic monitoring
- [ ] Collect queue statistics
- [ ] Expose metrics endpoint
- [ ] Add historical tracking
- [ ] Test with all queues

### Step 3: Alert Conditions
- [ ] Add high backlog alert
- [ ] Add high error rate alert
- [ ] Add high failure rate alert
- [ ] Add queue stalled alert
- [ ] Add worker crash alert
- [ ] Test alert triggering

### Step 4: Redis Resilience
- [ ] Add retry strategy
- [ ] Add exponential backoff
- [ ] Add connection health logging
- [ ] Add reconnection handling
- [ ] Test disconnect scenarios
- [ ] Test reconnection

### Step 5: Worker Crash Recovery
- [ ] Add error event listeners
- [ ] Add stalled event listeners
- [ ] Add failed event listeners
- [ ] Implement restart logic
- [ ] Test crash recovery
- [ ] Test Redis disconnect recovery

### Step 6: Docker Deployment
- [ ] Create docker-compose.prod.yml
- [ ] Create Dockerfile.api
- [ ] Create Dockerfile.workers
- [ ] Create workers-standalone.ts
- [ ] Add health checks
- [ ] Add resource limits
- [ ] Test deployment

---

## TESTING PLAN

### Worker Manager Testing
1. Start all workers - verify all start successfully
2. Stop all workers - verify graceful shutdown
3. Crash worker - verify restart
4. Multiple crashes - verify max retry limit
5. Health status - verify accurate reporting

### Queue Monitoring Testing
1. Normal load - verify metrics collected
2. High backlog - verify alert triggered
3. High failure rate - verify alert triggered
4. Queue stalled - verify alert triggered
5. Historical metrics - verify tracking

### Redis Resilience Testing
1. Redis disconnect - verify retry
2. Redis reconnect - verify recovery
3. Extended outage - verify graceful degradation
4. Connection pool - verify no exhaustion

### Worker Crash Recovery Testing
1. Worker error - verify restart
2. Redis disconnect - verify pause/resume
3. Stalled jobs - verify recovery
4. Failed jobs - verify DLQ

### Docker Deployment Testing
1. Build images - verify successful build
2. Start services - verify all start
3. Health checks - verify passing
4. API requests - verify working
5. Worker processing - verify working
6. Restart services - verify recovery

---

## SUCCESS CRITERIA

### Reliability
- ✅ Workers restart automatically on crash
- ✅ System recovers from Redis disconnect
- ✅ Graceful shutdown (no job loss)
- ✅ Alert on threshold violations

### Monitoring
- ✅ Queue metrics exposed
- ✅ Worker health status available
- ✅ Historical metrics tracked
- ✅ Structured logging

### Deployment
- ✅ Docker deployment works
- ✅ Workers run independently
- ✅ Health checks pass
- ✅ Resource limits enforced

### Operational Safety
- ✅ No data loss on restart
- ✅ No duplicate processing
- ✅ Automatic recovery
- ✅ Clear alerting

---

## CONCLUSION

**Status**: Ready for implementation

**Estimated Time**: 6-8 hours

**Files to Create**: 6 files

**Files to Modify**: 1 file

**Ready for**: Production hardening implementation

---

**Plan Version**: 1.0  
**Last Updated**: March 7, 2026  
**Status**: READY FOR IMPLEMENTATION
