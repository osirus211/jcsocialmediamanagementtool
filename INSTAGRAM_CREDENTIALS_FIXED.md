# Instagram Credentials Configuration - FIXED

## Problem

You were getting "Invalid platform app" error because you were using Instagram Basic Display credentials for Instagram Business, which caused the system to redirect to Instagram's OAuth page instead of Facebook's OAuth page.

## Root Cause

Instagram Business and Instagram Basic Display are **two completely different OAuth flows** that require **different app credentials**:

| Provider | App Type | Credentials | OAuth URL |
|----------|----------|-------------|-----------|
| **Instagram Business** | Facebook App | Facebook App ID/Secret | facebook.com/dialog/oauth |
| **Instagram Basic Display** | Instagram Basic Display App | Instagram App ID/Secret | instagram.com/oauth/authorize |

## What Was Fixed

Updated `apps/backend/.env` to use the correct credentials for each provider:

```env
# Instagram Business (via Facebook Login)
# Use your FACEBOOK app credentials here
INSTAGRAM_CLIENT_ID=1201349047500191  # ← Facebook App ID
INSTAGRAM_CLIENT_SECRET=67867ce028f802173aa9824cdeede653  # ← Facebook App Secret
INSTAGRAM_CALLBACK_URL=http://localhost:5000/api/v1/oauth/instagram/callback

# Instagram Basic Display API (for personal accounts)
# Use your INSTAGRAM BASIC DISPLAY app credentials here (different from Facebook app)
INSTAGRAM_BASIC_APP_ID=1228109538546688  # ← Instagram Basic Display App ID
INSTAGRAM_BASIC_APP_SECRET=e802739200f42e8c5d2eea9d75c1e81d  # ← Instagram Basic Display Secret
INSTAGRAM_BASIC_REDIRECT_URI=http://localhost:5000/api/v1/oauth/instagram/callback
```

## Current Configuration

### Instagram Business (Working)
- **Credentials**: Facebook App (`1201349047500191`)
- **OAuth Flow**: Redirects to Facebook → User logs in with Facebook → Connects Instagram Business account
- **Status**: ✅ Should work now

### Instagram Basic Display (Configured)
- **Credentials**: Instagram Basic Display App (`1228109538546688`)
- **OAuth Flow**: Redirects to Instagram → User logs in with Instagram → Connects personal account
- **Status**: ✅ Will show in modal now (credentials are configured)

## Expected Behavior Now

### When You Click "Connect Instagram"

1. **Modal opens** with TWO options:
   - Instagram API with Facebook Login (Business) - Recommended
   - Instagram API with Instagram Login (Basic Display)

2. **Click "Connect Business"**:
   - Redirects to **facebook.com** OAuth page
   - User logs in with Facebook
   - Selects Instagram Business account
   - Returns to app with connected account

3. **Click "Connect Basic"**:
   - Redirects to **instagram.com** OAuth page
   - User logs in with Instagram
   - Authorizes app
   - Returns to app with connected account

## Key Differences

### Instagram Business (via Facebook)
- ✅ Full publishing capabilities
- ✅ Analytics and insights
- ✅ Comment moderation
- ✅ Story and Reel publishing
- ⚠️ Requires Business/Creator account
- ⚠️ Must be linked to Facebook Page

### Instagram Basic Display
- ✅ Works with personal accounts
- ✅ View profile and media
- ✅ Read basic account data
- ❌ Cannot publish content
- ❌ No analytics
- ❌ Read-only access

## Testing Checklist

- [ ] Backend server restarted
- [ ] Modal shows TWO options now
- [ ] "Connect Business" redirects to facebook.com (not instagram.com)
- [ ] "Connect Basic" redirects to instagram.com
- [ ] Both flows complete successfully
- [ ] Accounts are saved with correct providerType

## Important Notes

### For Instagram Business
- You MUST use your **Facebook App credentials**
- The Instagram account must be a **Business or Creator account**
- The Instagram account must be **linked to a Facebook Page**
- OAuth happens through **Facebook**, not Instagram

### For Instagram Basic Display
- You MUST use your **Instagram Basic Display App credentials**
- Works with **personal Instagram accounts**
- OAuth happens through **Instagram** directly
- Limited to **read-only access**

## Common Mistakes to Avoid

❌ **Don't** use Instagram Basic Display credentials for Instagram Business
❌ **Don't** use Facebook App credentials for Instagram Basic Display
❌ **Don't** use the same credentials for both providers
✅ **Do** use Facebook App credentials for Instagram Business
✅ **Do** use Instagram Basic Display App credentials for Basic Display
✅ **Do** keep them separate in your .env file

## Credential Summary

```
Facebook App (for Instagram Business):
- App ID: 1201349047500191
- Used for: Instagram Business connections
- OAuth: facebook.com

Instagram Basic Display App (for personal accounts):
- App ID: 1228109538546688
- Used for: Instagram Basic Display connections
- OAuth: instagram.com
```

---

**Status**: ✅ FIXED  
**Ready for**: Testing both Instagram connection flows  
**Expected**: Both options should work correctly now  

**Last Updated**: 2026-03-01 07:37 UTC
