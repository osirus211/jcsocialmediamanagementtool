# Runtime System Validation Guide

**Purpose:** Manual production testing and system state inspection  
**Mode:** READ-ONLY - No code modifications

---

## Quick Validation

### Option 1: Run Validation Script

```bash
cd apps/backend
tsx scripts/validate-runtime.ts
```

**Output Format:**
```
1️⃣  INFRASTRUCTURE HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MongoDB:   ✅ OK
   Redis:     ✅ OK
   Worker:    ✅ OK
   Scheduler: ✅ OK
   Queue:     ✅ OK

2️⃣  QUEUE STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Waiting:   5
   Active:    2
   Completed: 1234
   Failed:    3
   Delayed:   0
   Paused:    false

3️⃣  WORKER HEARTBEAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Last Heartbeat: 2026-02-15T10:30:45.123Z
   Active Jobs:    2
   Memory Usage:   256 MB
   Uptime:         3600s
   Healthy:        ✅ YES

4️⃣  FAILED JOBS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [1] Job ID: publish-post-123
       Post ID:   507f1f77bcf86cd799439011
       Error:     Social account token expired
       Attempts:  3
       Failed At: 2026-02-15T10:25:00.000Z

5️⃣  BACKUP HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MongoDB Backup:
     Last Backup: 2026-02-15T02:00:00.000Z
     Status:      SUCCESS
     Age:         8.5 hours
     Healthy:     ✅ YES

   Redis Snapshot:
     Last Snapshot: 2026-02-15T08:00:00.000Z
     Status:        SUCCESS
     Age:           2.5 hours
     Healthy:       ✅ YES

6️⃣  SYSTEM STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ SYSTEM_STATUS = HEALTHY
```

---

### Option 2: Health Check Endpoint

```bash
# Basic health check
curl http://localhost:5000/health

# Expected response (200 OK):
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-02-15T10:30:45.123Z",
  "memory": {
    "used": 256,
    "total": 512,
    "percentage": 50.0
  },
  "dependencies": {
    "db": "ok",
    "redis": "ok",
    "queue": "ok",
    "worker": "ok"
  }
}
```

**Status Codes:**
- `200` - System healthy
- `503` - System degraded (one or more dependencies failing)

---

### Option 3: Manual Redis Inspection

```bash
# Connect to Redis
redis-cli

# Check worker heartbeat
GET worker:heartbeat
# Returns: Unix timestamp (milliseconds)

# Check active jobs
GET worker:active_jobs
# Returns: Number of active jobs

# Check scheduler heartbeat
GET scheduler:heartbeat
# Returns: Unix timestamp (milliseconds)

# Check rate limit keys
KEYS ratelimit:*
# Returns: List of rate limit keys

# Check queue keys
KEYS bull:posting-queue:*
# Returns: List of queue-related keys
```

---

### Option 4: Manual MongoDB Inspection

```bash
# Connect to MongoDB
mongosh "mongodb://localhost:27017/social-scheduler"

# Check database connection
db.runCommand({ ping: 1 })

# Count posts by status
db.posts.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

# Check failed posts
db.posts.find({ status: "failed" }).limit(10)

# Check social accounts
db.socialaccounts.countDocuments({ status: "active" })

# Check billing records
db.billings.find({ status: "active" }).count()

# Check webhook events (idempotency)
db.webhookevents.find().sort({ processedAt: -1 }).limit(10)
```

---

### Option 5: Queue Inspection via BullMQ Board (Optional)

If BullMQ Board is installed:

```bash
# Install BullMQ Board (dev only)
npm install -g @bull-board/cli

# Start board
bull-board
```

Navigate to `http://localhost:3000` to see:
- Queue statistics
- Job details
- Failed jobs
- Retry history

---

## System Status Interpretation

### ✅ HEALTHY
All systems operational:
- MongoDB connected
- Redis connected
- Worker heartbeat active (<120s)
- Scheduler running
- Queue accessible
- Backups current (<26 hours for MongoDB, <8 hours for Redis)
- Failed jobs <50

### ⚠️ DEGRADED
System operational but with warnings:
- Worker heartbeat stale (>120s)
- Scheduler heartbeat stale
- Backups stale but not critical
- Failed jobs >50 but <100
- High memory usage (>85%)

### ❌ FAIL
Critical system failure:
- MongoDB disconnected
- Redis disconnected
- Queue inaccessible
- Failed jobs >100
- Backups failed or missing

