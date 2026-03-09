# Media Lifecycle Tracking Enhancement

## Status: ✅ COMPLETE

## Overview

Enhanced the Media storage system with granular upload lifecycle tracking to prevent orphan files and incomplete uploads. The system now tracks separate states for upload and processing phases.

## Objective

Track the lifecycle of media uploads through distinct phases:
1. **Upload Phase**: `pending` → `uploaded` → `failed`
2. **Processing Phase**: `pending` → `processing` → `completed` → `failed`

This prevents:
- Publishing posts with incomplete media
- Using media that failed to upload
- Processing media that hasn't been uploaded yet
- Orphan files in storage

## Changes Implemented

### 1. Media Model Updates ✅

**Location:** `src/models/Media.ts`

**New Enums:**
```typescript
export enum UploadStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  FAILED = 'failed',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

**New Fields:**
- `uploadStatus` - Tracks upload lifecycle (pending → uploaded → failed)
- `processingStatus` - Tracks processing lifecycle (pending → processing → completed → failed)

**Legacy Field:**
- `status` - Kept for backward compatibility, updated alongside new fields

**New Indexes:**
```typescript
MediaSchema.index({ workspaceId: 1, uploadStatus: 1 });
MediaSchema.index({ workspaceId: 1, processingStatus: 1 });
MediaSchema.index({ uploadStatus: 1, processingStatus: 1 }); // For finding ready media
```

### 2. MediaService Enhancements ✅

**Location:** `src/services/MediaService.ts`

**New Methods:**

#### `markUploadCompleted(mediaId: string)`
Marks upload as completed when client finishes uploading to S3.

**Updates:**
- `uploadStatus` → `'uploaded'`
- `uploadedAt` → current timestamp
- `status` → `'uploaded'` (legacy)

**Usage:** Called by UploadController after successful upload

#### `markUploadFailed(mediaId: string, errorMessage?: string)`
Marks upload as failed if upload to S3 fails.

**Updates:**
- `uploadStatus` → `'failed'`
- `status` → `'failed'` (legacy)
- `metadata.uploadError` → error message
- `metadata.uploadFailedAt` → current timestamp

**Usage:** Called by UploadController on upload errors

#### `markProcessingStarted(mediaId: string)`
Marks processing as started when MediaProcessingWorker begins.

**Updates:**
- `processingStatus` → `'processing'`
- `status` → `'processing'` (legacy)
- `metadata.processingStartedAt` → current timestamp

**Usage:** Called by MediaProcessingWorker at start

#### `markProcessingCompleted(mediaId: string, processingData?: {...})`
Marks processing as completed when MediaProcessingWorker finishes.

**Updates:**
- `processingStatus` → `'completed'`
- `status` → `'ready'` (legacy)
- `width`, `height`, `duration`, `thumbnailUrl` → from processing
- `metadata.processingCompletedAt` → current timestamp

**Usage:** Called by MediaProcessingWorker on success

#### `markProcessingFailed(mediaId: string, errorMessage?: string)`
Marks processing as failed if MediaProcessingWorker encounters error.

**Updates:**
- `processingStatus` → `'failed'`
- `status` → `'failed'` (legacy)
- `metadata.processingError` → error message
- `metadata.processingFailedAt` → current timestamp

**Usage:** Called by MediaProcessingWorker on error

#### `getReadyMedia(workspaceId: string, mediaIds?: string[])`
Returns only media that is ready for publishing.

**Filter Criteria:**
- `uploadStatus` = `'uploaded'`
- `processingStatus` = `'completed'`
- Optional: filter by specific media IDs

**Usage:** Can be used by publishing workers to validate media

### 3. UploadController Updates ✅

**Location:** `src/controllers/UploadController.ts`

**Updated Endpoint:** `POST /media/complete`

**Changes:**
```typescript
// Create media record
const media = await mediaService.createMedia({...});

// Mark upload as completed
const updatedMedia = await mediaService.markUploadCompleted(media._id.toString());
```

**Flow:**
1. Client uploads file to S3 using presigned URL
2. Client calls `/media/complete` with storage key
3. Server creates media record (uploadStatus: 'pending')
4. Server marks upload as completed (uploadStatus: 'uploaded')
5. Media is now ready for processing

### 4. MediaProcessingWorker Updates ✅

**Location:** `src/workers/MediaProcessingWorker.ts`

**Updated `process()` Method:**

**Start of Processing:**
```typescript
// Mark processing as started
await mediaService.markProcessingStarted(mediaId);
```

**On Success:**
```typescript
// Mark processing as completed with processed data
await mediaService.markProcessingCompleted(mediaId, {
  width: processedData.width,
  height: processedData.height,
  duration: processedData.duration,
  thumbnailUrl: processedData.thumbnailUrl,
  metadata: {...},
});
```

**On Error:**
```typescript
// Mark processing as failed
await mediaService.markProcessingFailed(mediaId, error.message);
```

### 5. PublishingWorker Updates ✅

**Location:** `src/workers/PublishingWorker.ts`

**Updated `prepareMedia()` Method:**

**Critical Change:**
```typescript
// CRITICAL: Only fetch media that is fully uploaded and processed
const mediaDocuments = await Media.find({
  _id: { $in: post.mediaIds },
  workspaceId: post.workspaceId,
  uploadStatus: UploadStatus.UPLOADED, // Must be uploaded
  processingStatus: ProcessingStatus.COMPLETED, // Must be processed
});

