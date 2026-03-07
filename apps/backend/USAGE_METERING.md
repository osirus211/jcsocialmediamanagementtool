# Production-Grade Usage Metering & Hard Plan Limits

## Overview

Accurate usage tracking with atomic increments and hard limit enforcement to prevent overuse.

## Architecture

```
Action Request → Hard Limit Check → Execute Action → Atomic Usage Increment
                      ↓ (if exceeded)
                 PlanLimitError (403)
                 No queue entry
                 No retry
```

---

## 1. Usage Model

**File**: `src/models/Usage.ts`

### Schema

```typescript
{
  workspaceId: ObjectId (indexed),
  periodStart: Date (indexed),
  periodEnd: Date,
  postsUsed: number (default: 0),
  accountsUsed: number (default: 0),
  aiUsed: number (default: 0),
  storageUsedMB: number (default: 0),
  lastUpdatedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```typescript
// Compound unique index for period queries
{ workspaceId: 1, periodStart: 1 } (unique)

// Period range queries
{ periodStart: 1, periodEnd: 1 }
```

### Key Features

- One record per workspace per billing period
- Atomic increments prevent double-counting
- Separate from Billing model (single responsibility)
- Efficient queries with compound index

---

## 2. Usage Service

**File**: `src/services/UsageService.ts`

### Atomic Increment Pattern

All increment methods use MongoDB's atomic `findOneAndUpdate` with `$inc`:

```typescript
await Usage.findOneAndUpdate(
  {
    workspaceId,
    periodStart: { $lte: now },
    periodEnd: { $gte: now },
  },
  {
    $inc: { postsUsed: 1 },           // Atomic increment
    $set: { lastUpdatedAt: now },
    $setOnInsert: {                    // Only on insert
      workspaceId,
      periodStart,
      periodEnd,
      accountsUsed: 0,
      aiUsed: 0,
      storageUsedMB: 0,
    },
  },
  {
    upsert: true,                      // Create if not exists
    new: true,                         // Return updated doc
  }
);
```

### Methods

**incrementPosts(workspaceId)**:
- Atomically increments `postsUsed`
- ONLY call after successful post publish
- No double-counting on retries

**incrementAccounts(workspaceId)**:
- Atomically increments `accountsUsed`
- ONLY call after successful account connection

**incrementAI(workspaceId)**:
- Atomically increments `aiUsed`
- ONLY call after successful AI request

**incrementStorage(workspaceId, sizeMB)**:
- Atomically increments `storageUsedMB`
- ONLY call after successful media upload

**getCurrentUsage(workspaceId)**:
- Returns current period usage
- Creates new record if not exists

**resetUsageForNewPeriod(workspaceId, periodStart, periodEnd)**:
- Creates new usage record for new billing period
- Called when subscription renews

---

## 3. Hard Limit Checks

**File**: `src/services/PlanEnforcementService.ts`

### Plan Limits

```typescript
const PLAN_LIMITS = {
  free: {
    maxPosts: 10,
    maxAccounts: 2,
    maxAIRequests: 5,
    maxStorageMB: 100,
  },
  pro: {
    maxPosts: 100,
    maxAccounts: 10,
    maxAIRequests: 100,
    maxStorageMB: 1000,
  },
  team: {
    maxPosts: 500,
    maxAccounts: 50,
    maxAIRequests: 500,
    maxStorageMB: 5000,
  },
  enterprise: {
    maxPosts: -1,        // unlimited
    maxAccounts: -1,
    maxAIRequests: -1,
    maxStorageMB: -1,
  },
};
```

### Hard Limit Methods

**canCreatePost(workspaceId)**:
```typescript
// Check before creating post
const result = await planEnforcementService.canCreatePost(workspaceId);

// If limit exceeded, throws PlanLimitError (403)
// No queue entry, no retry
```

**canConnectAccount(workspaceId)**:
```typescript
// Check before connecting account
const result = await planEnforcementService.canConnectAccount(workspaceId);

// Throws PlanLimitError if limit exceeded
```

**canUseAI(workspaceId)**:
```typescript
// Check before AI request
const result = await planEnforcementService.canUseAI(workspaceId);

// Throws PlanLimitError if limit exceeded
```

**canUploadMedia(workspaceId, sizeMB)**:
```typescript
// Check before media upload
const result = await planEnforcementService.canUploadMedia(workspaceId, sizeMB);

// Throws PlanLimitError if storage limit exceeded
```

### PlanLimitError

**File**: `src/errors/PlanLimitError.ts`

```typescript
class PlanLimitError extends Error {
  statusCode: 403;
  code: 'PLAN_LIMIT_EXCEEDED';
  limitType: string;        // 'posts', 'accounts', 'ai', 'storage'
  currentUsage: number;
  limit: number;
}
```

**Usage**:
```typescript
try {
  await planEnforcementService.canCreatePost(workspaceId);
} catch (error) {
  if (error instanceof PlanLimitError) {
    // Return 403 with upgrade message
    return res.status(403).json({
      error: error.message,
      code: error.code,
      limitType: error.limitType,
      currentUsage: error.currentUsage,
      limit: error.limit,
    });
  }
}
```

---

## 4. Period Reset Logic

**File**: `src/controllers/StripeWebhookController.ts`

### Automatic Reset on Subscription Renewal

```typescript
// In updateBillingFromSubscription()

