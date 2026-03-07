# Milestone 1 - Authorization Flow Fix

## Issue

When clicking "Connect" on a platform, got error:
```
UnauthorizedError: No token provided
```

## Root Cause

The frontend was doing a browser redirect (`window.location.href`) to the authorize endpoint, which doesn't include the Authorization header with the access token.

## Solution

Changed the flow to:

1. **Frontend**: Make authenticated POST request to `/api/v1/oauth-v2/:platform/authorize`
2. **Backend**: Return JSON with `authorizationUrl` instead of doing `res.redirect()`
3. **Frontend**: Redirect browser to the returned `authorizationUrl`

## Files Modified

### Backend: `apps/backend/src/controllers/OAuthControllerV2.ts`

**Before**:
```typescript
// Redirect to OAuth provider
res.redirect(url);
```

**After**:
```typescript
// Return authorization URL as JSON (for frontend to redirect)
res.json({
  success: true,
  authorizationUrl: url,
  state,
  platform,
});
```

### Frontend: `apps/frontend/src/pages/connect-v2/ConnectChannelV2.tsx`

**Before**:
```typescript
const handleConnect = (platform: string) => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  window.location.href = `${apiUrl}/oauth-v2/${platform}/authorize`;
};
```

**After**:
```typescript
const handleConnect = async (platform: string) => {
  try {
    setLoading(true);
    // Call authorize endpoint to get authorization URL
    const response = await apiClient.post(`/oauth-v2/${platform}/authorize`);
    
    // If backend returns authorizationUrl, redirect to it
    if (response.authorizationUrl) {
      window.location.href = response.authorizationUrl;
    }
  } catch (err: any) {
    console.error('Failed to initiate OAuth:', err);
    setError(`Failed to connect: ${err.response?.data?.message || err.message}`);
    setLoading(false);
  }
};
```

## How It Works Now

1. User clicks "Connect" button
2. Frontend makes authenticated POST to `/api/v1/oauth-v2/:platform/authorize` (includes auth token)
3. Backend validates token, generates OAuth URL, stores state
4. Backend returns JSON: `{ authorizationUrl: "https://..." }`
5. Frontend redirects browser to the OAuth provider
6. User authorizes on provider site
7. Provider redirects to callback: `/api/v1/oauth-v2/:platform/callback`
8. Backend creates account with `connectionVersion: 'v2'`
9. Backend redirects to frontend with success params

## Testing

1. Log in at http://localhost:5173/auth/login
2. Go to "Connect V2 (Test)" in sidebar
3. Click "Connect" on any platform
4. Should redirect to test OAuth page (test mode)
5. Should redirect back with success message
6. Account created with `connectionVersion: 'v2'`

---

**Status**: Fixed and ready for testing
**Date**: 2026-02-28
**Milestone**: 1 (V2 New Accounts Only)
