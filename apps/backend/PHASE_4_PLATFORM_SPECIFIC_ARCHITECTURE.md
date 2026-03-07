# Phase 4: Platform-Specific Publishing Architecture

## Overview

Phase 4 has been refactored to use **platform-specific queues and workers** instead of a single unified queue. This architecture provides better rate limiting, isolation, and observability per platform.

## Architecture

```
PostScheduler (runs every 1 minute)
    ↓
PublishingRouter (routes by platform)
    ↓
Platform-Specific Queues (with rate limiters)
    ├── facebook_publish_queue (20 req/sec)
    ├── instagram_publish_queue (15 req/sec)
    ├── twitter_publish_queue (10 req/sec)
    ├── linkedin_publish_queue (5 req/sec)
    └── tiktok_publish_queue (5 req/sec)
    ↓
Platform-Specific Workers
    ├── FacebookPublisherWorker
    ├── InstagramPublisherWorker
    ├── TwitterPublisherWorker
    ├── LinkedInPublisherWorker
    └── TikTokPublisherWorker
    ↓
Social Media APIs
```

## Components

### 1. Post Scheduler Service
**File**: `src/services/PostSchedulerService.ts`

**Responsibilities**:
- Runs every 1 minute
- Finds posts with `status = "scheduled"` where `scheduledAt <= now`
- Batch size: 500 posts per iteration
- Applies publish time smoothing (random 0-120 seconds)
- Routes posts to PublishingRouter

**Key Features**:
- Prevents duplicate scheduling with status checks
- Oldest posts processed first
- Telemetry integration with OpenTelemetry spans

### 2. Publishing Router
**File**: `src/services/PublishingRouter.ts`

**Responsibilities**:
- Routes publishing jobs to platform-specific queues
- Maintains references to all 5 platform queues
- Provides unified interface for job routing

**Routing Logic**:
```typescript
switch (platform.toLowerCase()) {
  case 'facebook': → facebook_publish_queue
  case 'instagram': → instagram_publish_queue
  case 'twitter': → twitter_publish_queue
  case 'linkedin': → linkedin_publish_queue
  case 'tiktok': → tiktok_publish_queue
}
```

### 3. Platform-Specific Queues

Each platform has its own BullMQ queue with platform-specific rate limits:

| Queue | File | Rate Limit | Concurrency |
|-------|------|------------|-------------|
| `facebook_publish_queue` | `src/queue/FacebookPublishQueue.ts` | 20 req/sec | 5 |
| `instagram_publish_queue` | `src/queue/InstagramPublishQueue.ts` | 15 req/sec | 5 |
| `twitter_publish_queue` | `src/queue/TwitterPublishQueue.ts` | 10 req/sec | 5 |
| `linkedin_publish_queue` | `src/queue/LinkedInPublishQueue.ts` | 5 req/sec | 3 |
| `tiktok_publish_queue` | `src/queue/TikTokPublishQueue.ts` | 5 req/sec | 3 |

**Queue Configuration**:
- **Retry Strategy**: 5 attempts with exponential backoff (5s → 10s → 20s → 40s → 80s)
- **Job Retention**: Completed jobs kept for 24 hours (max 1000), failed jobs kept indefinitely
- **Job ID**: `{platform}:{postId}` (prevents duplicates)

### 4. Platform-Specific Workers

Each platform has a dedicated worker that processes jobs from its queue:

| Worker | File | Platform Publisher |
|--------|------|-------------------|
| `FacebookPublisherWorker` | `src/workers/FacebookPublisherWorker.ts` | `FacebookPublisher` |
| `InstagramPublisherWorker` | `src/workers/InstagramPublisherWorker.ts` | `InstagramPublisher` |
| `TwitterPublisherWorker` | `src/workers/TwitterPublisherWorker.ts` | `TwitterPublisher` |
| `LinkedInPublisherWorker` | `src/workers/LinkedInPublisherWorker.ts` | `LinkedInPublisher` |
| `TikTokPublisherWorker` | `src/workers/TikTokPublisherWorker.ts` | `TikTokPublisher` |

**Worker Responsibilities**:
1. Acquire Redis lock (`publish_lock:{postId}`) for idempotency
2. Fetch post and social account from database
3. Update post status: `scheduled` → `publishing`
4. Upload media if required
5. Publish to platform API
6. Update post status: `publishing` → `published` or `failed`
7. Record attempt in `PostPublishAttempt` collection
8. Update Prometheus metrics
9. Release Redis lock

### 5. Idempotent Publishing

**Redis Lock**: `publish_lock:{postId}`
- **TTL**: 5 minutes
- **Purpose**: Prevents duplicate publishing if job is retried
- **Implementation**: `PublishingLockService`

**Lock Flow**:
```typescript
1. Acquire lock → if already held, skip job
2. Process publishing
3. Release lock (in finally block)
```

### 6. Retry Strategy

**Configuration**:
- **Attempts**: 5
- **Backoff**: Exponential
- **Delays**: 5s → 10s → 20s → 40s → 80s

**Error Classification**:
- **Retryable**: Network errors, 500 errors, rate limit errors (429)
- **Non-retryable**: Invalid token, invalid content, 400 errors

**Dead Letter Queue (DLQ)**:
- Failed jobs after 5 retries are kept in the queue with `removeOnFail: false`
- Can be manually inspected and retried

### 7. Observability

**Prometheus Metrics** (per platform):
```typescript
// Success/failure counters
posts_published_total{platform, status}
posts_failed_total{platform, error_type}

// Retry tracking
publish_retry_total{platform}

// Duration histograms
publish_duration_ms{platform, status}

// Delay tracking
publish_delay_ms{platform}

// Attempt tracking
publish_attempt_total{platform, status}
publish_attempt_failure_total{platform, error_code}
```

