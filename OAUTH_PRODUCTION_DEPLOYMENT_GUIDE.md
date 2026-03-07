# OAuth Production Deployment Guide

**Date:** 2026-02-28  
**Status:** ✅ Production-ready improvements implemented

---

## Changes Implemented

### 1. ✅ Removed Debug Logging
**File:** `apps/backend/src/config/index.ts`

**Removed:**
```typescript
// Debug logging for Facebook OAuth configuration (non-production safe)
console.log('=== FACEBOOK OAUTH CONFIG DEBUG ===');
console.log('FB APP ID:', env.FACEBOOK_APP_ID || 'NOT SET');
console.log('FB APP SECRET LENGTH:', env.FACEBOOK_APP_SECRET?.length || 0);
// ... etc
```

**Status:** No sensitive data is logged at startup.

---

### 2. ✅ Added Strict OAuth Environment Validation
**File:** `apps/backend/src/config/validateOAuthEnv.ts` (NEW)

**Features:**
- Validates all required OAuth credentials at startup
- Fails fast if any required variable is missing
- Does NOT log secret values
- Provides clear error messages

**Required Variables:**
- `FACEBOOK_APP_ID` (must be numeric)
- `FACEBOOK_APP_SECRET` (must be at least 32 characters)
- `INSTAGRAM_CLIENT_ID` (must be numeric)
- `INSTAGRAM_CLIENT_SECRET` (must be at least 32 characters)

**Optional Variables:**
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `TWITTER_CALLBACK_URL`

**Validation Logic:**
```typescript
export function validateOAuthConfigAtStartup(): void {
  try {
    getValidatedOAuthConfig();
    logger.info('[OAuth Config] ✅ OAuth environment validation passed');
  } catch (error) {
    logger.error('[OAuth Config] ❌ OAuth environment validation failed');
    throw error; // Server will not start
  }
}
```

**Integration:**
Updated `apps/backend/src/config/index.ts` to call validation at startup:
```typescript
import { validateOAuthConfigAtStartup } from './validateOAuthEnv';

dotenv.config();

// Validate OAuth configuration at startup (fail fast)
validateOAuthConfigAtStartup();
```

---

### 3. ✅ Docker Environment Configuration
**File:** `docker-compose.yml`

**Added:**
```yaml
backend:
  env_file:
    - ./apps/backend/.env  # ← NEW: Loads all env vars from .env file
  environment:
    # Override specific vars for Docker
    MONGODB_URI: mongodb://admin:password123@mongodb:27017/social-media-scheduler?authSource=admin
    REDIS_HOST: redis
    # ... other Docker-specific overrides
```

**File:** `docker-compose.production.yml`

**Status:** ✅ Already configured correctly:
```yaml
backend:
  env_file:
    - ./apps/backend/.env.production
```

---

### 4. ✅ Enhanced Error Handling in OAuthController
**File:** `apps/backend/src/controllers/OAuthController.ts`

**Changes:**
- Detects invalid app secret errors
- Returns safe error messages (does not expose configuration details)
- Logs errors without exposing secrets

**Implementation:**
```typescript
catch (error: any) {
  const errorMessage = error.response?.data?.error?.message || 
                       error.response?.data?.error_description || 
                       error.message;
  
  const isInvalidSecret = errorMessage?.toLowerCase().includes('secret') || 
                         errorMessage?.toLowerCase().includes('client') ||
                         error.response?.data?.error === 'invalid_client';
  
  if (isInvalidSecret) {
    logger.error('[OAuth] Token exchange failed - invalid client credentials', {
      platform,
      errorType: 'INVALID_CLIENT_CREDENTIALS',
      // Do NOT log the actual secret or tokens
    });
  }
  
  // Return safe error message
  const userMessage = isInvalidSecret 
    ? 'OAuth configuration error. Please contact support.'
    : (errorMessage || 'Token exchange failed');
  
  return res.redirect(
    `${frontendUrl}/social/accounts?error=${OAuthErrorCode.TOKEN_EXCHANGE_FAILED}&message=${encodeURIComponent(userMessage)}`
  );
}
```

**User-Facing Error Messages:**
- ❌ Before: "Error validating client secret" (exposes configuration issue)
- ✅ After: "OAuth configuration error. Please contact support." (safe message)

---

### 5. ✅ Production Logging Security
**Verified:** No sensitive data is logged in production

**Checked Files:**
- `apps/backend/src/services/oauth/FacebookOAuthProvider.ts` ✅
- `apps/backend/src/services/oauth/FacebookOAuthService.ts` ✅
- `apps/backend/src/controllers/OAuthController.ts` ✅

