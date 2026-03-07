# LinkedIn Media Upload - Image Support

## Overview

LinkedInProvider now supports image uploads using the LinkedIn Assets API.

## Implementation Details

### 1. Register Media Asset

**Endpoint**: `POST https://api.linkedin.com/v2/assets?action=registerUpload`

**Headers**:
```typescript
{
  'Authorization': 'Bearer {accessToken}',
  'Content-Type': 'application/json',
  'X-Restli-Protocol-Version': '2.0.0'
}
```

**Request Body**:
```json
{
  "registerUploadRequest": {
    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
    "owner": "urn:li:person:{providerUserId}",
    "serviceRelationships": [
      {
        "relationshipType": "OWNER",
        "identifier": "urn:li:userGeneratedContent"
      }
    ]
  }
}
```

**Response** (Success):
```json
{
  "value": {
    "uploadMechanism": {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        "uploadUrl": "https://upload.linkedin.com/..."
      }
    },
    "asset": "urn:li:digitalmediaAsset:1234567890"
  }
}
```

**Extract**:
- `uploadUrl`: URL to upload binary image
- `assetUrn`: Asset identifier to attach to post

### 2. Upload Image Binary

**Endpoint**: `PUT {uploadUrl}` (from step 1)

**Headers**:
```typescript
{
  'Content-Type': 'image/jpeg'  // or image/png
}
```

**Body**: Raw binary image data (ArrayBuffer)

**Response**: HTTP 200 or 201 on success

### 3. Attach Media to Post

**Modified UGC Post Request**:

**Without Media**:
```json
{
  "author": "urn:li:person:abc123",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": { "text": "Post content" },
      "shareMediaCategory": "NONE"
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

**With Media**:
```json
{
  "author": "urn:li:person:abc123",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": { "text": "Check out these images!" },
      "shareMediaCategory": "IMAGE",
      "media": [
        {
          "status": "READY",
          "media": "urn:li:digitalmediaAsset:1234567890"
        },
        {
          "status": "READY",
          "media": "urn:li:digitalmediaAsset:9876543210"
        }
      ]
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

## Upload Flow

```
1. Download image from mediaUrl
2. Validate size (≤ 5MB)
3. Validate type (jpg, png)
4. Register asset with LinkedIn → get uploadUrl + assetUrn
5. Upload binary to uploadUrl
6. Attach assetUrn to post
7. Create post with media
```

## Validation

### Limits

| Limit | Value |
|-------|-------|
| Max images per post | 9 |
| Max image size | 5MB |
| Allowed types | image/jpeg, image/jpg, image/png |

### Validation Errors (Permanent)

**Too Many Images**:
```typescript
{
  success: false,
  retryable: false,
  errorCode: 'INVALID_REQUEST',
  errorMessage: 'LinkedIn allows maximum 9 images per post'
}
```

**Image Too Large**:
```typescript
{
  success: false,
  retryable: false,
  errorCode: 'INVALID_REQUEST',
  errorMessage: 'Image size 7.5MB exceeds 5MB limit'
}
```

**Invalid Image Type**:
```typescript
{
  success: false,
  retryable: false,
  errorCode: 'INVALID_REQUEST',
  errorMessage: 'Image type image/gif not allowed. Allowed types: image/jpeg, image/jpg, image/png'
}
```

## Error Handling

### Asset Registration Errors

| Error Type | Status Code | Retryable | Description |
|------------|-------------|-----------|-------------|
| Network timeout | 0 | Yes | Connection issues |
| Rate limit | 429 | Yes | Too many requests |
| Invalid token | 401 | No | Token expired/invalid |
| Forbidden | 403 | No | Insufficient permissions |
| Server error | 500/503 | Yes | LinkedIn server issues |

### Binary Upload Errors

| Error Type | Status Code | Retryable | Description |
|------------|-------------|-----------|-------------|
| Network timeout | 0 | Yes | Connection issues |
| Invalid token | 401 | No | Token expired/invalid |
| Forbidden | 403 | No | Insufficient permissions |
| Server error | 500/503 | Yes | Upload server issues |

### Image Download Errors

| Error Type | Retryable | Description |
|------------|-----------|-------------|
| Network timeout | Yes | Failed to download from mediaUrl |
| Invalid URL | No | mediaUrl not accessible |
| Size exceeded | No | Image > 5MB |
| Type not allowed | No | Not jpg/png |

## Retry Behavior

### Scenario 1: Network Error During Asset Registration

```
1. Worker calls provider.publishPost()
2. Provider downloads image → success
3. Provider registers asset → network timeout
4. Provider throws error with statusCode=0 (retryable)
5. Worker retries entire post (including asset registration)
6. BullMQ exponential backoff: 5s → 25s → 125s
```

### Scenario 2: Binary Upload Fails

```
1. Provider registers asset → success (uploadUrl + assetUrn obtained)
2. Provider uploads binary → network timeout
3. Provider throws error with statusCode=0 (retryable)
4. Worker retries entire post
5. Asset re-registered (new uploadUrl + assetUrn)
6. Binary uploaded successfully
7. Post created with new assetUrn
```

**Note**: LinkedIn asset registration is NOT idempotent. Each retry creates a new asset URN.

### Scenario 3: Image Too Large (Permanent)

```
1. Provider downloads image → 7.5MB
2. Provider validates size → exceeds 5MB limit
3. Provider throws error with statusCode=400 (permanent)
4. Worker marks post as FAILED (no retry)
5. User must resize image
```

### Scenario 4: Post Creation Fails After Upload

```
1. Provider registers asset → success
2. Provider uploads binary → success
3. Provider creates post → rate limit (429)
4. Provider throws error with statusCode=429 (retryable)
5. Worker retries entire post
6. Asset re-registered (new assetUrn)
7. Binary re-uploaded
8. Post created successfully
```

**Note**: Orphaned assets may exist on LinkedIn from failed attempts. This is expected behavior.

## Example Usage

### Single Image
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Check out this amazing photo!',
  mediaUrls: ['https://example.com/photo.jpg']
});
```

### Multiple Images
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Photo gallery from our event',
  mediaUrls: [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg',
    'https://example.com/photo3.jpg'
  ]
});
```

