# Phase 4: Publishing Pipeline - Architecture Report

**Date:** 2026-03-04  
**Status:** ✅ STARTED  
**Version:** 4.0

---

## Executive Summary

Phase 4 Publishing Pipeline implementation has been **STARTED**.

The system provides:
- Scheduled post management
- BullMQ-based publishing queue
- Platform-specific publishers
- Rate limiting per platform
- Retry with exponential backoff
- Publishing metrics and observability

---

## Architecture Overview

### Publishing Flow

```
User Creates Post
    ↓
ScheduledPost (MongoDB)
    ↓
Post Scheduler Service (runs every 30s)
    ↓
Query posts where scheduledAt <= now
    ↓
Enqueue to post-publishing-queue (BullMQ)
    ↓
Update status → queued
    ↓
Publishing Worker
    ↓
Fetch Post + Social Account
    ↓
Resolve Platform Publisher
    ↓
Check Rate Limit
    ↓
Upload Media (if required)
    ↓
Publish to Platform API
    ↓
Update status → published
    ↓
Record PostPublishAttempt
    ↓
Update Metrics
```

---

## Component Details

### 1. ScheduledPost Model

**File**: `src/models/ScheduledPost.ts`

**Schema**:
```typescript
{
  workspaceId: ObjectId (indexed)
  socialAccountId: ObjectId (indexed)
  platform: enum (twitter, facebook, instagram, linkedin, tiktok)
  content: string
  mediaUrls: string[]
  scheduledAt: Date (indexed)
  status: enum (scheduled, queued, publishing, published, failed) (indexed)
  publishedAt: Date
  failureReason: string
  platformPostId: string
  metadata: object
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `{ status: 1, scheduledAt: 1 }` - For scheduler queries
- `{ workspaceId: 1, status: 1 }` - For workspace queries
- `{ workspaceId: 1, scheduledAt: -1 }` - For listing posts
- `{ socialAccountId: 1, status: 1 }` - For account queries

**Status Flow**:
```
scheduled → queued → publishing → published
                              ↓
                           failed
```

---

### 2. PostPublishAttempt Model

**File**: `src/models/PostPublishAttempt.ts`

**Schema**:
```typescript
{
  postId: ObjectId (indexed)
  platform: string (indexed)
  attemptNumber: number
  status: enum (success, failed, retrying) (indexed)
  error: string
  errorCode: string (indexed)
  platformResponse: object
  duration: number (milliseconds)
  createdAt: Date (indexed)
}
```

**Purpose**:
- Track all publishing attempts
- Debug publishing failures
- Analytics on retry patterns
- Platform error analysis

**Indexes**:
- `{ postId: 1, attemptNumber: 1 }` - For attempt history
- `{ platform: 1, status: 1, createdAt: -1 }` - For analytics
- `{ status: 1, createdAt: -1 }` - For monitoring

---

### 3. Publishing Queue

**File**: `src/queue/PostPublishingQueue.ts`

**Queue Name**: `post-publishing-queue`

**Configuration**:
```typescript
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000 // Start with 2 seconds
  },
  removeOnComplete: {
    age: 24 * 3600, // 24 hours
    count: 1000
  },
  removeOnFail: {
    age: 7 * 24 * 3600 // 7 days
  }
}
```

**Worker Configuration**:
```typescript
{
  concurrency: 10, // Process 10 jobs concurrently
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000 // per minute
  }
}
```

**Retry Strategy**:
- Attempt 1: Immediate
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay
- Attempt 4: 8 seconds delay
- Attempt 5: 16 seconds delay

**Dead Letter Handling**:
- Failed jobs kept for 7 days
- Can be manually retried
- Analyzed for patterns

---

### 4. Post Scheduler Service

**File**: `src/services/PostSchedulerService.ts`

**Schedule**: Runs every 30 seconds

**Query**:
```typescript
ScheduledPost.find({
  status: PostStatus.SCHEDULED,
  scheduledAt: { $lte: now }
})
.limit(100)
.sort({ scheduledAt: 1 })
```

**Batch Size**: 100 posts per iteration

**Priority Calculation**:
- > 1 hour overdue: Priority 1 (highest)
- > 30 min overdue: Priority 2
- > 10 min overdue: Priority 3
- > 5 min overdue: Priority 4
- > 1 min overdue: Priority 5
- On time: Priority 10 (lowest)

**Features**:
- Prevents duplicate runs (isRunning flag)
- Distributed tracing integration
- Metrics collection
- Error handling with logging

---

### 5. Publishing Worker

**File**: `src/workers/PostPublishingWorker.ts`

**Responsibilities**:
1. Fetch post from database
2. Fetch social account with access token
3. Update post status to "publishing"
4. Resolve platform publisher
5. Upload media (if required)
6. Publish to platform API
7. Update post status to "published"
8. Record publish attempt
9. Update metrics

**Error Handling**:
- Catch all errors
- Update post status to "failed"
- Record failed attempt
- Update metrics
- Re-throw to trigger retry

**Observability**:
- Distributed tracing spans
- Prometheus metrics
- Structured logging
- Correlation IDs

---

### 6. Publisher Interface

**File**: `src/providers/publishers/IPublisher.ts`

**Interface**:
```typescript
interface IPublisher {
  readonly platform: string;
  
