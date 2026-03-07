# Dead Letter Queue Replay System

## Overview

The DLQ Replay System provides safe recovery of permanently failed jobs from the Dead Letter Queue. It allows administrators to manually or programmatically retry failed publishing jobs with comprehensive safety guarantees.

## Problem Solved

**Before**: Jobs that failed permanently (after all retries) were stuck in the DLQ with no way to recover them without manual database intervention.

**After**: Administrators can safely replay failed jobs through API endpoints with full idempotency and safety guarantees.

## Architecture

### Components

1. **DLQReplayService** (`src/services/recovery/DLQReplayService.ts`)
   - Core replay logic with safety guarantees
   - Batch replay support
   - Dry-run preview mode
   - Metrics tracking
   - Alert integration

2. **DLQReplayController** (`src/controllers/DLQReplayController.ts`)
   - Admin API endpoints
   - Request validation
   - Audit logging

3. **Admin Routes** (`src/routes/admin.routes.ts`)
   - RESTful API for DLQ operations
   - Authentication required
   - Rate limited

## Safety Guarantees

### 1. Idempotency
- Checks if post already published before replay
- Skips posts in PUBLISHED status
- Prevents duplicate publishes

### 2. Distributed Locks
- Acquires Redis lock before replay
- Prevents concurrent replay of same job
- Safe in multi-instance environment

### 3. Post Status Validation
- Checks post still exists
- Validates post not cancelled
- Respects post lifecycle

### 4. No Queue Corruption
- Uses QueueManager's safe addJob method
- Generates new unique job ID
- Preserves original job data

### 5. No Worker Blocking
- Replay runs independently of workers
- Never blocks publishing worker
- Non-blocking async operations

### 6. Never Crashes
- All errors caught and logged
- Returns result objects (never throws)
- Failures don't stop batch processing

### 7. Horizontally Safe
- Uses distributed Redis locks
- Each instance can replay independently
- No coordination required

## Features

### 1. Single Job Replay
Replay one specific DLQ job:

```typescript
const result = await dlqReplayService.replayJob('dlq-posting-queue-123');
```

**Result**:
```typescript
{
  success: true,
  jobId: 'dlq-posting-queue-123',
  postId: '507f1f77bcf86cd799439011',
  action: 'replayed' | 'skipped' | 'failed',
  reason?: 'Already published' | 'Post not found' | 'Post cancelled',
  error?: 'Error message if failed'
}
```

### 2. Batch Replay
Replay multiple jobs at once:

```typescript
const summary = await dlqReplayService.replayBatch([
  'dlq-posting-queue-123',
  'dlq-posting-queue-456',
  'dlq-posting-queue-789',
]);
```

**Summary**:
```typescript
{
  total: 3,
  replayed: 2,
  skipped: 1,
  failed: 0,
  dryRun: false,
  results: [...],
  duration: 1234 // milliseconds
}
```

### 3. Replay All
Replay all jobs in DLQ (up to batch size limit):

```typescript
const summary = await dlqReplayService.replayAll();
```

### 4. Preview Mode
Preview what would be replayed without actually replaying:

```typescript
const preview = await dlqReplayService.preview(10);
```

**Preview**:
```typescript
[
  {
    dlqJobId: 'dlq-posting-queue-123',
    postId: '507f1f77bcf86cd799439011',
    originalQueue: 'posting-queue',
    failedAt: '2026-02-17T10:00:00.000Z',
    error: 'Social account token expired',
    attempts: 3,
    postStatus: 'failed',
    wouldReplay: true,
    skipReason: undefined
  },
  {
    dlqJobId: 'dlq-posting-queue-456',
    postId: '507f1f77bcf86cd799439012',
    originalQueue: 'posting-queue',
    failedAt: '2026-02-17T09:00:00.000Z',
    error: 'Network timeout',
    attempts: 3,
    postStatus: 'published',
    wouldReplay: false,
    skipReason: 'Already published'
  }
]
```

### 5. Dry Run Mode
Test replay logic without actually replaying:

```typescript
const dlqReplayService = new DLQReplayService({
  enabled: true,
  batchSize: 10,
  skipPublished: true,
  dryRun: true, // Dry run mode
});
```

## API Endpoints

### Authentication
All admin endpoints require authentication:
```
Authorization: Bearer <access_token>
```

### GET /api/v1/admin/dlq/stats
Get DLQ and replay statistics

**Response**:
```json
{
  "success": true,
  "data": {
    "dlqStats": {
      "total": 15,
      "waiting": 15,
      "completed": 0,
      "failed": 0
    },
    "replayMetrics": {
      "replay_attempts": 10,
      "replay_success": 8,
      "replay_skipped": 2,
      "replay_failed": 0
    }
  }
}
```

### GET /api/v1/admin/dlq/preview?limit=10
Preview DLQ jobs without replaying

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "dlqJobId": "dlq-posting-queue-123",
      "postId": "507f1f77bcf86cd799439011",
      "originalQueue": "posting-queue",
      "failedAt": "2026-02-17T10:00:00.000Z",
      "error": "Social account token expired",
      "attempts": 3,
      "postStatus": "failed",
      "wouldReplay": true
    }
  ]
}
```

### POST /api/v1/admin/dlq/replay/:jobId
Replay a single DLQ job

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "jobId": "dlq-posting-queue-123",
    "postId": "507f1f77bcf86cd799439011",
    "action": "replayed"
  }
}
```

### POST /api/v1/admin/dlq/replay-batch
Replay multiple DLQ jobs

