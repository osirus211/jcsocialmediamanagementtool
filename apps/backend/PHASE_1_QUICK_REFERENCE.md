# Phase 1 Token Refresh - Quick Reference

**Status**: PRODUCTION READY ✅  
**Date**: 2026-03-05

---

## What Changed?

The mock token refresh implementation has been replaced with real platform API integration.

**Before**: Generated fake tokens (`refreshed_${Date.now()}`)  
**After**: Calls real platform APIs (Facebook, Instagram, Twitter, TikTok, LinkedIn)

---

## How It Works

```
Token Expiring Soon (< 24 hours)
  ↓
Scheduler finds account
  ↓
Enqueues refresh job (with jitter)
  ↓
Worker receives job
  ↓
Routes to platform service
  ↓
Platform API called
  ↓
New token stored in database
  ↓
Metrics recorded
  ↓
Success!
```

---

## Supported Platforms

| Platform | Service | Status |
|----------|---------|--------|
| Facebook | `facebookTokenRefreshWorker` | ✅ Ready |
| Instagram | `instagramTokenRefreshService` | ✅ Ready |
| Twitter | `twitterService` | ✅ Ready |
| TikTok | `tiktokService` | ✅ Ready |
| LinkedIn | `linkedinService` | ✅ Ready |

---

## Key Features

✅ **Distributed Locks** - Prevents duplicate refreshes  
✅ **Circuit Breaker** - Protects against platform API failures  
✅ **Rate Limiter** - Respects platform rate limits  
✅ **Retry Logic** - 3 attempts with exponential backoff  
✅ **DLQ** - Failed jobs tracked for manual review  
✅ **Metrics** - Real-time monitoring via /metrics  
✅ **Logging** - Structured logs for debugging

---

## Monitoring

### Metrics Endpoint

```bash
curl http://localhost:3000/metrics
```

**Key Metrics**:
- `token_refresh_success_total` - Successful refreshes
- `token_refresh_failure_total` - Failed refreshes
- `token_refresh_retry_total` - Retry attempts
- `circuit_blocked_total` - Circuit breaker blocks
- `rate_limit_blocked_total` - Rate limit blocks

### DLQ Monitoring

Check failed jobs:
```typescript
const stats = await tokenRefreshDLQ.getStats();
console.log(stats); // { total, waiting, completed, failed }
```

Get failed job by connection:
```typescript
const job = await tokenRefreshDLQ.getByConnectionId(connectionId);
```

---

## Configuration

### Worker Settings

**File**: `apps/backend/src/workers/DistributedTokenRefreshWorker.ts`

- Concurrency: 5 workers
- Lock TTL: 120 seconds

### Scheduler Settings

**File**: `apps/backend/src/workers/TokenRefreshScheduler.ts`

- Poll Interval: 5 minutes
- Refresh Window: 24 hours before expiration
- Batch Size: 10,000 accounts per scan
- Jitter: ±10 minutes

### Queue Settings

**File**: `apps/backend/src/queue/TokenRefreshQueue.ts`

- Max Attempts: 3
- Backoff: Exponential (5s base)
- Retry Schedule: 5s, 25s, 125s

---

## Troubleshooting

### Token Refresh Failing

1. Check metrics: `token_refresh_failure_total`
2. Check logs for error messages
3. Check DLQ for failed jobs
4. Verify platform API credentials
5. Check circuit breaker state

### Circuit Breaker Open

1. Check platform API status
2. Wait 60 seconds for circuit to half-open
3. Monitor probe request
4. Circuit will close on success

### High DLQ Count

1. Check DLQ stats: `tokenRefreshDLQ.getStats()`
2. Review error messages in DLQ jobs
3. Identify common failure patterns
4. Fix root cause
5. Manually retry failed jobs

---

## Testing

### Run Integration Tests

```bash
npm test -- TokenRefreshIntegration.test.ts
```

### Manual Test

```typescript
// Enqueue test job
await tokenRefreshQueue.addRefreshJob({
  connectionId: 'account-id',
  provider: 'facebook',
  expiresAt: new Date(),
  correlationId: 'test-123',
});

// Check metrics
const metrics = distributedTokenRefreshWorker.getMetrics();
console.log(metrics);
```

---

## Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] No compilation errors
- [ ] Environment variables configured
- [ ] Redis connected
- [ ] MongoDB connected

### Deployment Steps

1. Deploy to staging
2. Run integration tests
3. Monitor metrics for 1 hour
4. Check DLQ for failures
5. Deploy to production
6. Monitor metrics for 24 hours

### Post-Deployment Monitoring

- Monitor `/metrics` endpoint
- Check DLQ every hour
- Alert on `token_refresh_failure_total > 10%`
- Alert on `circuit_blocked_total > 5`
- Alert on DLQ growth

---

## Support

**Documentation**: See `PHASE_1_IMPLEMENTATION_COMPLETE.md`  
**Tests**: See `TokenRefreshIntegration.test.ts`  
**Audit**: See `PHASE_1_TOKEN_LIFECYCLE_AUDIT.md`

---

**Status**: PRODUCTION READY ✅  
**Last Updated**: 2026-03-05
