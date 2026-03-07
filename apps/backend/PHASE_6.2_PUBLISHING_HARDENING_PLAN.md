# Phase 6.2 — Publishing Hardening Implementation Plan

**Date**: March 6, 2026  
**Goal**: Improve publishing reliability and scalability  
**Status**: Planning

---

## OVERVIEW

Implement two architectural improvements:
1. **SchedulerWorker** - Dedicated BullMQ worker for scheduled posts
2. **Media Pipeline Separation** - Upload media before publishing

---

## STEP 1: SCHEDULER WORKER

### Requirements
- Dedicated BullMQ worker (not polling-based)
- Runs every 60 seconds as repeatable job
- Queries MongoDB for eligible posts
- Creates fanout jobs per platform
- Marks posts as enqueued

### Implementation

**File to Create**: `src/workers/SchedulerWorker.ts`

**Key Features**:
```typescript
class SchedulerWorker {
  // BullMQ repeatable job (every 60 seconds)
  private worker: Worker;
  
  async processScheduledPosts() {
    // Query: status = SCHEDULED, scheduledAt <= now
    const posts = await Post.find({
      status: PostStatus.SCHEDULED,
      scheduledAt: { $lte: new Date() }
    });
    
    // For each post: create fanout jobs
    for (const post of posts) {
      await this.createFanoutJobs(post);
    }
  }
  
  async createFanoutJobs(post) {
    // Get accounts
    const accounts = await SocialAccount.find({
      _id: { $in: post.socialAccountIds }
    });
    
    // Create one job per platform
    for (const account of accounts) {
      await postingQueue.addPost({
        postId: post._id,
        platform: account.provider,
        socialAccountId: account._id,
        ...
      });
    }
    
    // Mark as queued
    post.status = PostStatus.QUEUED;
    await post.save();
  }
}
```

**Queue Setup**:
- Queue name: `scheduler-queue`
- Repeatable job: Every 60 seconds
- Concurrency: 1 (single instance)

---

## STEP 2: MEDIA PIPELINE SEPARATION

### Current Flow
```
User uploads media
  ↓
MediaProcessingWorker (resize, thumbnail)
  ↓
Media status: READY
  ↓
PublishingWorker uploads to platform (SYNC)
  ↓
Publish post
```

### Target Flow
```
User uploads media
  ↓
MediaProcessingWorker (resize, thumbnail)
  ↓
MediaProcessingWorker uploads to platform APIs
  ↓
Store platformMediaIds in Media document
  ↓
Media status: READY
  ↓
PublishingWorker reads platformMediaIds
  ↓
Publish post with pre-uploaded media
```

### Implementation

**File to Modify**: `src/workers/MediaProcessingWorker.ts`

**Add Platform Upload**:
```typescript
async processMedia(job: Job<MediaJobData>) {
  // Existing: resize, thumbnail
  await this.resizeImage(media);
  await this.generateThumbnail(media);
  
  // NEW: Upload to platform APIs
  await this.uploadToPlatforms(media);
  
  media.status = MediaStatus.READY;
  await media.save();
}

async uploadToPlatforms(media: IMedia) {
  // Get all social accounts for workspace
  const accounts = await SocialAccount.find({
    workspaceId: media.workspaceId,
    status: 'active'
  });
  
  // Upload to each platform
  for (const account of accounts) {
    const provider = providerFactory.getProvider(account.provider);
    const platformMediaId = await provider.uploadMedia({
      mediaUrl: media.storageUrl,
      accountId: account._id
    });
    
    // Store platform-specific media ID
    media.platformMediaIds.push({
      platform: account.provider,
      mediaId: platformMediaId,
      uploadedAt: new Date()
    });
  }
  
  await media.save();
}
```

**File to Modify**: `src/workers/PublishingWorker.ts`

**Use Pre-Uploaded Media**:
```typescript
async publishToPlatform(post, account) {
  // Get media with platform IDs
  const media = await Media.find({
    _id: { $in: post.mediaIds }
  });
  
  // Extract platform-specific media IDs
  const platformMediaIds = media
    .flatMap(m => m.platformMediaIds || [])
    .filter(pm => pm.platform === account.provider)
    .map(pm => pm.mediaId);
  
  // BACKWARD COMPATIBILITY: Fallback to upload if missing
  let finalMediaIds = platformMediaIds;
  if (platformMediaIds.length === 0 && post.mediaUrls?.length > 0) {
    // Fallback: upload media synchronously
    finalMediaIds = await this.uploadMediaFallback(post.mediaUrls, account);
  }
  
  // Publish with pre-uploaded media IDs
  await provider.publish({
    postId: post._id,
    accountId: account._id,
    content: post.content,
    mediaIds: finalMediaIds, // Use platform media IDs
    metadata: post.metadata
  });
}
```

