# Phase 4 Task P4-7: Publishing Audit Logs - COMPLETE

## Overview
Implemented comprehensive audit logging for all publishing attempts, enabling debugging, analytics, and retry logic tracking.

---

## Implementation Summary

### ✅ STEP 1: PostPublishAttempt MongoDB Model
**Status**: COMPLETE (Updated with new fields)

**Model**: `PostPublishAttempt`

**Fields**:
```typescript
{
  _id: ObjectId;
  postId: ObjectId;              // Reference to ScheduledPost
  workspaceId: ObjectId;         // NEW: Workspace isolation
  platform: string;              // Social platform
  socialAccountId: ObjectId;     // NEW: Account reference
  attemptNumber: number;         // Attempt sequence (1, 2, 3...)
  status: 'success' | 'failed' | 'retrying';
  errorCode?: string;            // Error category
  errorMessage?: string;         // Detailed error message (stored as 'error')
  platformResponse?: object;     // Platform API response
  duration?: number;             // Attempt duration in ms
  publishedAt?: Date;            // NEW: Timestamp when published
  createdAt: Date;               // Attempt timestamp
}
```

**Enums**:
```typescript
enum AttemptStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}
```

**Files**:
- `src/models/PostPublishAttempt.ts`

---

### ✅ STEP 2: PostPublishingWorker Integration
**Status**: COMPLETE

**Before Publishing**:
- Worker does NOT create "retrying" status (not needed with current architecture)
- Attempts are recorded after completion (success or failure)

**After Success**:
```typescript
await PostPublishAttempt.recordAttempt({
  postId: post._id,
  workspaceId: post.workspaceId,
  platform,
  socialAccountId: post.socialAccountId,
  attemptNumber,
  status: AttemptStatus.SUCCESS,
  platformResponse: result,
  duration,
  publishedAt: new Date(),
});
```

**After Failure**:
```typescript
await PostPublishAttempt.recordAttempt({
  postId,
  workspaceId: post.workspaceId,
  platform,
  socialAccountId: post.socialAccountId,
  attemptNumber,
  status: AttemptStatus.FAILED,
  error: errorInfo.message,
  errorCode: errorInfo.category,
  duration,
});
```

**Files**:
- `src/workers/PostPublishingWorker.ts` (modified)

---

### ✅ STEP 3: Link Attempts to ScheduledPost
**Status**: COMPLETE

**Relationship**:
- PostPublishAttempt.postId → ScheduledPost._id
- One-to-many relationship (one post, many attempts)

**Query Pattern**:
```typescript
// Get all attempts for a post
const attempts = await PostPublishAttempt.find({ postId })
  .sort({ attemptNumber: 1 });

// Get latest attempt
const latest = await PostPublishAttempt.findOne({ postId })
  .sort({ attemptNumber: -1 });
```

**Static Methods**:
- `recordAttempt()` - Create new attempt record
- `getAttemptHistory()` - Get all attempts for a post
- `getLatestAttempt()` - Get most recent attempt
- `getFailureRate()` - Calculate failure rate for platform

---

### ✅ STEP 4: Database Indexes
**Status**: COMPLETE

**Indexes Created**:

1. **Single Field Indexes**:
   - `postId` - For attempt lookups
   - `workspaceId` - For workspace queries
   - `platform` - For platform analytics
   - `socialAccountId` - For account queries
   - `status` - For status filtering
   - `errorCode` - For error analysis
   - `createdAt` - For time-based queries

2. **Compound Indexes**:
   - `{ postId: 1, platform: 1 }` - Attempt history by post and platform
   - `{ workspaceId: 1, createdAt: -1 }` - Workspace analytics
   - `{ postId: 1, attemptNumber: 1 }` - Attempt history ordered
   - `{ platform: 1, status: 1, createdAt: -1 }` - Platform analytics
   - `{ status: 1, createdAt: -1 }` - Monitoring queries

**Query Performance**:
- Attempt history: O(log n) with postId index
- Workspace analytics: O(log n) with compound index
- Platform failure rate: O(log n) with compound index

---

### ✅ STEP 5: API Endpoint
**Status**: COMPLETE (Already implemented)

**Endpoint**: `GET /api/v1/posts/:id`

**Query Parameters**:
- `workspaceId` (required) - Workspace ID

