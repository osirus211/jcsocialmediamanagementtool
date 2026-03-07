# Meta Graph API Integration - Facebook & Instagram

## Overview

Implemented real publishing for:
- Facebook Page posts (text and images)
- Instagram Business Account posts (images with captions)

Both use Meta Graph API v18.0.

## Facebook Provider

### 1. Text Post

**Endpoint**: `POST https://graph.facebook.com/v18.0/{pageId}/feed`

**Request Body**:
```json
{
  "message": "Post content here",
  "access_token": "{pageAccessToken}"
}
```

**Response** (Success):
```json
{
  "id": "123456789_987654321"
}
```

### 2. Image Post

**Endpoint**: `POST https://graph.facebook.com/v18.0/{pageId}/photos`

**Request Body**:
```json
{
  "url": "https://example.com/image.jpg",
  "caption": "Post content here",
  "published": true,
  "access_token": "{pageAccessToken}"
}
```

**Response** (Success):
```json
{
  "id": "987654321",
  "post_id": "123456789_987654321"
}
```

**Note**: Uses `post_id` if available, falls back to `id`.

### Implementation Flow

```
1. Get page access token via TokenService
2. Get page ID from account.providerUserId
3. If mediaUrls present → publishPhotoPost()
4. Else → publishTextPost()
5. Return post ID
```

## Instagram Provider

### Two-Step Publish Process

Instagram requires a two-step process:
1. Create media container
2. Publish container

### Step 1: Create Media Container

**Endpoint**: `POST https://graph.facebook.com/v18.0/{igUserId}/media`

**Request Body**:
```json
{
  "image_url": "https://example.com/image.jpg",
  "caption": "Post caption here",
  "access_token": "{accessToken}"
}
```

**Response** (Success):
```json
{
  "id": "17895695668004550"
}
```

**Returns**: `creation_id` (container ID)

### Step 2: Publish Container

**Endpoint**: `POST https://graph.facebook.com/v18.0/{igUserId}/media_publish`

**Request Body**:
```json
{
  "creation_id": "17895695668004550",
  "access_token": "{accessToken}"
}
```

**Response** (Success):
```json
{
  "id": "17895695668004551"
}
```

**Returns**: `media_id` (published post ID)

### Implementation Flow

```
1. Validate: Instagram requires at least one image
2. Get access token via TokenService
3. Get Instagram user ID from account.providerUserId
4. Create media container → get creation_id
5. Publish container → get media_id
6. Return media_id
```

## Error Mapping

### HTTP Status Codes

| Status | Classification | Retryable | Description |
|--------|---------------|-----------|-------------|
| 200/201 | Success | - | Request successful |
| 400 | Permanent | No | Bad request / Invalid parameters |
| 401 | Permanent | No | Invalid or expired token |
| 403 | Permanent | No | Forbidden / Insufficient permissions |
| 404 | Permanent | No | Resource not found |
| 429 | Retryable | Yes | Rate limit exceeded |
| 500 | Retryable | Yes | Internal server error |
| 502 | Retryable | Yes | Bad gateway |
| 503 | Retryable | Yes | Service unavailable |
| 504 | Retryable | Yes | Gateway timeout |
| Network | Retryable | Yes | Connection timeout/reset |

### Error Response Format

**Facebook/Instagram Error**:
```json
{
  "error": {
    "message": "Error description",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463
  }
}
```

**Extracted Message**:
```
"Error description (code: 190)"
```

## Token Usage

Both providers use the same token flow:

```typescript
// Get valid access token
const accessToken = await this.getValidToken(params.accountId);
```

**Facebook**: Uses Page Access Token (long-lived)
**Instagram**: Uses Instagram Business Account token (long-lived)

**Note**: Meta tokens are long-lived (60 days) and don't require frequent refresh, but TokenService still handles expiration checking.

## Provider Routing

**ProviderFactory** now includes:
```typescript
this.providers.set('twitter', new TwitterProvider());
this.providers.set('linkedin', new LinkedInProvider());
this.providers.set('facebook', new FacebookProvider());
this.providers.set('instagram', new InstagramProvider());
```

**Usage**:
```typescript
const provider = providerFactory.getProvider('facebook');
const result = await provider.publishPost(params);
```

## Logging

### Facebook Success
```typescript
logger.info('Facebook API success', {
  postId: '123456789_987654321',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN
});

logger.info('Facebook photo API success', {
  postId: '123456789_987654321',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN
});
```

### Instagram Success
```typescript
logger.info('Instagram media container created', {
  creationId: '17895695668004550',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN
});

logger.info('Instagram media published', {
  mediaId: '17895695668004551',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN
});
```

### Error Logs
```typescript
logger.error('Facebook API error', {
  statusCode: 429,
  errorMessage: 'Rate limit exceeded (code: 4)',
  accountId: '507f1f77bcf86cd799439011',
  classification: 'retryable',
  // NO TOKEN
});

logger.error('Instagram API error', {
  statusCode: 401,
  errorMessage: 'Invalid OAuth access token (code: 190)',
  accountId: '507f1f77bcf86cd799439011',
  classification: 'permanent',
  // NO TOKEN
});
```

## Retry Behavior

### Facebook Rate Limit
```
1. Worker calls FacebookProvider.publishPost()
2. Provider calls Facebook API → HTTP 429
3. Provider returns PublishResult { success: false, retryable: true }
4. Worker throws error (triggers BullMQ retry)
5. BullMQ waits 5s → retry attempt 2
6. If still rate limited → waits 25s → retry attempt 3
7. If still rate limited → waits 125s → final attempt
8. If final attempt fails → post marked as FAILED
```