  publishPost(
    account: ISocialAccount,
    options: PublishPostOptions
  ): Promise<PublishPostResult>;
  
  uploadMedia(
    account: ISocialAccount,
    mediaUrls: string[]
  ): Promise<string[]>;
  
  validatePost?(options: PublishPostOptions): Promise<{
    valid: boolean;
    errors?: string[];
  }>;
  
  getLimits?(): {
    maxContentLength: number;
    maxMediaCount: number;
    supportedMediaTypes: string[];
  };
}
```

**PublishPostOptions**:
```typescript
{
  content: string;
  mediaIds?: string[];
  metadata?: Record<string, any>;
}
```

**PublishPostResult**:
```typescript
{
  platformPostId: string;
  url?: string;
  metadata?: Record<string, any>;
}
```

---

### 7. Publisher Adapters

**Implemented Publishers**:

**TwitterPublisher** (`src/providers/publishers/TwitterPublisher.ts`):
- API: Twitter API v2
- Max content: 280 characters
- Max media: 4 items
- Media upload: 3-step process (INIT, APPEND, FINALIZE)
- Supported media: images, videos

**FacebookPublisher** (`src/providers/publishers/FacebookPublisher.ts`):
- API: Graph API v18.0
- Max content: 63,206 characters
- Max media: 10 items
- Media upload: URL-based
- Supported media: images, videos

**InstagramPublisher** (`src/providers/publishers/InstagramPublisher.ts`):
- API: Graph API v18.0
- Max content: 2,200 characters
- Max media: 10 items
- Publishing: 2-step (create container, publish)
- Supported media: images, videos

**LinkedInPublisher** (`src/providers/publishers/LinkedInPublisher.ts`):
- API: LinkedIn API v2
- Max content: 3,000 characters
- Max media: 9 items
- Media upload: Placeholder (not fully implemented)
- Supported media: images

**TikTokPublisher** (`src/providers/publishers/TikTokPublisher.ts`):
- Max content: 2,200 characters
- Max media: 1 video
- Status: Placeholder (not fully implemented)

**BasePublisher**:
- Common functionality for all publishers
- HTTP client with 30s timeout
- Media download helper
- Content/media validation
- Error handling

---

### 8. Platform Rate Limiting

**File**: `src/services/PublishingRateLimiter.ts`

**Rate Limits**:

| Platform | Max Posts | Window |
|----------|-----------|--------|
| Twitter | 300 | 3 hours |
| Facebook | 50 | 1 hour |
| Instagram | 25 | 24 hours |
| LinkedIn | 100 | 24 hours |
| TikTok | 10 | 24 hours |

**Redis Key Format**:
```
publish:rate:{platform}:{accountId}
```

**Implementation**:
- Redis sorted set with timestamps
- Sliding window algorithm
- Automatic cleanup of old entries
- Fail-open on Redis errors

**Features**:
- Per-account rate limiting
- Get remaining publishes
- Get reset time
- Clear rate limit (for testing)

**Integration**:
```typescript
const rateLimiter = new PublishingRateLimiter(redis);

