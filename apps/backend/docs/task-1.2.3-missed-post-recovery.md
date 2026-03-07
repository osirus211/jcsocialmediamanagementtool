# Task 1.2.3: Implement Missed Post Recovery with Job Claiming

## Implementation Summary

**Status**: ✅ Complete  
**Date**: 2026-02-26  
**Epic**: 1.2 Idempotency Guarantees  
**Dependencies**: Task 1.1.3 (Optimistic Locking)

## Overview

Implemented a new `MissedPostRecoveryService` that automatically recovers posts that missed their scheduled time due to worker downtime, queue delays, or system outages. The service uses atomic job claiming with optimistic locking to prevent multiple workers from recovering the same post.

## Changes Made

### 1. Created MissedPostRecoveryService

New service at `apps/backend/src/services/MissedPostRecoveryService.ts` with the following features:

**Core Features:**
- Runs every 5 minutes with random jitter (0-30 seconds)
- Finds posts > 5 minutes late but < 24 hours
- Marks posts > 24 hours late as "expired"
- Atomic job claiming using optimistic locking
- Worker ID tracking to prevent duplicate recovery
- Comprehensive metrics and alerting

**Key Methods:**

```typescript
class MissedPostRecoveryService {
  // Start service with jittered interval
  start(): void
  
  // Stop service
  stop(): void
  
  // Run recovery process (finds and recovers missed posts)
  private async run(): Promise<void>
  
  // Atomic job claiming with optimistic locking
  private async recoverPost(post: any, lateness: number): Promise<boolean>
  
  // Mark post as expired if > 24 hours late
  private async expirePost(postId: string, lateness: number): Promise<void>
  
  // Get service status and metrics
  getStatus()
  getMetrics()
}
```

### 2. Atomic Job Claiming

Implemented atomic job claiming using MongoDB's `findOneAndUpdate` with optimistic locking:

```typescript
private async recoverPost(post: any, lateness: number): Promise<boolean> {
  // TASK 1.2.3: Atomic job claiming using optimistic locking
  const claimed = await Post.findOneAndUpdate(
    {
      _id: post._id,
      status: PostStatus.SCHEDULED, // Only claim if still scheduled
      version: post.version, // Optimistic locking
    },
    {
      $set: {
        status: PostStatus.QUEUED,
        'metadata.recoveredBy': this.workerId,
        'metadata.recoveredAt': new Date(),
        'metadata.lateness': lateness,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!claimed) {
    // Another worker claimed this post or status changed
    this.metrics.claim_conflicts_total++;
    return false;
  }

  // Successfully claimed, now add to queue
  // ...
}
```

### 3. Worker ID Tracking

Each service instance generates a unique worker ID:

```typescript
constructor() {
  // Generate unique worker ID for this instance
  this.workerId = `recovery-worker-${uuidv4()}`;
  logger.info('MissedPostRecoveryService initialized', {
    workerId: this.workerId,
  });
}
```

Worker ID is stored in post metadata when claiming or expiring:
- `metadata.recoveredBy`: Worker that recovered the post
- `metadata.expiredBy`: Worker that expired the post

### 4. Jittered Interval

Service runs every 5 minutes with random jitter to prevent thundering herd:

```typescript
private scheduleNextRun(): void {
  // Add random jitter (0-30 seconds)
  const jitter = Math.floor(Math.random() * this.MAX_JITTER);
  const nextRunDelay = this.BASE_INTERVAL + jitter;

  this.intervalId = setTimeout(async () => {
    await this.run();
    this.scheduleNextRun();
  }, nextRunDelay);
}
```

### 5. Expired Post Handling

Posts > 24 hours late are marked as expired:

```typescript
private async expirePost(postId: string, lateness: number): Promise<void> {
  logger.warn('Marking post as expired (> 24 hours late)', {
    workerId: this.workerId,
    postId,
    lateness: Math.floor(lateness / 1000 / 60 / 60) + 'h',
  });

  await Post.findByIdAndUpdate(postId, {
    status: PostStatus.FAILED,
    errorMessage: 'Post expired - more than 24 hours late',
    'metadata.expiredBy': this.workerId,
    'metadata.expiredAt': new Date(),
    'metadata.lateness': lateness,
  });
}
```

