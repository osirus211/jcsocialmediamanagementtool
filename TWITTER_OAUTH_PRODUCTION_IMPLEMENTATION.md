# Twitter OAuth Production Implementation

## Overview

Implemented real production OAuth 2.0 with PKCE for Twitter (X API v2).

## Implementation Details

### 1. OAuth 2.0 with PKCE ✅

**Location**: `apps/backend/src/controllers/OAuthController.ts`

- **State Generation**: 256-bit cryptographically secure state using `crypto.randomBytes(32).toString('base64url')`
- **PKCE Implementation**:
  - Code Verifier: 256-bit random value (32 bytes)
  - Code Challenge: SHA-256 hash of verifier, base64url encoded
  - Challenge Method: S256

```typescript
private generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}
```

### 2. State Storage in Redis ✅

**Location**: `apps/backend/src/services/OAuthStateService.ts`

- **TTL**: 10 minutes (600 seconds)
- **Storage Key**: `oauth:state:{state}`
- **Data Stored**:
  - state
  - workspaceId
  - userId
  - platform
  - codeVerifier (for PKCE)
  - createdAt
  - expiresAt
  - metadata

**Usage**:
```typescript
// Store state
await oauthStateService.createState(workspaceId, userId, platform, {
  codeVerifier,
  metadata: { platform, timestamp: new Date().toISOString() },
});

// Retrieve and consume state (one-time use)
const stateData = await oauthStateService.consumeState(state);
```

### 3. Endpoints ✅

#### POST /api/v1/oauth/twitter/authorize

**Purpose**: Initiate OAuth flow

**Request**:
- Headers: `Authorization: Bearer <jwt_token>`
- Requires authentication (JWT)
- Requires workspace context

**Response**:
```json
{
  "success": true,
  "authorizationUrl": "https://twitter.com/i/oauth2/authorize?...",
  "state": "base64url_encoded_state",
  "platform": "twitter"
}
```

**Flow**:
1. Validate authentication
2. Generate 256-bit state
3. Generate PKCE (verifier + challenge)
4. Store state in Redis (TTL 10 min)
5. Build authorization URL with PKCE
6. Return URL to frontend

#### GET /api/v1/oauth/twitter/callback

**Purpose**: Handle OAuth callback from Twitter

**Query Parameters**:
- `code`: Authorization code from Twitter
- `state`: State parameter for CSRF protection
- `error`: (optional) Error from Twitter
- `error_description`: (optional) Error description

**Flow**:
1. Validate state from Redis
2. Exchange code for tokens using PKCE verifier
3. Fetch user profile
4. Check for duplicate accounts
5. Create SocialAccount with encrypted tokens
6. Redirect to frontend with success/error

**Redirect URLs**:
- Success: `${FRONTEND_URL}/social/accounts?success=true&platform=twitter&account={accountId}`
- Error: `${FRONTEND_URL}/social/accounts?error={errorCode}&message={errorMessage}`

### 4. Token Exchange ✅

**Location**: `apps/backend/src/controllers/OAuthController.ts` (callback method)

**Endpoint**: `https://api.twitter.com/2/oauth2/token`

**Request**:
```typescript
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(clientId:clientSecret)}

Body:
  grant_type=authorization_code
  code={authorization_code}
  redirect_uri={redirect_uri}
  code_verifier={pkce_verifier}
  client_id={client_id}
```

**Response**:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 7200,
  "scope": "tweet.read tweet.write users.read offline.access",
  "token_type": "bearer"
}
```

### 5. User Profile Fetch ✅

**Endpoint**: `https://api.twitter.com/2/users/me`

**Request**:
```typescript
GET https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url,public_metrics
Authorization: Bearer {access_token}
```

**Response**:
```json
{
  "data": {
    "id": "123456789",
    "name": "John Doe",
    "username": "johndoe",
    "profile_image_url": "https://...",
    "public_metrics": {
      "followers_count": 1000
    }
  }
}
```

**Extracted Profile**:
- `id`: Twitter user ID
- `username`: Twitter handle
- `name`: Display name
- `profileUrl`: `https://twitter.com/{username}`
- `avatarUrl`: Profile image URL
- `followerCount`: Number of followers

### 6. Token Encryption ✅

**Location**: `apps/backend/src/utils/encryption.ts`

**Algorithm**: AES-256-GCM

**Features**:
- Automatic encryption via Mongoose pre-save hook
- Key versioning support
- Salt-based key derivation (PBKDF2)
- Authentication tag for integrity

**Encryption Format**:
```
version:salt:iv:authTag:encrypted
```

**Usage** (automatic via model):
```typescript
const account = new SocialAccount({
  accessToken: tokens.accessToken, // Plain text
  refreshToken: tokens.refreshToken, // Plain text
  // ... other fields
});

await account.save(); // Tokens automatically encrypted

// Decryption
const decryptedAccessToken = account.getDecryptedAccessToken();
const decryptedRefreshToken = account.getDecryptedRefreshToken();
```

