# Phase 6: Connection Health Monitoring - Quick Start

## What is Phase 6?

Continuous health monitoring for social media connections with automatic recovery and webhook notifications.

## Quick Overview

```
Every 10 minutes:
  Check all social accounts
    ↓
  Calculate health score (0-100)
    ↓
  Determine health state
    ↓
  Auto-recover expired tokens
    ↓
  Emit webhook events
```

## Health States

| State | Score | Description |
|-------|-------|-------------|
| HEALTHY | 80-100 | All systems operational |
| WARNING | 60-79 | Minor issues, token expiring soon |
| DEGRADED | 40-59 | Significant issues, needs attention |
| EXPIRED | - | Token expired, auto-recovery attempted |
| REAUTH_REQUIRED | - | Manual reauthorization needed |

## How It Works

### 1. Health Score Calculation

```
score = (
  Token Refresh Success * 40% +
  Webhook Activity * 30% +
  Error Frequency * 20% +
  Last Interaction * 10%
)
```

### 2. Auto-Recovery

When token expires:
1. Health check detects expiration
2. Queues token refresh job
3. Attempts refresh using refresh token
4. Updates status based on result
5. Emits webhook event

### 3. Webhook Events

Three event types:
- `connection.degraded` - Health dropped to DEGRADED
- `connection.recovered` - Health returned to HEALTHY
- `connection.disconnected` - Expired or requires reauth

## Setup

### 1. Start Server

Health monitoring starts automatically when Redis is connected:

```bash
npm start
```

Look for:
```
✅ Phase 6 connection health monitoring system started
🏥 Connection health check worker started
```

### 2. Register Webhook (Optional)

```typescript
const webhook = await Webhook.create({
  workspaceId: 'your_workspace_id',
  url: 'https://your-app.com/webhooks',
  secret: 'your_webhook_secret',
  events: [
    'connection.degraded',
    'connection.recovered',
    'connection.disconnected'
  ],
  enabled: true
});
```

### 3. Verify Webhook Signature

```typescript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

// In your webhook handler
app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifyWebhook(req.body, signature, 'your_webhook_secret');
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  console.log('Event:', req.body.event);
  console.log('Data:', req.body.data);
  
  res.json({ received: true });
});
```

## Testing

### Force Run Health Check

```bash
# In Node.js console or script
const { connectionHealthCheckWorker } = require('./workers/ConnectionHealthCheckWorker');

// Force immediate health check
await connectionHealthCheckWorker.forceRun();

// Check worker status
const status = connectionHealthCheckWorker.getStatus();
console.log(status);
// { running: true, interval: 600000, intervalMinutes: 10 }
```

### Test Webhook Emission

```bash
const { webhookService } = require('./services/WebhookService');

await webhookService.emit({
  event: 'connection.degraded',
  workspaceId: 'workspace_id',
  data: {
    accountId: 'account_id',
    platform: 'facebook',
    status: 'degraded',
    previousStatus: 'healthy',
    timestamp: new Date()
  }
});
```

### View Metrics

```bash
curl http://localhost:3000/metrics | grep connection_health
```

## Monitoring

### Check Logs

```bash
# Health check activity
grep "Running health check" logs/app.log

# Status changes
grep "Account status updated" logs/app.log

# Webhook events
grep "Webhook event emitted" logs/app.log

# Auto-recovery attempts
grep "Auto-recovery" logs/app.log
```

### Prometheus Metrics

```
# Health score
connection_health_score{platform="facebook",account_id="...",workspace_id="..."}

# Expired connections
expired_connections_total{platform="facebook"}

# Reauth required
reauth_required_total{platform="facebook"}

# Degraded connections
degraded_connections_total{platform="facebook"}

# Health checks
connection_health_checks_total{platform="facebook",status="healthy"}

# Status changes
connection_status_changes_total{platform="facebook",from_status="healthy",to_status="degraded"}

# Auto-recovery
auto_recovery_attempts_total{platform="facebook",status="success"}

# Webhooks
webhook_events_emitted_total{event_type="connection.degraded"}
```

## Webhook Event Examples

### Connection Degraded

```json
{
  "event": "connection.degraded",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "accountId": "507f1f77bcf86cd799439011",
    "platform": "facebook",
    "status": "degraded",
    "previousStatus": "healthy",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Connection Recovered

```json
{
  "event": "connection.recovered",
  "timestamp": "2024-01-15T11:00:00Z",
  "data": {
    "accountId": "507f1f77bcf86cd799439011",
    "platform": "facebook",
    "status": "healthy",
    "previousStatus": "degraded",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

### Connection Disconnected

```json
{
  "event": "connection.disconnected",
  "timestamp": "2024-01-15T12:00:00Z",
  "data": {
    "accountId": "507f1f77bcf86cd799439011",
    "platform": "facebook",
    "status": "reauth_required",
    "previousStatus": "warning",
    "timestamp": "2024-01-15T12:00:00Z"
  }
}
```

## Common Issues

### Worker Not Starting

**Problem**: Health check worker not starting

**Solution**: Check Redis connection
```bash
# Verify Redis is running
redis-cli ping
# Should return: PONG

# Check server logs
grep "Redis connected" logs/app.log
```

### Webhooks Not Firing

**Problem**: Webhook events not being sent

**Solution**: Verify webhook configuration
```bash
# Check webhook exists and is enabled
db.webhooks.find({ workspaceId: ObjectId("..."), enabled: true })

# Check webhook logs
grep "Webhook event emitted" logs/app.log
grep "Failed to send webhook" logs/app.log
```

### Health Score Always 0

**Problem**: Health score showing 0 for all accounts

**Solution**: Check metrics in Redis
```bash
# Check if metrics exist
redis-cli KEYS "health:*"

# Manually record some metrics
const { ConnectionHealthService } = require('./services/ConnectionHealthService');
const { getRedisClient } = require('./config/redis');
const healthService = new ConnectionHealthService(getRedisClient());

await healthService.recordInteraction('facebook', 'account_id');
await healthService.recordTokenRefresh('facebook', 'account_id', true);
```

## Configuration

### Health Check Interval

Default: 10 minutes

To change, edit `src/workers/ConnectionHealthCheckWorker.ts`:
```typescript
const CHECK_INTERVAL = 10 * 60 * 1000; // Change this value
```

### Health Score Weights

To adjust weights, edit `src/services/ConnectionHealthService.ts`:
```typescript
private readonly weights = {
  tokenRefresh: 0.4,     // 40%
  webhookActivity: 0.3,  // 30%
  errorFrequency: 0.2,   // 20%
  lastInteraction: 0.1,  // 10%
};
```

### Webhook Timeout

Default: 10 seconds

To change, edit `src/services/WebhookService.ts`:
```typescript
const response = await axios.post(webhook.url, payload, {
  timeout: 10000, // Change this value (milliseconds)
});
```

## Next Steps

1. **Set up webhooks** for your workspace
2. **Monitor health metrics** in Prometheus/Grafana
3. **Test auto-recovery** by expiring a token
4. **Review logs** for health check activity

## Related Documentation

- [Full Phase 6 Documentation](./PHASE_6_CONNECTION_HEALTH_MONITORING.md)
- [Implementation Details](./PHASE_6_IMPLEMENTATION_COMPLETE.md)
- [Phase 1: Token Refresh](./PHASE_1_IMPLEMENTATION_COMPLETE.md)

## Support

For issues or questions:
1. Check logs: `grep "connection health" logs/app.log`
2. View metrics: `curl http://localhost:3000/metrics`
3. Review documentation: `PHASE_6_CONNECTION_HEALTH_MONITORING.md`
