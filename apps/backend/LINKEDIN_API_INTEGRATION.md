# LinkedIn API Integration - Real Implementation

## Overview

LinkedInProvider has been upgraded from MOCK → REAL LinkedIn UGC Posts API integration.

## Implementation Details

### 1. LinkedIn UGC Posts API

**Endpoint**: `POST https://api.linkedin.com/v2/ugcPosts`

**Authentication**: OAuth 2.0 Bearer Token

**Required Headers**:
```typescript
{
  'Authorization': 'Bearer {accessToken}',
  'Content-Type': 'application/json',
  'X-Restli-Protocol-Version': '2.0.0'  // Required by LinkedIn
}
```

**Request Body** (Text Post):
```json
{
  "author": "urn:li:person:{providerUserId}",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": {
        "text": "Your post content here"
      },
      "shareMediaCategory": "NONE"
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

**Response** (Success - HTTP 201):
```json
{
  "id": "urn:li:share:1234567890123456789"
}
```

### 2. Error Mapping

| HTTP Status | Classification | Error Code | Retryable | Description |
|-------------|---------------|------------|-----------|-------------|
| 201 | Success | - | - | Post created successfully |
| 400 | Permanent | INVALID_REQUEST | No | Bad request / Invalid format |
| 401 | Permanent | INVALID_TOKEN | No | Invalid or expired token |
| 403 | Permanent | FORBIDDEN | No | Insufficient permissions |
| 404 | Permanent | NOT_FOUND | No | Resource not found |
| 422 | Permanent | CONTENT_REJECTED | No | Validation error / Content rejected |
| 429 | Retryable | RATE_LIMIT | Yes | Rate limit exceeded |
| 500 | Retryable | INTERNAL_ERROR | Yes | LinkedIn server error |
| 502 | Retryable | SERVICE_UNAVAILABLE | Yes | Bad gateway |
| 503 | Retryable | SERVICE_UNAVAILABLE | Yes | Service unavailable |
| 504 | Retryable | SERVICE_UNAVAILABLE | Yes | Gateway timeout |
| Network/Timeout | Retryable | NETWORK_ERROR | Yes | Connection issues |

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
- User must reconnect LinkedIn account

### 4. Author URN Requirement

LinkedIn requires the `author` field to be a person URN:
```
urn:li:person:{providerUserId}
```

**Where providerUserId comes from**:
- Stored in `SocialAccount.providerUserId` field
- Obtained during OAuth connection flow
- Example: `urn:li:person:abc123xyz`

**Account Lookup**:
```typescript
const account = await this.getAccount(params.accountId);
const authorUrn = `urn:li:person:${account.providerUserId}`;
```

### 5. Safe Logging

**Success Log**:
```typescript
logger.info('LinkedIn API success', {
  postUrn: 'urn:li:share:1234567890123456789',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN LOGGED
});
```

**Rate Limit Log**:
```typescript
logger.error('LinkedIn API error', {
  statusCode: 429,
  errorMessage: 'LinkedIn API rate limit exceeded',
  accountId: '507f1f77bcf86cd799439011',
  classification: 'retryable',
  // NO TOKEN LOGGED
});
```

**Permanent Error Log**:
```typescript
logger.error('LinkedIn API error', {
  statusCode: 401,
  errorMessage: 'LinkedIn token invalid or expired',
  accountId: '507f1f77bcf86cd799439011',
  classification: 'permanent',
  // NO TOKEN LOGGED
});
```

**Validation Error Log** (HTTP 422):
```typescript
logger.error('LinkedIn API error', {
  statusCode: 422,
  errorMessage: 'Content violates LinkedIn community guidelines',
  accountId: '507f1f77bcf86cd799439011',
  classification: 'permanent',
  // NO TOKEN LOGGED
});
```

**Network Error Log**:
```typescript
logger.error('Unknown LinkedIn API error', {
  error: 'Network timeout connecting to LinkedIn API',
  accountId: '507f1f77bcf86cd799439011',
  // NO TOKEN LOGGED
});
```

## Error Flow Examples

### Example 1: Success
```
1. Worker calls LinkedInProvider.publishPost()
2. Provider calls getValidToken() → returns valid token
3. Provider calls getAccount() → returns account with providerUserId
4. Provider builds request with author URN
5. Provider calls LinkedIn API → HTTP 201
6. Provider extracts post URN from response.id
7. Provider returns PublishResult { success: true, platformPostId: postUrn }
8. Worker marks post as PUBLISHED
```

### Example 2: Rate Limit (Retryable)
```
1. Worker calls LinkedInProvider.publishPost()
2. Provider calls LinkedIn API → HTTP 429
3. Provider returns PublishResult { success: false, retryable: true, errorCode: 'RATE_LIMIT' }
4. Worker throws error (triggers BullMQ retry)
5. BullMQ waits 5s → retry attempt 2
6. If still rate limited → waits 25s → retry attempt 3
7. If still rate limited → waits 125s → final attempt
8. If final attempt fails → post marked as FAILED
```

### Example 3: Invalid Token (Permanent)
```
1. Worker calls LinkedInProvider.publishPost()
2. Provider calls getValidToken() → token expired
3. TokenService attempts refresh → refresh fails (invalid refresh token)
4. TokenService throws error
5. Provider catches error → returns PublishResult { success: false, retryable: false, errorCode: 'INVALID_TOKEN' }
6. Worker marks post as FAILED immediately (no retry)
7. User must reconnect LinkedIn account
```

### Example 4: Content Validation Error (Permanent)
```
1. Worker calls LinkedInProvider.publishPost()
2. Provider calls LinkedIn API → HTTP 422
3. LinkedIn returns: "Content violates community guidelines"
4. Provider returns PublishResult { success: false, retryable: false, errorCode: 'CONTENT_REJECTED' }
5. Worker marks post as FAILED immediately (no retry)
6. User must modify content
```

### Example 5: Network Timeout (Retryable)
```
1. Worker calls LinkedInProvider.publishPost()
2. Provider calls LinkedIn API → network timeout
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

