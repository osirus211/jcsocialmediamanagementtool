# Phase 6: Product UX Infrastructure - COMPLETE

## Overview
Phase 6 implements comprehensive media upload infrastructure with S3-compatible storage, signed URLs, and complete API layer for handling images and videos.

---

## Implementation Summary

### ✅ STEP 1: MediaUploadService
**Status**: COMPLETE

**Implementation**:
- Created `MediaUploadService` class for handling media uploads
- S3-compatible storage integration
- Signed URL generation for direct client uploads
- Media validation (file type and size)
- Storage key generation with workspace isolation
- CDN support for public URLs

**Features**:
- Generate signed upload URLs (15-minute expiration)
- Confirm upload completion
- Mark uploads as failed
- Get media by ID
- List media with pagination
- Delete media
- Track workspace storage usage

**Files**:
- `src/services/MediaUploadService.ts`

**Key Methods**:
```typescript
generateUploadUrl(input): Promise<GenerateUploadUrlResult>
confirmUpload(input): Promise<IMedia>
markUploadFailed(mediaId, workspaceId, error): Promise<void>
getMediaById(mediaId, workspaceId): Promise<IMedia>
getMediaList(workspaceId, options): Promise<MediaListResponse>
deleteMedia(mediaId, workspaceId): Promise<void>
```

---

### ✅ STEP 2: S3-Compatible Storage Integration
**Status**: COMPLETE

**Implementation**:
- AWS SDK S3 Client integration
- Support for AWS S3 and S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
- Pre-signed URL generation for secure direct uploads
- CDN integration for public URLs
- Workspace-scoped storage keys

**Configuration** (Environment Variables):
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=social-media-scheduler
S3_ENDPOINT=https://s3.example.com  # Optional for S3-compatible services
CDN_URL=https://cdn.example.com     # Optional CDN URL
```

**Storage Key Format**:
```
workspaces/{workspaceId}/media/{timestamp}-{uuid}.{ext}
```

**URL Generation**:
- With CDN: `https://cdn.example.com/workspaces/.../media/...`
- Without CDN: `https://bucket.s3.region.amazonaws.com/workspaces/.../media/...`

**Security**:
- Signed URLs expire after 15 minutes
- Workspace isolation in storage paths
- Content-Type validation
- Content-Length validation

---

### ✅ STEP 3: Media Metadata Model
**Status**: COMPLETE

**Implementation**:
- Created `Media` MongoDB model
- Tracks upload status (pending, uploaded, failed)
- Stores file metadata (size, dimensions, duration)
- References workspace and user
- Indexes for efficient queries

**Schema**:
```typescript
{
  workspaceId: ObjectId (indexed)
  userId: ObjectId (indexed)
  filename: string
  originalFilename: string
  mimeType: string
  mediaType: 'image' | 'video' (indexed)
  size: number (bytes)
  width?: number (pixels)
  height?: number (pixels)
  duration?: number (seconds)
  storageKey: string (unique)
  storageUrl: string (public URL)
  thumbnailUrl?: string
  status: 'pending' | 'uploaded' | 'failed' (indexed)
  uploadedAt?: Date
  metadata?: object
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `{ workspaceId: 1, status: 1 }`
- `{ workspaceId: 1, mediaType: 1 }`
- `{ workspaceId: 1, createdAt: -1 }`
- `{ storageKey: 1 }` (unique)

**Files**:
- `src/models/Media.ts`

---

### ✅ STEP 4: Post Creation Flow Update
**Status**: COMPLETE

**Implementation**:
- Updated `PostService` to support `mediaIds` parameter
- Added `resolveMediaIds()` method to convert media IDs to URLs
- Validates media belongs to workspace
- Validates media status is 'uploaded'
- Backward compatible with `mediaUrls` parameter

**Updated Interfaces**:
```typescript
interface CreatePostInput {
  workspaceId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls?: string[]; // Deprecated: use mediaIds
  mediaIds?: string[];  // New: reference to Media model
  scheduledAt: Date;
}