**Response**:
```json
{
  "success": true,
  "data": {
    "post": {
      "id": "507f1f77bcf86cd799439011",
      "platform": "twitter",
      "content": "Post content",
      "status": "published",
      "scheduledAt": "2026-03-04T15:00:00Z",
      "publishedAt": "2026-03-04T15:00:05Z",
      ...
    },
    "attempts": [
      {
        "id": "507f1f77bcf86cd799439020",
        "postId": "507f1f77bcf86cd799439011",
        "workspaceId": "507f1f77bcf86cd799439012",
        "platform": "twitter",
        "socialAccountId": "507f1f77bcf86cd799439013",
        "attemptNumber": 1,
        "status": "failed",
        "errorCode": "RATE_LIMIT",
        "error": "Rate limit exceeded",
        "duration": 1250,
        "createdAt": "2026-03-04T15:00:00Z"
      },
      {
        "id": "507f1f77bcf86cd799439021",
        "postId": "507f1f77bcf86cd799439011",
        "workspaceId": "507f1f77bcf86cd799439012",
        "platform": "twitter",
        "socialAccountId": "507f1f77bcf86cd799439013",
        "attemptNumber": 2,
        "status": "success",
        "platformResponse": {
          "platformPostId": "1234567890",
          "url": "https://twitter.com/user/status/1234567890"
        },
        "duration": 980,
        "publishedAt": "2026-03-04T15:05:00Z",
        "createdAt": "2026-03-04T15:05:00Z"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-04T15:10:00Z",
    "requestId": "req_123"
  }
}
```

**Files**:
- `src/controllers/PostController.ts` - `getPostById()` handler
- `src/services/PostService.ts` - `getPostWithAttempts()` method
- `src/routes/v1/posts.routes.ts` - Route definition

---

### ✅ STEP 6: Prometheus Metrics
**Status**: COMPLETE

**Metrics Implemented**:

1. **publish_attempt_total** (Counter)
   - Labels: platform, status
   - Tracks all publish attempts
   - Incremented on every attempt (success or failure)

2. **publish_attempt_failure_total** (Counter)
   - Labels: platform, error_code
   - Tracks failed attempts by error type
   - Incremented only on failures

**Helper Functions**:
```typescript
recordPublishAttempt(platform: string, status: 'success' | 'failed'): void
recordPublishAttemptFailure(platform: string, errorCode: string): void
```

**Integration**:
- Metrics recorded in `PostPublishingWorker.process()`
- Success: `recordPublishAttempt(platform, 'success')`
- Failure: `recordPublishAttempt(platform, 'failed')` + `recordPublishAttemptFailure(platform, errorCode)`

**Files**:
- `src/config/publishingMetrics.ts` (modified)
- `src/workers/PostPublishingWorker.ts` (modified)

**Monitoring Queries**:
```promql
# Total attempts by platform
sum(rate(publish_attempt_total[5m])) by (platform)

# Success rate by platform
sum(rate(publish_attempt_total{status="success"}[5m])) by (platform) / 
sum(rate(publish_attempt_total[5m])) by (platform)

# Failure rate by platform
sum(rate(publish_attempt_total{status="failed"}[5m])) by (platform) / 
sum(rate(publish_attempt_total[5m])) by (platform)

# Most common error codes
topk(5, sum(rate(publish_attempt_failure_total[5m])) by (error_code))

# Failures by platform and error code
sum(rate(publish_attempt_failure_total[5m])) by (platform, error_code)
```

---

### ✅ STEP 7: OpenAPI Documentation
**Status**: COMPLETE (Already documented)

**Endpoint Documentation**: `GET /api/v1/posts/:id`

**OpenAPI Spec**:
```yaml
/api/v1/posts/{id}:
  get:
    summary: Get post by ID
    description: Retrieve a specific post with its publish attempts
    tags:
      - Posts
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
        description: Post ID
      - in: query
        name: workspaceId
        required: true
        schema:
          type: string
        description: Workspace ID
    responses:
      200:
        description: Post retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                data:
                  type: object
                  properties:
                    post:
                      $ref: '#/components/schemas/Post'
                    attempts:
                      type: array
                      items:
                        $ref: '#/components/schemas/PostAttempt'
      404:
        description: Post not found
```

**Schema Definitions**:
- `Post` - Complete post object
- `PostAttempt` - Attempt record with all fields

**Files**:
- `src/routes/v1/posts.routes.ts` - OpenAPI annotations

---

### ✅ STEP 8: Architecture Report
**Status**: COMPLETE (This document)

---

## Architecture

### Audit Log Flow