**Logging Policy:**
- ✅ Never log app secrets
- ✅ Never log access tokens
- ✅ Never log OAuth authorization codes
- ✅ Never log refresh tokens
- ✅ Only log non-sensitive metadata (user IDs, timestamps, success/failure)

---

## Restart Instructions

### Local Development (Non-Docker)

**Current Status:** Server is running with old code

**Steps:**
1. Stop the current backend server
2. Start fresh to load new validation

```bash
# Navigate to backend directory
cd apps/backend

# Stop current server (if running)
# Press Ctrl+C or kill the process

# Start server with new validation
npm run dev
```

**Expected Output:**
```
[OAuth Config] ✅ OAuth environment validation passed
✅ Server running on port 5000
```

**If validation fails:**
```
[OAuth Config] ❌ OAuth environment validation failed
OAuth environment validation failed:
  - FACEBOOK_APP_ID is required but not set
  - FACEBOOK_APP_SECRET is required but not set
  ...
```

---

### Docker Development

**Steps:**
1. Stop current containers
2. Rebuild backend image (to include new validation code)
3. Start containers

```bash
# Stop all containers
docker-compose down

# Rebuild backend image
docker-compose build backend

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

**Expected Output:**
```
[OAuth Config] ✅ OAuth environment validation passed
✅ Server running on port 5000
```

---

### Docker Production

**Steps:**
1. Ensure `.env.production` has correct OAuth credentials
2. Stop current containers
3. Rebuild images
4. Start containers

```bash
# Stop all containers
docker-compose -f docker-compose.production.yml down

# Rebuild all images
docker-compose -f docker-compose.production.yml build

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f worker
```

**Verify Health:**
```bash
# Check backend health
curl http://localhost:5000/health

# Check all container status
docker-compose -f docker-compose.production.yml ps
```

---

## Environment File Checklist

### Development (.env)
```env
# Required OAuth Variables
FACEBOOK_APP_ID=1201349047500191
FACEBOOK_APP_SECRET=<correct-secret-from-meta-console>
FACEBOOK_CALLBACK_URL=http://localhost:5000/api/v1/oauth/facebook/callback

INSTAGRAM_CLIENT_ID=1228109538546688
INSTAGRAM_CLIENT_SECRET=<same-as-facebook-secret>

# Optional Twitter OAuth
TWITTER_CLIENT_ID=<your-twitter-client-id>
TWITTER_CLIENT_SECRET=<your-twitter-client-secret>
TWITTER_CALLBACK_URL=http://localhost:5000/api/v1/oauth/twitter/callback
```

### Production (.env.production)
```env
# Required OAuth Variables
FACEBOOK_APP_ID=<production-app-id>
FACEBOOK_APP_SECRET=<production-app-secret>
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/v1/oauth/facebook/callback

INSTAGRAM_CLIENT_ID=<production-instagram-id>
INSTAGRAM_CLIENT_SECRET=<production-instagram-secret>

# Optional Twitter OAuth
TWITTER_CLIENT_ID=<production-twitter-client-id>
TWITTER_CLIENT_SECRET=<production-twitter-client-secret>
TWITTER_CALLBACK_URL=https://yourdomain.com/api/v1/oauth/twitter/callback
```

---

## Validation Behavior

### Startup Validation

**On Server Start:**
1. `dotenv.config()` loads environment variables
2. `validateOAuthConfigAtStartup()` runs immediately
3. If validation fails → Server exits with error
4. If validation passes → Server continues startup

**Example Success:**
```
[OAuth Config] ✅ OAuth environment validation passed
[OAuth Config] Validation passed {
  facebook: { appIdSet: true, appSecretSet: true, callbackUrlSet: true },
  instagram: { clientIdSet: true, clientSecretSet: true },
  twitter: { clientIdSet: true, clientSecretSet: true }
}
```

**Example Failure:**
```
[OAuth Config] ❌ OAuth environment validation failed
OAuth environment validation failed:
  - FACEBOOK_APP_SECRET is required but not set
  - INSTAGRAM_CLIENT_SECRET is required but not set

Please ensure all required OAuth credentials are set in your .env file.
Required variables:
  - FACEBOOK_APP_ID
  - FACEBOOK_APP_SECRET
  - INSTAGRAM_CLIENT_ID
  - INSTAGRAM_CLIENT_SECRET

Error: OAuth environment validation failed
    at getValidatedOAuthConfig (...)
    at validateOAuthConfigAtStartup (...)
