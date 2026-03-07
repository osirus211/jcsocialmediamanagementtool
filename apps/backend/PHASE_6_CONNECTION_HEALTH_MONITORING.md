# Phase 6: Connection Health Monitoring System

## Overview

Continuous health monitoring for social media account connections with automatic recovery and webhook notifications.

## Architecture

```
ConnectionHealthCheckWorker (every 10 min)
  ↓
Check All Active Accounts
  ↓
Calculate Health Score (0-100)
  ↓
Determine Health State
  ↓
Auto-Recovery (if needed)
  ↓
Emit Webhook Events
```

## Health States

### 1. HEALTHY (80-100 score)
- All systems operational
- Token valid
- API failure rate < 5%
- Publish error rate < 5%

### 2. WARNING (60-79 score)
- Minor issues detected
- Token expiring soon (< 24 hours)
- API failure rate 5-15%
- Publish error rate 5-15%

### 3. DEGRADED (40-59 score)
- Significant issues
- API failure rate 15-30%
- Publish error rate 15-30%
- Requires attention

### 4. EXPIRED
- Token has expired
- Auto-recovery attempted
- May require manual reauth

### 5. REAUTH_REQUIRED
- Auto-recovery failed
- Manual reauthorization needed
- Connection unusable

## Health Score Calculation

Health score is calculated using weighted metrics:

```typescript
score = (
  tokenRefreshSuccessRate * 0.4 +  // 40% weight
  webhookActivityScore * 0.3 +      // 30% weight
  errorFrequencyScore * 0.2 +       // 20% weight
  lastInteractionScore * 0.1        // 10% weight
)
```

### Metrics Breakdown

**Token Refresh Success Rate (40%)**
- Percentage of successful token refreshes
- Higher = better health

**Webhook Activity Score (30%)**
- Based on webhook events received
- 0 webhooks = 0 score
- 1-10 webhooks = 50 score
- 11-50 webhooks = 75 score
- 51+ webhooks = 100 score

**Error Frequency Score (20%)**
- Inverse of error rate
- 0% errors = 100 score
- 5% errors = 75 score
- 10% errors = 50 score
- 20%+ errors = 0 score

**Last Interaction Score (10%)**
- Based on recency of last successful interaction
- < 1 hour = 100 score
- < 24 hours = 75 score
- < 7 days = 50 score
- < 30 days = 25 score
- 30+ days = 0 score

## Auto-Recovery

When a token expires, the system automatically:

1. Detects expiration during health check
2. Queues token refresh job
3. Attempts to refresh using refresh token
4. Updates connection status based on result

If auto-recovery fails:
- Connection marked as `reauth_required`
- Webhook event emitted
- User notified to manually reauthorize

## Webhook Events

The system emits webhook events for:

### connection.degraded
Triggered when connection health drops to DEGRADED state

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

### connection.recovered
Triggered when connection health returns to HEALTHY state

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

### connection.disconnected
Triggered when connection expires or requires reauth

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

## Webhook Configuration

Webhooks are stored in the `webhooks` collection:

```typescript
{
  workspaceId: ObjectId,
  url: "https://your-app.com/webhooks",
  secret: "webhook_secret_key",
  events: ["connection.degraded", "connection.recovered", "connection.disconnected"],
  enabled: true,
  lastTriggeredAt: Date,
  successCount: 42,
  failureCount: 2
}
```

### Webhook Security

All webhook requests include:
- `Content-Type: application/json`
- `X-Webhook-Signature: <hmac-sha256-signature>`

Verify signature:
```typescript
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', secret);
hmac.update(JSON.stringify(payload));
const signature = hmac.digest('hex');
```

## Monitoring Metrics

### Prometheus Metrics