## Logging

### Asset Registration
```typescript
logger.debug('Registering LinkedIn asset', {
  url: 'https://api.linkedin.com/v2/assets?action=registerUpload',
  owner: 'urn:li:person:abc123',
  accountId: '507f1f77bcf86cd799439011'
});

logger.debug('Asset registered successfully', {
  accountId: '507f1f77bcf86cd799439011',
  assetUrn: 'urn:li:digitalmediaAsset:1234567890'
});
```

### Binary Upload
```typescript
logger.debug('Uploading binary to LinkedIn', {
  uploadUrl: 'https://upload.linkedin.com/...',
  contentType: 'image/jpeg',
  sizeMB: '2.34',
  accountId: '507f1f77bcf86cd799439011'
});

logger.debug('Binary uploaded successfully', {
  accountId: '507f1f77bcf86cd799439011'
});
```

### Complete Upload
```typescript
logger.info('All media uploaded successfully', {
  accountId: '507f1f77bcf86cd799439011',
  mediaCount: 3
});
```

### Upload Failure
```typescript
logger.error('Media upload failed', {
  accountId: '507f1f77bcf86cd799439011',
  mediaUrl: 'https://example.com/photo.jpg',
  position: 2,
  error: 'Network timeout during asset registration'
});
```

## Implementation Details

### registerAsset()
```typescript
private async registerAsset(
  accessToken: string,
  account: any,
  accountId: string
): Promise<{ uploadUrl: string; assetUrn: string }>
```

**Steps**:
1. Build request with recipes, owner URN, service relationships
2. POST to `/assets?action=registerUpload`
3. Extract uploadUrl from response
4. Extract assetUrn from response
5. Return both values

