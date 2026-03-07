# Phase 1B: Backend Startup Verification Guide

**Date**: 2026-03-04  
**Objective**: Verify all Phase 1B components initialize correctly at backend startup

---

## OVERVIEW

This guide walks you through verifying that the backend server starts successfully with all Phase 1B components (Circuit Breaker, Rate Limiter, Token Refresh System) properly initialized.

---

## PREREQUISITES

Before starting, ensure:
- ✅ Redis is running (`redis-cli ping` returns `PONG`)
- ✅ MongoDB is running
- ✅ Backend dependencies installed (`npm install` in `apps/backend`)
- ✅ `.env` file configured with correct Redis and MongoDB URLs

---

## STEP 1: Verify Backend Startup

### Option A: Automated Verification (Recommended)

Run the startup verification script:

**PowerShell (Windows)**:
```powershell
cd apps/backend
.\phase1b-verify-startup.ps1
```

**Bash (Linux/Mac)**:
```bash
cd apps/backend
chmod +x phase1b-verify-startup.sh
./phase1b-verify-startup.sh
```

The script will:
1. Check if backend is already running
2. Prompt you to start the backend in a new terminal
3. Ask you to paste the first 40 lines of startup logs
4. Analyze the logs and verify all components initialized

### Option B: Manual Verification

1. **Start the backend**:
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Capture the first 40 lines of output**

3. **Verify the following log messages appear**:

   | Component | Expected Log Message | Status |
   |-----------|---------------------|--------|
   | Redis Connection | `✅ Redis connected successfully` | Required |
   | MongoDB Connection | `✅ MongoDB connected` | Required |
   | BullMQ Queue | `QueueManager initialized` | Required |
   | Token Refresh Scheduler | `📅 Token refresh scheduler started` | Required |
   | Token Refresh Worker | `🔄 Distributed token refresh worker started` | Required |
   | Worker Concurrency | `concurrency: 5` | Required |
   | Publishing Worker | `👷 Publishing worker started` | Required |
   | Server Listening | `🚀 Server running on port 3000` | Required |

---

## STEP 2: Verify Redis Connectivity

Run the following command:

```bash
redis-cli ping
```

**Expected Output**:
```
PONG
```

If Redis is not reachable, check:
- Redis service is running
- Redis URL in `.env` is correct
- Firewall/network settings

---

## STEP 3: Inspect Redis Keys

Run the following command:

```bash
redis-cli keys "*"
```

### Expected Key Categories

After backend starts, you should see:

1. **BullMQ Queue Keys** (`bull:*`):
   - `bull:token-refresh-queue:id`
   - `bull:token-refresh-queue:meta`
   - `bull:token-refresh-queue:events`
   - `bull:token-refresh-queue:wait` (list)
   - `bull:token-refresh-queue:active` (list)
   - `bull:token-refresh-queue:delayed` (sorted set)
   - `bull:token-refresh-queue:completed` (sorted set)
   - `bull:token-refresh-queue:failed` (sorted set)

2. **Phase 1B Keys** (created on-demand during operation):
   - `oauth:circuit:{provider}` - Circuit breaker state
   - `oauth:ratelimit:{provider}:{minute}` - Rate limiter counters
   - `oauth:refresh:lock:{connectionId}` - Distributed locks
   - `oauth:refresh:dlq:{connectionId}` - Dead letter queue entries

**Note**: Phase 1B keys (circuit breaker, rate limiter) will only appear after the system processes token refresh jobs. They are created on-demand.

---

## STEP 4: Verify BullMQ Queues

Run the following commands:

```bash
redis-cli keys "bull:*"
```

**Expected Output**: Should list 8+ keys related to `bull:token-refresh-queue:*`

### Check Queue Counts

```bash
redis-cli LLEN bull:token-refresh-queue:wait
redis-cli LLEN bull:token-refresh-queue:active
redis-cli ZCARD bull:token-refresh-queue:delayed
redis-cli ZCARD bull:token-refresh-queue:completed
redis-cli ZCARD bull:token-refresh-queue:failed
```

**Healthy Initial State**:
- Waiting: 0 (no jobs queued yet)
- Active: 0 (no jobs processing)
- Delayed: 0 (no delayed jobs)
- Completed: 0 (no completed jobs yet)
- Failed: 0 (no failed jobs)

---

## STEP 5: Confirm Worker Registration

Check the backend logs for worker startup messages:

### Token Refresh Worker

**Expected Log**:
```
🔄 Distributed token refresh worker started
```

**Details to Verify**:
- Worker is connected to Redis
- Concurrency is set to 5
- Worker is listening for jobs on `token-refresh-queue`

### Token Refresh Scheduler

**Expected Log**:
```
📅 Token refresh scheduler started
```

**Details to Verify**:
- Scheduler interval: 300000ms (5 minutes)
- Scheduler scans for tokens expiring within 24 hours
- Scheduler is active and will run periodically

---

## STEP 6: Confirm Scheduler Activity

The token refresh scheduler runs every 5 minutes. To verify it's working:

1. **Wait 5 minutes** after backend starts
2. **Check logs** for scheduler activity:
   ```
   [INFO] Token refresh scheduler: Scanning for tokens expiring in 24h
   [INFO] Token refresh scheduler: Found X tokens to refresh
   ```

3. **Check Redis queue**:
   ```bash
   redis-cli LLEN bull:token-refresh-queue:wait
   ```
   - If tokens are expiring soon, this should be > 0

---

## STEP 7: Produce Runtime Infrastructure Report

Run the infrastructure audit script:

```bash
cd apps/backend
node phase1b-infrastructure-audit.js
```

### Expected Report Sections

1. **Backend Startup Status**: ✅ Running
2. **Redis Connectivity**: ✅ OK
3. **Redis Keyspace Snapshot**: Lists all key categories
4. **BullMQ Queue Status**: ✅ Queues initialized
5. **Worker Status**: ✅ Worker running (concurrency: 5)
6. **Scheduler Status**: ✅ Scheduler active (interval: 5 minutes)

### Success Criteria

The audit report should show:
```
═══════════════════════════════════════════════════════════
✅ INFRASTRUCTURE READY FOR PHASE 1B VALIDATION
═══════════════════════════════════════════════════════════
```

---

## TROUBLESHOOTING

### Issue: Backend Not Starting

**Symptoms**:
- `npm run dev` fails
- Error messages in console

**Solutions**:
1. Check `.env` file exists and has correct values
2. Verify Redis is running: `redis-cli ping`
3. Verify MongoDB is running
4. Check for port conflicts (port 3000 already in use)
5. Run `npm install` to ensure dependencies are installed

### Issue: Redis Connection Failed

**Symptoms**:
- Log shows: `❌ Redis connection failed`
- Backend continues without Redis

**Solutions**:
1. Start Redis: `redis-server` (or `brew services start redis` on Mac)
2. Check Redis URL in `.env`: `REDIS_URL=redis://localhost:6379`
3. Test connection: `redis-cli ping`

### Issue: MongoDB Connection Failed

**Symptoms**:
- Log shows: `❌ MongoDB connection failed`
- Backend exits with error

**Solutions**:
1. Start MongoDB: `mongod` (or `brew services start mongodb-community` on Mac)
2. Check MongoDB URI in `.env`: `MONGODB_URI=mongodb://localhost:27017/social-media-scheduler`
3. Test connection: `mongosh`

### Issue: BullMQ Queues Not Initialized

**Symptoms**:
- `redis-cli keys "bull:*"` returns empty
- No queue-related logs

**Solutions**:
1. Verify Redis is connected (check logs)
2. Restart backend to re-initialize queues
3. Check for errors in backend logs during QueueManager initialization

### Issue: Worker Not Starting

**Symptoms**:
- No log message: `Distributed token refresh worker started`
- Worker status unknown

**Solutions**:
1. Check if Redis is connected (worker requires Redis)
2. Look for errors in logs during worker initialization
3. Verify `DistributedTokenRefreshWorker.ts` file exists
4. Restart backend

### Issue: Scheduler Not Starting

**Symptoms**:
- No log message: `Token refresh scheduler started`
- No periodic scanning activity

**Solutions**:
1. Check if Redis is connected (scheduler requires Redis)
2. Look for errors in logs during scheduler initialization
3. Verify `TokenRefreshScheduler.ts` file exists
4. Restart backend

---

## VALIDATION CHECKLIST

Use this checklist to confirm backend is ready:

- [ ] Backend process running
- [ ] Redis connected (log shows `✅ Redis connected`)
- [ ] MongoDB connected (log shows `✅ MongoDB connected`)
- [ ] BullMQ queues initialized (log shows `QueueManager initialized`)
- [ ] Token refresh worker started (log shows `🔄 Distributed token refresh worker started`)
- [ ] Worker concurrency = 5 (log shows `concurrency: 5`)
- [ ] Token refresh scheduler started (log shows `📅 Token refresh scheduler started`)
- [ ] Publishing worker started (log shows `👷 Publishing worker started`)
- [ ] Server listening on port 3000 (log shows `🚀 Server running on port 3000`)
- [ ] Redis keys `bull:*` exist (run `redis-cli keys "bull:*"`)
- [ ] Infrastructure audit passes (run `node phase1b-infrastructure-audit.js`)

---

## NEXT STEPS

Once all checks pass, proceed to Phase 1B validation tests:

1. **Circuit Breaker Test**:
   ```bash
   node phase1b-test-circuit-breaker.js
   ```

2. **Rate Limiter Test**:
   ```bash
   node phase1b-test-rate-limiter.js
   ```

3. **Storm Protection Test**:
   ```bash
   node phase1b-test-storm-protection.js
   ```

4. **Combined Failure Test**:
   ```bash
   node phase1b-test-combined-failure.js
   ```

---

## EXPECTED BACKEND STARTUP LOGS

Here's what a successful startup should look like:

```
🔧 server.ts: Loading modules...
✅ server.ts: Modules loaded
🚀 INSIDE startServer() - START
🚀 Starting server...
📦 Connecting to MongoDB...
✅ MongoDB connected
📦 Connecting to Redis...
✅ Redis connected successfully
🔧 Initializing services...
🔧 Initializing OAuth Manager...
✅ OAuth Manager initialized with platforms: [ 'facebook', 'instagram', 'twitter', 'tiktok', 'google-business' ]
📅 Scheduler Service STARTED
💾 Backup Scheduler STARTED
👷 Publishing worker started
🔄 Distributed token refresh worker started
📅 Token refresh scheduler started
🔄 Missed Post Recovery Service STARTED
📊 Queue backpressure monitor started
📊 Metrics endpoint enabled at /metrics
✅ Services registered with Redis recovery service
🚀 Starting Express server on port 3000
✅ Server running on port 3000
📍 Environment: development
🔗 Health check: http://localhost:3000/health
📊 Metrics: http://localhost:3000/metrics
📚 API v1: http://localhost:3000/api/v1
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-04  
**Status**: Ready for execution