interface UpdatePostInput {
  content?: string;
  mediaUrls?: string[]; // Deprecated: use mediaIds
  mediaIds?: string[];  // New: reference to Media model
  scheduledAt?: Date;
}
```

**Flow**:
1. Client uploads media via `/api/v1/media/upload-url`
2. Client uploads file to signed URL
3. Client confirms upload via `/api/v1/media/:id/confirm`
4. Client creates post with `mediaIds` array
5. PostService resolves media IDs to storage URLs
6. Post is created with resolved URLs

**Files**:
- `src/services/PostService.ts` (modified)
- `src/validators/postValidators.ts` (modified)

---

### ✅ STEP 5: Media Upload API Endpoints
**Status**: COMPLETE

**Endpoints Implemented**:

1. **POST /api/v1/media/upload-url** - Generate signed upload URL
   - Input: workspaceId, filename, mimeType, size
   - Output: mediaId, uploadUrl, storageUrl, expiresIn
   - Creates pending media record
   - Returns pre-signed S3 URL

2. **POST /api/v1/media/:id/confirm** - Confirm upload completion
   - Input: workspaceId, width?, height?, duration?
   - Output: Updated media record
   - Marks media as uploaded
   - Updates metadata

3. **POST /api/v1/media/:id/failed** - Mark upload as failed
   - Input: workspaceId, error
   - Output: Success message
   - Marks media as failed
   - Records error details

4. **GET /api/v1/media** - List media files
   - Query: workspaceId, mediaType?, status?, page?, limit?
   - Output: Paginated media list
   - Supports filtering by type and status

5. **GET /api/v1/media/:id** - Get media by ID
   - Query: workspaceId
   - Output: Media record
   - Workspace-scoped access

6. **DELETE /api/v1/media/:id** - Delete media
   - Query: workspaceId
   - Output: Success message
   - Deletes from database (S3 deletion TODO)

**Files**:
- `src/controllers/MediaController.ts`
- `src/routes/v1/media.routes.ts`
- `src/validators/mediaValidators.ts`

**Security**:
- All endpoints require authentication (`requireAuth`)
- All endpoints require workspace context (`requireWorkspace`)
- Rate limiting: 50 requests per 15 minutes
- Workspace-scoped access control

---

### ✅ STEP 6: File Type and Size Validation
**Status**: COMPLETE

**Supported File Types**:

**Images**:
- image/jpeg
- image/jpg
- image/png
- image/gif
- image/webp

**Videos**:
- video/mp4
- video/mpeg
- video/quicktime
- video/webm

**Size Limits**:
- Images: 10MB maximum
- Videos: 100MB maximum

**Validation Points**:
1. **API Level** - express-validator in `mediaValidators.ts`
2. **Service Level** - `MediaUploadService.validateFile()`
3. **S3 Level** - Content-Length header in signed URL

**Error Handling**:
- Unsupported file type → 400 Bad Request
- File size exceeded → 400 Bad Request
- Validation failures recorded in metrics

**Files**:
- `src/services/MediaUploadService.ts` - Validation logic
- `src/validators/mediaValidators.ts` - API validation

---

### ✅ STEP 7: Prometheus Metrics
**Status**: COMPLETE

**Metrics Implemented**:

1. **media_uploads_total** (Counter)
   - Labels: media_type, status
   - Tracks total uploads by type and outcome

2. **media_upload_failures_total** (Counter)
   - Labels: media_type, error_type
   - Tracks upload failures by type and error

3. **media_upload_duration_ms** (Histogram)
   - Labels: media_type, status
   - Tracks upload operation duration
   - Buckets: 100ms to 60s

4. **media_upload_size_bytes** (Histogram)
   - Labels: media_type
   - Tracks file sizes
   - Buckets: 10KB to 100MB

5. **media_storage_usage_bytes** (Gauge)
   - Labels: workspace_id
   - Tracks total storage per workspace
   - Updated on upload/delete

6. **media_signed_urls_generated_total** (Counter)
   - Labels: media_type
   - Tracks signed URL generation

7. **media_validation_failures_total** (Counter)
   - Labels: validation_type
   - Tracks validation failures

**Helper Functions**:
```typescript
recordMediaUpload(mediaType, status, durationMs, sizeBytes)
recordMediaUploadFailure(mediaType, errorType)
recordSignedUrlGenerated(mediaType)
recordValidationFailure(validationType)
updateStorageUsage(workspaceId, totalBytes)
```

**Files**:
- `src/config/mediaMetrics.ts`

**Monitoring Queries**:
```promql
# Upload success rate
rate(media_uploads_total{status="success"}[5m]) / rate(media_uploads_total[5m])