**Error Handling**:
- Network/timeout → retryable (statusCode=0)
- 401/403 → permanent (invalid token/permission)
- 429/500/503 → retryable (rate limit/server error)

### uploadBinary()
```typescript
private async uploadBinary(
  uploadUrl: string,
  imageBuffer: ArrayBuffer,
  contentType: string,
  accountId: string
): Promise<void>
```

**Steps**:
1. PUT binary data to uploadUrl
2. Set Content-Type header
3. Check response status (200 or 201 = success)

**Error Handling**:
- Network/timeout → retryable (statusCode=0)
- 401/403 → permanent (invalid token/permission)
- 500/503 → retryable (server error)

### uploadImage()
```typescript
private async uploadImage(
  mediaUrl: string,
  accessToken: string,
  account: any,
  accountId: string
): Promise<string>
```

**Steps**:
1. Register asset → get uploadUrl + assetUrn
2. Download image from mediaUrl
3. Validate size (≤ 5MB)
4. Validate type (jpg/png)
5. Upload binary to uploadUrl
6. Return assetUrn

**Error Handling**:
- Download failure → retryable
- Size/type validation → permanent
- Registration failure → retryable/permanent (depends on error)
- Upload failure → retryable/permanent (depends on error)

## LinkedIn vs Twitter Media Upload

| Feature | LinkedIn | Twitter |
|---------|----------|---------|
| **Steps** | 3-step (register → upload → attach) | 2-step (upload → attach) |
| **Upload Endpoint** | Dynamic (from registration) | Static |
| **Asset ID Format** | URN | Numeric string |
| **Max Images** | 9 | 4 |
| **Max Size** | 5MB | 5MB |
| **Allowed Types** | jpg, png | jpg, png, gif |
| **Idempotency** | No (new URN each time) | Yes (same media_id) |

## Testing

### Test Single Image
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: account._id,
  content: 'Test LinkedIn image post',
  mediaUrls: ['https://picsum.photos/800/600'],
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

### Test Multiple Images
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: account._id,
  content: 'LinkedIn gallery test',
  mediaUrls: [
    'https://picsum.photos/800/600',
    'https://picsum.photos/800/601',
    'https://picsum.photos/800/602'
  ],
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

## Monitoring

**Key Metrics**:
- Asset registration failures
- Binary upload failures
- Size validation errors
- Type validation errors
- Orphaned assets (registration success, post creation failed)

**Log Queries**:
```bash
# Find asset registration failures
grep "Asset registration error" logs

# Find binary upload failures
grep "Binary upload error" logs

# Find size validation errors
grep "exceeds 5MB limit" logs

# Find type validation errors
grep "not allowed" logs
```

## Common Issues

### Issue 1: Missing uploadUrl in Response
**Symptom**: Error "missing uploadUrl or asset URN"
**Cause**: LinkedIn API response structure changed
**Solution**: Verify response parsing logic

### Issue 2: Binary Upload 403 Forbidden
**Symptom**: Binary upload fails with 403
**Cause**: uploadUrl expired (valid for limited time)
**Solution**: Ensure upload happens immediately after registration

### Issue 3: Orphaned Assets
**Symptom**: Assets registered but not used in posts
**Cause**: Post creation failed after asset upload
**Solution**: This is expected - LinkedIn will clean up unused assets

## Security Notes

1. **Tokens never logged**: All logs exclude access tokens
2. **Upload URLs temporary**: uploadUrl expires after short time
3. **Asset ownership**: Assets tied to person URN
4. **Binary validation**: Size and type checked before upload
5. **HTTPS only**: All API calls use HTTPS

## Future Enhancements

1. **Video Support**: Add video upload (different recipe)
2. **Asset Caching**: Cache assetUrns to avoid re-upload on retry
3. **Progress Tracking**: Track upload progress for large images
4. **Image Optimization**: Auto-resize images > 5MB
5. **Alt Text**: Add description for accessibility