---

## Common Issues & Resolutions

### Issue: Worker heartbeat stale

**Symptoms:**
```
Worker:    ❌ FAIL
Worker heartbeat stale (180s ago)
```

**Resolution:**
1. Check if worker process is running:
   ```bash
   ps aux | grep worker
   ```
2. Check worker logs:
   ```bash
   tail -f logs/worker.log
   ```
3. Restart worker if needed:
   ```bash
   pm2 restart worker
   ```

---

### Issue: High failed job count

**Symptoms:**
```
Failed:    125
```

**Resolution:**
1. Inspect failed jobs:
   ```bash
   tsx scripts/validate-runtime.ts
   ```
2. Check error patterns (token expired, network issues, etc.)
3. If token expired:
   - Users need to reconnect social accounts
   - Check token refresh worker is running
4. If network issues:
   - Check external API connectivity
   - Review retry storm protection logs
5. Move to DLQ if permanent failures:
   ```typescript
   // DLQ handles this automatically after max retries
   ```

---

### Issue: Backup stale

**Symptoms:**
```
MongoDB Backup:
  Age:         30.5 hours
  Healthy:     ❌ NO
```

**Resolution:**
1. Check backup cron job:
   ```bash
   crontab -l | grep backup
   ```
2. Check backup logs:
   ```bash
   tail -f /backups/mongodb/backup.log
   ```
3. Run backup manually:
   ```bash
   ./scripts/backup-mongodb.sh
   ```
4. Verify backup file created:
   ```bash
   ls -lh /backups/mongodb/
   ```

---

### Issue: Redis connection failed

**Symptoms:**
```
Redis:     ❌ FAIL
Redis connection failed: ECONNREFUSED
```

**Resolution:**
1. Check Redis is running:
   ```bash
   redis-cli ping
   ```
2. Check Redis configuration:
   ```bash
   cat config/redis.conf
   ```
3. Check Redis logs:
   ```bash
   tail -f /var/log/redis/redis-server.log
   ```
4. Restart Redis if needed:
   ```bash
   sudo systemctl restart redis
   ```

---

### Issue: MongoDB connection failed

**Symptoms:**
```
MongoDB:   ❌ FAIL
MongoDB connection failed: MongoNetworkError
```

**Resolution:**
1. Check MongoDB is running:
   ```bash
   mongosh --eval "db.runCommand({ ping: 1 })"
   ```
2. Check connection string in `.env`:
   ```bash
   grep MONGODB_URI .env
   ```
3. Check MongoDB logs:
   ```bash
   tail -f /var/log/mongodb/mongod.log
   ```
4. Verify network connectivity to MongoDB Atlas (if using cloud)

---

## Monitoring Recommendations

### Real-time Monitoring

1. **Application Monitoring:**
   - Datadog, New Relic, or AppDynamics
   - Track response times, error rates, throughput

2. **Log Aggregation:**
   - CloudWatch Logs, Loggly, or Papertrail
   - Centralized log search and analysis

3. **Error Tracking:**
   - Sentry or Rollbar
   - Real-time error notifications

4. **Infrastructure Monitoring:**
   - Prometheus + Grafana
   - CPU, memory, disk, network metrics

### Alert Thresholds

Set up alerts for:
- Worker heartbeat >120s
- Failed jobs >50
- Memory usage >85%
- MongoDB backup age >26 hours
- Redis snapshot age >8 hours
- Queue waiting jobs >100
- Response time >2s (p95)
- Error rate >1%

---

## Validation Checklist

Before declaring system healthy, verify:

- [ ] MongoDB connection: OK
- [ ] Redis connection: OK
- [ ] Worker heartbeat: <120s
- [ ] Scheduler running: OK
- [ ] Queue accessible: OK
- [ ] Failed jobs: <50
- [ ] MongoDB backup: <26 hours
- [ ] Redis snapshot: <8 hours
- [ ] Memory usage: <85%
- [ ] No critical warnings in logs

---

## Emergency Contacts

**Critical Issues:**
- Database outage
- Redis outage
- Worker crash loop
- Backup failures

**Escalation Path:**
1. Check logs and metrics
2. Attempt automated recovery
3. Contact on-call engineer
4. Escalate to senior engineer if unresolved in 30 minutes

---

**Last Updated:** February 15, 2026  
**Next Review:** After first production deployment
