# LinkedIn OAuth Integration Plan

**Status:** Ready to implement  
**Pattern:** Following YouTube implementation

---

## Current State

### ✅ Already Exists:
- `LinkedInOAuthProvider.ts` - OAuth provider implementation
- `LINKEDIN` enum in frontend types
- LinkedIn registered in OAuthManager
- Config schema supports LinkedIn

### ❌ Missing:
- LinkedIn support in OAuthController (authorize & callback)
- LinkedIn OAuth service
- LinkedIn credentials in .env
- Frontend UI components (button labels, icons, colors)
- LinkedIn app in LinkedIn Developer Portal

---

## Implementation Steps

### 1. Backend Implementation

#### A. Create LinkedInOAuthService.ts
Similar to YouTubeOAuthService, create a minimal service:
- `connectAccount()` method
- Profile fetching
- Account creation
- Token storage

#### B. Update OAuthController.ts
Add LinkedIn support to:
- `authorize()` method - LinkedIn OAuth flow
- `callback()` method - LinkedIn callback handler
- `getLinkedInConfig()` private method
- `handleLinkedInCallback()` private method

#### C. Update .env
Add LinkedIn credentials:
```env
LINKEDIN_CLIENT_ID=your-app-client-id
LINKEDIN_CLIENT_SECRET=your-app-client-secret
LINKEDIN_CALLBACK_URL=http://localhost:5000/api/v1/oauth/linkedin/callback
```

### 2. Frontend Implementation

#### A. Update UI Components
- `ConnectButton.tsx` - Add "LinkedIn" label
- `AccountCard.tsx` - Add LinkedIn icon (🔗 or LinkedIn logo) and blue color (#0A66C2)
- `PlatformTabs.tsx` - Add LinkedIn tab
- `AccountSelector.tsx` - Add LinkedIn icon
- `PlatformComparison.tsx` - Add LinkedIn support
- `PostComposer.tsx` - Add LinkedIn icon

### 3. LinkedIn Developer Portal Setup

#### A. Create LinkedIn App
1. Go to https://www.linkedin.com/developers/apps
2. Create new app
3. Get Client ID and Client Secret
4. Add redirect URI: `http://localhost:5000/api/v1/oauth/linkedin/callback`
5. Request scopes:
   - `openid`
   - `profile`
   - `email`
   - `w_member_social` (for posting)

---

## OAuth Scopes

### Required Scopes:
```
openid
profile
email
w_member_social
```

### What They Allow:
- `openid` - OpenID Connect authentication
- `profile` - Read user profile
- `email` - Read email address
- `w_member_social` - Post content to LinkedIn

---

## Configuration

### Callback URL:
```
http://localhost:5000/api/v1/oauth/linkedin/callback
```

### OAuth Endpoints:
- Authorization: `https://www.linkedin.com/oauth/v2/authorization`
- Token: `https://www.linkedin.com/oauth/v2/accessToken`
- User Info: `https://api.linkedin.com/v2/userinfo`

---

## Implementation Order

1. ✅ Check existing LinkedInOAuthProvider
2. ⏳ Create LinkedInOAuthService
3. ⏳ Update OAuthController (authorize & callback)
4. ⏳ Add LinkedIn credentials to .env
5. ⏳ Update frontend UI components
6. ⏳ Create LinkedIn app in developer portal
7. ⏳ Test OAuth flow
8. ⏳ Verify account connection
9. ⏳ Test token refresh
10. ⏳ Cleanup and documentation

---

## Differences from YouTube

### LinkedIn Specifics:
- Uses OpenID Connect (userinfo endpoint)
- Refresh tokens may not always be provided
- Tokens expire in 60 days
- No ngrok needed (allows localhost)
- Different icon and branding (blue #0A66C2)

### Similar to YouTube:
- OAuth 2.0 flow
- State-based CSRF protection
- Token encryption
- Account sync support

---

## Next Steps

1. **Get LinkedIn credentials** from developer portal
2. **Implement backend** (service + controller)
3. **Update frontend** UI components
4. **Test OAuth flow** end-to-end
5. **Verify** account appears in list

---

**Ready to start implementation!**
