# Production Alerting System

## Overview

The Production Alerting System monitors critical system health conditions and sends alerts through multiple channels when issues are detected. The system is designed to be:

- **Non-blocking**: Never crashes or blocks the main application
- **Horizontally safe**: Works across multiple instances without duplicate alerts
- **Production-ready**: Handles failures gracefully with proper error handling
- **Configurable**: Fully configurable via environment variables
- **Optional**: Can be disabled without affecting core functionality

## Architecture

### Components

1. **SystemMonitor** (`src/services/alerting/SystemMonitor.ts`)
   - Background polling service (default: every 60 seconds)
   - Checks 10 critical alert conditions
   - Triggers alerts when thresholds are exceeded
   - Never crashes on failure

2. **AlertingService** (`src/services/alerting/AlertingService.ts`)
   - Central service for sending alerts
   - Manages alert deduplication (cooldown window)
   - Distributes alerts to multiple adapters
   - Uses Redis for distributed deduplication

3. **Alert Adapters**
   - **ConsoleAlertAdapter**: Logs alerts to application logger
   - **WebhookAlertAdapter**: Sends alerts to webhook endpoints (Slack/Discord compatible)

## Alert Conditions

The system monitors 10 critical conditions:

### 1. Worker Heartbeat Missing
- **Severity**: CRITICAL
- **Condition**: Publishing worker hasn't sent heartbeat in >120 seconds
- **Impact**: Posts may not be published
- **Action**: Check worker process, restart if needed

### 2. Scheduler Heartbeat Stale
- **Severity**: CRITICAL
- **Condition**: Scheduler heartbeat is >90 seconds old
- **Impact**: Posts won't be queued for publishing
- **Action**: Check scheduler service, restart if needed

### 3. Redis Connection Lost (Production Only)
- **Severity**: CRITICAL
- **Condition**: Cannot connect to Redis
- **Impact**: Queue system and distributed locks unavailable
- **Action**: Check Redis server, network connectivity

### 4. MongoDB Disconnected
- **Severity**: CRITICAL
- **Condition**: MongoDB connection state != 1 or ping fails
- **Impact**: Database operations will fail
- **Action**: Check MongoDB server, network connectivity

### 5. High Queue Failure Rate
- **Severity**: WARNING
- **Condition**: Queue failure rate > threshold (default: 20%)
- **Impact**: Many posts failing to publish
- **Action**: Check provider APIs, token validity, error logs

### 6. Dead Letter Queue Growing
- **Severity**: WARNING
- **Condition**: DLQ size > threshold (default: 10 jobs)
- **Impact**: Jobs permanently failed after all retries
- **Action**: Review failed jobs, fix underlying issues

### 7. Token Refresh Failures Spike
- **Severity**: WARNING
- **Condition**: 5+ token refresh failures since last check
- **Impact**: Social accounts may become expired
- **Action**: Check OAuth provider APIs, refresh token validity

### 8. Publishing Failures Spike
- **Severity**: WARNING
- **Condition**: 10+ publishing failures since last check
- **Impact**: Many posts failing to publish
- **Action**: Check provider APIs, rate limits, error logs

### 9. Critical Memory Usage
- **Severity**: CRITICAL
- **Condition**: Memory usage > threshold (default: 90%)
- **Impact**: Application may crash or slow down
- **Action**: Check for memory leaks, scale resources

### 10. Health Endpoint Degraded
- **Severity**: WARNING
- **Condition**: Health check returns degraded status
- **Impact**: One or more dependencies unhealthy
- **Action**: Check specific dependency status

## Configuration

### Environment Variables

```bash
# Enable/disable alerting system
ALERTING_ENABLED=false

# Cooldown window for duplicate alerts (minutes)
ALERTING_COOLDOWN_MINUTES=30

# Webhook URL for alerts (optional)
ALERTING_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhook format (slack, discord, generic)
ALERTING_WEBHOOK_FORMAT=slack

# Memory usage threshold (percentage)
ALERTING_MEMORY_THRESHOLD=90

# Queue failure rate threshold (percentage)
ALERTING_QUEUE_FAILURE_RATE_THRESHOLD=20

# Dead Letter Queue size threshold
ALERTING_DLQ_THRESHOLD=10

# Polling interval (milliseconds)
ALERTING_POLL_INTERVAL=60000
```

### Example Configuration

#### Development (Disabled)
```bash
ALERTING_ENABLED=false
```