// Check if new billing period
const isNewPeriod = billing.currentPeriodStart && 
  new Date(subscription.current_period_start * 1000).getTime() !== 
  billing.currentPeriodStart.getTime();

if (isNewPeriod) {
  // Reset Billing.usageSnapshot
  billing.resetUsage();
  
  // Create new Usage record for new period
  await usageService.resetUsageForNewPeriod(
    workspaceId,
    newPeriodStart,
    newPeriodEnd
  );
  
  logger.info('Usage reset for new billing period');
}
```

### When Reset Happens

1. **Subscription renewal**: Stripe sends `customer.subscription.updated` webhook
2. **Period change detected**: `current_period_start` differs from stored value
3. **New Usage record created**: Fresh counters for new period
4. **Old Usage record preserved**: Historical data retained

---

## 5. Overage Protection

### Atomic Increments

**Problem**: Race conditions could cause double-counting

**Solution**: MongoDB atomic operations

```typescript
// ❌ BAD: Race condition
const usage = await Usage.findOne({ workspaceId });
usage.postsUsed += 1;
await usage.save();

// ✅ GOOD: Atomic increment
await Usage.findOneAndUpdate(
  { workspaceId },
  { $inc: { postsUsed: 1 } }
);
```

### No Double-Counting on Retries

**Problem**: Worker retries could increment usage multiple times

**Solution**: Only increment AFTER successful action

```typescript
// In PublishingWorker

try {
  // Publish post
  const result = await provider.publishPost(params);
  
  // ✅ Only increment on success
  if (result.success) {
    await planEnforcementService.incrementPostUsage(workspaceId);
  }
} catch (error) {
  // ❌ No increment on failure
  throw error;
}
```

### No Counting Failed Posts

**Problem**: Failed posts shouldn't count toward limit

**Solution**: Increment only on `PublishResult.success === true`

```typescript
// Provider returns PublishResult
{
  success: true,           // Only increment if true
  platformPostId: '...',
  publishedAt: Date
}
```

---

## 6. Integration Points

### Post Creation Flow

```typescript
// In PostController.createPost()

// 1. Hard limit check (before queue)
try {
  await planEnforcementService.canCreatePost(workspaceId);
} catch (error) {
  if (error instanceof PlanLimitError) {
    return res.status(403).json({ error: error.message });
  }
}

// 2. Create post and enqueue
const post = await Post.create({ ... });
await postingQueue.enqueue(post._id);

// 3. Worker publishes post
// 4. On success, increment usage
await planEnforcementService.incrementPostUsage(workspaceId);
```

### Account Connection Flow

```typescript
// In SocialAccountController.connect()

// 1. Hard limit check
try {
  await planEnforcementService.canConnectAccount(workspaceId);
} catch (error) {
  if (error instanceof PlanLimitError) {
    return res.status(403).json({ error: error.message });
  }
}

// 2. Connect account
const account = await SocialAccount.create({ ... });

// 3. Increment usage
await planEnforcementService.incrementAccountUsage(workspaceId);
```

### AI Request Flow

```typescript
// In AIController.generate()

// 1. Hard limit check
try {
  await planEnforcementService.canUseAI(workspaceId);
} catch (error) {
  if (error instanceof PlanLimitError) {
    return res.status(403).json({ error: error.message });
  }
}

// 2. Generate AI content
const result = await aiService.generate(prompt);

// 3. Increment usage
await planEnforcementService.incrementAIUsage(workspaceId);
```

### Media Upload Flow

```typescript
// In MediaController.upload()

// 1. Calculate file size
const sizeMB = file.size / (1024 * 1024);

// 2. Hard limit check
try {
  await planEnforcementService.canUploadMedia(workspaceId, sizeMB);
} catch (error) {
  if (error instanceof PlanLimitError) {
    return res.status(403).json({ error: error.message });
  }
}

// 3. Upload media
const url = await storageService.upload(file);

// 4. Increment usage
await planEnforcementService.incrementStorageUsage(workspaceId, sizeMB);
```

---

## 7. Billing + Usage Alignment

### How They Stay Aligned

1. **Same Period Boundaries**:
   - Usage.periodStart = Billing.currentPeriodStart
   - Usage.periodEnd = Billing.currentPeriodEnd

2. **Synchronized Reset**:
   - Webhook detects new period
   - Resets both Billing.usageSnapshot AND creates new Usage record

3. **Single Source of Truth**:
   - Usage model is authoritative for metering
   - Billing.usageSnapshot is deprecated (kept for backward compatibility)

### Period Alignment Example

```typescript
// Subscription created: Jan 1 - Jan 31
Billing: {
  currentPeriodStart: 2024-01-01,
  currentPeriodEnd: 2024-01-31
}

