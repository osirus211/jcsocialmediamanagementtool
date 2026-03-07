# Social Media Provider Comparison

## Quick Reference

| Feature | Twitter | LinkedIn | Facebook |
|---------|---------|----------|----------|
| **Status** | ✅ Implemented | ✅ Implemented | ⏳ Mock |
| **API Version** | v2 | v2 (UGC) | - |
| **Endpoint** | `/tweets` | `/ugcPosts` | - |
| **Success Status** | 200 OK | 201 Created | - |
| **Post ID Format** | Numeric string | URN | - |
| **Content Limit** | 280 chars | 3000 chars | 63206 chars |
| **Media Support** | ✅ Images (4 max) | ⏳ TODO | ⏳ TODO |
| **Thread Support** | ✅ Yes (25 max) | ❌ No | ❌ No |
| **Special Headers** | None | X-Restli-Protocol-Version | - |
| **Author Field** | Not required | Required (URN) | - |

## Error Code Mapping

### Retryable Errors (All Providers)
- **429**: Rate limit exceeded
- **500**: Internal server error
- **502**: Bad gateway
- **503**: Service unavailable
- **504**: Gateway timeout
- **Network**: Connection timeout/reset

### Permanent Errors

| Status | Twitter | LinkedIn | Description |
|--------|---------|----------|-------------|
| 400 | ✅ | ✅ | Bad request / Invalid format |
| 401 | ✅ | ✅ | Invalid or expired token |
| 403 | ✅ | ✅ | Forbidden / Insufficient permissions |
| 404 | ✅ | ✅ | Resource not found |
| 422 | ❌ | ✅ | Validation error (LinkedIn-specific) |

## Request Structure

### Twitter
```json
{
  "text": "Tweet content",
  "media": {
    "media_ids": ["123", "456"]
  },
  "reply": {
    "in_reply_to_tweet_id": "789"
  }
}
```

### LinkedIn
```json
{
  "author": "urn:li:person:abc123",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": {
        "text": "Post content"
      },
      "shareMediaCategory": "NONE"
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

## Response Structure

### Twitter (Success)
```json
{
  "data": {
    "id": "1234567890123456789",
    "text": "Tweet content..."
  }
}
```

### LinkedIn (Success)
```json
{
  "id": "urn:li:share:1234567890123456789"
}
```

## Media Upload

### Twitter
- **Endpoint**: `https://upload.twitter.com/1.1/media/upload.json`
- **Method**: POST with FormData
- **Max Size**: 5MB per image
- **Max Count**: 4 images per tweet
- **Returns**: `media_id_string`
- **Status**: ✅ Implemented

### LinkedIn
- **Endpoint**: `https://api.linkedin.com/v2/assets?action=registerUpload`
- **Method**: Multi-step (register → upload → attach)
- **Max Size**: TBD
- **Max Count**: 9 images per post
- **Returns**: Asset URN
- **Status**: ⏳ TODO

## Thread/Chain Posting

### Twitter
- **Support**: ✅ Yes
- **Max Length**: 25 tweets
- **Method**: Reply to previous tweet
- **Field**: `reply.in_reply_to_tweet_id`
- **Retry Behavior**: Entire thread re-posted on failure

### LinkedIn
- **Support**: ❌ No native thread support
- **Alternative**: Post multiple separate posts

## Token Management

All providers use the same token flow:

```typescript
// 1. Get valid token (auto-refresh)
const accessToken = await this.getValidToken(params.accountId);

// 2. TokenService checks expiration
// 3. If expired → auto-refresh
// 4. If refresh fails → permanent error
// 5. Returns decrypted token
```

## Error Handling Pattern

All providers follow the same pattern:

```typescript
try {
  // 1. Validate input
  // 2. Get token
  // 3. Call API
  // 4. Return success result
} catch (error) {
  // 5. Log error
  // 6. Return error result with retryable flag
}
```

## Logging Pattern

All providers use safe logging (no tokens):

```typescript
// Success
logger.info('API success', {
  postId: '...',
  accountId: '...',
  // NO TOKEN
});

// Error
logger.error('API error', {
  statusCode: 429,
  errorMessage: '...',
  accountId: '...',
  classification: 'retryable',
  // NO TOKEN
});
```

## Worker Integration

All providers return standardized `PublishResult`:

```typescript
interface PublishResult {
  success: boolean;
  platformPostId?: string;
  retryable?: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    url?: string;
    publishedAt?: Date;
  };
}
```

Worker handles all providers identically:

```typescript
const result = await provider.publishPost(params);

if (result.success) {
  // Mark as PUBLISHED
} else {
  // Throw error with retryable flag
  // BullMQ handles retry logic
}
```

## Implementation Checklist

### Twitter ✅
- [x] Basic text posts
- [x] Media upload (images)
- [x] Thread posting
- [x] Error classification
- [x] Token management
- [x] Safe logging
- [ ] Video support
- [ ] Media caching

### LinkedIn ✅
- [x] Basic text posts
- [x] Error classification
- [x] Token management
- [x] Safe logging
- [x] Author URN handling
- [ ] Media upload
- [ ] Visibility options
- [ ] Draft posts

### Facebook ⏳
- [ ] Basic text posts
- [ ] Media upload
- [ ] Error classification
- [ ] Token management
- [ ] Safe logging

## Testing Commands

### Test Twitter
```bash
# Text post
node test-provider-integration.cjs --provider=twitter

# With media
node test-provider-integration.cjs --provider=twitter --media

# Thread
node test-provider-integration.cjs --provider=twitter --thread
```

### Test LinkedIn
```bash
# Text post
node test-provider-integration.cjs --provider=linkedin
```

## Monitoring Queries

### Find Provider-Specific Errors
```bash
# Twitter errors
grep "Twitter API error" logs

# LinkedIn errors
grep "LinkedIn API error" logs

# Rate limits
grep "statusCode: 429" logs

# Token errors
grep "statusCode: 401" logs
```

### Success Rate by Provider
```bash
# Twitter success
grep "Twitter API success" logs | wc -l

# LinkedIn success
grep "LinkedIn API success" logs | wc -l
```

## Common Patterns

### 1. Network Error Handling
All providers classify network errors as retryable:
```typescript
if (error.name === 'AbortError' || error.code === 'ECONNRESET') {
  const networkError: any = new Error('Network timeout');
  networkError.statusCode = 0; // Retryable
  throw networkError;
}
```

### 2. Status Code Classification
All providers use similar classification:
```typescript
private classifyHttpStatus(statusCode: number): 'retryable' | 'permanent' {
  // Retryable: 429, 500, 502, 503, 504
  // Permanent: 400, 401, 403, 404, 422
  // Default: retryable (safer)
}
```

### 3. Token Retrieval
All providers use BaseProvider method:
```typescript
protected async getValidToken(accountId: string): Promise<string> {
  return await tokenService.getValidAccessToken(accountId);
}
```

### 4. Result Creation
All providers use BaseProvider helpers:
```typescript
// Success
return this.createSuccessResult(postId, { url: postUrl });

// Error
return this.createErrorResult(error);
```

## Next Steps

1. ✅ Twitter API - Complete
2. ✅ LinkedIn API - Complete
3. ⏳ Facebook API - Implement
4. ⏳ Instagram API - Implement
5. ⏳ LinkedIn media - Add support
6. ⏳ Twitter video - Add support
7. ⏳ Real OAuth flow - Replace mock