#### Production (Console Only)
```bash
ALERTING_ENABLED=true
ALERTING_COOLDOWN_MINUTES=30
ALERTING_POLL_INTERVAL=60000
```

#### Production (Slack Webhook)
```bash
ALERTING_ENABLED=true
ALERTING_COOLDOWN_MINUTES=30
ALERTING_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERTING_WEBHOOK_FORMAT=slack
ALERTING_MEMORY_THRESHOLD=90
ALERTING_QUEUE_FAILURE_RATE_THRESHOLD=20
ALERTING_DLQ_THRESHOLD=10
ALERTING_POLL_INTERVAL=60000
```

## Alert Deduplication

The system uses Redis-based deduplication to prevent alert spam:

1. **Cooldown Window**: Each alert type has a cooldown period (default: 30 minutes)
2. **Distributed**: Works across multiple instances using Redis
3. **Automatic Expiry**: Cooldown keys expire automatically via Redis TTL
4. **Fail Open**: If Redis fails, alerts are sent (better to spam than miss critical alerts)

### Cooldown Key Format
```
alert:cooldown:{severity}:{title_hash}
```

Example:
```
alert:cooldown:critical:abc123
```

## Integration

### Server Startup

The system monitor is automatically started in `server.ts` if:
1. Redis is connected
2. `ALERTING_ENABLED=true`

```typescript
// Start system monitor if Redis is connected and alerting is enabled
if (redisConnected && config.alerting.enabled) {
  // Create alert adapters
  const adapters: any[] = [new ConsoleAlertAdapter()];
  
  // Add webhook adapter if URL is configured
  if (config.alerting.webhookUrl) {
    adapters.push(new WebhookAlertAdapter({
      url: config.alerting.webhookUrl,
      format: config.alerting.webhookFormat,
    }));
  }
  
  // Create alerting service
  const alertingService = new AlertingService({
    enabled: config.alerting.enabled,
    cooldownMinutes: config.alerting.cooldownMinutes,
    adapters,
  });
  
  // Create and start system monitor
  systemMonitorInstance = new SystemMonitor(alertingService, {
    enabled: config.alerting.enabled,
    pollInterval: config.alerting.pollInterval,
    memoryThresholdPercent: config.alerting.memoryThreshold,
    queueFailureRateThreshold: config.alerting.queueFailureRateThreshold,
    deadLetterQueueThreshold: config.alerting.dlqThreshold,
  });
  
  systemMonitorInstance.start();
  logger.info('🔔 System monitor started');
}
```

### Graceful Shutdown

The system monitor is properly stopped during graceful shutdown:

```typescript
// Stop system monitor
if (systemMonitorInstance) {
  logger.info('Stopping system monitor...');
  systemMonitorInstance.stop();
  logger.info('✅ System monitor stopped');
}
```

## Alert Formats

### Console Alert (Logged)
```json
{
  "level": "error",
  "message": "ALERT: Worker Heartbeat Missing",
  "severity": "critical",
  "alert": {
    "title": "Worker Heartbeat Missing",
    "message": "Publishing worker has not sent a heartbeat. Worker may be down or stuck.",
    "timestamp": "2026-02-17T10:30:00.000Z",
    "metadata": {
      "component": "worker"
    }
  }
}
```

### Slack Webhook Alert
```json
{
  "text": "🚨 CRITICAL: Worker Heartbeat Missing",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        {
          "title": "Message",
          "value": "Publishing worker has not sent a heartbeat. Worker may be down or stuck.",
          "short": false
        },
        {
          "title": "Timestamp",
          "value": "2026-02-17T10:30:00.000Z",
          "short": true
        },
        {
          "title": "Component",
          "value": "worker",
          "short": true
        }
      ]
    }
  ]
}
```

### Discord Webhook Alert
```json
{
  "embeds": [
    {
      "title": "🚨 CRITICAL: Worker Heartbeat Missing",
      "description": "Publishing worker has not sent a heartbeat. Worker may be down or stuck.",
      "color": 15158332,
      "timestamp": "2026-02-17T10:30:00.000Z",
      "fields": [
        {
          "name": "Component",
          "value": "worker",
          "inline": true
        }
      ]
    }
  ]
}
```

## Safety Guarantees

### Non-Blocking
- All alert checks run in `Promise.allSettled()` - failures don't crash the monitor
- Webhook calls have 5-second timeout
- Never throws errors that could crash the application

