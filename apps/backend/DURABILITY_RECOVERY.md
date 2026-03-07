# Durability, Recovery & Backup Infrastructure

## Overview

This document describes the durability, recovery, and backup features implemented to prevent data loss, job loss, and enable disaster recovery.

---

## 1. Dead Letter Queue (DLQ)

### Purpose
Store permanently failed jobs for analysis and manual recovery. Prevents job loss and enables debugging.

### Implementation

**File:** `src/queue/DeadLetterQueue.ts`

**Features:**
- Automatic move of failed jobs after all retries
- Stores complete job data and error information
- Redis index for fast lookup by post ID
- Manual retry capability
- Automatic cleanup of old jobs

**Data Stored:**
```typescript
{
  originalQueue: 'posting-queue',
  originalJobId: 'post-123',
  postId: '123',
  workspaceId: 'ws-456',
  socialAccountId: 'acc-789',
  attempts: 3,
  error: 'Token expired',
  errorStack: '...',
  failedAt: '2024-01-15T10:30:00Z',
  originalData: { /* original job data */ },
  metadata: {
    lastAttemptAt: '2024-01-15T10:29:55Z',
    retryHistory: []
  }
}
```

**Usage:**
```typescript
import { DeadLetterQueue } from './queue/DeadLetterQueue';

const dlq = DeadLetterQueue.getInstance();

// Move failed job to DLQ
await dlq.moveToDeadLetter('posting-queue', job, error);

// Get DLQ job by post ID
const dlqJob = await dlq.getByPostId('post-123');

// Retry job from DLQ
await dlq.retryJob(dlqJobId);

// Get DLQ statistics
const stats = await dlq.getStats();
// { total: 5, waiting: 0, completed: 3, failed: 2 }
```

**Integration with Worker:**
```typescript
// In PublishingWorker.ts
worker.on('failed', async (job, error) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Final failure - move to DLQ
    const dlq = DeadLetterQueue.getInstance();
    await dlq.moveToDeadLetter('posting-queue', job, error);
  }
});
```

---

## 2. Retry Storm Protection

### Purpose
Prevent infinite retry storms that can overwhelm the system. Automatically pauses queue when failure rate is too high.

### Implementation

**File:** `src/queue/RetryStormProtection.ts`

**Configuration:**
```typescript
{
  windowMs: 60000,        // 1 minute window
  maxFailures: 50,        // Max 50 failures in window
  pauseDurationMs: 60000, // Pause for 60 seconds
  checkIntervalMs: 5000   // Check every 5 seconds
}
```

**Behavior:**
1. Tracks failure timestamps in sliding window
2. If failures exceed threshold → pause queue
3. Log ALERT with HIGH severity
4. Automatically resume after pause duration
5. Clear failure history on resume

**Alert Example:**
```json
{
  "level": "error",
  "message": "ALERT: Retry storm detected - Queue paused",
  "queueName": "posting-queue",
  "failureCount": 52,
  "windowMs": 60000,
  "pauseDurationSec": 60,
  "severity": "HIGH",
  "action": "queue_paused",
  "resumeAt": "2024-01-15T10:31:00Z"
}
```

**Usage:**
```typescript
import { RetryStormProtection } from './queue/RetryStormProtection';

const protection = new RetryStormProtection('posting-queue', {
  maxFailures: 50,
  pauseDurationMs: 60000,
});

// Start monitoring
protection.start();

// Record failures
protection.recordFailure();

// Get status
const status = protection.getStatus();
// { isPaused: false, failureCount: 12, failureRate: '0.20/sec' }

// Manual pause/resume
await protection.manualPause();
await protection.manualResume();
```

**Integration with Worker:**
```typescript
// In PublishingWorker.ts
const stormProtection = new RetryStormProtection('posting-queue');
stormProtection.start();

worker.on('failed', (job, error) => {
  stormProtection.recordFailure();
});
```

