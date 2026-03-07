# Google OAuth Error 403: access_denied - Fix Guide

## Error Message
```
grapper has not completed the Google verification process. 
The app is currently being tested, and can only be accessed by developer-approved testers.
Error 403: access_denied
```

## Root Cause
Your Google Cloud OAuth app is in **"Testing"** mode, which restricts access to only approved test users.

---

## Solution: Add Your Email as Test User

### Step 1: Go to Google Cloud Console
1. Open: https://console.cloud.google.com/
2. Select your project (the one with Client ID: `801397712801-bh15kem9v5koodj4er90iqd00gq8o0sc`)

### Step 2: Navigate to OAuth Consent Screen
1. In the left sidebar, click **"APIs & Services"**
2. Click **"OAuth consent screen"**

### Step 3: Add Test Users
1. Scroll down to the **"Test users"** section
2. Click **"+ ADD USERS"** button
3. Enter your Google email address (the one you're trying to connect YouTube with)
4. Click **"SAVE"**

### Step 4: Test Again
1. Go back to your app: http://localhost:5173
2. Try connecting YouTube again
3. You should now be able to proceed through the OAuth flow

---

## Alternative Solution: Publish the App (Not Recommended for Development)

If you want anyone to be able to use it:

1. Go to **OAuth consent screen**
2. Click **"PUBLISH APP"** button
3. **WARNING:** This requires Google verification if you're requesting sensitive scopes
4. For development, just add test users instead

---

## Quick Fix Steps

**Option 1: Add Your Email (Recommended for Development)**
```
1. Google Cloud Console → APIs & Services → OAuth consent screen
2. Scroll to "Test users" section
3. Click "+ ADD USERS"
4. Enter your email: your-email@gmail.com
5. Click "SAVE"
6. Try YouTube connection again
```

**Option 2: Use a Different Google Account**
- If you have access to the Google account that created the OAuth app
- That account should work automatically as the owner

---

## Verification

After adding your email as a test user:
1. ✅ You should see your email in the "Test users" list
2. ✅ Try the YouTube OAuth flow again
3. ✅ You should get past the consent screen
4. ✅ YouTube account should connect successfully

---

## Common Issues

### Issue: "Can't find OAuth consent screen"
**Solution:** 
- Make sure you're in the correct Google Cloud project
- Check the project dropdown at the top of the page

### Issue: "Don't have access to Google Cloud Console"
**Solution:**
- You need to be the project owner or have Editor role
- Ask the project owner to add you as a test user

### Issue: "Still getting 403 after adding email"
**Solution:**
- Wait 1-2 minutes for changes to propagate
- Clear browser cookies/cache
- Try in incognito mode
- Make sure you're using the exact email you added

---

## Current Configuration

**Google OAuth Client:**
- Client ID: `801397712801-bh15kem9v5koodj4er90iqd00gq8o0sc`
- Redirect URI: `http://localhost:5000/api/v1/oauth/youtube/callback`
- Scopes: `https://www.googleapis.com/auth/youtube.readonly`

**App Status:** Testing (requires approved test users)

---

## Next Steps

1. **Add your email as test user** in Google Cloud Console
2. **Wait 1-2 minutes** for changes to take effect
3. **Try YouTube connection again** from your app
4. **Check backend logs** for any errors during OAuth flow

---

**Status:** Waiting for you to add test user in Google Cloud Console
