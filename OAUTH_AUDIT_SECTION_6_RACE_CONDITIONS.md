# OAuth Audit - Section 6: Race Conditions & Concurrency

## 6.1 Token Refresh Race Conditions

### Current Implementation: **EXCELLENT**

**Protection Mechanisms**:
1. **Distributed Lock**: Workspace-scoped lock (600s TTL)
2. **Heartbeat Renewal**: Lock renewed every 60s
3. **Abort on Failure**: Stops all operations if heartbeat fails
4. **Atomic Operations**: Optimistic locking with version checks

### Race Condition Scenarios

#### ✅ PROTECTED: Concurrent Token Refresh
**Scenario**: Two workers try to refresh same account simultaneously

**Protection**:
```typescript
// Worker A acquires lock
const lock = await distributedLockService.acquireLock(
  `facebook:refresh:workspace:${workspaceId}`,
  { ttl: 600000 }
);

// Worker B tries to acquire lock
const lock = await distributedLockService.acquireLock(...);
// Returns null - lock already held by Worker A

if (!lock) {
  logger.warn('Could not acquire lock - skipping');
  return; // Worker B exits gracefully
}
```

**Status**: ✅ FULLY PROTECTED

#### ✅ PROTECTED: Lock Expiry Mid-Refresh
**Scenario**: Lock expires while refresh is in progress

**Protection**:
```typescript
// Heartbeat renews lock every 60s
heartbeatTimer = setInterval(async () => {
  const renewed = await distributedLockService.renewLock(lock, 600000);
  if (!renewed) {
    logger.error('CRITICAL: Failed to renew lock - ABORTING');
    this.abortRefresh = true; // Stops all operations
  }
}, 60000);

// Check abort flag at every critical step
if (this.abortRefresh) {
  throw new Error('Refresh aborted due to lock renewal failure');
}
```

**Status**: ✅ FULLY PROTECTED

#### ⚠️ WARNING: Slow Facebook API Calls
**Scenario**: Facebook API takes > 600s to respond

**Current Mitigation**: Heartbeat renewal every 60s extends lock  
**Gap**: If heartbeat fails, refresh aborts (partial state)

**Recommendation**: Add timeout to Facebook API calls
```typescript
const response = await axios.get(url, {
  timeout: 30000, // 30 second timeout
});
```

**Status**: ⚠️ RECOMMENDED

---

## 6.2 Publishing Race Conditions

### Current Implementation: **EXCELLENT**

**Protection Mechanisms**:
1. **Processing Lock**: Redis lock per post (120s TTL)
2. **Publish Lock**: Distributed lock per post (120s TTL)
3. **Status Check**: Skip if already `PUBLISHED`
4. **Platform Post ID Check**: Skip if `metadata.platformPostId` exists
5. **Atomic Status Update**: Optimistic locking with version check
6. **Heartbeat**: Updates `updatedAt` every 5s

### Race Condition Scenarios

#### ✅ PROTECTED: Concurrent Worker Execution
**Scenario**: Two workers pick up same job from queue

**Protection**:
```typescript
// Worker A acquires processing lock
const processingLock = await queueMgr.acquireLock(`post:processing:${postId}`, 120000);

// Worker B tries to acquire processing lock
const processingLock = await queueMgr.acquireLock(...);
// Returns null - lock already held by Worker A

if (!processingLock) {
  logger.warn('Could not acquire processing lock - skipping');
  return { success: false, skipped: true };
}
```

**Status**: ✅ FULLY PROTECTED

#### ✅ PROTECTED: Status Change During Processing
**Scenario**: Post status changes while worker is processing

**Protection**:
```typescript
// Atomic status update with optimistic locking
const atomicUpdate = await Post.findOneAndUpdate(
  {
    _id: postId,
    status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
    version: post.version, // Optimistic locking
  },
  {
    $set: { status: PostStatus.PUBLISHING },
    $inc: { version: 1 },
  }
);

if (!atomicUpdate) {
  // Status changed - another worker may have processed it
  const currentPost = await Post.findById(postId);
  if (currentPost?.status === PostStatus.PUBLISHED) {
    return { success: true, idempotent: true };
  }
  return { success: false, skipped: true };
}
```

