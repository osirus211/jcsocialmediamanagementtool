# Phase 4 Quick Reference Guide

## Architecture Overview

```
PostScheduler (1 min) → PublishingRouter → Platform Queues → Platform Workers → APIs
```

## Platform Rate Limits

| Platform | Rate Limit | Concurrency | Queue Name |
|----------|------------|-------------|------------|
| Facebook | 20/sec | 5 | `facebook_publish_queue` |
| Instagram | 15/sec | 5 | `instagram_publish_queue` |
| Twitter | 10/sec | 5 | `twitter_publish_queue` |
| LinkedIn | 5/sec | 3 | `linkedin_publish_queue` |
| TikTok | 5/sec | 3 | `tiktok_publish_queue` |

## Key Components

### PostSchedulerService
- **Interval**: 1 minute
- **Batch Size**: 500 posts
- **Smoothing**: 0-120 seconds random delay
- **File**: `src/services/PostSchedulerService.ts`

### PublishingRouter
- **Purpose**: Routes jobs to platform queues
- **File**: `src/services/PublishingRouter.ts`

### Platform Workers
- **Facebook**: `src/workers/FacebookPublisherWorker.ts`
- **Instagram**: `src/workers/InstagramPublisherWorker.ts`
- **Twitter**: `src/workers/TwitterPublisherWorker.ts`
- **LinkedIn**: `src/workers/LinkedInPublisherWorker.ts`
- **TikTok**: `src/workers/TikTokPublisherWorker.ts`

## Redis Keys

### Locks
```
publish_lock:{postId}  # TTL: 5 minutes
```

### Queues
```
bull:facebook_publish_queue:*
bull:instagram_publish_queue:*
bull:twitter_publish_queue:*
bull:linkedin_publish_queue:*
bull:tiktok_publish_queue:*
```

## Common Commands

### Check Queue Stats
```bash
# All queues
redis-cli KEYS "*publish_queue*"

# Specific platform
redis-cli KEYS "bull:facebook_publish_queue:*"

# Active jobs
redis-cli HGETALL "bull:facebook_publish_queue:active"

# Waiting jobs
redis-cli LLEN "bull:facebook_publish_queue:wait"

# Failed jobs
redis-cli ZCARD "bull:facebook_publish_queue:failed"
```

### Check Metrics
```bash
# All publish metrics
curl http://localhost:3000/metrics | grep publish

# Platform-specific
curl http://localhost:3000/metrics | grep 'platform="facebook"'

# Success rate
curl http://localhost:3000/metrics | grep posts_published_total

# Failure rate
curl http://localhost:3000/metrics | grep posts_failed_total
```

### Monitor Logs
```bash
# All publishing logs
tail -f logs/app.log | grep publish

# Platform-specific
tail -f logs/app.log | grep "platform.*facebook"

# Errors only
tail -f logs/app.log | grep "ERROR.*publish"
```

## Post Status Flow

```
scheduled → queued → publishing → published
                              ↓
                           failed
```

## Retry Strategy

- **Attempts**: 5
- **Delays**: 5s → 10s → 20s → 40s → 80s
- **Backoff**: Exponential
- **DLQ**: Failed jobs kept indefinitely

## Error Types

### Retryable
- Network errors
- 500 server errors
- 429 rate limit errors
- Timeout errors

### Non-Retryable
- Invalid token (401)
- Invalid content (400)
- Forbidden (403)
- Not found (404)

## Metrics Reference

### Counters
```
posts_published_total{platform, status}
posts_failed_total{platform, error_type}
publish_retry_total{platform}
publish_attempt_total{platform, status}
publish_attempt_failure_total{platform, error_code}
```

### Histograms
```
publish_duration_ms{platform, status}
publish_delay_ms{platform}
```

## Troubleshooting

### Queue Not Processing
```bash
# Check worker status
curl http://localhost:3000/health

# Check Redis connection
redis-cli PING

# Check queue depth
redis-cli LLEN "bull:facebook_publish_queue:wait"

# Check active jobs
redis-cli HGETALL "bull:facebook_publish_queue:active"
```

### High Failure Rate
```bash
# Check error distribution
curl http://localhost:3000/metrics | grep posts_failed_total

# Check recent failures
redis-cli ZRANGE "bull:facebook_publish_queue:failed" 0 10 WITHSCORES

# Check logs
tail -f logs/app.log | grep "ERROR.*facebook"
```

### Slow Publishing
```bash
# Check publish duration
curl http://localhost:3000/metrics | grep publish_duration_ms

# Check queue backlog
redis-cli LLEN "bull:facebook_publish_queue:wait"

# Check rate limiter
redis-cli GET "bull:facebook_publish_queue:limiter"
```

### Duplicate Publishing
```bash
# Check locks
redis-cli KEYS "publish_lock:*"

# Check specific lock
redis-cli GET "publish_lock:{postId}"
redis-cli TTL "publish_lock:{postId}"
```

## Testing

### Create Test Post
```bash
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "platform": "facebook",
    "content": "Test post",
    "scheduledAt": "2026-03-05T12:00:00Z"
  }'
```

### Force Scheduler Run
```typescript
// In Node.js REPL or test
const { postSchedulerService } = require('./services/PostSchedulerService');
await postSchedulerService.forceRun();
```

### Check Job Status
```bash
# Get job by ID
redis-cli HGET "bull:facebook_publish_queue:facebook:{postId}" data

# Check job state
redis-cli HGET "bull:facebook_publish_queue:facebook:{postId}" state
```

## Performance Tuning

### Increase Concurrency
Edit worker file:
```typescript
concurrency: 10, // Increase from 5
```

### Adjust Rate Limit
Edit queue file:
```typescript
limiter: {
  max: 30, // Increase from 20
  duration: 1000,
}
```

### Increase Batch Size
Edit `PostSchedulerService.ts`:
```typescript
const BATCH_SIZE = 1000; // Increase from 500
```

### Reduce Smoothing Window
Edit `PostSchedulerService.ts`:
```typescript
const SMOOTHING_WINDOW = 60; // Reduce from 120
```

## Monitoring Alerts

### Critical
- Queue depth > 1000
- Failure rate > 10%
- DLQ size > 100
- Worker down > 5 min

### Warning
- Queue depth > 500
- Failure rate > 5%
- Avg delay > 5 min
- Retry rate > 20%

## Files Reference

### Queues
- `src/queue/FacebookPublishQueue.ts`
- `src/queue/InstagramPublishQueue.ts`
- `src/queue/TwitterPublishQueue.ts`
- `src/queue/LinkedInPublishQueue.ts`
- `src/queue/TikTokPublishQueue.ts`

### Workers
- `src/workers/FacebookPublisherWorker.ts`
- `src/workers/InstagramPublisherWorker.ts`
- `src/workers/TwitterPublisherWorker.ts`
- `src/workers/LinkedInPublisherWorker.ts`
- `src/workers/TikTokPublisherWorker.ts`

### Services
- `src/services/PostSchedulerService.ts`
- `src/services/PublishingRouter.ts`
- `src/services/PublishingLockService.ts`

### Configuration
- `src/config/publishingMetrics.ts`
- `src/server.ts`

## Support

For issues or questions:
1. Check logs: `tail -f logs/app.log`
2. Check metrics: `curl http://localhost:3000/metrics`
3. Check Redis: `redis-cli KEYS "*publish*"`
4. Review documentation: `PHASE_4_PLATFORM_SPECIFIC_ARCHITECTURE.md`