// If no media is ready, throw error
if (mediaDocuments.length === 0) {
  throw new Error('No media ready for publishing. Media must be uploaded and processed.');
}
```

**Behavior:**
- Only uses media where `uploadStatus = 'uploaded'` AND `processingStatus = 'completed'`
- Logs warning if some media is not ready
- Throws error if no media is ready
- Prevents publishing with incomplete media

## Lifecycle State Machine

### Upload Lifecycle

```
┌─────────┐
│ pending │ (Initial state when presigned URL generated)
└────┬────┘
     │
     ├─── Upload Success ──→ ┌──────────┐
     │                       │ uploaded │
     │                       └──────────┘
     │
     └─── Upload Failure ──→ ┌────────┐
                             │ failed │
                             └────────┘
```

### Processing Lifecycle

```
┌─────────┐
│ pending │ (Waiting for processing)
└────┬────┘
     │
     ├─── Worker Starts ──→ ┌────────────┐
     │                      │ processing │
     │                      └──────┬─────┘
     │                             │
     │                             ├─── Success ──→ ┌───────────┐
     │                             │                 │ completed │
     │                             │                 └───────────┘
     │                             │
     │                             └─── Failure ──→ ┌────────┐
     │                                               │ failed │
     │                                               └────────┘
     │
     └─── Processing Skipped ──→ ┌────────┐
                                  │ failed │
                                  └────────┘
```

### Combined Lifecycle (Ready for Publishing)

```
Upload: pending → uploaded
Processing: pending → processing → completed
                                    ↓
                            ✅ READY FOR PUBLISHING
```

## API Response Changes

### Media Object Now Includes:

```json
{
  "id": "...",
  "workspaceId": "...",
  "filename": "...",
  "status": "ready",
  "uploadStatus": "uploaded",
  "processingStatus": "completed",
  "uploadedAt": "2024-03-07T...",
  "createdAt": "2024-03-07T...",
  "updatedAt": "2024-03-07T..."
}
```

### Status Field Mapping:

| uploadStatus | processingStatus | status (legacy) |
|--------------|------------------|-----------------|
| pending      | pending          | pending         |
| uploaded     | pending          | uploaded        |
| uploaded     | processing       | processing      |
| uploaded     | completed        | ready           |
| failed       | *                | failed          |
| *            | failed           | failed          |

## Error Handling

### Upload Failures

**Scenario:** Client fails to upload to S3

**Handling:**
- UploadController can call `markUploadFailed()`
- Media record marked as failed
- Storage key can be cleaned up
- User notified of upload failure

### Processing Failures

**Scenario:** MediaProcessingWorker encounters error

**Handling:**
- Worker calls `markProcessingFailed()`
- Media record marked as failed
- Error message stored in metadata
- User can retry or delete media

### Publishing with Incomplete Media

**Scenario:** Post references media that isn't ready

**Handling:**
- PublishingWorker filters out incomplete media
- Logs warning about filtered media
- Throws error if no media is ready
- Post remains in queue for retry

## Database Queries

### Find Ready Media

```typescript
// Media ready for publishing
const readyMedia = await Media.find({
  workspaceId: workspaceId,
  uploadStatus: 'uploaded',
  processingStatus: 'completed',
});
```

### Find Failed Uploads

```typescript
// Media that failed to upload
const failedUploads = await Media.find({
  workspaceId: workspaceId,
  uploadStatus: 'failed',
});
```

### Find Stuck Processing

```typescript
// Media stuck in processing (for cleanup)
const stuckMedia = await Media.find({
  workspaceId: workspaceId,
  processingStatus: 'processing',
  updatedAt: { $lt: new Date(Date.now() - 3600000) }, // 1 hour ago
});
```

### Find Orphan Media

```typescript
// Media uploaded but never processed
const orphanMedia = await Media.find({
  workspaceId: workspaceId,
  uploadStatus: 'uploaded',
  processingStatus: 'pending',
  createdAt: { $lt: new Date(Date.now() - 86400000) }, // 24 hours ago
});
```

## Benefits

### 1. Prevents Orphan Files
- Track upload completion separately from processing
- Identify media that was uploaded but never processed
- Clean up incomplete uploads

### 2. Prevents Publishing Incomplete Media
- PublishingWorker only uses fully ready media
- Explicit checks for upload and processing completion
- Clear error messages when media isn't ready

### 3. Better Error Tracking
- Separate error states for upload vs processing
- Error messages stored in metadata
- Timestamps for failure events

### 4. Improved Monitoring
- Query media by lifecycle state
- Identify bottlenecks in pipeline
- Track success/failure rates separately

### 5. Retry Logic
- Can retry failed uploads without reprocessing
- Can retry failed processing without re-uploading
- Clear state for retry decisions

## Backward Compatibility

### Legacy `status` Field
- Still updated alongside new fields
- Existing queries still work
- Gradual migration possible

### Mapping Logic
```typescript
// When uploadStatus changes
if (uploadStatus === 'uploaded') {
  status = 'uploaded';
}
if (uploadStatus === 'failed') {
  status = 'failed';
}