---

## 3. Redis Durability Configuration

### Purpose
Ensure Redis is safe for queue persistence and can recover from crashes without data loss.

### Implementation

**File:** `config/redis.conf`

**Key Settings:**

#### AOF (Append Only File)
```conf
appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes
```

**Benefits:**
- Every write logged to disk
- Fsync every second (max 1 second data loss)
- Hybrid RDB+AOF format for fast restarts

#### RDB (Snapshots)
```conf
save 900 1      # 15 min if 1 key changed
save 300 10     # 5 min if 10 keys changed
save 60 10000   # 1 min if 10000 keys changed
```

**Benefits:**
- Additional recovery points
- Faster restarts than pure AOF
- Compressed storage

#### Memory Management
```conf
maxmemory-policy noeviction
maxmemory 2gb
```

**CRITICAL:** `noeviction` prevents Redis from evicting queue jobs when memory is full. Returns error instead of losing data.

#### Security
```conf
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

**Benefits:**
- Prevents accidental data deletion
- Disables dangerous commands

### Deployment

**Docker Compose:**
```yaml
redis:
  image: redis:7-alpine
  command: redis-server /usr/local/etc/redis/redis.conf
  volumes:
    - ./config/redis.conf:/usr/local/etc/redis/redis.conf
    - redis-data:/data
  ports:
    - "6379:6379"
```

**Kubernetes:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    appendonly yes
    appendfsync everysec
    maxmemory-policy noeviction
    # ... rest of config
```

---

## 4. Worker Crash Recovery

### Purpose
Recover stalled jobs on worker startup. Prevents job loss and double publishing.

### Implementation

**File:** `src/utils/workerCrashRecovery.ts`

**Recovery Process:**
1. Find all stalled jobs (status = active)
2. Check post status in database
3. Apply idempotency checks:
   - Skip if already published
   - Skip if already failed
   - Skip if cancelled
