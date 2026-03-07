# Enable YouTube Data API v3 - Fix Guide

## Error Message
```
Failed to fetch YouTube channel info: YouTube Data API v3 has not been used in project 801397712801 
before or it is disabled. Enable it by visiting 
https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=801397712801 
then retry.
```

## Root Cause
The YouTube Data API v3 is not enabled in your Google Cloud project. OAuth worked, but the API calls to fetch channel info are failing.

---

## Solution: Enable YouTube Data API v3

### Quick Fix (Direct Link)
**Click this link to enable the API directly:**
https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=801397712801

Then click the **"ENABLE"** button.

---

### Manual Steps

#### Step 1: Go to Google Cloud Console
1. Open: https://console.cloud.google.com/
2. Make sure you're in project: **801397712801**
   - Check the project dropdown at the top of the page

#### Step 2: Navigate to APIs & Services
1. Click the hamburger menu (☰) in the top-left
2. Click **"APIs & Services"**
3. Click **"Library"**

#### Step 3: Search for YouTube Data API
1. In the search box, type: **"YouTube Data API v3"**
2. Click on **"YouTube Data API v3"** from the results

#### Step 4: Enable the API
1. Click the **"ENABLE"** button
2. Wait for the API to be enabled (takes a few seconds)
3. You should see "API enabled" confirmation

#### Step 5: Verify API is Enabled
1. Go to **"APIs & Services"** → **"Enabled APIs & services"**
2. You should see **"YouTube Data API v3"** in the list

---

## After Enabling the API

### Wait Time
- **Immediate:** Usually works right away
- **If not:** Wait 2-5 minutes for changes to propagate

### Test Again
1. Go back to your app: http://localhost:5173
2. Go to **Connected Accounts**
3. **Disconnect** the YouTube account if it's showing (it's incomplete)
4. Click **"Connect Account"** → **"YouTube"** again
5. Complete the OAuth flow
6. This time it should fetch your channel info successfully

---

## What This API Does

The **YouTube Data API v3** allows your app to:
- ✅ Fetch channel information (name, ID, subscriber count)
- ✅ Read channel metadata
- ✅ Access public channel data

**Scope we're using:** `https://www.googleapis.com/auth/youtube.readonly`
- This is read-only access
- No posting or modifications
- Just fetching channel info

---

## Verification Steps

After enabling the API and reconnecting:

1. **Check Backend Logs:**
   ```
   [OAuth] YouTube account connected
   workspaceId: ...
   userId: ...
   accountId: ...
   ```

2. **Check Frontend:**
   - YouTube account should appear in Connected Accounts list
   - Should show your channel name
   - Should show subscriber count (if public)

3. **Check Database:**
   - SocialAccount document created
   - provider: "youtube"
   - providerUserId: your channel ID
   - accountName: your channel name
   - tokens encrypted and stored

---

## Common Issues

### Issue: "API still not working after enabling"
**Solution:**
- Wait 2-5 minutes for propagation
- Clear browser cache
- Try in incognito mode
- Restart backend server

### Issue: "Can't find Enable button"
**Solution:**
- Make sure you're in the correct project (801397712801)
- Check if API is already enabled (go to "Enabled APIs & services")

### Issue: "Don't have permission to enable APIs"
**Solution:**
- You need Editor or Owner role on the project
- Ask the project owner to enable it for you

---

## Current Status

✅ **OAuth Flow:** Working (you got past the consent screen)  
✅ **Token Exchange:** Working (got access token)  
❌ **API Call:** Failing (YouTube Data API v3 not enabled)  

**Next Step:** Enable YouTube Data API v3 and retry

---

## Quick Checklist

- [ ] Click the direct link: https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=801397712801
- [ ] Click "ENABLE" button
- [ ] Wait for confirmation
- [ ] Go back to your app
- [ ] Disconnect incomplete YouTube account (if showing)
- [ ] Connect YouTube again
- [ ] Verify channel info appears correctly

---

**Status:** Waiting for you to enable YouTube Data API v3 in Google Cloud Console