// When processingStatus changes
if (processingStatus === 'processing') {
  status = 'processing';
}
if (processingStatus === 'completed') {
  status = 'ready';
}
if (processingStatus === 'failed') {
  status = 'failed';
}
```

## Testing Recommendations

### Unit Tests

1. **MediaService Lifecycle Methods**
   - Test `markUploadCompleted()`
   - Test `markUploadFailed()`
   - Test `markProcessingStarted()`
   - Test `markProcessingCompleted()`
   - Test `markProcessingFailed()`
   - Test `getReadyMedia()`

2. **State Transitions**
   - Test valid state transitions
   - Test invalid state transitions
   - Test concurrent updates

### Integration Tests

1. **Upload Flow**
   - Generate presigned URL
   - Upload to S3
   - Complete upload
   - Verify uploadStatus = 'uploaded'

2. **Processing Flow**
   - Create uploaded media
   - Start processing
   - Verify processingStatus = 'processing'
   - Complete processing
   - Verify processingStatus = 'completed'

3. **Publishing Flow**
   - Create post with media
   - Verify only ready media is used
   - Test with incomplete media
   - Verify error handling

### Manual Testing

1. **Upload Lifecycle**
   ```bash
   # 1. Generate upload URL
   POST /api/v1/media/upload-url
   
   # 2. Upload to S3
   PUT {presignedUrl}
   
   # 3. Complete upload
   POST /api/v1/media/complete
   
   # 4. Verify status
   GET /api/v1/media/{id}
   # Should show: uploadStatus: 'uploaded', processingStatus: 'pending'
   ```

2. **Processing Lifecycle**
   ```bash
   # Wait for MediaProcessingWorker to process
   
   # Verify status
   GET /api/v1/media/{id}
   # Should show: uploadStatus: 'uploaded', processingStatus: 'completed'
   ```

3. **Publishing with Media**
   ```bash
   # Create post with media
   POST /api/v1/posts
   {
     "content": "Test post",
     "mediaIds": ["media-id"]
   }
   
   # Verify post publishes successfully
   # Check logs for media preparation
   ```

## Monitoring Queries

### Dashboard Metrics

```typescript
// Upload success rate
const uploadStats = await Media.aggregate([
  { $match: { workspaceId: workspaceId } },
  { $group: {
    _id: '$uploadStatus',
    count: { $sum: 1 }
  }}
]);

// Processing success rate
const processingStats = await Media.aggregate([
  { $match: { workspaceId: workspaceId } },
  { $group: {
    _id: '$processingStatus',
    count: { $sum: 1 }
  }}
]);

// Average processing time
const avgProcessingTime = await Media.aggregate([
  { $match: {
    workspaceId: workspaceId,
    processingStatus: 'completed',
    'metadata.processingStartedAt': { $exists: true },
    'metadata.processingCompletedAt': { $exists: true }
  }},
  { $project: {
    duration: {
      $subtract: [
        '$metadata.processingCompletedAt',
        '$metadata.processingStartedAt'
      ]
    }
  }},
  { $group: {
    _id: null,
    avgDuration: { $avg: '$duration' }
  }}
]);
```

## Files Modified

1. ✅ `src/models/Media.ts` - Added uploadStatus and processingStatus fields
2. ✅ `src/services/MediaService.ts` - Added lifecycle tracking methods
3. ✅ `src/controllers/UploadController.ts` - Updated to mark upload completed
4. ✅ `src/workers/MediaProcessingWorker.ts` - Updated to use lifecycle methods
5. ✅ `src/workers/PublishingWorker.ts` - Updated to only use ready media

## Summary

Successfully enhanced the Media storage system with granular lifecycle tracking:

- ✅ Added `uploadStatus` and `processingStatus` fields to Media model
- ✅ Created lifecycle tracking methods in MediaService
- ✅ Updated UploadController to mark uploads as completed
- ✅ Updated MediaProcessingWorker to track processing states
- ✅ Updated PublishingWorker to only use fully ready media
- ✅ Added indexes for efficient querying
- ✅ Maintained backward compatibility with legacy `status` field

The system now prevents orphan files, incomplete uploads, and publishing with unready media through explicit lifecycle state tracking.
