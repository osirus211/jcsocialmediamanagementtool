# OAuth Implementation Guide

## Overview

Complete OAuth 2.0 implementation for social media platforms with real OAuth flows and test mode support.

## Supported Platforms

- **Twitter** (OAuth 2.0 with PKCE)
- **LinkedIn** (OAuth 2.0 with OpenID Connect)
- **Facebook** (OAuth 2.0 with long-lived tokens)
- **Instagram** (Basic Display API with long-lived tokens)

## Features

✅ Real OAuth 2.0 authorization flows
✅ PKCE (Proof Key for Code Exchange) for Twitter
✅ Secure state parameter validation (CSRF protection)
✅ Token exchange (authorization code → access token)
✅ Encrypted token storage (AES-256-GCM)
✅ Automatic token refresh with retry logic
✅ Token expiry tracking
✅ Reconnect flow for expired/revoked tokens
✅ Multiple accounts per workspace per platform
✅ Test mode for development (bypasses real OAuth)

## Architecture

```
┌─────────────────┐
│  OAuth Manager  │ ← Singleton, manages all providers
└────────┬────────┘
         │
         ├─── TwitterOAuthProvider
         ├─── LinkedInOAuthProvider
         ├─── FacebookOAuthProvider
         ├─── InstagramOAuthProvider
         └─── TestOAuthProvider (test mode)
```

## Configuration

### Environment Variables

```bash
# Enable test mode (bypasses real OAuth)
OAUTH_TEST_MODE=true

# Twitter OAuth 2.0
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# LinkedIn OAuth 2.0
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Facebook OAuth 2.0
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Instagram Basic Display API
INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

# Encryption key (64 hex characters)
ENCRYPTION_KEY=your_64_character_hex_key

# API URL (for OAuth callbacks)
API_URL=http://localhost:5000

# Frontend URL (for redirects after OAuth)
FRONTEND_URL=http://localhost:5173
```

### Generating Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## OAuth Flow

### 1. Initiate Authorization

**Frontend:**
```typescript
// Get OAuth URL
const response = await fetch('/api/v1/oauth/twitter/url', {
  headers: { Authorization: `Bearer ${token}` }
});
const { url } = await response.json();

// Redirect user to OAuth URL
window.location.href = url;
```

**Backend:**
1. Generates authorization URL with state parameter
2. Stores state in memory (with workspace/user context)
3. Returns URL to frontend
4. Frontend redirects user to platform

### 2. User Authorizes on Platform

User is redirected to platform (Twitter, LinkedIn, etc.) and authorizes the app.

### 3. OAuth Callback

Platform redirects back to: `/api/v1/oauth/:platform/callback?code=xxx&state=yyy`

**Backend:**
1. Validates state parameter (CSRF protection)
2. Exchanges authorization code for access token
3. Fetches user profile from platform
4. Stores account with encrypted tokens
5. Redirects to frontend with success/error

### 4. Frontend Handles Result

```typescript
// Parse URL parameters
const params = new URLSearchParams(window.location.search);
const success = params.get('success');
const error = params.get('error');

if (success) {
  // Show success message
  // Refresh account list
} else if (error) {
  // Show error message
}
```

## API Endpoints

### Get Available Platforms

```http
GET /api/v1/oauth/platforms
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "platforms": ["twitter", "linkedin", "facebook", "instagram"],
  "testMode": true
}
```

### Get OAuth URL

```http
GET /api/v1/oauth/:platform/url
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "url": "https://twitter.com/i/oauth2/authorize?...",
  "platform": "twitter",
  "testMode": false
}
```

### Initiate OAuth (Redirect)

```http
GET /api/v1/oauth/:platform/authorize
Authorization: Bearer {token}
```

Redirects to platform OAuth page.

### OAuth Callback (Public)

```http
GET /api/v1/oauth/:platform/callback?code=xxx&state=yyy
```

Handles OAuth callback, exchanges code for tokens, stores account, redirects to frontend.

## Token Management

### Token Storage

- Tokens are encrypted using AES-256-GCM before storage
- Encryption key derived from `ENCRYPTION_KEY` using PBKDF2
- Format: `salt:iv:authTag:encrypted`
- Tokens never exposed in API responses

### Token Refresh

**Automatic Refresh:**
- Publishing service checks token expiry before posting
- Automatically refreshes if expired
- Updates account with new tokens

