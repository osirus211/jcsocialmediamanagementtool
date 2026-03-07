# Twitter OAuth Testing Guide

## Quick Start

### 1. Prerequisites

- Backend running on http://localhost:5000 ✅
- Frontend running on http://localhost:5173 ✅
- MongoDB connected ✅
- Twitter OAuth credentials configured in `.env`

### 2. Configure Twitter Credentials

Update `apps/backend/.env`:

```bash
# Set to false for production OAuth
OAUTH_TEST_MODE=false

# Add your Twitter OAuth 2.0 credentials
TWITTER_CLIENT_ID=your-actual-twitter-client-id
TWITTER_CLIENT_SECRET=your-actual-twitter-client-secret
```

**Get Twitter Credentials**:
1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new app or select existing app
3. Go to "Keys and tokens" tab
4. Under "OAuth 2.0 Client ID and Client Secret", copy:
   - Client ID
   - Client Secret
5. Go to "User authentication settings"
6. Set "Callback URI / Redirect URL": `http://localhost:5000/api/v1/oauth/twitter/callback`
7. Enable these scopes:
   - `tweet.read`
   - `tweet.write`
   - `users.read`
   - `offline.access`

### 3. Restart Backend

After updating `.env`:

```bash
# Stop current backend (Ctrl+C)
# Start again
cd apps/backend
npm run dev
```

### 4. Test OAuth Flow

#### Option A: Via Frontend UI

1. Navigate to http://localhost:5173/social/accounts
2. Click "Connect Account" button
3. Select "Twitter" platform
4. You should be redirected to Twitter authorization page
5. Authorize the app
6. You should be redirected back to `/social/accounts?success=true&platform=twitter&account={id}`
7. Your Twitter account should now appear in the connected accounts list

#### Option B: Via API (cURL)

**Step 1: Get JWT Token**

First, login to get a JWT token:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

Save the `accessToken` from the response.

**Step 2: Initiate OAuth**

```bash
curl -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "authorizationUrl": "https://twitter.com/i/oauth2/authorize?response_type=code&client_id=...",
  "state": "base64url_encoded_state",
  "platform": "twitter"
}
```

**Step 3: Open Authorization URL**

Copy the `authorizationUrl` from the response and open it in your browser. This will redirect you to Twitter's authorization page.

**Step 4: Authorize**

Click "Authorize app" on Twitter's page.

**Step 5: Callback**

Twitter will redirect to:
```
http://localhost:5000/api/v1/oauth/twitter/callback?code=...&state=...
```

The backend will:
1. Validate state
2. Exchange code for tokens
3. Fetch user profile
4. Create account in database
5. Redirect to frontend with success

### 5. Verify in Database

```bash
mongosh
use social-media-scheduler
db.socialaccounts.find({ provider: 'twitter' }).pretty()
```

You should see:
```javascript
{
  _id: ObjectId("..."),
  workspaceId: ObjectId("..."),
  provider: "twitter",
  providerUserId: "123456789", // Your Twitter user ID
  accountName: "Your Name",
  accessToken: "1:abc123...:def456...:ghi789...:jkl012...", // Encrypted
  refreshToken: "1:mno345...:pqr678...:stu901...:vwx234...", // Encrypted
  tokenExpiresAt: ISODate("2024-03-01T12:00:00.000Z"),
  scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  status: "active",
  connectionVersion: "v2",
  metadata: {
    username: "your_twitter_handle",
    profileUrl: "https://twitter.com/your_twitter_handle",
    avatarUrl: "https://pbs.twimg.com/profile_images/...",
    followerCount: 1000
  },
  lastSyncAt: ISODate("2024-03-01T10:00:00.000Z"),
  createdAt: ISODate("2024-03-01T10:00:00.000Z"),
  updatedAt: ISODate("2024-03-01T10:00:00.000Z")
}
```

**Verify Encryption**:
- `accessToken` should be in format: `version:salt:iv:authTag:encrypted`
- `refreshToken` should be in format: `version:salt:iv:authTag:encrypted`
- Both should start with `1:` (version 1)

### 6. Check Backend Logs

Look for these log messages:

```
[OAuth] Authorization initiated { platform: 'twitter', workspaceId: '...', userId: '...', state: '...' }
[OAuth] Token exchange successful { platform: 'twitter', workspaceId: '...', expiresIn: 7200 }
[OAuth] Profile fetched { platform: 'twitter', workspaceId: '...', userId: '123456789', username: 'your_handle' }
[OAuth] Account created { platform: 'twitter', workspaceId: '...', accountId: '...', providerUserId: '123456789', username: 'your_handle', connectionVersion: 'v2' }
```

## Testing Error Scenarios

### 1. Invalid State

Manually modify the state parameter in the callback URL:

```
http://localhost:5000/api/v1/oauth/twitter/callback?code=valid_code&state=invalid_state
```

Expected: Redirect to `/social/accounts?error=STATE_INVALID&message=Invalid%20or%20expired%20state`

### 2. Expired State

Wait 11 minutes after initiating OAuth, then complete the flow.

Expected: Redirect to `/social/accounts?error=STATE_INVALID&message=Invalid%20or%20expired%20state`

### 3. Duplicate Account

Try to connect the same Twitter account twice.

Expected: Redirect to `/social/accounts?error=DUPLICATE_ACCOUNT&message=Account%20already%20connected`

### 4. Invalid Twitter Credentials