### 7. SocialAccount Storage ✅

**Location**: `apps/backend/src/models/SocialAccount.ts`

**Schema**:
```typescript
{
  workspaceId: ObjectId,
  provider: 'twitter',
  providerUserId: string, // Twitter user ID
  accountName: string, // Display name
  accessToken: string, // Encrypted
  refreshToken: string, // Encrypted
  tokenExpiresAt: Date,
  scopes: string[],
  status: 'active' | 'expired' | 'revoked',
  connectionVersion: 'v2',
  metadata: {
    username: string,
    profileUrl: string,
    avatarUrl: string,
    followerCount: number
  },
  lastSyncAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ workspaceId, provider, providerUserId }` - Unique (prevents duplicates)
- `{ workspaceId, provider }`
- `{ workspaceId, status }`
- `{ status, tokenExpiresAt }`

### 8. Duplicate Account Prevention ✅

**Location**: `apps/backend/src/controllers/OAuthController.ts` (callback method)

**Check**:
```typescript
const existing = await SocialAccount.findOne({
  workspaceId: stateData.workspaceId,
  provider: 'twitter',
  providerUserId: profile.id,
});

if (existing) {
  // Return error - account already connected
  return res.redirect(
    `${frontendUrl}/social/accounts?error=DUPLICATE_ACCOUNT&message=Account already connected`
  );
}
```

**Database Constraint**:
- Unique index on `{ workspaceId, provider, providerUserId }`
- Prevents race conditions at database level

### 9. Structured Error Codes ✅

**Location**: `apps/backend/src/controllers/OAuthController.ts`

**Error Codes**:
```typescript
enum OAuthErrorCode {
  INVALID_PLATFORM = 'INVALID_PLATFORM',
  PLATFORM_NOT_CONFIGURED = 'PLATFORM_NOT_CONFIGURED',
  STATE_INVALID = 'STATE_INVALID',
  STATE_EXPIRED = 'STATE_EXPIRED',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  PROFILE_FETCH_FAILED = 'PROFILE_FETCH_FAILED',
  DUPLICATE_ACCOUNT = 'DUPLICATE_ACCOUNT',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
}
```

**Error Response Format**:
```
Redirect to: ${FRONTEND_URL}/social/accounts?error={errorCode}&message={errorMessage}
```

**Examples**:
- `?error=STATE_INVALID&message=Invalid%20or%20expired%20state`
- `?error=TOKEN_EXCHANGE_FAILED&message=Failed%20to%20exchange%20code`
- `?error=DUPLICATE_ACCOUNT&message=Account%20already%20connected`

## Configuration

### Environment Variables

**Required**:
```bash
# OAuth Mode
OAUTH_TEST_MODE=false  # MUST be false for production

# Twitter OAuth 2.0 Credentials
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# API URL (for callback redirect)
API_URL=http://localhost:5000

# Frontend URL (for success/error redirects)
FRONTEND_URL=http://localhost:5173

# Encryption Key (64 hex characters = 32 bytes)
ENCRYPTION_KEY=f8a25c246efc5b858e66e029256131b46b967ca691c72367acc0b9cac554449c

# Redis (for state storage)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/social-media-scheduler
```

### Twitter Developer Portal Setup

1. Go to https://developer.twitter.com/
2. Create a new app or use existing app
3. Enable OAuth 2.0
4. Set callback URL: `http://localhost:5000/api/v1/oauth/twitter/callback`
5. Request scopes:
   - `tweet.read`
   - `tweet.write`
   - `users.read`
   - `offline.access` (for refresh tokens)
6. Copy Client ID and Client Secret to `.env`

## Testing

### Manual Testing Flow

1. **Start Backend**:
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Start Frontend**:
   ```bash
   cd apps/frontend
   npm run dev
   ```

3. **Test OAuth Flow**:
   - Navigate to http://localhost:5173/social/accounts
   - Click "Connect Account" → Select Twitter
   - Should redirect to Twitter authorization page
   - Authorize the app
   - Should redirect back to `/social/accounts?success=true&platform=twitter&account={id}`

4. **Verify in Database**:
   ```bash
   mongosh
   use social-media-scheduler
   db.socialaccounts.find({ provider: 'twitter' }).pretty()
   ```

   Should see:
   - Encrypted `accessToken` and `refreshToken`
   - `connectionVersion: 'v2'`
   - `status: 'active'`
   - User metadata (username, profileUrl, etc.)

### API Testing with cURL

**1. Initiate OAuth**:
```bash
curl -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
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

**2. Check Available Platforms**:
```bash
curl http://localhost:5000/api/v1/oauth/platforms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
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

## Security Features

### 1. CSRF Protection
- 256-bit cryptographically secure state parameter
- State stored in Redis with 10-minute TTL
- One-time use (consumed after validation)