**Manual Refresh:**
```http
POST /api/v1/social/accounts/:id/refresh
Authorization: Bearer {token}
```

### Token Expiry

| Platform  | Access Token | Refresh Token | Notes                    |
|-----------|--------------|---------------|--------------------------|
| Twitter   | 2 hours      | Never expires | OAuth 2.0 with PKCE      |
| LinkedIn  | 60 days      | 365 days      | Long-lived tokens        |
| Facebook  | 60 days      | N/A           | Extended via refresh     |
| Instagram | 60 days      | N/A           | Extended via refresh     |

## Test Mode

### Enabling Test Mode

```bash
OAUTH_TEST_MODE=true
```

### Test Mode Behavior

- Bypasses real OAuth flows
- Generates mock tokens
- Returns mock user profiles
- No external API calls
- Useful for development and testing

### Test Mode Flow

1. Frontend requests OAuth URL
2. Backend returns test URL with mock code
3. Frontend "redirects" (or auto-completes)
4. Backend generates mock tokens
5. Account created with test data

## Security

### CSRF Protection

- State parameter generated with crypto.randomBytes(32)
- State stored server-side with 10-minute expiry
- State validated on callback
- One-time use (deleted after validation)

### Token Encryption

- AES-256-GCM encryption
- Unique salt and IV per encryption
- Authentication tag for integrity
- PBKDF2 key derivation (100,000 iterations)

### Token Storage

- Tokens never selected by default (Mongoose `select: false`)
- Tokens never included in JSON responses
- Tokens only decrypted when needed
- Decryption happens in-memory only

### Error Handling

- OAuth errors logged (without sensitive data)
- Failed tokens marked as expired
- Graceful degradation on refresh failure
- User-friendly error messages

## Platform-Specific Notes

### Twitter

- Uses OAuth 2.0 with PKCE (no client secret in auth URL)
- Requires `offline.access` scope for refresh tokens
- Access tokens expire in 2 hours
- Refresh tokens never expire

**Required Scopes:**
- `tweet.read` - Read tweets
- `tweet.write` - Post tweets
- `users.read` - Read user profile
- `offline.access` - Get refresh token

### LinkedIn

- Uses OAuth 2.0 with OpenID Connect
- Access tokens expire in 60 days
- Refresh tokens expire in 365 days
- May not always provide refresh tokens

**Required Scopes:**
- `openid` - OpenID Connect
- `profile` - Read profile
- `email` - Read email
- `w_member_social` - Post content

### Facebook

- Uses OAuth 2.0 with long-lived tokens
- Short-lived tokens (1 hour) exchanged for long-lived (60 days)
- Long-lived tokens can be extended before expiry
- No traditional refresh tokens

**Required Permissions:**
- `pages_show_list` - List pages
- `pages_read_engagement` - Read page data
- `pages_manage_posts` - Publish posts
- `public_profile` - Read profile
- `email` - Read email

### Instagram

- Uses Basic Display API (for personal accounts)
- Short-lived tokens (1 hour) exchanged for long-lived (60 days)
- Long-lived tokens can be refreshed before expiry
- For business accounts, use Facebook Graph API

**Required Permissions:**
- `user_profile` - Read profile
- `user_media` - Read media

## Troubleshooting

### OAuth URL Generation Fails

**Error:** "OAuth provider not configured for platform: twitter"

**Solution:** Check environment variables:
```bash
echo $TWITTER_CLIENT_ID
echo $TWITTER_CLIENT_SECRET
```

### State Validation Fails

**Error:** "Invalid or expired state parameter"

**Causes:**
- State expired (>10 minutes)
- State already used
- State mismatch

**Solution:** Restart OAuth flow

### Token Exchange Fails

**Error:** "Twitter token exchange failed: invalid_grant"

**Causes:**
- Invalid authorization code
- Code already used
- Code expired
- Redirect URI mismatch

**Solution:** Check OAuth app configuration, ensure redirect URI matches exactly

### Token Refresh Fails

**Error:** "Token refresh failed"

**Causes:**
- Refresh token expired
- Refresh token revoked
- Invalid refresh token

**Solution:** User must reconnect account (re-authorize)

## Testing

### Manual Testing

1. Set `OAUTH_TEST_MODE=false`
2. Configure OAuth credentials
3. Start backend: `npm run dev`
4. Navigate to frontend: `http://localhost:5173/social/accounts`
5. Click "Connect Account"
6. Complete OAuth flow
7. Verify account appears in list