# Average upload duration
avg(media_upload_duration_ms) by (media_type)

# Storage usage by workspace
media_storage_usage_bytes

# Validation failure rate
rate(media_validation_failures_total[5m])
```

---

## Architecture

### Upload Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. POST /api/v1/media/upload-url
     │    { filename, mimeType, size }
     ▼
┌─────────────────┐
│ MediaController │
└────┬────────────┘
     │
     │ 2. Generate signed URL
     ▼
┌──────────────────────┐
│ MediaUploadService   │
│ - Validate file      │
│ - Create Media record│
│ - Generate S3 URL    │
└────┬─────────────────┘
     │
     │ 3. Return signed URL
     ▼
┌─────────┐
│ Client  │
│ Uploads │
│ to S3   │
└────┬────┘
     │
     │ 4. POST /api/v1/media/:id/confirm
     │    { width, height, duration }
     ▼
┌──────────────────────┐
│ MediaUploadService   │
│ - Mark as uploaded   │
│ - Update metadata    │
│ - Update metrics     │
└──────────────────────┘
```

### Post Creation with Media

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. Upload media files (get mediaIds)
     │
     │ 2. POST /api/v1/posts
     │    { content, mediaIds: [...] }
     ▼
┌─────────────┐
│PostService  │
└────┬────────┘
     │
     │ 3. Resolve media IDs to URLs
     ▼
┌──────────────────────┐
│ Media.find()         │
│ - Validate workspace │
│ - Validate uploaded  │
│ - Get storage URLs   │
└────┬─────────────────┘
     │
     │ 4. Create post with URLs
     ▼
┌──────────────────────┐
│ ScheduledPost.create │
│ { mediaUrls: [...] } │
└──────────────────────┘
```

### Storage Structure

```
S3 Bucket: social-media-scheduler
│
├── workspaces/
│   ├── {workspace-id-1}/
│   │   └── media/
│   │       ├── 1234567890-uuid1.jpg
│   │       ├── 1234567891-uuid2.mp4
│   │       └── ...
│   │
│   ├── {workspace-id-2}/
│   │   └── media/
│   │       └── ...
│   │
│   └── ...
```

---

## API Reference

### Generate Upload URL

**Request**:
```http
POST /api/v1/media/upload-url
Authorization: Bearer {token}
Content-Type: application/json

{
  "workspaceId": "507f1f77bcf86cd799439012",
  "filename": "product-image.jpg",
  "mimeType": "image/jpeg",
  "size": 1048576
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "mediaId": "507f1f77bcf86cd799439020",
    "uploadUrl": "https://bucket.s3.amazonaws.com/...?signature=...",
    "storageUrl": "https://cdn.example.com/workspaces/.../media/...",
    "expiresIn": 900
  },
  "meta": {
    "timestamp": "2026-03-04T15:00:00Z",
    "requestId": "req_123"
  }
}
```

### Upload to S3

**Request**:
```http
PUT {uploadUrl}
Content-Type: image/jpeg
Content-Length: 1048576

{binary data}
```

### Confirm Upload

**Request**:
```http
POST /api/v1/media/507f1f77bcf86cd799439020/confirm
Authorization: Bearer {token}
Content-Type: application/json