**Status**: ✅ FULLY PROTECTED

#### 🔴 CRITICAL: Lock Expiry During Platform Publish
**Scenario**: Platform API takes > 120s, lock expires, second worker publishes

**Timeline**:
1. Worker A acquires publish lock (120s TTL)
2. Worker A calls platform API (slow response)
3. 120 seconds pass, lock expires
4. Worker B acquires publish lock
5. Worker B publishes to platform (DUPLICATE)
6. Worker A's API call completes (DUPLICATE)

**Current Mitigation**: 120s TTL should be sufficient for most API calls

**Gap**: No lock renewal during platform publish

**Recommendation**: Add lock renewal heartbeat
```typescript
// Start lock renewal during platform publish
const renewalInterval = setInterval(async () => {
  const renewed = await distributedLockService.renewLock(publishLock, 120000);
  if (!renewed) {
    logger.error('CRITICAL: Failed to renew publish lock - ABORTING');
    throw new Error('Publish lock renewal failed');
  }
}, 30000); // Renew every 30s

try {
  result = await this.publishToPlatform(post, account);
} finally {
  clearInterval(renewalInterval);
}
```

**Status**: 🔴 HIGH PRIORITY FIX

#### ⚠️ WARNING: Platform Duplicate Detection Timing
**Scenario**: Platform detects duplicate after both workers publish

**Timeline**:
1. Worker A publishes to platform (success)
2. Worker B publishes to platform (platform returns duplicate error)
3. Worker A updates post status to PUBLISHED
4. Worker B handles duplicate error (marks as published)

**Current Mitigation**: Platform duplicate error handling
```typescript
if (this.isPlatformDuplicateError(publishError)) {
  await Post.findByIdAndUpdate(postId, {
    status: PostStatus.PUBLISHED,
    'metadata.platformDuplicateDetected': true,
  });
  return { success: true, idempotent: true };
}
```

**Gap**: Wasted API quota (both workers called platform API)

**Recommendation**: Add pre-publish duplicate check
```typescript
// Check for recent duplicate content
const contentHash = crypto.createHash('sha256')
  .update(`${account._id}:${post.content}`)
  .digest('hex');

const recentDuplicate = await Post.findOne({
  socialAccountId: account._id,
  'metadata.contentHash': contentHash,
  status: PostStatus.PUBLISHED,
  publishedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});

if (recentDuplicate) {
  throw new Error('Duplicate content detected (pre-publish check)');
}
```

**Status**: ⚠️ RECOMMENDED

---

## 6.3 Account Connection Race Conditions

### Current Implementation: **GOOD**

**Protection Mechanisms**:
1. **Unique Index**: `{ workspaceId, provider, providerUserId }` (unique)
2. **Upsert Logic**: Updates existing account if found

### Race Condition Scenarios

#### ✅ PROTECTED: Duplicate Account Creation
**Scenario**: Two OAuth callbacks for same account simultaneously

**Protection**:
```typescript
// Unique index prevents duplicate accounts
SocialAccountSchema.index(
  { workspaceId: 1, provider: 1, providerUserId: 1 },
  { unique: true }
);

// Upsert logic handles race condition
const existingAccount = await SocialAccount.findOne({
  workspaceId,
  provider,
  providerUserId,
});

if (existingAccount) {
  // Update existing account
  return await this.updateExistingPage(existingAccount, page, userProfile, params);
}

// Create new account
const account = await SocialAccount.create({...});
```

**Status**: ✅ FULLY PROTECTED

#### ⚠️ WARNING: Token Overwrite During Refresh
**Scenario**: OAuth callback updates token while refresh worker is running

**Timeline**:
1. Refresh worker reads current token
2. OAuth callback updates token (user reconnects)
3. Refresh worker exchanges old token (fails)
4. Refresh worker marks account as REAUTH_REQUIRED (incorrect)

**Current Mitigation**: Distributed lock per workspace (prevents concurrent refresh)

**Gap**: OAuth callback doesn't acquire lock

