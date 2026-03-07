# LinkedIn OAuth - Quick Setup Guide

**Status:** ✅ Code deployed, server restarted  
**Next:** Add LinkedIn credentials

---

## Current Status

✅ Backend code complete and running  
✅ Frontend UI ready  
❌ LinkedIn credentials needed

---

## Quick Setup (5 minutes)

### Step 1: Create LinkedIn App

1. **Go to:** https://www.linkedin.com/developers/apps
2. **Click:** "Create app"
3. **Fill in:**
   - App name: "Your App Name"
   - LinkedIn Page: Select or create
   - Upload logo
   - Accept terms
4. **Click:** "Create app"

### Step 2: Get Credentials

1. **Go to:** "Auth" tab
2. **Copy:**
   - Client ID
   - Client Secret

### Step 3: Add Redirect URI

1. **In "Auth" tab:**
2. **Under "OAuth 2.0 settings":**
3. **Click:** "Add redirect URL"
4. **Enter:** `http://localhost:5000/api/v1/oauth/linkedin/callback`
5. **Click:** "Update"

### Step 4: Request Products

1. **Go to:** "Products" tab
2. **Request:**
   - ✅ "Sign In with LinkedIn using OpenID Connect" (instant approval)
   - ✅ "Share on LinkedIn" (may need review)

### Step 5: Update .env

Edit `apps/backend/.env`:

```env
LINKEDIN_CLIENT_ID=paste-your-client-id-here
LINKEDIN_CLIENT_SECRET=paste-your-client-secret-here
LINKEDIN_CALLBACK_URL=http://localhost:5000/api/v1/oauth/linkedin/callback
```

### Step 6: Restart Backend

The server will automatically reload, or restart manually:

```bash
# Kill and restart
taskkill /F /IM node.exe
cd apps/backend
npm run dev
```

### Step 7: Test

1. Go to http://localhost:5173
2. Navigate to "Connected Accounts"
3. Click "Connect Account"
4. Select "LinkedIn"
5. Complete OAuth flow
6. ✅ Account should appear!

---

## Troubleshooting

### "LinkedIn OAuth not configured"
- Check credentials in .env
- Restart backend server
- Verify no typos in Client ID/Secret

### "Redirect URI mismatch"
- Verify exact match: `http://localhost:5000/api/v1/oauth/linkedin/callback`
- No trailing slash
- Use http (not https) for localhost

### "Invalid scope"
- Ensure "Sign In with LinkedIn" product is added
- May need to wait for approval

---

## What You'll Get

After connecting LinkedIn:
- ✅ User profile information
- ✅ Email address
- ✅ Profile picture
- ✅ Ability to post (if "Share" product approved)

---

**Ready to test once you add credentials!** 🚀
