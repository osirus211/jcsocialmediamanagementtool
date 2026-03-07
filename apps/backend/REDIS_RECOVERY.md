# Redis Reconnect Auto-Recovery System

## Overview

The Redis Recovery System automatically detects Redis disconnections and safely restarts all Redis-dependent services when Redis reconnects. This prevents the system from getting stuck in a broken state after Redis outages.

## Problem Solved

**Before**: When Redis disconnected and reconnected, workers and schedulers would remain stopped, requiring manual intervention.

**After**: Services automatically restart when Redis reconnects, ensuring zero-downtime recovery.

## Architecture

### Components

1. **RedisRecoveryService** (`src/services/recovery/RedisRecoveryService.ts`)
   - Listens to Redis events (close, end, ready)
   - Manages service lifecycle during Redis outages
   - Prevents duplicate workers/schedulers
   - Respects graceful shutdown

2. **Service Registration** (in `server.ts`)
   - Each Redis-dependent service registers with recovery service
   - Provides isRunning/start/stop methods
   - Marked as requiresRedis: true

3. **Redis Integration** (in `config/redis.ts`)
   - Recovery service attached to Redis client
   - Notified of shutdown events

## How It Works

### 1. Redis Disconnect Detection

When Redis disconnects (network issue, Redis restart, etc.):

```
Redis 'close' or 'end' event
  ↓
RedisRecoveryService.handleDisconnect()
  ↓
Pause all Redis-dependent services
  ↓
Services stop gracefully
```

### 2. Redis Reconnect Detection

When Redis reconnects:

```
Redis 'ready' event
  ↓
RedisRecoveryService.handleReconnect()
  ↓
Schedule recovery (5 second delay)
  ↓
Recover all Redis-dependent services
  ↓
Services restart automatically
```

### 3. Service Recovery Process

For each registered service:

1. Check if service is already running (idempotency)
2. If not running, call service.start()
3. Verify service started successfully
4. Log success/failure
5. Continue to next service

## Registered Services

The following services are automatically recovered:

1. **Scheduler Service** - Polls for scheduled posts
2. **Publishing Worker** - Processes post publishing jobs
3. **Token Refresh Worker** - Auto-refreshes OAuth tokens
4. **System Monitor** - Monitors system health and sends alerts
5. **Backpressure Monitor** - Monitors queue health

## Safety Guarantees

### No Duplicate Workers/Schedulers

- Each service checks `isRunning()` before starting
- Idempotent recovery (safe to call multiple times)
- Distributed locks prevent multi-instance conflicts

### Graceful Shutdown Respected

- Recovery disabled during shutdown
- Pending recovery cancelled on shutdown
- No services restarted during shutdown

### Redis Flapping Protection

- 5-second delay after reconnect (allows Redis to stabilize)
- Only one recovery attempt at a time
- Cancels pending recovery if new disconnect occurs

### Non-Blocking

- Recovery runs asynchronously
- Never blocks main thread
- Failures logged but don't crash app

### Horizontally Safe

- Each instance manages its own services
- Distributed locks prevent conflicts
- No coordination required between instances

## Configuration

```typescript
// In config/redis.ts
const recoveryService = new RedisRecoveryService({
  enabled: true,
  recoveryDelayMs: 5000, // 5 second delay after reconnect
});
```

## Metrics

The recovery service tracks:

- `disconnect_events` - Total Redis disconnects
- `reconnect_events` - Total Redis reconnects
- `recovery_attempts` - Total recovery attempts
- `recovery_success` - Successful recoveries
- `recovery_failed` - Failed recoveries

Access via:

```typescript
const status = recoveryService.getStatus();
console.log(status.metrics);
```

## Testing

### Manual Testing

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Stop Redis**:
   ```bash
   # Docker
   docker stop redis
   
   # Or kill Redis process
   redis-cli shutdown
   ```

3. **Observe logs**:
   ```
   Redis disconnected - pausing Redis-dependent services
   Pausing service due to Redis disconnect: scheduler
   Pausing service due to Redis disconnect: publishing-worker
   ...
   ```

4. **Start Redis**:
   ```bash
   # Docker
   docker start redis
   
   # Or start Redis
   redis-server
   ```

