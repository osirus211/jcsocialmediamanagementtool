# Task 1.2.2: Store Platform Post ID After Publishing

## Implementation Summary

**Status**: ✅ Complete  
**Date**: 2026-02-26  
**Epic**: 1.2 Idempotency Guarantees  
**Dependencies**: Task 1.2.1 (Post Status Check)

## Overview

Enhanced the PublishingWorker with platform post ID deduplication to prevent duplicate publishing when a post has already been published to the platform. This adds an additional layer of idempotency beyond status checks.

## Changes Made

### 1. Platform Post ID Check Before Publishing

Added check for existing `platformPostId` in post metadata before attempting to publish:

```typescript
// TASK 1.2.2: Check if platformPostId already exists (already published to platform)
if (post.metadata?.platformPostId) {
  // OBSERVABILITY: Increment skipped counter and new metric
  this.metrics.publish_skipped_total++;
  this.metrics.idempotency_check_platform_post_id_exists++;
  
  const duration = Date.now() - startTime;
  logger.warn('Post already has platformPostId (idempotency guard)', { 
    postId,
    platformPostId: post.metadata.platformPostId,
    publish_duration_ms: duration,
    attempt: currentAttempt,
    status: 'skipped_platform_post_id_exists',
    idempotency_check: 'platform_post_id_exists',
  });
  
  // Update status to PUBLISHED if not already (data consistency)
  if (post.status !== PostStatus.PUBLISHED) {
    await Post.findByIdAndUpdate(postId, {
      status: PostStatus.PUBLISHED,
      publishedAt: post.publishedAt || new Date(),
    });
    logger.info('Updated post status to PUBLISHED based on platformPostId', { postId });
  }
  
  return { 
    success: true, 
    message: 'Already published to platform',
    idempotent: true,
    platformPostId: post.metadata.platformPostId,
  };
}
```

### 2. Platform Duplicate Error Detection

Added `isPlatformDuplicateError()` method to detect when platforms return duplicate content errors:

```typescript
private isPlatformDuplicateError(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code;

  // Twitter/X duplicate detection (code 187)
  // LinkedIn duplicate detection (code 'DUPLICATE_SHARE')
  // Facebook duplicate detection (code 506)
  // Instagram duplicate detection (message patterns)
  // Generic duplicate patterns
  
  return /* detection logic */;
}
```

### 3. Graceful Duplicate Error Handling

Wrapped `publishToPlatform()` call with duplicate error handling:

```typescript
let result;
try {
  result = await this.publishToPlatform(post, account);
} catch (publishError: any) {
  // TASK 1.2.2: Handle platform duplicate detection errors
  const isDuplicateError = this.isPlatformDuplicateError(publishError);
  
  if (isDuplicateError) {
    this.metrics.platform_duplicate_errors_total++;
    this.metrics.duplicate_publish_attempts_total++;
    
    logger.warn('Platform detected duplicate post', {
      postId,
      platform: account.provider,
      error: publishError.message,
      idempotency_check: 'platform_duplicate_detected',
    });
    
    // Mark as published since platform already has it
    await Post.findByIdAndUpdate(postId, {
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
      'metadata.platformDuplicateDetected': true,
      'metadata.platformDuplicateError': publishError.message,
    });
    
    return {
      success: true,
      message: 'Platform detected duplicate, marked as published',
      idempotent: true,
    };
  }
  
  // Not a duplicate error, re-throw for normal error handling
  throw publishError;
}
```

### 4. Platform Post ID Validation

Added validation after storing platformPostId:

```typescript
// TASK 1.2.2: Validate platformPostId was stored
if (updated && !updated.metadata?.platformPostId) {
  logger.error('Failed to store platformPostId', {
    postId,
    platform: account.provider,
    resultHadPlatformPostId: !!result.platformPostId,
  });
} else if (updated) {
  logger.info('Platform post ID stored successfully', {
    postId,
    platformPostId: updated.metadata.platformPostId,
    platform: account.provider,
  });
}
```

### 5. Enhanced Metrics

Added new metrics to track platform post ID deduplication:

```typescript
private metrics = {
  // ... existing metrics
  // TASK 1.2.2: Platform post ID deduplication metrics
  idempotency_check_platform_post_id_exists: 0,
  duplicate_publish_attempts_total: 0,
  platform_duplicate_errors_total: 0,
};
```

## Idempotency Guarantees