{
  "workspaceId": "507f1f77bcf86cd799439012",
  "width": 1920,
  "height": 1080
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "workspaceId": "507f1f77bcf86cd799439012",
    "filename": "1234567890-uuid.jpg",
    "originalFilename": "product-image.jpg",
    "mimeType": "image/jpeg",
    "mediaType": "image",
    "size": 1048576,
    "width": 1920,
    "height": 1080,
    "storageUrl": "https://cdn.example.com/...",
    "status": "uploaded",
    "uploadedAt": "2026-03-04T15:00:05Z",
    "createdAt": "2026-03-04T15:00:00Z",
    "updatedAt": "2026-03-04T15:00:05Z"
  }
}
```

### Create Post with Media

**Request**:
```http
POST /api/v1/posts
Authorization: Bearer {token}
Content-Type: application/json

{
  "workspaceId": "507f1f77bcf86cd799439012",
  "socialAccountId": "507f1f77bcf86cd799439013",
  "platform": "twitter",
  "content": "Check out our new product!",
  "mediaIds": ["507f1f77bcf86cd799439020"],
  "scheduledAt": "2026-03-04T16:00:00Z"
}
```

---

## Dependencies Required

### AWS SDK for S3
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Already Installed
- uuid (for unique filenames)
- mongoose (for Media model)
- express-validator (for validation)
- prom-client (for metrics)

---

## Configuration

### Environment Variables

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=social-media-scheduler

# Optional: S3-Compatible Service (MinIO, DigitalOcean Spaces, etc.)
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com

# Optional: CDN for public URLs
CDN_URL=https://cdn.example.com
```

### S3 Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::social-media-scheduler/*"
    }
  ]
}
```

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["https://app.example.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## Testing

### 1. Generate Upload URL
```bash
curl -X POST http://localhost:3000/api/v1/media/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace_id",
    "filename": "test.jpg",
    "mimeType": "image/jpeg",
    "size": 1048576
  }'
```

### 2. Upload to S3
```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg
```

### 3. Confirm Upload
```bash
curl -X POST http://localhost:3000/api/v1/media/$MEDIA_ID/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace_id",
    "width": 1920,
    "height": 1080
  }'
```

### 4. Create Post with Media
```bash
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace_id",
    "socialAccountId": "account_id",
    "platform": "twitter",
    "content": "Test post with media",
    "mediaIds": ["'$MEDIA_ID'"],
    "scheduledAt": "2026-03-04T16:00:00Z"
  }'
```

---

## Files Created/Modified

### New Files
1. `src/models/Media.ts` - Media metadata model
2. `src/services/MediaUploadService.ts` - Upload service
3. `src/controllers/MediaController.ts` - API controller
4. `src/routes/v1/media.routes.ts` - API routes
5. `src/validators/mediaValidators.ts` - Input validation
6. `src/config/mediaMetrics.ts` - Prometheus metrics

### Modified Files
1. `src/services/PostService.ts` - Added mediaIds support
2. `src/validators/postValidators.ts` - Added mediaIds validation

---

## Next Steps

### 1. Install AWS SDK
```bash
cd apps/backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Configure S3
- Create S3 bucket or configure S3-compatible service
- Set up bucket policy for public read access
- Configure CORS for client uploads
- Add environment variables

### 3. Register Media Routes
Add to `src/server.ts`:
```typescript
import mediaRoutes from './routes/v1/media.routes';
app.use('/api/v1/media', mediaRoutes);
```

### 4. Frontend Integration
- Implement media upload UI
- Handle signed URL uploads
- Display media library
- Integrate with post composer

### 5. Optional Enhancements
- Image thumbnail generation
- Video transcoding
- Storage quota enforcement
- Media CDN integration
- Automatic cleanup of failed uploads

---

## Status: COMPLETE ✅

Phase 6 Product UX Infrastructure is complete with:
- ✅ MediaUploadService with S3 integration
- ✅ Signed upload URL generation
- ✅ Media metadata model
- ✅ Post creation with media IDs
- ✅ Complete API layer (6 endpoints)
- ✅ File type and size validation
- ✅ Prometheus metrics (7 metrics)

**Ready for AWS SDK installation and S3 configuration.**

---

**Completion Date**: 2026-03-04  
**Phase**: Phase 6 - Product UX Infrastructure  
**Status**: COMPLETE ✅