```
# Health score for each connection
connection_health_score{platform="facebook",account_id="...",workspace_id="..."}

# Total expired connections
expired_connections_total{platform="facebook"}

# Total connections requiring reauth
reauth_required_total{platform="facebook"}

# Total degraded connections
degraded_connections_total{platform="facebook"}

# Health checks performed
connection_health_checks_total{platform="facebook",status="healthy"}

# Status changes
connection_status_changes_total{platform="facebook",from_status="healthy",to_status="degraded"}

# Auto-recovery attempts
auto_recovery_attempts_total{platform="facebook",status="success"}

# Webhook events emitted
webhook_events_emitted_total{event_type="connection.degraded"}

# API failure rate
connection_api_failure_rate{platform="facebook",account_id="..."}

# Publish error rate
connection_publish_error_rate{platform="facebook",account_id="..."}

# Health check duration
health_check_duration_ms{platform="facebook"}
```

## Worker Configuration

```typescript
// Health check runs every 10 minutes
const CHECK_INTERVAL = 10 * 60 * 1000;

// Checks performed:
// 1. Token expiration
// 2. API failures (last 24 hours)
// 3. Publish errors (last 7 days)
// 4. Health score calculation
```

## Database Schema Updates

### SocialAccount Model

Added fields:
```typescript
{
  status: 'healthy' | 'warning' | 'degraded' | 'expired' | 'reauth_required',
  healthMetadata: {
    healthScore: number,
    apiFailureRate: number,
    publishErrorRate: number,
    lastChecked: Date,
    previousStatus: string
  }
}
```

## API Endpoints (Future)

```
GET /api/v1/connections/:accountId/health
- Get current health status and score

GET /api/v1/connections/health/summary
- Get health summary for all connections

POST /api/v1/webhooks
- Register webhook endpoint

GET /api/v1/webhooks
- List webhook endpoints

DELETE /api/v1/webhooks/:webhookId
- Remove webhook endpoint
```

## Testing

### Manual Health Check
```typescript
import { connectionHealthCheckWorker } from './workers/ConnectionHealthCheckWorker';

// Force run health check
await connectionHealthCheckWorker.forceRun();

// Get worker status
const status = connectionHealthCheckWorker.getStatus();
console.log(status);
// { running: true, interval: 600000, intervalMinutes: 10 }
```

### Test Webhook Emission
```typescript
import { webhookService } from './services/WebhookService';

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

## Error Handling

### Health Check Failures
- Individual account failures logged but don't stop worker
- Worker continues checking remaining accounts
- Failed checks don't update account status

### Webhook Failures
- Webhook failures logged but don't stop health checks
- Failed webhooks tracked in `failureCount`
- Successful webhooks tracked in `successCount`
- 10 second timeout per webhook request

### Auto-Recovery Failures
- Failed recovery attempts logged
- Account marked as `reauth_required`
- Webhook event emitted
- User notified via dashboard

## Performance Considerations

### Batch Processing
- All accounts checked in single iteration
- Parallel processing for independent checks
- Efficient database queries with indexes

### Rate Limiting
- Health checks run every 10 minutes
- No external API calls during checks
- Only database and Redis queries

### Memory Usage
- Worker runs in-process
- No queue overhead
- Minimal memory footprint

## Future Enhancements

1. **Predictive Health Monitoring**
   - ML-based prediction of connection failures
   - Proactive token refresh before expiration

2. **Custom Health Thresholds**
   - Per-workspace health score thresholds
   - Custom alert rules

3. **Health History**
   - Store health score history
   - Trend analysis and reporting

4. **Advanced Auto-Recovery**
   - Multiple recovery strategies
   - Fallback mechanisms

5. **Dashboard Integration**
   - Real-time health status display
   - Health score charts
   - Alert history

## Related Documentation

- [Phase 1: Token Refresh System](./PHASE_1_IMPLEMENTATION_COMPLETE.md)
- [Phase 4: Publishing Pipeline](./PHASE_4_REFACTORING_COMPLETE.md)
- [Phase 5: Media Upload Pipeline](./PHASE_5_IMPLEMENTATION_COMPLETE.md)