// Check before publishing
const isAllowed = await rateLimiter.isAllowed(platform, accountId);
if (!isAllowed) {
  throw new Error('Rate limit exceeded');
}
```

---

### 9. Publishing Metrics

**File**: `src/config/publishingMetrics.ts`

**Metrics**:

**Counters**:
- `posts_published_total` - Total posts published (by platform, status)
- `posts_failed_total` - Total failed publishes (by platform, error_type)
- `publish_retry_total` - Total retries (by platform)
- `posts_scheduled_total` - Total posts scheduled (by platform)
- `posts_queued_total` - Total posts queued (by platform)
- `publish_rate_limit_exceeded_total` - Rate limits exceeded (by platform, account_id)

**Histograms**:
- `publish_duration_ms` - Publishing duration (by platform, status)
  - Buckets: [100, 500, 1000, 2500, 5000, 10000, 30000]

**Helper Functions**:
```typescript
recordPostPublished(platform, status, durationMs);
recordPostFailed(platform, errorType);
recordPostRetry(platform);
recordPostScheduled(platform);
recordPostQueued(platform);
recordPublishRateLimitExceeded(platform, accountId);
```

---

## Integration with Existing Systems

### Queue System Integration
- Uses existing BullMQ infrastructure
- Shares Redis connection with webhook queues
- Same worker pattern as webhook workers
- Integrated with queue metrics

### Observability Integration
- OpenTelemetry tracing spans
- Prometheus metrics
- Structured logging
- Correlation IDs from tracing middleware

### Database Integration
- Uses existing MongoDB connection
- Follows existing model patterns
- Encrypted token access via SocialAccount model
- Workspace-scoped queries

---

## Error Handling Strategy

### Retry Logic
1. **Transient Errors** (network, timeout):
   - Retry with exponential backoff
   - Up to 5 attempts
   - Record each attempt

2. **Permanent Errors** (invalid token, content violation):
   - Mark as failed immediately
   - No retry
   - Record error details

3. **Rate Limit Errors**:
   - Delay retry until rate limit resets
   - Use platform-specific backoff
   - Record rate limit event

### Error Classification
```typescript
// Transient errors (retry)
- NETWORK_ERROR
- TIMEOUT_ERROR
- SERVER_ERROR (5xx)

// Permanent errors (no retry)
- INVALID_TOKEN
- CONTENT_VIOLATION
- ACCOUNT_SUSPENDED
- INVALID_MEDIA

// Rate limit errors (delay retry)
- RATE_LIMIT_EXCEEDED
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

**Publishing Success Rate**:
```
(posts_published_total{status="success"} / posts_published_total) * 100
```

**Publishing Failure Rate**:
```
(posts_failed_total / posts_published_total) * 100
```

**Average Publishing Duration**:
```
histogram_quantile(0.95, publish_duration_ms)
```

**Queue Depth**:
```
queue_depth{queue_name="post-publishing-queue"}
```

**Retry Rate**:
```
rate(publish_retry_total[5m])
```

### Alert Thresholds

| Alert | Threshold | Severity |
|-------|-----------|----------|
| Publishing failure rate | > 10% | WARNING |
| Publishing failure rate | > 25% | CRITICAL |
| Queue depth | > 1000 | WARNING |
| Queue depth | > 5000 | CRITICAL |
| Average duration | > 10s | WARNING |
| Retry rate | > 10/min | WARNING |

---

## Files Created

### Models (2)
1. `src/models/ScheduledPost.ts`
2. `src/models/PostPublishAttempt.ts`

### Queue (1)
3. `src/queue/PostPublishingQueue.ts`

### Services (2)
4. `src/services/PostSchedulerService.ts`
5. `src/services/PublishingRateLimiter.ts`

### Workers (1)
6. `src/workers/PostPublishingWorker.ts`

### Publishers (8)
7. `src/providers/publishers/IPublisher.ts`
8. `src/providers/publishers/PublisherRegistry.ts`
9. `src/providers/publishers/BasePublisher.ts`
10. `src/providers/publishers/TwitterPublisher.ts`
11. `src/providers/publishers/FacebookPublisher.ts`
12. `src/providers/publishers/InstagramPublisher.ts`
13. `src/providers/publishers/LinkedInPublisher.ts`
14. `src/providers/publishers/TikTokPublisher.ts`
15. `src/providers/publishers/index.ts`

### Metrics (1)
16. `src/config/publishingMetrics.ts`

### Documentation (1)
17. `PHASE_4_ARCHITECTURE_REPORT.md` (this document)

**Total Files**: 17

---

## Next Steps

### Immediate
1. Verify compilation (no TypeScript errors)
2. Initialize publisher registry
3. Start post scheduler service
4. Start publishing worker
5. Test end-to-end publishing flow

### Short-term
1. Implement remaining publisher features (LinkedIn, TikTok)
2. Add media validation
3. Add content validation per platform
4. Implement webhook for publish status updates
5. Add publishing analytics dashboard

### Long-term
1. Implement post preview
2. Add post templates
3. Implement bulk scheduling
4. Add AI-powered content suggestions
5. Implement post performance tracking

---

## Phase 4 Publishing Pipeline Status: STARTED ✅

**Models:** COMPLETE  
**Queue:** COMPLETE  
**Scheduler:** COMPLETE  
**Worker:** COMPLETE  
**Publishers:** STARTED (Twitter, Facebook, Instagram complete; LinkedIn, TikTok placeholders)  
**Rate Limiting:** COMPLETE  
**Metrics:** COMPLETE

---

**Phase 4 implementation has been started and core infrastructure is in place.**