### 6. Metrics and Alerting

Comprehensive metrics tracking:

```typescript
private metrics = {
  recovery_runs_total: 0,
  posts_recovered_total: 0,
  posts_expired_total: 0,
  claim_conflicts_total: 0,
  recovery_errors_total: 0,
  last_run_timestamp: 0,
  last_run_recovered_count: 0,
  last_run_expired_count: 0,
};
```

Alert if > 10 posts missed in one run:

```typescript
if (this.metrics.last_run_recovered_count + this.metrics.last_run_expired_count > 10) {
  logger.error('High number of missed posts detected', {
    workerId: this.workerId,
    recovered: this.metrics.last_run_recovered_count,
    expired: this.metrics.last_run_expired_count,
    total: this.metrics.last_run_recovered_count + this.metrics.last_run_expired_count,
    alert: 'MISSED_POSTS_THRESHOLD_EXCEEDED',
  });
}
```

### 7. Integration with Server

Added service startup in `apps/backend/src/server.ts`:

```typescript
console.log('🔧 Checking missed post recovery service...');
// TASK 1.2.3: Start missed post recovery service if Redis is connected
if (redisConnected) {
  try {
    const { missedPostRecoveryService } = await import('./services/MissedPostRecoveryService');
    missedPostRecoveryService.start();
    console.log('🔄 Missed Post Recovery Service STARTED');
    logger.info('🔄 Missed post recovery service started');
  } catch (error) {
    console.log('❌ Missed post recovery service failed to start:', error);
    logger.error('❌ Missed post recovery service failed to start:', error);
    logger.warn('Continuing without missed post recovery');
  }
} else {
  console.log('⏸️  Missed Post Recovery Service DISABLED (Redis not connected)');
  logger.warn('⏸️  Missed Post Recovery Service DISABLED (Redis not connected)');
}
```

## Recovery Process Flow

### Normal Recovery (< 24 hours late)

1. Service runs every 5 minutes (+ jitter)
2. Acquires distributed lock to prevent multiple workers
3. Finds posts with status SCHEDULED and scheduledAt < (now - 5 minutes)
4. For each missed post:
   - Attempts atomic claim with optimistic locking
   - If claim succeeds:
     - Updates status to QUEUED
     - Stores worker ID in metadata.recoveredBy
     - Stores lateness in metadata.lateness
     - Adds post to queue for immediate publishing
   - If claim fails:
     - Increments claim_conflicts_total metric
     - Skips post (another worker claimed it)
5. Releases distributed lock
6. Logs metrics and alerts if > 10 posts missed

### Expired Post Handling (> 24 hours late)

1. Service detects post is > 24 hours late
2. Updates post:
   - Status: FAILED
   - errorMessage: "Post expired - more than 24 hours late"
   - metadata.expiredBy: worker ID
   - metadata.expiredAt: current timestamp
   - metadata.lateness: lateness in milliseconds
3. Increments posts_expired_total metric
4. Logs warning with post ID and lateness

## Test Coverage

Created comprehensive test suite: `apps/backend/src/__tests__/services/MissedPostRecoveryService.test.ts`

### Test Categories

**Atomic Job Claiming:**
- ✅ Atomically claim a missed post with optimistic locking
- ✅ Fail to claim if another worker already claimed
- ✅ Fail to claim if post status changed

**Missed Post Detection:**
- ✅ Detect posts > 5 minutes late
- ✅ Not detect posts < 5 minutes late

**Expired Post Handling:**
- ✅ Mark posts > 24 hours late as expired
- ✅ Not expire posts < 24 hours late

**Worker ID Tracking:**
- ✅ Store worker ID when claiming post
- ✅ Store worker ID when expiring post

**Lateness Tracking:**
- ✅ Calculate and store lateness when recovering

## Metrics Tracking

All recovery events are tracked:

| Metric | Description |
|--------|-------------|
| `recovery_runs_total` | Total number of recovery runs |
| `posts_recovered_total` | Total posts recovered |
| `posts_expired_total` | Total posts expired |
| `claim_conflicts_total` | Total claim conflicts (another worker claimed) |
| `recovery_errors_total` | Total recovery errors |
| `last_run_timestamp` | Timestamp of last run |
| `last_run_recovered_count` | Posts recovered in last run |
| `last_run_expired_count` | Posts expired in last run |