---

## STEP 3: BACKWARD COMPATIBILITY

### Scenarios

**Scenario 1**: New post with pre-uploaded media
- Media has `platformMediaIds`
- PublishingWorker uses pre-uploaded IDs
- Result: ✅ Fast publishing

**Scenario 2**: Old post without pre-uploaded media
- Media missing `platformMediaIds`
- PublishingWorker falls back to upload
- Result: ✅ Backward compatible

**Scenario 3**: Post with mediaUrls (legacy)
- Post has `mediaUrls` instead of `mediaIds`
- PublishingWorker uploads from URLs
- Result: ✅ Backward compatible

### Implementation Strategy
```typescript
// Priority order:
1. Use platformMediaIds if available (NEW)
2. Upload from mediaIds if available (FALLBACK)
3. Upload from mediaUrls if available (LEGACY)
```

---

## STEP 4: LOGGING

### Structured Logging

**SchedulerWorker**:
```typescript
logger.info('Scheduler run started', {
  worker: 'scheduler',
  timestamp: new Date().toISOString()
});

logger.info('Eligible posts found', {
  worker: 'scheduler',
  count: posts.length,
  postIds: posts.map(p => p._id)
});

logger.info('Fanout jobs created', {
  worker: 'scheduler',
  postId: post._id,
  platformCount: accounts.length,
  platforms: accounts.map(a => a.provider)
});
```

**MediaProcessingWorker**:
```typescript
logger.info('Media upload started', {
  worker: 'media-processing',
  mediaId: media._id,
  platform: account.provider
});

logger.info('Media upload completed', {
  worker: 'media-processing',
  mediaId: media._id,
  platform: account.provider,
  platformMediaId: platformMediaId,
  duration_ms: Date.now() - startTime
});
```

**PublishingWorker**:
```typescript
logger.info('Publishing with pre-uploaded media', {
  worker: 'publishing',
  postId: post._id,
  platform: account.provider,
  mediaCount: platformMediaIds.length,
  preUploaded: true
});

logger.warn('Fallback to media upload', {
  worker: 'publishing',
  postId: post._id,
  platform: account.provider,
  reason: 'platformMediaIds missing',
  preUploaded: false
});
```

---

## IMPLEMENTATION ORDER

1. ✅ Create SchedulerWorker
2. ✅ Update MediaProcessingWorker (add platform upload)
3. ✅ Update PublishingWorker (use pre-uploaded media)
4. ✅ Add structured logging
5. ✅ Update server.ts (start SchedulerWorker)
6. ✅ Deprecate old SchedulerService
7. ✅ Test backward compatibility

---

## FILES TO CREATE

- `src/workers/SchedulerWorker.ts` - New dedicated worker
- `src/queue/SchedulerQueue.ts` - Queue for scheduler jobs

---

## FILES TO MODIFY

- `src/workers/MediaProcessingWorker.ts` - Add platform upload
- `src/workers/PublishingWorker.ts` - Use pre-uploaded media
- `src/server.ts` - Start SchedulerWorker
- `src/services/SchedulerService.ts` - Mark as deprecated

---

## TESTING CHECKLIST

- [ ] SchedulerWorker runs every 60 seconds
- [ ] SchedulerWorker creates fanout jobs
- [ ] MediaProcessingWorker uploads to platforms
- [ ] platformMediaIds stored correctly
- [ ] PublishingWorker uses pre-uploaded media
- [ ] Backward compatibility with old posts
- [ ] Fallback upload works
- [ ] Structured logging works
- [ ] No duplicate job creation

---

## ROLLBACK PLAN

If issues occur:
1. Stop SchedulerWorker
2. Start old SchedulerService
3. Revert MediaProcessingWorker changes
4. Revert PublishingWorker changes
5. System falls back to current behavior

---

**Status**: Ready to implement  
**Estimated Time**: 3-4 hours  
**Risk Level**: Medium (backward compatibility maintained)