```
┌──────────────────────┐
│ PostPublishingWorker │
└──────────┬───────────┘
           │
           │ 1. Start publishing
           ▼
┌──────────────────────┐
│ Acquire Lock         │
│ Fetch Post & Account │
│ Update status        │
└──────────┬───────────┘
           │
           │ 2. Publish to platform
           ▼
┌──────────────────────┐
│ Platform API Call    │
└──────────┬───────────┘
           │
           ├─── SUCCESS ───┐
           │               │
           │               ▼
           │    ┌──────────────────────┐
           │    │ PostPublishAttempt   │
           │    │ status: SUCCESS      │
           │    │ publishedAt: now     │
           │    │ platformResponse: {} │
           │    │ duration: 980ms      │
           │    └──────────────────────┘
           │               │
           │               ▼
           │    ┌──────────────────────┐
           │    │ Metrics              │
           │    │ - publish_attempt    │
           │    │   (success)          │
           │    └──────────────────────┘
           │
           └─── FAILURE ───┐
                           │
                           ▼
                ┌──────────────────────┐
                │ PostPublishAttempt   │
                │ status: FAILED       │
                │ errorCode: RATE_LIMIT│
                │ error: "Rate limit..." │
                │ duration: 1250ms     │
                └──────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ Metrics              │
                │ - publish_attempt    │
                │   (failed)           │
                │ - publish_attempt_   │
                │   failure (RATE_LIMIT)│
                └──────────────────────┘
```

### Data Model Relationships

```
┌─────────────────┐
│ ScheduledPost   │
│ _id             │◄──────┐
│ workspaceId     │       │
│ socialAccountId │       │
│ platform        │       │
│ content         │       │
│ status          │       │
│ scheduledAt     │       │
│ publishedAt     │       │
└─────────────────┘       │
                          │
                          │ postId (FK)
                          │
                ┌─────────────────────┐
                │ PostPublishAttempt  │
                │ _id                 │
                │ postId              │───┘
                │ workspaceId         │
                │ platform            │
                │ socialAccountId     │
                │ attemptNumber       │
                │ status              │
                │ errorCode           │
                │ error               │
                │ platformResponse    │
                │ duration            │
                │ publishedAt         │
                │ createdAt           │
                └─────────────────────┘
```

---

## Use Cases

### 1. Debugging Failed Posts

**Scenario**: A post failed to publish to Twitter

**Query**:
```typescript
const { post, attempts } = await postService.getPostWithAttempts(postId, workspaceId);

// Analyze attempts
attempts.forEach(attempt => {
  console.log(`Attempt ${attempt.attemptNumber}:`);
  console.log(`  Status: ${attempt.status}`);
  console.log(`  Error: ${attempt.errorCode} - ${attempt.error}`);
  console.log(`  Duration: ${attempt.duration}ms`);
});
```

**Output**:
```
Attempt 1:
  Status: failed
  Error: RATE_LIMIT - Rate limit exceeded
  Duration: 1250ms

Attempt 2:
  Status: failed
  Error: RATE_LIMIT - Rate limit exceeded
  Duration: 980ms

Attempt 3:
  Status: success
  Error: undefined
  Duration: 850ms
```

### 2. Platform Failure Analysis

**Scenario**: Analyze Twitter publishing failures

**Query**:
```typescript
const failureRate = await PostPublishAttempt.getFailureRate(
  'twitter',
  new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
);

console.log(`Twitter failure rate: ${failureRate.toFixed(2)}%`);
```

**Prometheus Query**:
```promql
# Failure rate by error code
sum(rate(publish_attempt_failure_total{platform="twitter"}[24h])) by (error_code)
```

### 3. Retry Success Tracking

**Scenario**: Track how many posts succeed after retries

**MongoDB Query**:
```typescript
const postsWithRetries = await PostPublishAttempt.aggregate([
  {
    $group: {
      _id: '$postId',
      attempts: { $sum: 1 },
      finalStatus: { $last: '$status' },
    },
  },
  {
    $match: {
      attempts: { $gt: 1 },
      finalStatus: 'success',
    },
  },
]);

console.log(`${postsWithRetries.length} posts succeeded after retries`);
```

### 4. Performance Monitoring

**Scenario**: Monitor publishing performance

**Prometheus Query**:
```promql
# Average duration by platform
avg(publish_duration_ms) by (platform)

# 95th percentile duration
histogram_quantile(0.95, publish_duration_ms)

# Attempts per post
avg(publish_attempt_total) by (platform)
```

---

## Testing

