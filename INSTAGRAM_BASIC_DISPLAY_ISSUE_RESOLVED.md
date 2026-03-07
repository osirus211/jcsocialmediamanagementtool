# Instagram Basic Display Issue - RESOLVED

## Problem

When clicking "Connect Basic" in the Instagram modal, you received this error:
```
Invalid request: Request parameters are invalid: Invalid platform app
```

## Root Cause

You were using the **same Facebook App credentials** for both:
1. Instagram Business (via Facebook) - ✅ Correct
2. Instagram Basic Display - ❌ Incorrect

Instagram Basic Display requires **separate app credentials** from a different app type in Facebook Developer Console.

## What Was Fixed

### 1. Smart Option Filtering
Modified `InstagramOAuthService.getConnectionOptions()` to:
- Only show Instagram Basic Display option when valid credentials are configured
- Check if credentials are placeholders and hide the option if they are
- Always show Instagram Business option (it's properly configured)

### 2. Validation Logic Update
Updated `validateOAuthEnv.ts` to:
- Skip validation for placeholder values in development
- Only validate Instagram Basic Display credentials if they're actually configured
- Prevent startup errors when placeholders are present

### 3. Environment File Cleanup
Reset `.env` to use placeholders with clear comments:
```env
# Instagram Basic Display API (for personal accounts)
# NOTE: These are DIFFERENT credentials from Instagram Business
# You need to create a separate Instagram Basic Display app in Facebook Developer Console
INSTAGRAM_BASIC_APP_ID=your_instagram_basic_app_id_here
INSTAGRAM_BASIC_APP_SECRET=your_instagram_basic_app_secret_here
INSTAGRAM_BASIC_REDIRECT_URI=http://localhost:5000/api/v1/oauth/instagram/callback
```

## Current Behavior

### ✅ What Works Now

1. **Modal Loads**: Opens and shows available connection options
2. **Instagram Business**: Only option displayed (Basic Display is hidden)
3. **Connect Business**: Works perfectly - redirects to Facebook OAuth
4. **No Errors**: No 500 errors or invalid platform app errors

### 🔄 What Happens When You Add Credentials

Once you add real Instagram Basic Display credentials:
1. Modal will show **both** options
2. Instagram Business (recommended)
3. Instagram Basic Display
4. Both will work correctly

## How to Enable Instagram Basic Display

### Step 1: Create Instagram Basic Display App

1. Go to https://developers.facebook.com/
2. Click "My Apps" → "Create App"
3. Select **"Consumer"** as app type (NOT "Business")
4. Fill in app details and create

### Step 2: Add Instagram Basic Display Product

1. In your new app dashboard, click "Add Product"
2. Find "Instagram Basic Display" and click "Set Up"
3. Configure settings:
   - **Valid OAuth Redirect URIs**: `http://localhost:5000/api/v1/oauth/instagram/callback`
   - **Deauthorize Callback URL**: `http://localhost:5000/api/v1/oauth/instagram/deauthorize`
   - **Data Deletion Request URL**: `http://localhost:5000/api/v1/oauth/instagram/delete`
4. Save changes

### Step 3: Get Credentials

1. In Instagram Basic Display settings, find:
   - **Instagram App ID** (numeric, like `987654321098765`)
   - **Instagram App Secret** (long string)
2. Copy these values

### Step 4: Update .env File

Open `apps/backend/.env` and replace:
```env
INSTAGRAM_BASIC_APP_ID=987654321098765  # Your actual App ID
INSTAGRAM_BASIC_APP_SECRET=xyz789abc456...  # Your actual App Secret
```

### Step 5: Restart Backend

```bash
cd apps/backend
# Press Ctrl+C to stop
npm run dev
```

### Step 6: Add Test Users (Development)

Instagram Basic Display requires test users in development:
1. In Instagram Basic Display settings, scroll to "User Token Generator"
2. Click "Add or Remove Instagram Testers"
3. Add your Instagram username
4. Accept the invitation on Instagram (Settings → Apps and Websites → Tester Invites)

## Testing Checklist

### Current State (Without Basic Display Credentials)
- [x] Backend server starts without errors
- [x] Frontend server running
- [x] Modal opens when clicking "Connect Instagram"
- [x] Only Instagram Business option is shown
- [x] "Connect Business" redirects to Facebook OAuth
- [x] No 500 errors
- [x] No "Invalid platform app" errors

### After Adding Credentials
- [ ] Backend server starts without errors
- [ ] Modal shows both options
- [ ] "Connect Business" still works
- [ ] "Connect Basic" redirects to Instagram OAuth
- [ ] Both flows complete successfully

## Key Differences

| Feature | Instagram Business | Instagram Basic Display |
|---------|-------------------|------------------------|
| **App Type** | Business/Any | Consumer only |
| **Credentials** | Facebook App ID/Secret | Instagram App ID/Secret |
| **OAuth URL** | facebook.com/dialog/oauth | instagram.com/oauth/authorize |
| **Publishing** | ✅ Yes | ❌ No |
| **Account Type** | Business/Creator | Personal |
| **Setup** | Already configured | Needs separate app |

## Files Modified

1. `apps/backend/src/services/oauth/InstagramOAuthService.ts`
   - Added smart filtering for connection options
   - Checks if Basic Display credentials are configured

2. `apps/backend/src/config/validateOAuthEnv.ts`
   - Updated validation to skip placeholder values
   - Added `isBasicDisplayConfigured` check

3. `apps/backend/.env`
   - Reset to placeholder values with clear comments
   - Separated from Instagram Business credentials

## Summary

✅ **Issue Resolved**: No more "Invalid platform app" errors
✅ **Smart Behavior**: Only shows options that are properly configured
✅ **User Experience**: Clean modal with only working options
✅ **Future Ready**: Will automatically show Basic Display when credentials are added

---

**Status**: ✅ RESOLVED  
**Current**: Instagram Business only (working)  
**Next**: Add Instagram Basic Display credentials to enable both options  

**Last Updated**: 2026-03-01 07:25 UTC
