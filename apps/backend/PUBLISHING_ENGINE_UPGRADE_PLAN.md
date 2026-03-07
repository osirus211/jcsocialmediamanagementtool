# Publishing Engine Upgrade to Buffer-Grade Architecture

**Date**: March 6, 2026  
**Goal**: Upgrade existing publishing system to support multi-platform fanout, correct idempotency, and separated media pipeline

---

## UPGRADE OVERVIEW

### Current State
- ✅ PublishingWorker with 7-layer idempotency
- ✅ posting-queue with BullMQ
- ✅ SchedulerService (polling-based)
- ✅ MediaProcessingWorker (local optimization only)
- ✅ Platform adapters (Twitter, Facebook, Instagram, LinkedIn, TikTok)

### Target State
- ✅ Multi-platform fanout (one post → multiple platform jobs)
- ✅ Platform-specific idempotency keys
- ✅ Separated media pipeline (upload before publish)
- ✅ Dedicated SchedulerWorker (replaces polling)
- ✅ Single publishQueue with platform identifier
- ✅ Backward compatibility maintained

---

## IMPLEMENTATION STEPS

### STEP 1: Platform Fanout
**Files to Modify**:
- `src/services/ComposerService.ts` - Add fanout logic
- `src/queue/PostingQueue.ts` - Update job payload
- `src/models/Post.ts` - Already has `socialAccountIds[]`

**Changes**:
1. Update `PostingJobData` interface to include `platform`
2. Modify `publishNow()` to create multiple jobs (one per account)
3. Modify `schedulePost()` to store multiple accounts
4. Update `SchedulerService` to create fanout jobs

### STEP 2: Update Idempotency Keys
**Files to Modify**:
- `src/workers/PublishingWorker.ts` - Update lock keys
- `src/services/PublishHashService.ts` - Add platform to hash
- `src/services/DistributedLockService.ts` - No changes needed (accepts any resource string)

**Changes**:
1. Change lock key from `publish:{postId}` to `publish:{postId}:{platform}`
2. Add `platform` to `PublishHashInput` interface
3. Update all lock acquisition calls

### STEP 3: Media Pipeline Separation
**Files to Modify**:
- `src/workers/MediaProcessingWorker.ts` - Add platform upload
- `src/models/Media.ts` - Add `platformMediaIds` field
- `src/workers/PublishingWorker.ts` - Use pre-uploaded media IDs
- `src/adapters/media/*` - Already have upload methods

**Changes**:
1. Add `platformMediaIds: { platform: string, mediaId: string }[]` to Media model
2. MediaProcessingWorker uploads to platform APIs
3. PublishingWorker uses `platformMediaIds` instead of uploading

### STEP 4: Scheduler Worker
**Files to Create**:
- `src/workers/SchedulerWorker.ts` - New dedicated worker

**Files to Modify**:
- `src/services/SchedulerService.ts` - Mark as deprecated
- `src/server.ts` - Start SchedulerWorker instead

**Changes**:
1. Create SchedulerWorker that runs every 60 seconds
2. Query MongoDB for eligible posts
3. Create fanout jobs for each platform
4. Deprecate old SchedulerService

### STEP 5: Queue Simplification
**Files to Modify**:
- `src/queue/PostingQueue.ts` - Rename to PublishQueue
- `src/workers/PublishingWorker.ts` - Update queue name

**Changes**:
1. Keep single queue: `publish-queue` (or rename to `publishQueue`)
2. Jobs include `platform` identifier
3. Platform-specific queues remain unused

### STEP 6: Backward Compatibility
**Strategy**:
1. If `socialAccountIds` is empty, use `socialAccountId` (single account)
2. If `socialAccountIds` has one item, create one job
3. If `socialAccountIds` has multiple items, create fanout jobs
4. All existing posts continue to work

---

## IMPLEMENTATION ORDER

1. ✅ Update data models (Post, Media)
2. ✅ Update PublishHashService (add platform)
3. ✅ Update PostingQueue (add platform to job payload)
4. ✅ Update PublishingWorker (platform-specific locks, use pre-uploaded media)
5. ✅ Update MediaProcessingWorker (upload to platforms)
6. ✅ Update ComposerService (fanout logic)
7. ✅ Create SchedulerWorker (replace polling)
8. ✅ Update server.ts (start new worker)
9. ✅ Test backward compatibility

---

## TESTING CHECKLIST

- [ ] Single-platform post still works
- [ ] Multi-platform post creates multiple jobs
- [ ] Idempotency keys include platform
- [ ] Media uploaded before publishing
- [ ] SchedulerWorker picks up scheduled posts
- [ ] Concurrent publishing to different platforms
- [ ] Backward compatibility with existing posts

---

## ROLLBACK PLAN

If issues occur:
1. Revert server.ts to use old SchedulerService
2. Revert PublishingWorker to old lock keys
3. Revert ComposerService to single-job creation
4. System falls back to current behavior

---

**Status**: Ready to implement  
**Estimated Time**: 2-3 hours  
**Risk Level**: Medium (backward compatibility maintained)