### Test Mode Testing

1. Set `OAUTH_TEST_MODE=true`
2. Start backend: `npm run dev`
3. Navigate to frontend: `http://localhost:5173/social/accounts`
4. Click "Connect Account"
5. OAuth completes automatically with mock data
6. Verify account appears with test data

### Integration Tests

```typescript
// Test OAuth flow
describe('OAuth Integration', () => {
  it('should connect Twitter account', async () => {
    // 1. Get OAuth URL
    const urlResponse = await request(app)
      .get('/api/v1/oauth/twitter/url')
      .set('Authorization', `Bearer ${token}`);
    
    expect(urlResponse.body.url).toContain('twitter.com');
    
    // 2. Simulate callback (in test mode)
    const callbackResponse = await request(app)
      .get('/api/v1/oauth/twitter/callback')
      .query({ code: 'test_code', state: 'test_state' });
    
    expect(callbackResponse.status).toBe(302); // Redirect
    
    // 3. Verify account created
    const accountsResponse = await request(app)
      .get('/api/v1/social/accounts')
      .set('Authorization', `Bearer ${token}`);
    
    expect(accountsResponse.body.accounts).toHaveLength(1);
    expect(accountsResponse.body.accounts[0].provider).toBe('twitter');
  });
});
```

## Production Deployment

### Prerequisites

1. Register OAuth apps on each platform
2. Configure redirect URIs (must match exactly)
3. Generate encryption key
4. Set environment variables
5. Disable test mode

### Redirect URI Configuration

**Format:** `https://your-domain.com/api/v1/oauth/:platform/callback`

**Examples:**
- Twitter: `https://api.yourapp.com/api/v1/oauth/twitter/callback`
- LinkedIn: `https://api.yourapp.com/api/v1/oauth/linkedin/callback`
- Facebook: `https://api.yourapp.com/api/v1/oauth/facebook/callback`
- Instagram: `https://api.yourapp.com/api/v1/oauth/instagram/callback`

### Environment Variables

```bash
OAUTH_TEST_MODE=false
API_URL=https://api.yourapp.com
FRONTEND_URL=https://yourapp.com
ENCRYPTION_KEY=<64-character-hex-key>
TWITTER_CLIENT_ID=<your-twitter-client-id>
TWITTER_CLIENT_SECRET=<your-twitter-client-secret>
# ... other credentials
```

### Security Checklist

- [ ] Test mode disabled (`OAUTH_TEST_MODE=false`)
- [ ] Strong encryption key (64 hex characters)
- [ ] HTTPS enabled
- [ ] Redirect URIs configured correctly
- [ ] OAuth credentials secured (not in version control)
- [ ] Logging configured (no sensitive data in logs)
- [ ] Rate limiting enabled
- [ ] CORS configured correctly

## Monitoring

### Metrics to Track

- OAuth success rate
- OAuth failure rate
- Token refresh success rate
- Token refresh failure rate
- Average OAuth completion time
- State expiry rate

### Logging

OAuth operations are logged with context:

```typescript
logger.info('OAuth authorization initiated', {
  platform,
  workspaceId,
  userId,
  state,
});

logger.info('OAuth callback successful', {
  platform,
  workspaceId,
  accountId,
  profileId,
});

logger.error('OAuth callback failed', {
  platform,
  error: error.message,
});
```

### Alerts

Set up alerts for:
- High OAuth failure rate (>10%)
- High token refresh failure rate (>5%)
- State validation failures (potential CSRF attack)
- Encryption/decryption failures

## Future Enhancements

- [ ] Redis-based state storage (for multi-server deployments)
- [ ] OAuth token rotation
- [ ] Webhook support for token revocation
- [ ] Rate limit handling
- [ ] Retry logic with exponential backoff
- [ ] OAuth scope management UI
- [ ] Token health monitoring
- [ ] Automatic token refresh worker
- [ ] OAuth analytics dashboard

## Support

For issues or questions:
1. Check logs for error details
2. Verify environment variables
3. Test in test mode first
4. Check platform-specific documentation
5. Review OAuth app configuration

## References

- [Twitter OAuth 2.0 Documentation](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [LinkedIn OAuth 2.0 Documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [Facebook OAuth Documentation](https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow)
- [Instagram Basic Display API](https://developers.facebook.com/docs/instagram-basic-display-api)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