### Provider → SocialAccount
```typescript
const account = await this.getAccount(params.accountId);
// Returns: account with providerUserId field
// Used to build: urn:li:person:{providerUserId}
```

### Provider → BaseProvider
```typescript
// Error classification
return this.createErrorResult(error);
// Uses BaseProvider.classifyError() to determine retryable flag

// Success result
return this.createSuccessResult(postUrn, { url: linkedInUrl });
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

## LinkedIn-Specific Features

### 1. Visibility Options

Current implementation uses `PUBLIC` visibility:
```json
{
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

**Other options** (for future enhancement):
- `CONNECTIONS` - Only visible to connections
- `LOGGED_IN` - Visible to all logged-in LinkedIn members

### 2. Lifecycle State

Current implementation uses `PUBLISHED`:
```json
{
  "lifecycleState": "PUBLISHED"
}
```

**Other options** (for future enhancement):
- `DRAFT` - Save as draft (not published)

### 3. Share Media Category

Current implementation: `NONE` (text-only posts)

**Future options**:
- `IMAGE` - Posts with images
- `VIDEO` - Posts with videos
- `ARTICLE` - Shared articles

## Testing

### Manual Test
```bash
# 1. Start worker
npm run worker

# 2. Create test post with LinkedIn account
# Post will be queued and processed by worker

# 3. Monitor logs for:
# - "Calling LinkedIn UGC API"
# - "LinkedIn API success" (if successful)
# - "LinkedIn API error" (if failed)
```

### Expected Behaviors

**Success Case**:
- Post status: scheduled → queued → publishing → published
- Log: "LinkedIn API success" with postUrn
- Post.platformPostId = LinkedIn post URN
- Post.metadata.url = LinkedIn feed URL

**Rate Limit Case**:
- Post status: scheduled → queued → publishing → scheduled (retry)
- Log: "LinkedIn API error" with statusCode=429
- Worker retries with exponential backoff
- After 3 attempts → post marked as FAILED

**Invalid Token Case**:
- Post status: scheduled → queued → publishing → failed
- Log: "LinkedIn API error" with statusCode=401
- No retry (permanent error)
- User must reconnect account

**Validation Error Case** (HTTP 422):
- Post status: scheduled → queued → publishing → failed
- Log: "LinkedIn API error" with statusCode=422
- No retry (permanent error)
- User must modify content

## LinkedIn API Differences vs Twitter

| Feature | Twitter | LinkedIn |
|---------|---------|----------|
| Success Status | 200 OK | 201 Created |
| Post ID Format | Numeric string | URN format |
| Author Field | Not required | Required (person URN) |
| Protocol Header | Not required | X-Restli-Protocol-Version required |
| Validation Errors | 400 | 422 |
| Content Limit | 280 chars | 3000 chars |

## Media Support (TODO)

Media upload is not yet implemented. To add:

```typescript
// 1. Register media upload
private async registerMedia(accessToken: string, mediaUrl: string): Promise<string> {
  // POST https://api.linkedin.com/v2/assets?action=registerUpload
  // Returns upload URL and asset URN
}

// 2. Upload media binary
private async uploadMediaBinary(uploadUrl: string, mediaBuffer: ArrayBuffer): Promise<void> {
  // PUT to upload URL with binary data
}

// 3. Include in post request
requestBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
requestBody.specificContent['com.linkedin.ugc.ShareContent'].media = [
  {
    status: 'READY',
    media: assetUrn,
  }
];
```

## Security Notes

1. **Tokens never logged**: All logs exclude access tokens
2. **Tokens encrypted at rest**: SocialAccount model encrypts tokens
3. **Tokens auto-refresh**: TokenService handles expiration
4. **HTTPS only**: All API calls use HTTPS
5. **Bearer token auth**: OAuth 2.0 user context
6. **Person URN required**: Author must be valid LinkedIn person URN

## Dependencies

- **fetch**: Native Node.js fetch (Node 18+)
- **TokenService**: Handles token lifecycle
- **BaseProvider**: Provides error classification
- **Logger**: Winston logger (safe logging)
- **SocialAccount**: Provides providerUserId for author URN

## Configuration

No configuration needed. Provider uses:
- API base URL: `https://api.linkedin.com/v2`
- Token from: `TokenService.getValidAccessToken()`
- Error handling: `BaseProvider.classifyError()`
- Author URN from: `SocialAccount.providerUserId`

## Monitoring

Key metrics to monitor:
- `publish_success_total`: Successful LinkedIn posts
- `publish_failed_total`: Failed posts (after all retries)
- `publish_retry_total`: Retry attempts
- Rate limit errors: Check logs for statusCode=429
- Token errors: Check logs for statusCode=401
- Validation errors: Check logs for statusCode=422

## Common Issues

### Issue 1: Missing providerUserId
**Symptom**: Error "Cannot read property 'providerUserId' of undefined"
**Cause**: SocialAccount doesn't have providerUserId field
**Solution**: Ensure OAuth flow stores providerUserId during account connection

### Issue 2: Invalid Author URN
**Symptom**: HTTP 400 or 422 error
**Cause**: Author URN format incorrect
**Solution**: Verify format is exactly `urn:li:person:{providerUserId}`

### Issue 3: Missing Protocol Header
**Symptom**: HTTP 400 error
**Cause**: X-Restli-Protocol-Version header missing
**Solution**: Always include header with value "2.0.0"

## Next Steps

1. ✅ LinkedIn UGC API integration complete
2. ⏳ Facebook API integration (similar pattern)
3. ⏳ LinkedIn media upload support
4. ⏳ LinkedIn visibility options (connections-only posts)
5. ⏳ Real OAuth flow (currently mock)