## Benefits

1. **Automatic Recovery**: Posts that miss their scheduled time are automatically recovered
2. **Atomic Claiming**: Optimistic locking prevents multiple workers from recovering the same post
3. **Worker Tracking**: Worker ID tracking provides visibility into which worker recovered/expired each post
4. **Expired Post Handling**: Posts > 24 hours late are marked as expired instead of attempting recovery
5. **Jittered Interval**: Random jitter prevents thundering herd when multiple workers start simultaneously
6. **Comprehensive Metrics**: Detailed metrics for monitoring and alerting
7. **Alerting**: Automatic alerts if > 10 posts missed in one run

## Example Scenarios

### Scenario 1: Worker Downtime Recovery

1. Worker goes down at 10:00 AM
2. Posts scheduled for 10:05 AM, 10:10 AM, 10:15 AM miss their time
3. Worker comes back up at 10:30 AM
4. Recovery service runs at 10:35 AM
5. Finds 3 missed posts (25, 20, 15 minutes late)
6. Atomically claims all 3 posts
7. Adds them to queue for immediate publishing
8. Logs: "Recovered 3 posts"

### Scenario 2: Multiple Workers Prevent Duplicate Recovery

1. Worker A and Worker B both running
2. Post scheduled for 10:00 AM misses its time
3. Recovery service runs on both workers at 10:05 AM
4. Worker A claims post first (atomic update succeeds)
5. Worker B attempts to claim (atomic update fails - version mismatch)
6. Worker B increments claim_conflicts_total metric
7. Worker B skips post
8. Only Worker A publishes the post

### Scenario 3: Expired Post Handling

1. Post scheduled for yesterday at 10:00 AM
2. System was down for 25 hours
3. Recovery service runs today at 11:00 AM
4. Detects post is 25 hours late (> 24 hour threshold)
5. Marks post as FAILED with error "Post expired - more than 24 hours late"
6. Stores worker ID in metadata.expiredBy
7. Increments posts_expired_total metric
8. Logs warning: "Post expired (25h late)"

### Scenario 4: High Volume Alert

1. System outage for 2 hours
2. 50 posts miss their scheduled time
3. Recovery service runs after outage
4. Recovers 50 posts in one run
5. Detects > 10 posts missed
6. Logs error with alert: "MISSED_POSTS_THRESHOLD_EXCEEDED"
7. Operations team receives alert
8. Investigates root cause of outage

## Configuration

Service configuration (in MissedPostRecoveryService.ts):

```typescript
private readonly BASE_INTERVAL = 5 * 60 * 1000; // 5 minutes
private readonly MAX_JITTER = 30 * 1000; // 30 seconds
private readonly MISSED_THRESHOLD = 5 * 60 * 1000; // 5 minutes
private readonly EXPIRED_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
private readonly LOCK_KEY = 'missed-post-recovery:lock';
private readonly LOCK_TTL = 60; // 60 seconds
```

## Related Tasks

- **Task 1.1.3**: Implement Optimistic Locking for Post Updates (prerequisite)
- **Task 1.2.1**: Add Post Status Check Before Publishing (related)
- **Task 1.2.2**: Store Platform Post ID After Publishing (related)

## Verification

To verify the implementation:

1. **Check Service Status**: Call `missedPostRecoveryService.getStatus()` to verify running
2. **Check Metrics**: Call `missedPostRecoveryService.getMetrics()` to see recovery stats
3. **Test Recovery**: Create a post with past scheduledAt, wait 5 minutes, verify recovered
4. **Test Expiry**: Create a post with scheduledAt > 24 hours ago, verify marked as expired
5. **Test Atomic Claiming**: Run multiple workers, verify no duplicate recovery

## Notes

- Service requires Redis for distributed locking
- Service is disabled if Redis is not connected
- Worker ID is unique per service instance (uses UUID)
- Jitter prevents thundering herd when multiple workers start
- Batch processing (100 posts per run) prevents memory issues
- Distributed lock (60 second TTL) prevents multiple workers from running simultaneously
- Metrics are exposed via `getMetrics()` method
- Service can be force-run for testing via `forceRun()` method