### 1. Test Successful Publish
```bash
# Create and publish a post
POST /api/v1/posts
{
  "workspaceId": "workspace_id",
  "socialAccountId": "account_id",
  "platform": "twitter",
  "content": "Test post",
  "scheduledAt": "2026-03-04T15:00:00Z"
}

# Wait for publishing

# Get post with attempts
GET /api/v1/posts/{postId}?workspaceId=workspace_id

# Verify attempt record
# - attemptNumber: 1
# - status: success
# - publishedAt: present
# - platformResponse: present
```

### 2. Test Failed Publish with Retry
```bash
# Simulate rate limit (requires test setup)
# Post will fail first attempt, succeed on retry

# Get post with attempts
GET /api/v1/posts/{postId}?workspaceId=workspace_id

# Verify attempt records
# Attempt 1:
#   - status: failed
#   - errorCode: RATE_LIMIT
# Attempt 2:
#   - status: success
#   - publishedAt: present
```

### 3. Test Metrics
```bash
# Check metrics endpoint
GET /metrics

# Verify metrics present:
# publish_attempt_total{platform="twitter",status="success"} 10
# publish_attempt_total{platform="twitter",status="failed"} 2
# publish_attempt_failure_total{platform="twitter",error_code="RATE_LIMIT"} 2
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Attempt Success Rate**
```promql
sum(rate(publish_attempt_total{status="success"}[5m])) / 
sum(rate(publish_attempt_total[5m]))
```

2. **Failure Rate by Platform**
```promql
sum(rate(publish_attempt_total{status="failed"}[5m])) by (platform)
```

3. **Most Common Errors**
```promql
topk(5, sum(rate(publish_attempt_failure_total[5m])) by (error_code))
```

4. **Average Attempts per Post**
```promql
sum(rate(publish_attempt_total[5m])) / 
sum(rate(posts_published_total[5m]))
```

### Recommended Alerts

```yaml
- alert: HighPublishFailureRate
  expr: |
    sum(rate(publish_attempt_total{status="failed"}[5m])) / 
    sum(rate(publish_attempt_total[5m])) > 0.2
  for: 10m
  annotations:
    summary: High publish failure rate (>20%)

- alert: PlatformPublishingDown
  expr: |
    sum(rate(publish_attempt_total{status="failed"}[5m])) by (platform) / 
    sum(rate(publish_attempt_total[5m])) by (platform) > 0.8
  for: 5m
  annotations:
    summary: Platform {{ $labels.platform }} publishing mostly failing

- alert: FrequentRateLimits
  expr: |
    sum(rate(publish_attempt_failure_total{error_code="RATE_LIMIT"}[5m])) by (platform) > 0.5
  for: 10m
  annotations:
    summary: Frequent rate limits on {{ $labels.platform }}
```

---

## Files Modified

1. `src/models/PostPublishAttempt.ts` - Added workspaceId, socialAccountId, publishedAt fields
2. `src/workers/PostPublishingWorker.ts` - Updated attempt recording with new fields
3. `src/config/publishingMetrics.ts` - Added publish_attempt_total and publish_attempt_failure_total metrics
4. `src/controllers/PostController.ts` - Already has getPostById with attempts (no changes needed)
5. `src/services/PostService.ts` - Already has getPostWithAttempts (no changes needed)
6. `src/routes/v1/posts.routes.ts` - Already documented (no changes needed)

---

## Benefits

### 1. Debugging
- Complete audit trail of all publish attempts
- Error codes and messages for troubleshooting
- Platform responses for API debugging
- Duration tracking for performance issues

### 2. Analytics
- Failure rate by platform
- Most common error types
- Retry success rate
- Performance metrics

### 3. Monitoring
- Real-time failure detection
- Platform health tracking
- Rate limit monitoring
- Alert triggering

### 4. Compliance
- Complete audit log for compliance
- Workspace isolation
- Timestamp tracking
- Immutable records

---

## Status: COMPLETE ✅

Phase 4 Task P4-7 Publishing Audit Logs is complete with:
- ✅ PostPublishAttempt model with all required fields
- ✅ Worker integration for attempt recording
- ✅ Linked attempts to ScheduledPost
- ✅ Database indexes for performance
- ✅ API endpoint for retrieving attempts
- ✅ Prometheus metrics (2 new metrics)
- ✅ OpenAPI documentation
- ✅ Architecture report

**All publishing attempts are now fully audited and queryable.**

---

**Completion Date**: 2026-03-04  
**Task**: Phase 4 Task P4-7 - Publishing Audit Logs  
**Status**: COMPLETE ✅