Usage: {
  workspaceId: '...',
  periodStart: 2024-01-01,
  periodEnd: 2024-01-31,
  postsUsed: 0
}

// Subscription renews: Feb 1 - Feb 28
Billing: {
  currentPeriodStart: 2024-02-01,
  currentPeriodEnd: 2024-02-28
}

Usage: {
  workspaceId: '...',
  periodStart: 2024-02-01,
  periodEnd: 2024-02-28,
  postsUsed: 0  // Reset
}
```

---

## 8. Preventing Overuse

### Hard Stop Before Action

```
User Request
    ↓
Hard Limit Check
    ↓ (if exceeded)
PlanLimitError (403)
    ↓
User sees upgrade prompt
    ↓
No action executed
No queue entry
No usage increment
```

### Soft Limit (Warning)

```typescript
// Optional: Warn at 80% usage
const usage = await usageService.getCurrentUsage(workspaceId);
const limit = PLAN_LIMITS[billing.plan].maxPosts;

if (usage.postsUsed >= limit * 0.8) {
  logger.warn('Approaching post limit', {
    workspaceId,
    usage: usage.postsUsed,
    limit,
    percentUsed: (usage.postsUsed / limit * 100).toFixed(1),
  });
  
  // Send email notification
  await emailService.sendLimitWarning(workspaceId);
}
```

---

## 9. Usage Dashboard

### Get Usage Stats

```typescript
// GET /api/usage

const stats = await planEnforcementService.getUsageStats(workspaceId);

// Returns:
{
  plan: 'pro',
  limits: {
    maxPosts: 100,
    maxAccounts: 10,
    maxAIRequests: 100,
    maxStorageMB: 1000
  },
  usage: {
    posts: 45,
    accounts: 5,
    ai: 23,
    storage: 234.5
  },
  periodStart: '2024-01-01T00:00:00Z',
  periodEnd: '2024-01-31T23:59:59Z'
}
```

### Frontend Display

```typescript
// Calculate percentage
const postsPercent = (stats.usage.posts / stats.limits.maxPosts) * 100;

// Show progress bar
<ProgressBar 
  value={stats.usage.posts} 
  max={stats.limits.maxPosts}
  label={`${stats.usage.posts} / ${stats.limits.maxPosts} posts`}
/>

// Show upgrade prompt at 100%
{postsPercent >= 100 && (
  <UpgradePrompt message="Post limit reached. Upgrade to post more." />
)}
```

---

## 10. Testing

### Test Atomic Increments

```typescript
// Simulate concurrent increments
const promises = [];
for (let i = 0; i < 10; i++) {
  promises.push(usageService.incrementPosts(workspaceId));
}
await Promise.all(promises);

// Verify count is exactly 10 (no race condition)
const usage = await usageService.getCurrentUsage(workspaceId);
expect(usage.postsUsed).toBe(10);
```

### Test Hard Limits

```typescript
// Create free plan workspace
const workspace = await Workspace.create({ plan: 'free' });
const billing = await Billing.create({
  workspaceId: workspace._id,
  plan: 'free',
  status: 'active',
});

// Increment to limit
for (let i = 0; i < 10; i++) {
  await usageService.incrementPosts(workspace._id);
}

// 11th post should throw PlanLimitError
await expect(
  planEnforcementService.canCreatePost(workspace._id)
).rejects.toThrow(PlanLimitError);
```

### Test Period Reset

```typescript
// Create usage for old period
await Usage.create({
  workspaceId,
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
  postsUsed: 10,
});

// Simulate subscription renewal
await usageService.resetUsageForNewPeriod(
  workspaceId,
  new Date('2024-02-01'),
  new Date('2024-02-28')
);

// Verify new period has zero usage
const usage = await usageService.getCurrentUsage(workspaceId);
expect(usage.postsUsed).toBe(0);
expect(usage.periodStart).toEqual(new Date('2024-02-01'));
```

---

## 11. Monitoring

### Key Metrics

```bash
# Usage by plan
db.usage.aggregate([
  { $lookup: { from: 'billings', localField: 'workspaceId', foreignField: 'workspaceId', as: 'billing' } },
  { $group: { _id: '$billing.plan', avgPosts: { $avg: '$postsUsed' } } }
])

# Workspaces near limit
db.usage.find({ postsUsed: { $gte: 8 } })  // Free plan limit is 10

# Period reset failures
grep "Usage reset for new billing period" logs | wc -l
```

### Alerts

1. **High usage**: Workspace at 90% of limit
2. **Limit exceeded**: PlanLimitError thrown
3. **Period reset failure**: New period not created
4. **Atomic increment failure**: Usage update failed

---

## Summary

Production-grade usage metering with:
- Atomic increments (no double-counting)
- Hard limit checks (no overuse)
- Period-aligned reset (billing + usage synchronized)
- PlanLimitError (clear upgrade path)
- Separate Usage model (single responsibility)
- Overage protection (increment only on success)

All TypeScript errors resolved. Ready for production.
