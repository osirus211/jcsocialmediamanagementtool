# Manual Testing Ready - Connect Flow V2

## Servers Running

✅ **Backend**: http://localhost:5000
✅ **Frontend**: http://localhost:5173

## V2 Routes Registered

The following V2 OAuth routes are active:

```
GET  /api/v1/oauth-v2/platforms
POST /api/v1/oauth-v2/:platform/authorize
GET  /api/v1/oauth-v2/:platform/callback
```

## Testing Steps

### 0. Login First (REQUIRED)

Before testing V2 OAuth, you MUST be logged in:

1. Navigate to: http://localhost:5173/auth/login
2. Login with your credentials
3. Select a workspace
4. THEN navigate to: http://localhost:5173/connect-v2

**Why?** The `/api/v1/oauth-v2/platforms` endpoint requires authentication (`requireAuth` middleware).

### 1. Access V2 Connect Page

Navigate to: http://localhost:5173/connect-v2

**Expected**: Platform list should load (Twitter, LinkedIn, Facebook, Instagram)

### 2. Expected Behavior

**Platform List**:
- Should fetch from `/api/v1/oauth-v2/platforms`
- Should display available platforms (Twitter, LinkedIn, Facebook, Instagram)
- Each platform should have a "Connect" button

**Connect Flow**:
1. Click "Connect" button for a platform
2. Frontend calls `/api/v1/oauth-v2/:platform/authorize`
3. Backend returns `authorizationUrl`
4. Frontend redirects to OAuth provider
5. User authorizes on provider site
6. Provider redirects back to `/api/v1/oauth-v2/:platform/callback`
7. Backend creates NEW account with `connectionVersion: 'v2'`
8. Backend redirects to frontend with success/error params

**Callback Handling**:
- Success: Shows green alert "Account connected successfully!"
- Error (account exists): Shows red alert with error message
- Error (other): Shows red alert with error message

### 3. What to Test

**New Account Creation**:
- Connect a NEW account (one you haven't connected before)
- Should succeed and create account with `connectionVersion: 'v2'`
- Check MongoDB to verify account was created

**Existing Account Error**:
- Try to connect an account that already exists
- Should show error: "Account already exists. Upgrade flow coming in Milestone 3."

**OAuth Flow**:
- Verify redirect to OAuth provider works
- Verify callback handling works
- Verify success/error messages display correctly

### 4. MongoDB Verification

After connecting an account, check MongoDB:

```bash
# Connect to MongoDB
mongosh mongodb://127.0.0.1:27017/social-media-scheduler

# Find the newly created account
db.socialaccounts.find({ connectionVersion: 'v2' }).pretty()
```

**Expected Fields**:
- `connectionVersion: 'v2'`
- `platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram'`
- `accessToken: '<encrypted-string>'` (same format as V1)
- `refreshToken: '<encrypted-string>'` (same format as V1)

### 5. Known Limitations (Milestone 1)

⚠️ **Redis Not Connected**: Workers are disabled, but OAuth flow works fine
⚠️ **No Upgrade Logic**: Existing V1 accounts cannot be upgraded yet (Milestone 3)
⚠️ **No UI Polish**: Minimal styling, no animations, no loading states
⚠️ **No Publishing Test**: Workers are disabled, so can't test publishing yet

### 6. Environment Variables

Make sure these are set in `apps/backend/.env`:

```env
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

### 7. Troubleshooting

**Platform list not loading**:
- Check browser console for errors
- Check backend logs for errors
- Verify backend is running on port 5000

**OAuth redirect not working**:
- Check OAuth provider credentials in `.env`
- Check callback URL is registered with OAuth provider
- Check browser console for errors

**Callback not working**:
- Check URL parameters after redirect
- Check backend logs for errors
- Verify callback route is registered

**Account not created**:
- Check MongoDB connection
- Check backend logs for errors
- Verify encryption key is set in `.env`

## Next Steps After Testing

Once manual testing confirms everything works:

1. ✅ Milestone 0: Schema + Worker Dual Compatibility (DONE)
2. ✅ Milestone 1: V2 New Accounts Only (DONE - TESTING NOW)
3. ⏭️ Milestone 2: V2→V1 Rollback Script (NEXT)
4. ⏭️ Milestone 3: V1→V2 Automatic Upgrade
5. ⏭️ Milestone 4: Full Production Deployment

## Quick Reference

**Frontend Code**: `apps/frontend/src/pages/connect-v2/ConnectChannelV2.tsx`
**Backend Controller**: `apps/backend/src/controllers/OAuthControllerV2.ts`
**Backend Routes**: `apps/backend/src/routes/v1/oauth-v2.routes.ts`
**Schema**: `apps/backend/src/models/SocialAccount.ts`
**Workers**: `apps/backend/src/workers/PublishingWorker.ts`, `TokenRefreshWorker.ts`

---

**Status**: Ready for manual testing
**Date**: 2026-02-28
**Milestone**: 1 (V2 New Accounts Only)