### 2. PKCE (Proof Key for Code Exchange)
- Prevents authorization code interception attacks
- 256-bit code verifier
- SHA-256 code challenge (S256 method)

### 3. Token Encryption
- AES-256-GCM encryption at rest
- Automatic encryption via Mongoose hooks
- Key versioning for safe rotation
- Authentication tags for integrity

### 4. Duplicate Prevention
- Unique database index on `{ workspaceId, provider, providerUserId }`
- Application-level check before creation
- Race condition protection at database level

### 5. Secure Token Storage
- Tokens never exposed in API responses
- Tokens never logged
- Tokens encrypted in database
- Tokens excluded from JSON serialization

## Architecture

### Flow Diagram

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│ Frontend│                │ Backend │                │ Twitter │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ POST /oauth/twitter/     │                          │
     │      authorize           │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │                          │ Generate state (256-bit) │
     │                          │ Generate PKCE            │
     │                          │ Store in Redis (10 min)  │
     │                          │                          │
     │ { authorizationUrl }     │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ Redirect to Twitter      │                          │
     ├──────────────────────────┼─────────────────────────>│
     │                          │                          │
     │                          │      User authorizes     │
     │                          │                          │
     │                          │ GET /callback?code=...   │
     │                          │<─────────────────────────┤
     │                          │                          │
     │                          │ Validate state (Redis)   │
     │                          │                          │
     │                          │ POST /oauth2/token       │
     │                          │ (with PKCE verifier)     │
     │                          ├─────────────────────────>│
     │                          │                          │
     │                          │ { access_token, ... }    │
     │                          │<─────────────────────────┤
     │                          │                          │
     │                          │ GET /users/me            │
     │                          ├─────────────────────────>│
     │                          │                          │
     │                          │ { user profile }         │
     │                          │<─────────────────────────┤
     │                          │                          │
     │                          │ Check duplicates         │
     │                          │ Encrypt tokens           │
     │                          │ Save to MongoDB          │
     │                          │                          │
     │ Redirect to /social/     │                          │
     │ accounts?success=true    │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
```

## Files Modified

1. **apps/backend/src/controllers/OAuthController.ts** - Complete rewrite for production OAuth
2. **apps/backend/src/services/oauth/TwitterOAuthProvider.ts** - Updated header comments
3. **apps/backend/.env** - Disabled test mode, added Twitter OAuth comments

## Files Used (Existing Infrastructure)

1. **apps/backend/src/services/OAuthStateService.ts** - Redis state storage
2. **apps/backend/src/utils/encryption.ts** - AES-256-GCM encryption
3. **apps/backend/src/models/SocialAccount.ts** - Account storage with encryption hooks
4. **apps/backend/src/routes/v1/oauth.routes.ts** - OAuth routes
5. **apps/backend/src/config/index.ts** - Configuration management

## Next Steps

### 1. Add Twitter Credentials
Update `.env` with real Twitter OAuth credentials:
```bash
TWITTER_CLIENT_ID=your-real-client-id
TWITTER_CLIENT_SECRET=your-real-client-secret
```

### 2. Test OAuth Flow
- Start backend and frontend servers
- Navigate to `/social/accounts`
- Click "Connect Account" → Twitter
- Complete OAuth flow
- Verify account created in database

### 3. Monitor Logs
Watch for:
- `[OAuth] Authorization initiated`
- `[OAuth] Token exchange successful`
- `[OAuth] Profile fetched`
- `[OAuth] Account created`

### 4. Verify Encryption
Check database to ensure tokens are encrypted:
```bash
mongosh
use social-media-scheduler
db.socialaccounts.findOne({ provider: 'twitter' })
```

Should see encrypted format: `version:salt:iv:authTag:encrypted`

### 5. Test Error Scenarios
- Invalid state
- Expired state
- Duplicate account
- Token exchange failure
- Profile fetch failure

## Production Checklist

- [x] OAuth 2.0 with PKCE implemented
- [x] 256-bit state generation
- [x] State stored in Redis with 10-minute TTL
- [x] Token exchange with PKCE verifier
- [x] User profile fetch
- [x] Token encryption (AES-256-GCM)
- [x] Duplicate account prevention
- [x] Structured error codes
- [x] Secure token storage
- [x] CSRF protection
- [ ] Add Twitter OAuth credentials to .env
- [ ] Test complete OAuth flow
- [ ] Verify token encryption in database
- [ ] Test error scenarios
- [ ] Monitor production logs

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Verify Twitter OAuth credentials
3. Ensure Redis is running
4. Verify MongoDB connection
5. Check frontend redirect URLs

## References

- Twitter OAuth 2.0 Documentation: https://developer.twitter.com/en/docs/authentication/oauth-2-0
- PKCE RFC: https://tools.ietf.org/html/rfc7636
- OAuth 2.0 RFC: https://tools.ietf.org/html/rfc6749