### Instagram Container Creation Fails
```
1. Provider creates container → network timeout
2. Provider throws error with statusCode=0 (retryable)
3. Worker retries entire post
4. New container created (different creation_id)
5. Container published successfully
```

**Note**: Failed containers are orphaned on Instagram. This is expected.

### Instagram Publish Fails After Container Created
```
1. Provider creates container → success (creation_id obtained)
2. Provider publishes container → rate limit (429)
3. Provider throws error with statusCode=429 (retryable)
4. Worker retries entire post
5. New container created (different creation_id)
6. New container published successfully
```

**Note**: Original container remains unpublished (orphaned).

## Example Usage

### Facebook Text Post
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Hello from our Facebook Page!',
});
```

### Facebook Image Post
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Check out this photo!',
  mediaUrls: ['https://example.com/photo.jpg']
});
```

### Instagram Image Post
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Beautiful sunset 🌅 #photography',
  mediaUrls: ['https://example.com/sunset.jpg']
});
```

## Platform Differences

| Feature | Facebook | Instagram |
|---------|----------|-----------|
| **Text-only posts** | ✅ Yes | ❌ No (requires image) |
| **Image posts** | ✅ Yes | ✅ Yes |
| **Multiple images** | ⏳ TODO | ⏳ TODO (carousel) |
| **Publish steps** | 1-step | 2-step |
| **ID format** | pageId_postId | Numeric string |
| **Required field** | Page ID | Instagram User ID |
| **Token type** | Page Access Token | IG Business token |

## Account Setup Requirements

### Facebook
- **providerUserId**: Facebook Page ID
- **Token**: Page Access Token with `pages_manage_posts` permission
- **Account Type**: Facebook Page (not personal profile)

### Instagram
- **providerUserId**: Instagram Business Account ID
- **Token**: Access token with `instagram_basic`, `instagram_content_publish` permissions
- **Account Type**: Instagram Business Account (not personal account)

## Testing

### Test Facebook Text Post
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: facebookAccount._id,
  content: 'Test Facebook post',
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

### Test Facebook Image Post
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: facebookAccount._id,
  content: 'Test Facebook photo',
  mediaUrls: ['https://picsum.photos/800/600'],
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

### Test Instagram Post
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: instagramAccount._id,
  content: 'Test Instagram post #test',
  mediaUrls: ['https://picsum.photos/1080/1080'],
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

## Common Issues

### Issue 1: Facebook "Page ID not found"
**Symptom**: Error "Facebook page ID not found in account"
**Cause**: providerUserId not set in SocialAccount
**Solution**: Ensure OAuth flow stores Page ID in providerUserId

### Issue 2: Instagram "Requires at least one image"
**Symptom**: Error "Instagram posts require at least one image"
**Cause**: Trying to post text-only to Instagram
**Solution**: Instagram requires images - add mediaUrls

### Issue 3: Instagram Container Stuck
**Symptom**: Container created but not published
**Cause**: Publish step failed (network/rate limit)
**Solution**: Worker will retry entire process (creates new container)

### Issue 4: Facebook Photo Post Returns ID Instead of post_id
**Symptom**: Post ID format unexpected
**Cause**: Facebook returns both `id` and `post_id`
**Solution**: Code checks `post_id` first, falls back to `id`

## Monitoring

**Key Metrics**:
- Facebook text post success rate
- Facebook photo post success rate
- Instagram container creation success rate
- Instagram publish success rate
- Rate limit errors (429)
- Token errors (401)

**Log Queries**:
```bash
# Facebook success
grep "Facebook API success" logs | wc -l

# Instagram success
grep "Instagram media published" logs | wc -l

# Rate limits
grep "statusCode: 429" logs | grep -E "(Facebook|Instagram)"

# Token errors
grep "statusCode: 401" logs | grep -E "(Facebook|Instagram)"

# Orphaned Instagram containers
grep "Instagram media container created" logs | wc -l
grep "Instagram media published" logs | wc -l
# Difference = orphaned containers
```

## Security Notes

1. **Tokens never logged**: All logs exclude access tokens
2. **Page tokens**: Facebook uses Page Access Tokens (not user tokens)
3. **IG Business**: Instagram requires Business Account (not personal)
4. **HTTPS only**: All API calls use HTTPS
5. **Token in body**: Meta Graph API accepts token in request body

## Future Enhancements

### Facebook
1. **Multiple images**: Use `/photos` batch upload + attach to feed post
2. **Video support**: Use `/videos` endpoint
3. **Link posts**: Add `link` parameter
4. **Scheduled posts**: Use `scheduled_publish_time` parameter

### Instagram
1. **Carousel posts**: Multiple images in single post
2. **Video support**: Use video container
3. **Stories**: Use stories endpoint
4. **Reels**: Use reels endpoint
5. **Alt text**: Add accessibility descriptions

## API Version

Both providers use **Graph API v18.0**.

To upgrade:
```typescript
private readonly apiVersion = 'v19.0'; // Update version
```

Check [Meta Graph API Changelog](https://developers.facebook.com/docs/graph-api/changelog) for breaking changes.

## Rate Limits

**Facebook**:
- 200 calls per hour per user
- 4800 calls per day per app

**Instagram**:
- 25 posts per day per user
- Rate limits vary by endpoint

**Handling**: Both providers classify 429 as retryable. Worker's exponential backoff handles delays.

## Next Steps

1. ✅ Facebook text posts - Complete
2. ✅ Facebook image posts - Complete
3. ✅ Instagram image posts - Complete
4. ⏳ Facebook multiple images - TODO
5. ⏳ Instagram carousel - TODO
6. ⏳ Video support - TODO
7. ⏳ Real OAuth flow - Replace mock