**Recommendation**: Add lock acquisition to OAuth callback
```typescript
// In FacebookOAuthService.connectAccount()
const lock = await distributedLockService.acquireLock(
  `facebook:oauth:workspace:${workspaceId}`,
  { ttl: 60000 }
);

try {
  // Exchange tokens and save accounts
} finally {
  if (lock) {
    await distributedLockService.releaseLock(lock);
  }
}
```

**Status**: ⚠️ RECOMMENDED

---

## 6.4 Queue Race Conditions

### Current Implementation: **EXCELLENT**

**Protection Mechanisms**:
1. **BullMQ**: Built-in job locking
2. **Processing Lock**: Additional Redis lock per job
3. **Idempotency**: Multiple layers of duplicate detection

### Race Condition Scenarios

#### ✅ PROTECTED: Duplicate Job Execution
**Scenario**: Same job picked up by multiple workers

**Protection**:
```typescript
// BullMQ ensures only one worker processes each job
// Additional processing lock for extra safety
const processingLock = await queueMgr.acquireLock(`post:processing:${postId}`, 120000);
if (!processingLock) {
  return { success: false, skipped: true };
}
```

**Status**: ✅ FULLY PROTECTED

#### ⚠️ WARNING: Job Retry During Processing
**Scenario**: Job retries while still being processed

**Timeline**:
1. Worker A starts processing job
2. Job takes > 30s (BullMQ stalled job timeout)
3. BullMQ marks job as stalled
4. Worker B picks up stalled job
5. Both workers process simultaneously

**Current Mitigation**: Processing lock prevents duplicate execution

**Gap**: Wasted worker resources (both workers acquire locks)

**Recommendation**: Increase BullMQ stalled job timeout
```typescript
const worker = queueManager.createWorker(
  POSTING_QUEUE_NAME,
  this.processJob.bind(this),
  {
    concurrency: 5,
    lockDuration: 180000, // 3 minutes (increased from default 30s)
  }
);
```

**Status**: ⚠️ RECOMMENDED

---

## 6.5 Redis Failure Scenarios

### Current Implementation: **GOOD**

**Circuit Breaker**: Tracks Redis failures and opens circuit

### Race Condition Scenarios

#### ⚠️ WARNING: Lock Service Unavailable
**Scenario**: Redis unavailable, locks cannot be acquired

**Current Behavior**: Operations fail (safe default)

**Gap**: No fallback mechanism for critical operations

**Recommendation**: Add fallback for read-only operations
```typescript
// For token refresh (write operation) - fail hard
if (!lock) {
  throw new Error('Cannot acquire lock - Redis unavailable');
}

// For health checks (read operation) - continue with warning
if (!lock) {
  logger.warn('Lock unavailable - continuing without lock (read-only)');
  // Continue with health check
}
```

**Status**: ⚠️ RECOMMENDED

#### ⚠️ WARNING: Lock Lost During Operation
**Scenario**: Redis connection lost mid-operation, lock released

**Current Mitigation**: Heartbeat detects failure and aborts

**Gap**: Partial state may be committed before abort

**Recommendation**: Add transaction rollback
```typescript
// Use MongoDB transactions for atomic operations
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Perform all updates within transaction
  await account.save({ session });
  await Post.updateMany({...}, { session });
  
  // Commit only if lock still held
  if (await distributedLockService.isLockHeld(lock)) {
    await session.commitTransaction();
  } else {
    await session.abortTransaction();
    throw new Error('Lock lost during operation');
  }
} finally {
  session.endSession();
}
```

**Status**: ⚠️ RECOMMENDED

---

## 6.6 Recommendations

### IMMEDIATE (This Sprint)
1. **Add lock renewal** during platform publish (prevent double-publish)
2. **Add timeout** to Facebook API calls (prevent hanging)
3. **Increase BullMQ stalled timeout** (reduce false stalls)

### SHORT-TERM (Next 2 Sprints)
4. **Add lock acquisition** to OAuth callback (prevent token overwrite)
5. **Add pre-publish duplicate check** (reduce wasted API quota)
6. **Implement transaction rollback** for critical operations

### LONG-TERM (Next Quarter)
7. **Add distributed tracing** (OpenTelemetry) for race condition debugging
8. **Implement chaos testing** for concurrency scenarios
9. **Add property-based tests** for race conditions