### Layer 1: Pre-Check Guards
1. Check if post status is PUBLISHED → skip
2. **NEW: Check if platformPostId exists → skip and fix status if needed**
3. Check if post status is FAILED → skip
4. Check if post status is CANCELLED → skip

### Layer 2: Atomic Status Update
1. Atomic update with optimistic locking (version check)
2. Only update if status is SCHEDULED or QUEUED
3. Increment version to prevent concurrent updates

### Layer 3: Platform Duplicate Detection
1. **NEW: Catch platform duplicate errors**
2. **NEW: Mark post as published if platform already has it**
3. **NEW: Log duplicate attempts for monitoring**

### Layer 4: Post-Publish Validation
1. **NEW: Validate platformPostId was stored**
2. **NEW: Log error if platformPostId missing**

## Test Coverage

Created comprehensive test suite: `apps/backend/src/__tests__/workers/PublishingWorker.idempotency.test.ts`

### Test Categories

**Platform Post ID Check:**
- ✅ Skip publishing if platformPostId already exists
- ✅ Allow publishing if platformPostId does not exist
- ✅ Store platformPostId after successful publish
- ✅ Update status to PUBLISHED if platformPostId exists but status is not PUBLISHED

**Platform Duplicate Error Handling:**
- ✅ Detect Twitter duplicate error (code 187)
- ✅ Detect LinkedIn duplicate error (code 'DUPLICATE_SHARE')
- ✅ Detect Facebook duplicate error (code 506)
- ✅ Detect Instagram duplicate error (message patterns)
- ✅ Not detect non-duplicate errors

**Platform Post ID Validation:**
- ✅ Validate platformPostId is stored after publish
- ✅ Detect missing platformPostId after publish

## Metrics Tracking

All platform post ID deduplication events are tracked:

| Metric | Description |
|--------|-------------|
| `idempotency_check_platform_post_id_exists` | Post already has platformPostId, skipped |
| `duplicate_publish_attempts_total` | Total duplicate publish attempts detected |
| `platform_duplicate_errors_total` | Platform returned duplicate error |

## Benefits

1. **Additional Idempotency Layer**: Prevents duplicate publishing even if status checks fail
2. **Data Consistency**: Fixes status if platformPostId exists but status is not PUBLISHED
3. **Platform Error Handling**: Gracefully handles platform duplicate detection
4. **Observability**: Comprehensive logging and metrics for duplicate attempts
5. **Validation**: Ensures platformPostId is stored correctly

## Example Scenarios

### Scenario 1: Post Already Has Platform Post ID

1. Post has status SCHEDULED but metadata.platformPostId exists
2. Worker detects platformPostId in pre-check
3. Worker skips publishing
4. Worker updates status to PUBLISHED (data consistency fix)
5. Metric `idempotency_check_platform_post_id_exists` incremented

### Scenario 2: Platform Detects Duplicate

1. Post status is SCHEDULED, no platformPostId
2. Worker attempts to publish
3. Platform returns duplicate error (e.g., Twitter code 187)
4. Worker detects duplicate error
5. Worker marks post as PUBLISHED with metadata.platformDuplicateDetected = true
6. Metrics `duplicate_publish_attempts_total` and `platform_duplicate_errors_total` incremented

### Scenario 3: Normal Publish with Validation

1. Post status is SCHEDULED, no platformPostId
2. Worker publishes successfully
3. Platform returns platformPostId
4. Worker stores platformPostId in metadata
5. Worker validates platformPostId was stored
6. Worker logs success with platformPostId

## Related Tasks

- **Task 1.2.1**: Add Post Status Check Before Publishing (prerequisite)
- **Task 1.2.3**: Implement Missed Post Recovery with Job Claiming (next)

## Verification

To verify the implementation:

1. **Check Metrics**: Monitor platform post ID deduplication metrics in production
2. **Check Logs**: Search for `idempotency_check: 'platform_post_id_exists'` in logs
3. **Test Duplicate Publish**: Manually set platformPostId on a scheduled post, verify skipped
4. **Test Platform Duplicate Error**: Simulate platform duplicate error, verify handled gracefully

## Notes

- platformPostId is stored in `metadata.platformPostId` field
- Platform duplicate errors are detected by error message and code patterns
- Data consistency fix: If platformPostId exists but status is not PUBLISHED, status is updated
- All duplicate attempts are logged with full context for debugging
- Metrics are exposed via `getMetrics()` method
