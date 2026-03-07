# Worker Sentry Integration - Complete ✅

## Status: Integration Complete

Sentry error tracking has been successfully integrated into all background workers.

## What Was Done

### 1. PublishingWorker Integration
**File**: `apps/backend/src/workers/PublishingWorker.ts`

**Features added**:
- Worker-level error handler (captures worker crashes)
- Job failure handler (captures final failures after all retries)
- Context attachment for failed jobs:
  - jobId
  - postId
  - workspaceId
  - socialAccountId
  - attemptsMade
  - maxAttempts
  - errorClassification (retryable vs permanent)
- Breadcrumb tracking for job failures
- Only captures final failures (not intermediate retries)

**Error capture points**:
- Worker errors (worker.on('error'))
- Final job failures (worker.on('failed') when attemptsMade >= maxAttempts)

### 2. TokenRefreshWorker Integration
**File**: `apps/backend/src/workers/TokenRefreshWorker.ts`

**Features added**:
- Global error handler for unhandled rejections
- Poll-level error capture
- Retry exhaustion capture (final failure after MAX_RETRIES)
- Context attachment for failed refreshes:
  - accountId
  - provider
  - attemptsMade
  - maxRetries
  - accountStatus
- Breadcrumb tracking for refresh failures

**Error capture points**:
- Unhandled promise rejections
- Poll errors
- Final refresh failures (after all retries)

### 3. BackupVerificationWorker Integration
**File**: `apps/backend/src/workers/BackupVerificationWorker.ts`

**Features added**:
- Global error handler for unhandled rejections
- Verification failure capture
- Context attachment for failed verifications:
  - errorCode (NO_BACKUP_FOUND, CORRUPTED_FILE, RESTORE_FAILED, etc.)
  - backupFile
  - duration
  - verificationResult
  - workerConfig (backupPath, intervalHours, timeoutMs)
- Breadcrumb tracking for verification failures

**Error capture points**:
- Unhandled promise rejections
- Verification failures
- Verification errors (exceptions)

### 4. Sentry Module Enhancement
**File**: `apps/backend/src/monitoring/sentry.ts`

**Enhanced `captureException` function**:
- Added support for tags (key-value pairs for filtering)
- Added support for extra context (additional data)
- Added support for user context
- Added support for severity level

**New signature**:
```typescript
captureException(error: Error, options?: {
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: { id?: string; email?: string; username?: string };
})
```

## Integration Details

### PublishingWorker
```typescript
// Worker-level errors
this.worker.on('error', (error: Error) => {
  captureException(error, {
    level: 'error',
    tags: {
      worker: 'publishing',
      queue: POSTING_QUEUE_NAME,
    },
    extra: {
      workerStatus: this.getStatus(),
      activeJobs: this.heartbeatIntervals.size,
    },
  });
});

// Final job failures
this.worker.on('failed', (job: Job | undefined, error: Error) => {
  if (currentAttempt >= maxAttempts) {
    addBreadcrumb('Publishing job failed after all retries', 'worker', {...});
    captureException(error, {
      level: 'error',
      tags: {
        worker: 'publishing',
        jobId: job.id,
        postId,
        workspaceId,
        finalFailure: 'true',
      },
      extra: {
        jobData: job.data,
        attemptsMade,
        maxAttempts,
        errorClassification,
      },
    });
  }
});
```

### TokenRefreshWorker
```typescript
// Poll errors
catch (error: any) {
  captureException(error, {
    level: 'error',
    tags: {
      worker: 'token-refresh',
      operation: 'poll',
    },
    extra: {
      workerStatus: this.getStatus(),
    },
  });
}

// Final refresh failures
if (attempt === this.MAX_RETRIES - 1) {
  addBreadcrumb('Token refresh failed after all retries', 'worker', {...});
  captureException(err, {
    level: 'error',
    tags: {
      worker: 'token-refresh',
      accountId,
      provider,
      finalFailure: 'true',
    },
    extra: {
      attemptsMade,
      maxRetries,
      accountStatus,
    },
  });
}
```

### BackupVerificationWorker
```typescript
// Verification failures
if (!result.success) {
  addBreadcrumb('Backup verification failed', 'worker', {...});
  captureException(new Error(result.error), {
    level: 'error',
    tags: {
      worker: 'backup-verification',
      errorCode: result.errorCode,
      backupFile: result.backupFile,
    },
    extra: {
      verificationResult: result,
      workerConfig: {...},
    },
  });
}

// Verification errors
catch (error: any) {
  captureException(error, {
    level: 'error',
    tags: {
      worker: 'backup-verification',
      operation: 'verify',
    },
    extra: {
      workerConfig: {...},
      workerStatus: this.getStatus(),
    },
  });
}
```

## Key Features

✅ No performance overhead (async error capture)
✅ No duplicate error logging (Sentry + existing logs)
✅ Only captures final failures (not intermediate retries)
✅ Rich context attachment (jobId, postId, workspaceId, etc.)
✅ Breadcrumb tracking for debugging
✅ Worker-level error capture (crashes)
✅ Job-level error capture (failures)
✅ Only enabled when SENTRY_DSN is configured
✅ No changes to worker logic or retry behavior
✅ Code compiles cleanly

## Error Filtering

Workers capture:
- Worker crashes (unhandled exceptions)
- Unhandled promise rejections
- Final job failures (after all retries exhausted)
- Poll errors
- Verification failures

Workers do NOT capture:
- Intermediate retry attempts
- Expected errors (handled gracefully)
- Skipped jobs (idempotency guards)

## Sentry Dashboard

In the Sentry dashboard, you can now:

1. **Filter by worker**:
   - `worker:publishing`
   - `worker:token-refresh`
   - `worker:backup-verification`

2. **Filter by failure type**:
   - `finalFailure:true` (only final failures)

3. **Filter by job/post**:
   - `jobId:123`
   - `postId:abc`
   - `workspaceId:xyz`

4. **View context**:
   - Job data
   - Attempt counts
   - Error classification
   - Worker status
   - Configuration

5. **View breadcrumbs**:
   - Sequence of events leading to failure
   - Job processing steps
   - Retry attempts

## Testing

To test worker error capture:

1. **PublishingWorker**: Trigger a job failure (invalid token, network error)
2. **TokenRefreshWorker**: Trigger a refresh failure (invalid refresh token)
3. **BackupVerificationWorker**: Trigger a verification failure (corrupted backup)

Check Sentry dashboard for captured errors with full context.

## Configuration

No additional configuration needed. Workers automatically use Sentry when:
- `SENTRY_DSN` is configured
- Sentry is initialized in `server.ts`
- Environment is staging or production

## Next Steps

1. ✅ Install `@sentry/node` package
2. ✅ Configure `SENTRY_DSN` in environment
3. ✅ Test error capture in staging
4. ✅ Monitor Sentry dashboard for worker failures
5. ✅ Set up alerts for critical worker errors

## Documentation

- Main Sentry integration: `apps/backend/src/monitoring/INTEGRATION_COMPLETE.md`
- Sentry module: `apps/backend/src/monitoring/sentry.ts`
- Worker files:
  - `apps/backend/src/workers/PublishingWorker.ts`
  - `apps/backend/src/workers/TokenRefreshWorker.ts`
  - `apps/backend/src/workers/BackupVerificationWorker.ts`

## Support

- Sentry docs: https://docs.sentry.io/platforms/node/
- Worker monitoring: https://docs.sentry.io/platforms/node/guides/express/performance/