5. **Observe recovery**:
   ```
   Redis reconnected - scheduling service recovery
   Service recovery scheduled (delayMs: 5000)
   Starting service recovery
   Recovering service: scheduler
   ✅ Service recovered successfully: scheduler
   Recovering service: publishing-worker
   ✅ Service recovered successfully: publishing-worker
   ...
   ✅ Service recovery completed successfully
   ```

### Automated Testing

```typescript
// Force recovery (for testing)
const recoveryService = getRecoveryService();
await recoveryService.forceRecovery();
```

## Logs

### Disconnect Event

```json
{
  "level": "warn",
  "message": "Redis disconnected - pausing Redis-dependent services",
  "disconnectTime": "2026-02-17T10:30:00.000Z",
  "metrics": {
    "disconnect_events": 1,
    "reconnect_events": 0,
    "recovery_attempts": 0,
    "recovery_success": 0,
    "recovery_failed": 0
  }
}
```

### Reconnect Event

```json
{
  "level": "info",
  "message": "Redis reconnected - scheduling service recovery",
  "reconnectTime": "2026-02-17T10:30:15.000Z",
  "disconnectDurationMs": 15000,
  "recoveryDelayMs": 5000,
  "metrics": {
    "disconnect_events": 1,
    "reconnect_events": 1,
    "recovery_attempts": 0,
    "recovery_success": 0,
    "recovery_failed": 0
  }
}
```

### Recovery Success

```json
{
  "level": "info",
  "message": "✅ Service recovery completed successfully",
  "recovered": 5,
  "total": 5,
  "successRate": "100.00",
  "results": [
    { "service": "scheduler", "success": true },
    { "service": "publishing-worker", "success": true },
    { "service": "token-refresh-worker", "success": true },
    { "service": "system-monitor", "success": true },
    { "service": "backpressure-monitor", "success": true }
  ],
  "metrics": {
    "disconnect_events": 1,
    "reconnect_events": 1,
    "recovery_attempts": 1,
    "recovery_success": 1,
    "recovery_failed": 0
  }
}
```

## Edge Cases Handled

### 1. Redis Flapping

If Redis disconnects and reconnects rapidly:

- Previous recovery cancelled
- New recovery scheduled
- Only one recovery runs

### 2. Shutdown During Recovery

If shutdown occurs during recovery:

- Recovery cancelled immediately
- No services restarted
- Clean shutdown proceeds

### 3. Service Already Running

If a service is already running when recovery attempts to start it:

- Service skipped (idempotent)
- No duplicate created
- Logged as success

### 4. Service Fails to Start

If a service fails to start during recovery:

- Error logged with details
- Recovery continues to next service
- Overall recovery marked as partial failure

### 5. Multiple Instances

If multiple app instances are running:

- Each instance manages its own services
- Distributed locks prevent conflicts
- No coordination required

## Production Readiness

✅ **Tested**: Manual testing with Redis stop/start  
✅ **Safe**: No duplicate workers/schedulers  
✅ **Non-blocking**: Async recovery, never blocks  
✅ **Idempotent**: Safe to call multiple times  
✅ **Shutdown-safe**: Respects graceful shutdown  
✅ **Horizontally safe**: Works with multiple instances  
✅ **Logged**: Comprehensive logging and metrics  
✅ **Configurable**: Recovery delay configurable  

## Monitoring

### Health Check

The recovery service status is available:

```typescript
const recoveryService = getRecoveryService();
const status = recoveryService.getStatus();

console.log({
  enabled: status.enabled,
  redisConnected: status.redisConnected,
  isRecovering: status.isRecovering,
  servicesRegistered: status.servicesRegistered,
  metrics: status.metrics,
});
```

### Alerts

No alerts are sent by the recovery service itself. However:

- Redis disconnect/reconnect events are logged
- Service recovery failures are logged
- System monitor will detect if services fail to restart

## Future Enhancements

Potential improvements (not currently needed):

1. **Exponential Backoff**: If recovery fails, retry with increasing delays
2. **Max Retry Limit**: Stop trying after N failed attempts
3. **Health Check Integration**: Add recovery status to /health endpoint
4. **Metrics Export**: Export recovery metrics to Prometheus
5. **Alert Integration**: Send alerts on recovery failures

## Summary

The Redis Recovery System provides automatic, safe, and reliable recovery of Redis-dependent services when Redis reconnects. It prevents manual intervention, ensures zero-downtime recovery, and maintains all production safety guarantees.

**Status**: ✅ Production Ready
