# Twitter API Integration - Real Implementation

## Overview

TwitterProvider has been upgraded from MOCK → REAL Twitter API v2 integration.

## Implementation Details

### 1. Twitter API Client

**Endpoint**: `POST https://api.twitter.com/2/tweets`

**Authentication**: OAuth 2.0 Bearer Token (user context)

**Request Format**:
```typescript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {accessToken}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: postContent
  })
}
```

**Response Format** (Success):
```json
{
  "data": {
    "id": "1234567890123456789",
    "text": "Tweet content..."
  }
}
```

### 2. Error Mapping

| HTTP Status | Classification | Error Code | Retryable |
|-------------|---------------|------------|-----------|
| 200 | Success | - | - |
| 400 | Permanent | INVALID_REQUEST | No |
| 401 | Permanent | INVALID_TOKEN | No |
| 403 | Permanent | FORBIDDEN | No |
| 404 | Permanent | NOT_FOUND | No |
| 429 | Retryable | RATE_LIMIT | Yes |
| 500 | Retryable | INTERNAL_ERROR | Yes |
| 502 | Retryable | SERVICE_UNAVAILABLE | Yes |
| 503 | Retryable | SERVICE_UNAVAILABLE | Yes |
| 504 | Retryable | SERVICE_UNAVAILABLE | Yes |
| Network/Timeout | Retryable | NETWORK_ERROR | Yes |

### 3. Token Usage

```typescript
// Get valid access token (auto-refreshes if expired)
const accessToken = await this.getValidToken(params.accountId);
```

**Token Flow**:
1. `getValidToken()` calls `TokenService.getValidAccessToken()`
2. TokenService checks if token is expired
3. If expired → automatically refreshes via `TokenService.refreshAccessToken()`
4. If refresh fails → throws error (classified as permanent)
5. Returns decrypted access token

**Token Failure Handling**:
- If token refresh fails → permanent error (no retry)
- Worker marks post as FAILED
- User must reconnect account

### 4. Rate Limit Handling

**HTTP 429 Response**:
```typescript
{
  statusCode: 429,
  errorMessage: "Rate limit exceeded",
  retryable: true,
  errorCode: "RATE_LIMIT",
  retryAfter: 900  // seconds until rate limit resets
}
```

**Rate Limit Headers**:
- `x-rate-limit-reset`: Unix timestamp when rate limit resets
- Extracted and included in error for observability
- Worker retry system handles delay (exponential backoff)

**No Delay Logic in Provider**:
- Provider only signals retryable=true
- Worker's BullMQ retry system handles backoff timing
- Backoff: 5s → 25s → 125s (exponential)

### 5. Safe Logging

**Success Log**:
```typescript
logger.info('Twitter API success', {
  tweetId: '1234567890123456789',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN LOGGED
});
```

**Rate Limit Log**:
```typescript
logger.error('Twitter API error', {
  statusCode: 429,
  errorMessage: 'Rate limit exceeded',
  accountId: '507f1f77bcf86cd799439011',
  retryAfter: 900,
  classification: 'retryable',
  // NO TOKEN LOGGED
});
```

**Permanent Error Log**:
```typescript
logger.error('Twitter API error', {
  statusCode: 401,
  errorMessage: 'Invalid or expired token',
  accountId: '507f1f77bcf86cd799439011',
  classification: 'permanent',
  // NO TOKEN LOGGED
});
```

**Network Error Log**:
```typescript
logger.error('Unknown Twitter API error', {
  error: 'Network timeout connecting to Twitter API',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN LOGGED
});
```

## Error Flow Examples

### Example 1: Success
```
1. Worker calls TwitterProvider.publishPost()
2. Provider calls getValidToken() → returns valid token
3. Provider calls Twitter API → HTTP 200
4. Provider extracts tweet ID from response.data.id
5. Provider returns PublishResult { success: true, platformPostId: tweetId }
6. Worker marks post as PUBLISHED
```

### Example 2: Rate Limit (Retryable)
```
1. Worker calls TwitterProvider.publishPost()
2. Provider calls Twitter API → HTTP 429
3. Provider extracts retry-after header
4. Provider returns PublishResult { success: false, retryable: true, errorCode: 'RATE_LIMIT' }
5. Worker throws error (triggers BullMQ retry)
6. BullMQ waits 5s → retry attempt 2
7. If still rate limited → waits 25s → retry attempt 3
8. If still rate limited → waits 125s → final attempt
9. If final attempt fails → post marked as FAILED
```