**Structured Logs**:
```typescript
// Job lifecycle
post_publish_started
post_publish_success
post_publish_failed
post_publish_retry

// Routing
publish_job_routed

// Scheduler
posts_scheduled
scheduler_iteration_complete
```

### 8. Failure Handling

**Handled Cases**:
1. **Platform API Timeout**: Retry with exponential backoff
2. **Rate Limit Error (429)**: Retry with backoff (BullMQ rate limiter prevents this)
3. **Temporary Server Error (500)**: Retry with backoff
4. **Invalid Token**: Mark account as `requires_reauth`, don't retry
5. **Invalid Content (400)**: Don't retry, mark as failed

**Account Reauth Flow**:
```typescript
if (error.code === 'INVALID_TOKEN') {
  account.status = 'requires_reauth';
  await account.save();
  // Don't retry
}
```

## Files Created

### Queues (5 files)
- `src/queue/FacebookPublishQueue.ts`
- `src/queue/InstagramPublishQueue.ts`
- `src/queue/TwitterPublishQueue.ts`
- `src/queue/LinkedInPublishQueue.ts`
- `src/queue/TikTokPublishQueue.ts`

### Services (1 file)
- `src/services/PublishingRouter.ts`

### Workers (5 files)
- `src/workers/FacebookPublisherWorker.ts`
- `src/workers/InstagramPublisherWorker.ts`
- `src/workers/TwitterPublisherWorker.ts`
- `src/workers/LinkedInPublisherWorker.ts`
- `src/workers/TikTokPublisherWorker.ts`

## Files Modified

### Services
- `src/services/PostSchedulerService.ts`
  - Changed from recovery mode (5 min interval) to active scheduling (1 min interval)
  - Replaced `PostPublishingQueue` with `PublishingRouter`
  - Added publish time smoothing (0-120 seconds)
  - Increased batch size from 100 to 500

### Server Initialization
- `src/server.ts`
  - Replaced single worker initialization with 5 platform workers
  - Added PublishingRouter initialization
  - Updated logging to reflect platform-specific architecture

## Benefits of Platform-Specific Architecture

### 1. Better Rate Limiting
- Each platform has its own rate limiter
- No cross-platform interference
- Respects platform-specific limits

### 2. Improved Isolation
- Facebook issues don't affect Twitter publishing
- Platform-specific failures are isolated
- Easier to debug platform-specific problems

### 3. Enhanced Observability
- Metrics are per-platform
- Easy to identify which platform has issues
- Better capacity planning per platform

### 4. Scalability
- Can scale workers independently per platform
- High-volume platforms (Facebook) can have more workers
- Low-volume platforms (LinkedIn) can have fewer workers

### 5. Flexibility
- Can pause/resume individual platforms
- Can adjust rate limits per platform
- Can deploy platform-specific fixes

## Monitoring Dashboard Data

**Queue Metrics** (per platform):
- Queue depth (waiting jobs)
- Active jobs
- Completed jobs
- Failed jobs
- Delayed jobs

**Publishing Metrics** (per platform):
- Publish success rate
- Average publish delay
- Retry rate
- DLQ size
- Error distribution by type

**Performance Metrics** (per platform):
- Average publish duration
- P50, P95, P99 latencies
- Throughput (posts/minute)

## Testing

### Manual Testing
```bash
# Check queue stats
redis-cli KEYS "*publish_queue*"

# Check active jobs
redis-cli HGETALL "bull:facebook_publish_queue:active"

# Check failed jobs
redis-cli HGETALL "bull:facebook_publish_queue:failed"

# Check metrics
curl http://localhost:3000/metrics | grep publish
```

### Integration Testing
```typescript
// Test scheduler → router → queue flow
const post = await ScheduledPost.create({
  platform: 'facebook',
  scheduledAt: new Date(),
  status: 'scheduled',
  // ...
});

// Wait for scheduler to run
await sleep(65000); // 1 minute + buffer

// Verify post was routed
const updatedPost = await ScheduledPost.findById(post._id);
expect(updatedPost.status).toBe('queued');
```

## Deployment Checklist

- [x] All 5 platform queues created
- [x] All 5 platform workers created
- [x] PublishingRouter implemented
- [x] PostSchedulerService refactored
- [x] Server.ts updated
- [x] Metrics updated for platform-specific tracking
- [x] Idempotency locks implemented
- [x] Retry strategy configured
- [x] Error handling implemented
- [x] Documentation created

## Next Steps

1. **Integration Tests**: Create comprehensive integration tests for all platforms
2. **Load Testing**: Test with high volume to verify rate limiters work correctly
3. **Monitoring Setup**: Configure Grafana dashboards for platform-specific metrics
4. **Alerting**: Set up alerts for queue depth, failure rates, and DLQ size
5. **Documentation**: Update API documentation and runbooks

## Comparison with Previous Architecture

| Aspect | Previous (Single Queue) | New (Platform-Specific) |
|--------|------------------------|-------------------------|
| Queues | 1 (`post-publishing-queue`) | 5 (one per platform) |
| Workers | 1 (`PostPublishingWorker`) | 5 (one per platform) |
| Rate Limiting | Global (100/min) | Per-platform (5-20/sec) |
| Isolation | None | Full platform isolation |
| Metrics | Aggregated | Per-platform |
| Scalability | Limited | High (independent scaling) |
| Debugging | Difficult | Easy (platform-specific) |

## Conclusion

The platform-specific architecture provides better isolation, observability, and scalability compared to the single-queue approach. Each platform now has its own queue, worker, and rate limiter, making the system more robust and easier to monitor.

**Status**: ✅ PHASE 4 REFACTORING COMPLETE