### Horizontally Safe
- Uses Redis for distributed deduplication
- Multiple instances won't send duplicate alerts (within cooldown window)
- Each instance independently monitors its own health

### Production Safe
- Graceful degradation if Redis fails
- Continues monitoring even if alert delivery fails
- Proper error logging for debugging
- Clean shutdown integration

## Monitoring the Monitor

The system monitor itself logs its status:

```typescript
logger.debug('System monitor polling');
```

To verify the monitor is working:
1. Check logs for "System monitor started"
2. Check logs for "System monitor polling" (every 60 seconds)
3. Trigger a test alert by setting a low threshold

## Testing

### Manual Test
```bash
# Set low memory threshold to trigger alert
ALERTING_ENABLED=true
ALERTING_MEMORY_THRESHOLD=1
ALERTING_POLL_INTERVAL=10000

# Start server and watch for memory alert
npm run dev
```

### Force Poll (Programmatic)
```typescript
// In code or REPL
systemMonitorInstance.forcePoll();
```

## Troubleshooting

### Alerts Not Sending

1. **Check if alerting is enabled**
   ```bash
   echo $ALERTING_ENABLED
   # Should be "true"
   ```

2. **Check Redis connection**
   ```bash
   # Alerting requires Redis
   redis-cli ping
   # Should return "PONG"
   ```

3. **Check logs for errors**
   ```bash
   grep "System monitor" logs/application-*.log
   grep "Alert" logs/application-*.log
   ```

4. **Verify webhook URL (if using webhooks)**
   ```bash
   curl -X POST $ALERTING_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"text":"Test alert"}'
   ```

### Too Many Alerts

1. **Increase cooldown window**
   ```bash
   ALERTING_COOLDOWN_MINUTES=60
   ```

2. **Adjust thresholds**
   ```bash
   ALERTING_MEMORY_THRESHOLD=95
   ALERTING_QUEUE_FAILURE_RATE_THRESHOLD=30
   ```

3. **Increase poll interval**
   ```bash
   ALERTING_POLL_INTERVAL=120000  # 2 minutes
   ```

### Missing Alerts

1. **Decrease cooldown window**
   ```bash
   ALERTING_COOLDOWN_MINUTES=15
   ```

2. **Lower thresholds**
   ```bash
   ALERTING_MEMORY_THRESHOLD=80
   ALERTING_QUEUE_FAILURE_RATE_THRESHOLD=10
   ```

3. **Check Redis for cooldown keys**
   ```bash
   redis-cli KEYS "alert:cooldown:*"
   ```

## Production Recommendations

1. **Enable alerting in production**
   ```bash
   ALERTING_ENABLED=true
   ```

2. **Configure webhook for critical alerts**
   - Use Slack/Discord for immediate notification
   - Set up on-call rotation

3. **Tune thresholds based on your workload**
   - Monitor false positive rate
   - Adjust thresholds to reduce noise

4. **Set appropriate cooldown**
   - 30 minutes is a good default
   - Shorter for critical alerts (15 min)
   - Longer for warnings (60 min)

5. **Monitor alert delivery**
   - Check webhook delivery success rate
   - Set up secondary alerting if primary fails

## Future Enhancements

Potential improvements for the alerting system:

1. **Additional Adapters**
   - Email adapter
   - PagerDuty adapter
   - SMS adapter (Twilio)

2. **Alert Routing**
   - Route critical alerts to PagerDuty
   - Route warnings to Slack
   - Route info to logs only

3. **Alert Aggregation**
   - Batch multiple alerts into single notification
   - Summary reports every N hours

4. **Custom Alert Conditions**
   - User-defined alert rules
   - Dynamic threshold adjustment

5. **Alert History**
   - Store alert history in database
   - Alert dashboard/UI
   - Alert analytics

## Summary

The Production Alerting System provides comprehensive monitoring of critical system health conditions with:

- ✅ 10 alert conditions covering all critical components
- ✅ Multiple alert channels (console, webhook)
- ✅ Distributed deduplication via Redis
- ✅ Non-blocking, production-safe implementation
- ✅ Fully configurable via environment variables
- ✅ Graceful shutdown integration
- ✅ Horizontally scalable

The system is ready for production use and can be enabled by setting `ALERTING_ENABLED=true` and configuring appropriate thresholds and webhook URLs.