**Request Body**:
```json
{
  "jobIds": [
    "dlq-posting-queue-123",
    "dlq-posting-queue-456"
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total": 2,
    "replayed": 2,
    "skipped": 0,
    "failed": 0,
    "dryRun": false,
    "results": [...],
    "duration": 1234
  }
}
```

### POST /api/v1/admin/dlq/replay-all
Replay all DLQ jobs (up to batch size limit)

**Response**:
```json
{
  "success": true,
  "data": {
    "total": 10,
    "replayed": 8,
    "skipped": 2,
    "failed": 0,
    "dryRun": false,
    "results": [...],
    "duration": 5678
  }
}
```

## Configuration

### Environment Variables

```bash
# DLQ Replay
DLQ_REPLAY_ENABLED=true              # Enable/disable replay system
DLQ_REPLAY_BATCH_SIZE=10             # Max jobs to replay in one batch
DLQ_REPLAY_SKIP_PUBLISHED=true       # Skip posts already published
DLQ_REPLAY_DRY_RUN=false             # Dry run mode (preview only)
```

### Config Object

```typescript
import { config } from './config';

const dlqReplayService = new DLQReplayService({
  enabled: config.dlqReplay.enabled,
  batchSize: config.dlqReplay.batchSize,
  skipPublished: config.dlqReplay.skipPublished,
  dryRun: config.dlqReplay.dryRun,
});
```

## How It Works

### Replay Flow

```
1. Admin initiates replay
   ↓
2. Fetch DLQ job
   ↓
3. Validate job data
   ↓
4. Check post exists
   ↓
5. Check post status (idempotency)
   ↓
6. Acquire distributed lock
   ↓
7. Revert post status to SCHEDULED
   ↓
8. Add job to posting queue (new job ID)
   ↓
9. Remove from DLQ
   ↓
10. Release lock
   ↓
11. Return result
```

### Skip Conditions

Jobs are skipped if:
- Post not found in database
- Post already published (idempotency)
- Post is cancelled
- Dry run mode enabled
- Lock acquisition fails

### Failure Handling

If replay fails:
- Error logged with full context
- Alert sent (if alerting enabled)
- Result returned with error details
- Other jobs in batch continue processing

## Metrics

The replay service tracks:

- `replay_attempts` - Total replay attempts
- `replay_success` - Successful replays
- `replay_skipped` - Skipped jobs
- `replay_failed` - Failed replays

Access metrics:
```typescript
const metrics = dlqReplayService.getMetrics();
```

## Alerting

Alerts are sent for:

1. **Replay Failure** (Warning)
   - Single job replay fails
   - Includes job ID and error

2. **Batch Replay Failures** (Warning)
   - Batch completes with failures
   - Includes summary statistics

## Testing

### Manual Testing

1. **Create a failed job**:
   ```bash
   # Cause a post to fail (e.g., invalid token)
   # Job will move to DLQ after all retries
   ```

2. **Preview DLQ**:
   ```bash
   curl -X GET http://localhost:5000/api/v1/admin/dlq/preview \
     -H "Authorization: Bearer <token>"
   ```

3. **Replay single job**:
   ```bash
   curl -X POST http://localhost:5000/api/v1/admin/dlq/replay/dlq-posting-queue-123 \
     -H "Authorization: Bearer <token>"
   ```

4. **Verify replay**:
   - Check logs for replay success
   - Verify post status changed to SCHEDULED
   - Verify job added to posting queue
   - Verify job removed from DLQ

### Dry Run Testing

```typescript
const dlqReplayService = new DLQReplayService({
  enabled: true,
  batchSize: 10,
  skipPublished: true,
  dryRun: true, // Test mode
});

const summary = await dlqReplayService.replayAll();
// No actual replay, just preview
```

## Production Readiness

✅ **Idempotent**: Checks post status before replay  
✅ **Safe**: Distributed locks prevent duplicates  
✅ **Non-blocking**: Never blocks workers  
✅ **Never crashes**: All errors caught  
✅ **Horizontally safe**: Multi-instance compatible  
✅ **Audited**: All operations logged  
✅ **Monitored**: Metrics and alerts  
✅ **Configurable**: Environment-based config  
✅ **Testable**: Dry run mode available  

## Edge Cases Handled

### 1. Post Already Published
- Skipped with reason "Already published"
- Idempotency guarantee

### 2. Post Not Found
- Skipped with reason "Post not found"
- Prevents errors

### 3. Post Cancelled
- Skipped with reason "Post cancelled"
- Respects user intent

### 4. Concurrent Replay
- Lock acquisition prevents duplicates
- Second attempt skipped

### 5. Lock Acquisition Failure
- Job skipped
- Logged as warning
- Doesn't block other jobs

### 6. Replay During Shutdown
- Locks released automatically
- No corruption

## Limitations

1. **Batch Size Limit**: Maximum jobs per batch (configurable)
2. **No Automatic Retry**: Replay is manual/admin-initiated only
3. **No Scheduling**: No scheduled automatic replay (can be added)
4. **Admin Only**: Requires admin authentication

## Future Enhancements

Potential improvements (not currently needed):

1. **Scheduled Replay Worker**: Automatic periodic replay
2. **Selective Replay**: Filter by error type, date, etc.
3. **Replay History**: Track replay attempts per job
4. **Replay Metrics Dashboard**: Visual monitoring
5. **Webhook Notifications**: External system integration

## Summary

The DLQ Replay System provides a production-safe way to recover failed jobs from the Dead Letter Queue. It guarantees idempotency, prevents duplicate publishes, and works safely in multi-instance environments. All operations are logged, monitored, and never crash the system.

**Status**: ✅ Production Ready