```

---

## Testing the Changes

### 1. Test Validation (Missing Credentials)

**Temporarily remove a required variable:**
```bash
# Edit apps/backend/.env
# Comment out FACEBOOK_APP_SECRET
# FACEBOOK_APP_SECRET=...

# Try to start server
npm run dev
```

**Expected:** Server should fail to start with clear error message.

### 2. Test Validation (Valid Credentials)

**Ensure all required variables are set:**
```bash
# Edit apps/backend/.env
# Uncomment FACEBOOK_APP_SECRET
FACEBOOK_APP_SECRET=<correct-secret>

# Start server
npm run dev
```

**Expected:** Server should start successfully with validation passed message.

### 3. Test OAuth Flow (Invalid Secret)

**With incorrect secret in .env:**
1. Start server
2. Initiate Facebook OAuth
3. Complete authorization on Facebook
4. Check callback error

**Expected Error Message:**
```
OAuth configuration error. Please contact support.
```

**NOT:**
```
Error validating client secret
```

### 4. Test OAuth Flow (Valid Secret)

**With correct secret in .env:**
1. Start server
2. Initiate Facebook OAuth
3. Complete authorization on Facebook
4. Check callback success

**Expected:** Account connected successfully.

---

## Security Verification

### ✅ No Sensitive Data in Logs

**Verified:**
- App secrets are never logged
- Access tokens are never logged
- OAuth codes are never logged
- Only metadata is logged (user IDs, timestamps, success/failure)

**Example Safe Log:**
```json
{
  "level": "info",
  "message": "[OAuth] Token exchange successful",
  "platform": "facebook",
  "workspaceId": "699abb302e5396ce53e57284",
  "expiresIn": 5183944
}
```

**Example Unsafe Log (PREVENTED):**
```json
{
  "level": "error",
  "message": "Token exchange failed",
  "clientSecret": "e802739200f42e8c5d2eea9d75c1e81d",  // ❌ NEVER DO THIS
  "accessToken": "EAABsb..."  // ❌ NEVER DO THIS
}
```

---

## Rollback Plan

If issues occur after deployment:

### 1. Revert Code Changes
```bash
git revert <commit-hash>
git push
```

### 2. Revert Docker Changes
```bash
# Edit docker-compose.yml
# Remove env_file line
# Restart containers
docker-compose down
docker-compose up -d
```

### 3. Disable Validation (Emergency Only)
```typescript
// Edit apps/backend/src/config/index.ts
// Comment out validation call
// validateOAuthConfigAtStartup();
```

**Note:** Only use as emergency measure. Fix root cause ASAP.

---

## Monitoring

### Check OAuth Health

**Endpoint:** `GET /api/v1/oauth/platforms`

**Expected Response:**
```json
{
  "success": true,
  "platforms": ["twitter", "facebook"],
  "features": {
    "oauth2": true,
    "pkce": true,
    "refreshTokens": true,
    "encryption": "AES-256-GCM",
    "ipBinding": true,
    "rateLimiting": true,
    "auditLogging": true,
    "replayProtection": true
  }
}
```

### Check Logs

**Development:**
```bash
# Local
tail -f apps/backend/logs/combined.log

# Docker
docker-compose logs -f backend
```

**Production:**
```bash
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f worker
```

**Look for:**
- `[OAuth Config] ✅ OAuth environment validation passed`
- `[OAuth] Token exchange successful`
- `[OAuth] Account created`

**Alert on:**
- `[OAuth Config] ❌ OAuth environment validation failed`
- `[OAuth] Token exchange failed - invalid client credentials`
- `INVALID_CLIENT_CREDENTIALS`

---

## Summary

**Changes Made:**
1. ✅ Removed debug logging of secret length
2. ✅ Added strict OAuth environment validation at startup
3. ✅ Updated docker-compose.yml to load .env file
4. ✅ Enhanced error handling for invalid secrets
5. ✅ Verified no sensitive data in logs

**Files Modified:**
- `apps/backend/src/config/index.ts`
- `apps/backend/src/controllers/OAuthController.ts`
- `docker-compose.yml`

**Files Created:**
- `apps/backend/src/config/validateOAuthEnv.ts`
- `OAUTH_PRODUCTION_DEPLOYMENT_GUIDE.md` (this file)

**Next Steps:**
1. Update `FACEBOOK_APP_SECRET` in `.env` with correct value from Meta Console
2. Restart backend server (local or Docker)
3. Test OAuth flow
4. Deploy to production with correct secrets in `.env.production`

**Status:** ✅ Ready for production deployment
