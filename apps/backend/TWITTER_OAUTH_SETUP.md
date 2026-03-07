# Real Twitter OAuth 2.0 Integration

This backend now uses **real Twitter (X API v2) OAuth 2.0 with PKCE** for production-ready account connections.

## Environment Variables

Add these to your `.env` file:

```env
# Twitter OAuth 2.0 Credentials
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_CALLBACK_URL=http://localhost:5000/api/v1/oauth/twitter/callback
```

## Getting Twitter Credentials

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or use an existing one
3. Navigate to "Keys and tokens"
4. Copy your **Client ID** and **Client Secret**
5. In "User authentication settings", set:
   - **App permissions**: Read and Write
   - **Type of App**: Web App
   - **Callback URL**: `http://localhost:5000/api/v1/oauth/twitter/callback` (or your production URL)
   - **Website URL**: Your app's URL

## OAuth Flow

### 1. Initiate OAuth

```bash
POST /api/v1/oauth/twitter/authorize
Authorization: Bearer <access_token>
```

Response:
```json
{
  "success": true,
  "authorizationUrl": "https://twitter.com/i/oauth2/authorize?...",
  "state": "...",
  "platform": "twitter"
}
```

### 2. User Authorizes

Redirect user to `authorizationUrl`. Twitter will redirect back to your callback URL.

### 3. Callback Handling

```bash
GET /api/v1/oauth/twitter/callback?code=...&state=...
```

The backend automatically:
- Validates state (CSRF protection)
- Exchanges code for tokens
- Fetches user profile
- Encrypts and stores tokens
- Redirects to frontend with success

### 4. Test Tweet Publishing

```bash
POST /api/v1/test/twitter-publish
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "text": "Hello from my app! 🚀"
}
```

Response:
```json
{
  "success": true,
  "tweet": {
    "id": "1234567890",
    "text": "Hello from my app! 🚀"
  },
  "account": {
    "id": "...",
    "username": "your_username",
    "displayName": "Your Name"
  }
}
```

## Security Features

✅ **OAuth 2.0 with PKCE (S256)** - Prevents authorization code interception  
✅ **256-bit state parameter** - CSRF protection with IP binding  
✅ **Single-use state tokens** - Atomic Redis GETDEL prevents replay attacks  
✅ **AES-256-GCM encryption** - Tokens encrypted at rest  
✅ **Rate limiting** - 10/min authorize, 20/min callback  
✅ **Comprehensive audit logging** - All OAuth events logged  
✅ **Token expiration tracking** - Automatic refresh detection  
✅ **Scope downgrade detection** - Ensures required permissions  

## Required Scopes

- `tweet.read` - Read tweets
- `tweet.write` - Post tweets
- `users.read` - Read user profile
- `offline.access` - Get refresh token

## Error Handling

The system handles:
- Expired tokens → Automatic refresh
- Revoked access → Reconnect required
- Rate limits → Automatic retry with backoff
- Invalid requests → Clear error messages
- Network errors → Retry logic

## Production Deployment

For production, update:

1. **Callback URL** in Twitter Developer Portal:
   ```
   https://yourdomain.com/api/v1/oauth/twitter/callback
   ```

2. **Environment variables**:
   ```env
   TWITTER_CALLBACK_URL=https://yourdomain.com/api/v1/oauth/twitter/callback
   API_URL=https://yourdomain.com
   ```

3. **Frontend URL** in config:
   ```env
   FRONTEND_URL=https://yourdomain.com
   ```

## Troubleshooting

### "Twitter OAuth not configured"
- Ensure `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are set in `.env`
- Restart the backend after adding credentials

### "Invalid or expired state"
- State tokens expire after 10 minutes
- Ensure Redis is running
- Check for clock skew between servers

### "IP address mismatch"
- User's IP changed between authorize and callback
- Common with VPNs or mobile networks
- User should retry the OAuth flow

### "Token expired"
- Access tokens expire after ~2 hours
- System will automatically refresh using refresh token
- If refresh fails, user needs to reconnect

## Test Mode Removed

⚠️ **Test mode has been completely removed**. All OAuth flows now use real Twitter API calls.

If you need to test without real Twitter credentials, use a Twitter Developer App in sandbox mode.