Set invalid `TWITTER_CLIENT_ID` or `TWITTER_CLIENT_SECRET` in `.env`.

Expected: Token exchange fails with `TOKEN_EXCHANGE_FAILED` error.

### 5. Denied Authorization

Click "Cancel" on Twitter's authorization page.

Expected: Redirect to `/social/accounts?error=access_denied&message=...`

## Debugging

### Check Available Platforms

```bash
curl http://localhost:5000/api/v1/oauth/platforms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "platforms": ["twitter"],
  "features": {
    "oauth2": true,
    "pkce": true,
    "refreshTokens": true,
    "encryption": "AES-256-GCM"
  }
}
```

If `platforms` is empty, check:
- `TWITTER_CLIENT_ID` is set in `.env`
- `TWITTER_CLIENT_SECRET` is set in `.env`
- Backend server restarted after updating `.env`

### Check Redis State Storage

If you have Redis running:

```bash
redis-cli
KEYS oauth:state:*
GET oauth:state:{your_state_value}
```

Should show state data with 10-minute TTL.

### Check MongoDB Connection

```bash
mongosh
use social-media-scheduler
db.socialaccounts.countDocuments({ provider: 'twitter' })
```

### Check Encryption

Verify tokens are encrypted:

```bash
mongosh
use social-media-scheduler
db.socialaccounts.findOne({ provider: 'twitter' }, { accessToken: 1, refreshToken: 1 })
```

Both tokens should be in format: `version:salt:iv:authTag:encrypted`

## Common Issues

### Issue 1: "Twitter OAuth not configured"

**Cause**: Missing `TWITTER_CLIENT_ID` or `TWITTER_CLIENT_SECRET` in `.env`

**Solution**:
1. Add credentials to `apps/backend/.env`
2. Restart backend server

### Issue 2: "Invalid or expired state"

**Cause**: State expired (>10 minutes) or Redis not available

**Solution**:
1. Complete OAuth flow within 10 minutes
2. Check Redis connection (optional, falls back to in-memory)

### Issue 3: "Account already connected"

**Cause**: Twitter account already connected to this workspace

**Solution**:
1. Delete existing account from database
2. Or connect a different Twitter account

### Issue 4: "Token exchange failed"

**Cause**: Invalid Twitter credentials or callback URL mismatch

**Solution**:
1. Verify `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`
2. Verify callback URL in Twitter Developer Portal matches: `http://localhost:5000/api/v1/oauth/twitter/callback`
3. Check Twitter app has correct scopes enabled

### Issue 5: Redirect to wrong URL

**Cause**: `FRONTEND_URL` not set correctly in `.env`

**Solution**:
1. Set `FRONTEND_URL=http://localhost:5173` in `apps/backend/.env`
2. Restart backend server

## Production Deployment

### Environment Variables

Update for production:

```bash
# Production URLs
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com

# Twitter OAuth (production credentials)
TWITTER_CLIENT_ID=your-production-client-id
TWITTER_CLIENT_SECRET=your-production-client-secret

# Disable test mode
OAUTH_TEST_MODE=false

# Redis (required for production)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# MongoDB
MONGODB_URI=mongodb://your-production-mongodb-uri

# Encryption key (generate new for production)
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### Twitter Developer Portal (Production)

1. Update callback URL to production: `https://api.yourdomain.com/api/v1/oauth/twitter/callback`
2. Update website URL to: `https://app.yourdomain.com`
3. Verify all scopes are enabled
4. Use production credentials

### Security Checklist

- [ ] `OAUTH_TEST_MODE=false`
- [ ] Production Twitter credentials configured
- [ ] Redis connected (not in-memory fallback)
- [ ] HTTPS enabled for API and frontend
- [ ] Callback URL matches production domain
- [ ] Encryption key is unique for production
- [ ] MongoDB has proper indexes
- [ ] Logs monitored for errors
- [ ] Rate limiting configured
- [ ] CORS configured for production domain

## Success Criteria

✅ OAuth flow completes without errors
✅ Account created in database with `connectionVersion: 'v2'`
✅ Tokens encrypted in database
✅ User redirected to frontend with success message
✅ Account appears in connected accounts list
✅ Logs show successful OAuth flow
✅ No errors in backend logs
✅ Duplicate account prevention works
✅ Error scenarios handled gracefully

## Next Steps

After successful testing:

1. **Test Token Refresh**: Implement token refresh logic for expired tokens
2. **Test Publishing**: Use connected account to publish tweets
3. **Monitor Logs**: Watch for any OAuth errors in production
4. **Add Other Platforms**: Implement LinkedIn, Facebook, Instagram OAuth
5. **Add Rate Limiting**: Implement rate limiting for OAuth endpoints
6. **Add Monitoring**: Set up alerts for OAuth failures

## Support

If you encounter issues:

1. Check backend logs for detailed error messages
2. Verify Twitter OAuth credentials
3. Ensure callback URL matches exactly
4. Check MongoDB connection
5. Verify encryption key is set
6. Test with different Twitter account
7. Check Twitter API status: https://api.twitterstat.us/

## References

- Implementation: `TWITTER_OAUTH_PRODUCTION_IMPLEMENTATION.md`
- Twitter OAuth 2.0 Docs: https://developer.twitter.com/en/docs/authentication/oauth-2-0
- PKCE RFC: https://tools.ietf.org/html/rfc7636