### Example 3: Invalid Token (Permanent)
```
1. Worker calls TwitterProvider.publishPost()
2. Provider calls getValidToken() → token expired
3. TokenService attempts refresh → refresh fails (invalid refresh token)
4. TokenService throws error
5. Provider catches error → returns PublishResult { success: false, retryable: false, errorCode: 'INVALID_TOKEN' }
6. Worker marks post as FAILED immediately (no retry)
7. User must reconnect Twitter account
```

### Example 4: Network Timeout (Retryable)
```
1. Worker calls TwitterProvider.publishPost()
2. Provider calls Twitter API → network timeout
3. Provider catches timeout error
4. Provider returns PublishResult { success: false, retryable: true, errorCode: 'NETWORK_ERROR' }
5. Worker throws error (triggers BullMQ retry)
6. BullMQ retries with exponential backoff
```

## Integration Points

### Provider → TokenService
```typescript
const accessToken = await this.getValidToken(params.accountId);
// Returns: decrypted access token (auto-refreshed if expired)
```

### Provider → BaseProvider
```typescript
// Error classification
return this.createErrorResult(error);
// Uses BaseProvider.classifyError() to determine retryable flag

// Success result
return this.createSuccessResult(tweetId, { url: tweetUrl });
```

### Provider → Worker
```typescript
// Worker calls provider
const result = await provider.publishPost(params);

// Worker handles result
if (result.success) {
  // Mark post as PUBLISHED
} else {
  // Throw error with retryable flag
  const error: any = new Error(result.errorMessage);
  error.retryable = result.retryable;
  throw error; // BullMQ handles retry
}
```

## Testing

### Manual Test
```bash
# 1. Start worker
npm run worker

# 2. Create test post with Twitter account
# Post will be queued and processed by worker

# 3. Monitor logs for:
# - "Calling Twitter API"
# - "Twitter API success" (if successful)
# - "Twitter API error" (if failed)
```

### Expected Behaviors

**Success Case**:
- Post status: scheduled → queued → publishing → published
- Log: "Twitter API success" with tweetId
- Post.platformPostId = actual Twitter tweet ID
- Post.metadata.url = Twitter URL

**Rate Limit Case**:
- Post status: scheduled → queued → publishing → scheduled (retry)
- Log: "Twitter API error" with statusCode=429, retryAfter
- Worker retries with exponential backoff
- After 3 attempts → post marked as FAILED

**Invalid Token Case**:
- Post status: scheduled → queued → publishing → failed
- Log: "Twitter API error" with statusCode=401
- No retry (permanent error)
- User must reconnect account

## Media Support (TODO)

Media upload is not yet implemented. To add:

```typescript
// 1. Upload media to Twitter
private async uploadMedia(accessToken: string, mediaUrls: string[]): Promise<string[]> {
  // POST https://upload.twitter.com/1.1/media/upload.json
  // Returns media_ids
}

// 2. Include in tweet request
requestBody.media = { media_ids: mediaIds };
```

## Security Notes

1. **Tokens never logged**: All logs exclude access tokens
2. **Tokens encrypted at rest**: SocialAccount model encrypts tokens
3. **Tokens auto-refresh**: TokenService handles expiration
4. **HTTPS only**: All API calls use HTTPS
5. **Bearer token auth**: OAuth 2.0 user context

## Dependencies

- **fetch**: Native Node.js fetch (Node 18+)
- **TokenService**: Handles token lifecycle
- **BaseProvider**: Provides error classification
- **Logger**: Winston logger (safe logging)

## Configuration

No configuration needed. Provider uses:
- API base URL: `https://api.twitter.com/2`
- Token from: `TokenService.getValidAccessToken()`
- Error handling: `BaseProvider.classifyError()`

## Monitoring

Key metrics to monitor:
- `publish_success_total`: Successful tweets
- `publish_failed_total`: Failed tweets (after all retries)
- `publish_retry_total`: Retry attempts
- Rate limit errors: Check logs for statusCode=429
- Token errors: Check logs for statusCode=401

## Next Steps

1. ✅ Twitter API integration complete
2. ⏳ LinkedIn API integration (similar pattern)
3. ⏳ Facebook API integration (similar pattern)
4. ⏳ Media upload support
5. ⏳ Real OAuth flow (currently mock)
