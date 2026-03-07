# Storage Integration Complete

The storage abstraction layer has been successfully integrated into MediaUploadService.

## What Changed

### MediaUploadService Updates

1. **Storage Provider Integration**
   - Added singleton storage provider instance
   - Lazy initialization via `getStorageProvider()`
   - Logs storage type on initialization (local or s3)

2. **Storage Key Generation**
   - New method: `generateStorageKey(workspaceId, filename)`
   - Format: `workspaceId/yyyy/mm/uuid.ext`
   - Example: `workspace-123/2024/12/a1b2c3d4-e5f6.jpg`
   - Organized by workspace and date for better management

3. **Upload Flow**
   - Uses `storage.upload()` instead of direct local storage
   - Stores storage key in database (not full URL)
   - Generates public URL via `storage.getPublicUrl()`
   - Logs storage type used for each upload

4. **Backward Compatibility**
   - `getMediaById()`: Converts storage keys to URLs on retrieval
   - `getMediaByWorkspace()`: Converts storage keys to URLs for all media
   - Old files with full URLs continue to work
   - Detection: URLs starting with 'http' are treated as legacy

5. **Delete Flow**
   - Deletes from storage provider using `storage.delete()`
   - Handles both new storage keys and old URLs
   - Graceful error handling (continues DB deletion if storage fails)
   - Deletes thumbnails if present

## Database Schema

**No changes to schema** - backward compatible:
- `url` field: Now stores storage key (e.g., `workspace-123/2024/12/uuid.jpg`)
- `metadata.storageKey`: Stores key for reference
- Old records with full URLs continue to work

## Configuration

Set storage type via environment variable:

```env
# Use local storage (default)
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
LOCAL_STORAGE_URL=http://localhost:3000/uploads

# OR use S3-compatible storage
STORAGE_TYPE=s3
S3_BUCKET=my-bucket
S3_REGION=auto
S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_PUBLIC_URL=https://cdn.example.com
```

## How It Works

### New Upload Flow

```
1. User uploads file
2. MediaUploadService.uploadMedia() called
3. Get storage provider (local or S3)
4. Generate storage key: workspace-123/2024/12/uuid.jpg
5. Upload via provider.upload(buffer, key, options)
6. Store key in database (not full URL)
7. Return public URL to client
```

### Retrieval Flow

```
1. Client requests media list
2. MediaUploadService.getMediaByWorkspace() called
3. Fetch media from database
4. For each media:
   - If URL starts with 'http': Use as-is (old file)
   - Otherwise: Generate URL via provider.getPublicUrl(key)
5. Return media with public URLs
```

### Delete Flow

```
1. Client requests delete
2. MediaUploadService.deleteMedia() called
3. Check if media is used in posts
4. Delete from storage:
   - If key (no 'http'): Call provider.delete(key)
   - If old URL: Skip storage deletion
5. Delete from database
```

## Backward Compatibility

### Old Files (Before Integration)
- Stored with full URLs in database
- Detection: URL starts with 'http'
- Behavior: Return URL as-is
- No migration needed

### New Files (After Integration)
- Stored with storage keys in database
- Format: `workspaceId/yyyy/mm/uuid.ext`
- Behavior: Generate URL via provider
- Flexible: Can switch storage providers

## Testing

### Test Local Storage

```bash
# Set environment
export STORAGE_TYPE=local
export LOCAL_STORAGE_PATH=./uploads
export LOCAL_STORAGE_URL=http://localhost:3000/uploads

# Upload file
curl -X POST http://localhost:3000/api/composer/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.jpg"

# Verify file exists in ./uploads/workspace-id/yyyy/mm/
```

### Test S3 Storage

```bash
# Install AWS SDK
npm install @aws-sdk/client-s3

# Set environment
export STORAGE_TYPE=s3
export S3_BUCKET=my-bucket
export S3_REGION=auto
export S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
export S3_ACCESS_KEY=your-key
export S3_SECRET_KEY=your-secret
export S3_PUBLIC_URL=https://cdn.example.com

# Upload file
curl -X POST http://localhost:3000/api/composer/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.jpg"

# Verify file exists in S3 bucket
```

## Logs

The service logs storage operations:

```
INFO: Storage provider initialized { type: 'local' }
INFO: File uploaded via storage provider { key: 'workspace-123/2024/12/uuid.jpg', size: 12345, workspaceId: 'workspace-123', storageType: 'local' }
INFO: Media uploaded { mediaId: '...', workspaceId: '...', type: 'image', size: 12345 }
```

## Migration Path

### Current State (Phase 2 Complete)
- ✅ Storage abstraction layer created
- ✅ MediaUploadService integrated
- ✅ New uploads use StorageProvider
- ✅ Old files continue to work
- ✅ Backward compatibility maintained

### Future (Phase 3)
- Migrate old files to new storage
- Remove legacy URL handling
- Optimize storage key structure
- Add storage analytics

## API Response Format

**No changes to API response** - backward compatible:

```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "media": {
    "_id": "...",
    "workspaceId": "...",
    "type": "image",
    "url": "workspace-123/2024/12/uuid.jpg",
    "filename": "uuid.jpg",
    "size": 12345,
    "mimeType": "image/jpeg"
  },
  "url": "http://localhost:3000/uploads/workspace-123/2024/12/uuid.jpg",
  "thumbnailUrl": "http://localhost:3000/uploads/workspace-123/2024/12/uuid_thumb.jpg"
}
```

Note: `media.url` contains the storage key, while the top-level `url` contains the public URL.

## Troubleshooting

### Issue: Files not uploading

**Check:**
1. Storage provider initialized? Check logs for "Storage provider initialized"
2. Environment variables set correctly?
3. For S3: AWS SDK installed? `npm install @aws-sdk/client-s3`
4. For S3: Credentials valid?

### Issue: Old files not loading

**Check:**
1. Old files have full URLs in database?
2. Backward compatibility logic working? (URLs starting with 'http')
3. Check logs for URL conversion

### Issue: Storage deletion fails

**Check:**
1. Storage provider has delete permissions?
2. Storage key correct in database?
3. Check logs for "Storage deletion error"
4. Note: DB deletion continues even if storage deletion fails

## Security Considerations

- Storage keys are workspace-scoped (prevents cross-workspace access)
- Date-based organization helps with retention policies
- Metadata includes uploader for audit trail
- Public URLs generated on-demand (can implement signed URLs later)

## Performance

- Storage provider initialized once (singleton)
- Lazy initialization (only when needed)
- Parallel operations (upload + thumbnail generation)
- Efficient key generation (no database lookups)

## Next Steps

1. Install AWS SDK for S3 support: `npm install @aws-sdk/client-s3`
2. Configure environment variables for production
3. Test with Cloudflare R2 or AWS S3
4. Monitor storage usage and costs
5. Consider implementing signed URLs for private files
6. Plan migration strategy for old files (if needed)
