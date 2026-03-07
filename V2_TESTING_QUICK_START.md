# V2 OAuth Testing - Quick Start

## Current Status

✅ Backend server running on http://localhost:5000
✅ Frontend server running on http://localhost:5173
✅ V2 routes registered and enabled (`OAUTH_V2_ENABLED=true`)
✅ V2 controller has all required methods (authorize, callback, getPlatforms, finalize)

## Issue Found & Fixed

**Problem**: `/api/v1/oauth-v2/platforms` was returning 404
**Root Cause**: Missing `OAUTH_V2_ENABLED=true` environment variable
**Fix Applied**: Added `OAUTH_V2_ENABLED=true` to `apps/backend/.env`
**Additional Fix**: Added stub `finalize()` method to OAuthControllerV2

## How to Test

### Step 1: Login (REQUIRED)

The V2 endpoints require authentication. You MUST login first:

1. Go to: http://localhost:5173/auth/login
2. Enter your credentials
3. Select a workspace

### Step 2: Access V2 Connect Page

Navigate to: http://localhost:5173/connect-v2

**Expected Behavior**:
- Platform list loads (Twitter, LinkedIn, Facebook, Instagram)
- Each platform has a "Connect" button
- Info box shows Milestone 1 features

### Step 3: Test OAuth Flow

1. Click "Connect" on any platform
2. You'll be redirected to the OAuth provider
3. Authorize the app
4. You'll be redirected back to the callback
5. Backend creates NEW account with `connectionVersion: 'v2'`
6. Success message appears

### Step 4: Verify in MongoDB

```bash
mongosh mongodb://127.0.0.1:27017/social-media-scheduler

db.socialaccounts.find({ connectionVersion: 'v2' }).pretty()
```

**Expected Fields**:
- `connectionVersion: 'v2'`
- `platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram'`
- `accessToken: '<encrypted-string>'`
- `refreshToken: '<encrypted-string>'`

## Known Limitations

⚠️ **OAuth Provider Credentials**: You need real OAuth credentials in `.env` to test with actual providers
⚠️ **Redis Not Connected**: Workers are disabled, but OAuth flow works fine
⚠️ **No Upgrade Logic**: Existing V1 accounts cannot be upgraded yet (Milestone 3)
⚠️ **Minimal UI**: No polish, no animations, no loading states

## Troubleshooting

### "Failed to load platforms"

**Cause**: Not logged in
**Fix**: Login first at http://localhost:5173/auth/login

### "No token provided"

**Cause**: Auth token not in request
**Fix**: Make sure you're logged in and have selected a workspace

### "OAuth not configured for platform"

**Cause**: Missing OAuth credentials in `.env`
**Fix**: Add real credentials for the platform you want to test

### Platform list is empty

**Cause**: No OAuth providers configured
**Fix**: Check `oauthManager.getAvailablePlatforms()` - it should return platforms with valid credentials

## Environment Variables Required

```env
# Enable V2 OAuth
OAUTH_V2_ENABLED=true

# OAuth Provider Credentials (replace with real values)
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
INSTAGRAM_CLIENT_ID=your-instagram-client-id
INSTAGRAM_CLIENT_SECRET=your-instagram-client-secret

# Frontend URL (for OAuth callback)
FRONTEND_URL=http://localhost:5173
```

## Files Modified

1. `apps/backend/.env` - Added `OAUTH_V2_ENABLED=true`
2. `apps/backend/src/controllers/OAuthControllerV2.ts` - Added `finalize()` stub method

## Next Steps

1. Login at http://localhost:5173/auth/login
2. Navigate to http://localhost:5173/connect-v2
3. Verify platform list loads
4. Test OAuth flow with a platform that has valid credentials
5. Verify account created in MongoDB with `connectionVersion: 'v2'`

---

**Status**: Ready for manual testing (after login)
**Date**: 2026-02-28
**Milestone**: 1 (V2 New Accounts Only)