4. Revert post to scheduled status
5. Move job to waiting for retry
6. **PRESERVE retry count** (don't reset attemptsMade)

**Idempotency Guarantees:**
- Never double-publish
- Never retry published posts
- Preserve retry count across crashes
- Respect cancellations

**Usage:**
```typescript
import { WorkerCrashRecovery } from './utils/workerCrashRecovery';

// On worker startup
const recovery = new WorkerCrashRecovery('posting-queue');
const stats = await recovery.recover();

console.log(stats);
// {
//   stalledJobs: 5,
//   recovered: 3,
//   skipped: 2,
//   failed: 0
// }
```

**Integration:**
```typescript
// In worker-standalone.ts
async function startWorker() {
  // Connect to DB and Redis
  await connectDatabase();
  await connectRedis();

  // Recover stalled jobs BEFORE starting worker
  const recovery = new WorkerCrashRecovery('posting-queue');
  await recovery.recover();

  // Start worker
  const worker = new PublishingWorker();
  worker.start();
}
```

**Recovery Log Example:**
```json
{
  "level": "info",
  "message": "Stalled job recovered",
  "jobId": "post-123",
  "postId": "123",
  "attemptsMade": 1,
  "retryCount": 1
}
```

---

## 5. MongoDB Daily Backup

### Purpose
Automated daily backups with compression, retention, and health checking.

### Implementation

**File:** `scripts/backup-mongodb.sh`

**Features:**
- mongodump with gzip compression
- Tar archive creation
- 7-day retention (configurable)
- Automatic cleanup of old backups
- Integrity verification
- Health check logging
- Success marker for monitoring

**Configuration:**
```bash
BACKUP_DIR=/backups/mongodb
MONGO_URI=mongodb://localhost:27017
MONGO_DB=social-scheduler
RETENTION_DAYS=7
```

**Backup Process:**
1. Run mongodump with gzip
2. Create tar.gz archive
3. Verify integrity
4. Delete old backups (>7 days)
5. Write success marker
6. Log statistics

**Backup Naming:**
```
mongodb_backup_20240115_103000.tar.gz
```

**Usage:**
```bash
# Manual backup
./scripts/backup-mongodb.sh

# Cron job (daily at 2 AM)
0 2 * * * /app/scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

**Docker Integration:**
```yaml
services:
  backup:
    image: mongo:6
    volumes:
      - ./scripts:/scripts
      - backups:/backups
    environment:
      - MONGO_URI=mongodb://mongo:27017
      - MONGO_DB=social-scheduler
    command: /scripts/backup-mongodb.sh
```

**Kubernetes CronJob:**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mongo:6
            command: ["/scripts/backup-mongodb.sh"]
            volumeMounts:
            - name: scripts
              mountPath: /scripts
            - name: backups
              mountPath: /backups
```

**Restore Process:**
```bash
# Extract backup
tar -xzf mongodb_backup_20240115_103000.tar.gz

# Restore database
mongorestore \
  --uri="mongodb://localhost:27017" \
  --db=social-scheduler \
  --gzip \
  mongodb_backup_20240115_103000/social-scheduler
```

---

## 6. Redis Snapshot Backup

### Purpose
Periodic RDB snapshots for Redis data recovery.

### Implementation

**Configuration in redis.conf:**
```conf
# Snapshot every 6 hours (if data changed)
save 21600 1

# RDB file settings
dbfilename dump.rdb
dir /data
rdbcompression yes
rdbchecksum yes
```

**Automatic Snapshots:**
- Every 6 hours if at least 1 key changed
- On Redis shutdown (graceful)
- Manual: `BGSAVE` command

**Backup Process:**
1. Redis creates dump.rdb in /data
2. Copy dump.rdb to backup location
3. Compress and archive
4. Retain for 7 days

**Manual Backup Script:**
```bash
#!/bin/bash
# backup-redis.sh

BACKUP_DIR=/backups/redis
DATE=$(date +%Y%m%d_%H%M%S)

# Trigger snapshot
redis-cli BGSAVE

# Wait for snapshot to complete
while [ $(redis-cli LASTSAVE) -eq $LAST_SAVE ]; do
  sleep 1
done

# Copy snapshot
cp /data/dump.rdb "$BACKUP_DIR/redis_backup_${DATE}.rdb"

# Compress
gzip "$BACKUP_DIR/redis_backup_${DATE}.rdb"

# Clean old backups
find "$BACKUP_DIR" -name "redis_backup_*.rdb.gz" -mtime +7 -delete
```

**Restore Process:**
```bash
# Stop Redis
redis-cli SHUTDOWN

# Replace dump.rdb
cp redis_backup_20240115_103000.rdb /data/dump.rdb

# Start Redis
redis-server /etc/redis/redis.conf
```

---

## 7. Backup Health Check

### Purpose
Monitor backup status and alert on failures. Ensures backups are running successfully.

### Implementation

**File:** `src/utils/backupHealthCheck.ts`

**Checks:**
1. **MongoDB Backup:**
   - Last backup timestamp
   - Backup age (must be <26 hours)
   - Success/failure status

2. **Redis Snapshot:**
   - Last snapshot timestamp
   - Snapshot age (must be <8 hours)
   - File existence

**Health Status:**
```typescript
{
  mongodb: {
    lastBackup: '2024-01-15T02:00:00Z',
    status: 'success',
    ageHours: 8.5,
    healthy: true
  },
  redis: {
    lastSnapshot: '2024-01-15T06:00:00Z',
    status: 'success',
    ageHours: 4.5,
    healthy: true
  },
  overall: {
    healthy: true,
    alerts: []
  }
}
```

**Alert Examples:**
```json
{
  "level": "error",
  "message": "ALERT: MongoDB backup is stale",
  "lastBackup": "2024-01-14T02:00:00Z",
  "ageHours": 32.5,
  "maxAgeHours": 26,
  "severity": "HIGH"
}
```

```json
{
  "level": "error",
  "message": "ALERT: MongoDB backup failed",
  "status": "failed",
  "severity": "CRITICAL"
}
```

**Usage:**
```typescript
import { BackupHealthCheck } from './utils/backupHealthCheck';

const healthCheck = new BackupHealthCheck(
  '/backups/mongodb',  // MongoDB backup dir
  '/data',             // Redis data dir
  26                   // Max backup age (hours)
);

// Manual check
const health = await healthCheck.check();

// Start periodic monitoring (every hour)
const interval = healthCheck.startMonitoring(3600000);
```

**Integration with Monitoring Service:**
```typescript
// In MonitoringService.ts
import { BackupHealthCheck } from '../utils/backupHealthCheck';

class MonitoringService {
  private backupHealthCheck: BackupHealthCheck;

  constructor() {
    this.backupHealthCheck = new BackupHealthCheck();
  }

  start() {
    // Check backups every hour
    this.backupHealthCheck.startMonitoring(3600000);
  }
}
```

---

## Protection Summary

### Job Loss Prevention
✅ **Dead Letter Queue** - Permanently failed jobs stored for recovery
✅ **Worker crash recovery** - Stalled jobs recovered on startup
✅ **Idempotency checks** - Never double-publish posts
✅ **Redis AOF** - Every write logged to disk
✅ **Redis RDB** - Periodic snapshots for recovery

### Queue Corruption Prevention
✅ **Retry storm protection** - Auto-pause on excessive failures
✅ **Distributed locks** - Prevent race conditions
✅ **Atomic operations** - Consistent state updates
✅ **noeviction policy** - Never evict queue jobs

### Data Loss Prevention
✅ **MongoDB daily backups** - Automated with 7-day retention
✅ **Redis snapshots** - Every 6 hours
✅ **AOF persistence** - Max 1 second data loss
✅ **Backup verification** - Integrity checks
✅ **Backup health monitoring** - Alerts on failures

### Infinite Retry Storm Prevention
✅ **Failure rate tracking** - Sliding window counter
✅ **Automatic queue pause** - When threshold exceeded
✅ **Automatic resume** - After cooldown period
✅ **Alert logging** - HIGH severity alerts
✅ **Manual controls** - Pause/resume capability

---

## Monitoring & Alerts

### Key Metrics

**DLQ Metrics:**
- Total jobs in DLQ
- DLQ growth rate
- Jobs by error type

**Retry Storm Metrics:**
- Failure rate (failures/sec)
- Queue pause events
- Pause duration

**Backup Metrics:**
- Last backup timestamp
- Backup age (hours)
- Backup size
- Success/failure rate

**Recovery Metrics:**
- Stalled jobs found
- Jobs recovered
- Jobs skipped (already published)
- Recovery failures

### Alert Thresholds

**CRITICAL:**
- MongoDB backup failed
- MongoDB backup status unknown
- DLQ growing rapidly (>100 jobs/hour)

**HIGH:**
- MongoDB backup >26 hours old
- Redis snapshot not found
- Retry storm detected (queue paused)
- Worker crash recovery failed

**MEDIUM:**
- Redis snapshot >8 hours old
- DLQ has >50 jobs
- Backup size growing rapidly

### Alert Destinations

1. **Logs** - All alerts logged with severity
2. **Monitoring Service** - Aggregates alerts
3. **External Services** - PagerDuty, Slack, etc.

---

## Disaster Recovery Procedures

### Scenario 1: Worker Crash

**Detection:**
- Worker process exits unexpectedly
- Jobs stuck in "active" state

**Recovery:**
1. Restart worker process
2. Worker crash recovery runs automatically
3. Stalled jobs recovered and retried
4. Check logs for recovery stats

**Prevention:**
- Process manager (PM2, systemd)
- Health checks
- Auto-restart on crash

### Scenario 2: Redis Crash

**Detection:**
- Redis connection errors
- Queue operations failing

**Recovery:**
1. Restart Redis
2. Redis loads AOF file
3. Queue state restored (max 1 second loss)
4. Workers reconnect automatically

**Prevention:**
- Redis Sentinel for HA
- AOF + RDB persistence
- Connection retry logic

### Scenario 3: MongoDB Crash

**Detection:**
- Database connection errors
- Post queries failing

**Recovery:**
1. Restart MongoDB
2. Database recovers from journal
3. Application reconnects automatically
4. If corruption: restore from backup

**Restore from Backup:**
```bash
# Stop application
systemctl stop app

# Restore database
mongorestore \
  --uri="mongodb://localhost:27017" \
  --db=social-scheduler \
  --drop \
  --gzip \
  mongodb_backup_20240115_020000/social-scheduler

# Start application
systemctl start app
```

### Scenario 4: Complete System Failure

**Recovery:**
1. Provision new infrastructure
2. Restore MongoDB from latest backup
3. Restore Redis from latest snapshot
4. Deploy application
5. Run worker crash recovery
6. Verify queue health
7. Resume operations

**Data Loss:**
- MongoDB: Max 24 hours (last backup)
- Redis: Max 6 hours (last snapshot)
- In-flight jobs: Recovered via crash recovery

---

## Testing Procedures

### Test DLQ
```bash
# Create failing job
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"Test","forceFail":true}'

# Wait for retries to exhaust
sleep 180

# Check DLQ
curl http://localhost:3000/api/queue/dlq/stats
```

### Test Retry Storm Protection
```bash
# Simulate 51 failures in 1 minute
for i in {1..51}; do
  curl -X POST http://localhost:3000/api/posts \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"content":"Test '$i'","forceFail":true}' &
done

# Check if queue paused
curl http://localhost:3000/api/queue/stats
```

### Test Worker Crash Recovery
```bash
# Start worker
npm run worker

# Kill worker mid-job
kill -9 $(pgrep -f worker)

# Restart worker
npm run worker

# Check recovery logs
tail -f logs/application.log | grep "crash recovery"
```

### Test Backup Health
```bash
# Run backup
./scripts/backup-mongodb.sh

# Check health
curl http://localhost:3000/health/backups
```

---

## Configuration

### Environment Variables
```bash
# Backup directories
BACKUP_DIR=/backups
MONGO_BACKUP_DIR=/backups/mongodb
REDIS_DATA_DIR=/data

# Backup retention
BACKUP_RETENTION_DAYS=7

# MongoDB connection
MONGO_URI=mongodb://localhost:27017
MONGO_DB=social-scheduler

# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Retry storm protection
RETRY_STORM_MAX_FAILURES=50
RETRY_STORM_WINDOW_MS=60000
RETRY_STORM_PAUSE_MS=60000

# Health check intervals
BACKUP_HEALTH_CHECK_INTERVAL_MS=3600000  # 1 hour
```

### Cron Jobs
```cron
# MongoDB backup (daily at 2 AM)
0 2 * * * /app/scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1

# Redis backup (every 6 hours)
0 */6 * * * /app/scripts/backup-redis.sh >> /var/log/redis-backup.log 2>&1

# Backup cleanup (weekly)
0 3 * * 0 find /backups -mtime +7 -delete
```

---

## Summary

✅ **Dead Letter Queue** - Failed jobs stored for recovery
✅ **Retry storm protection** - Auto-pause on excessive failures
✅ **Redis durability** - AOF + RDB + noeviction
✅ **Worker crash recovery** - Stalled jobs recovered safely
✅ **MongoDB daily backups** - Automated with retention
✅ **Redis snapshots** - Every 6 hours
✅ **Backup health checks** - Alerts on failures

**All features are production-ready and tested for durability and recovery.**
