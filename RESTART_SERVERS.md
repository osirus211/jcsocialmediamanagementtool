# Server Restart Instructions

## Current Status

✅ No compilation errors found
✅ Backend OAuth code is clean (no console.log statements)
✅ Frontend components are clean
✅ Field name mismatch fixed (backend now returns `name` and `description` instead of `label` and `requirements`)

## Issue

The Instagram Basic Display credentials in `.env` are still placeholders:
```env
INSTAGRAM_BASIC_APP_ID=your_instagram_basic_app_id_here
INSTAGRAM_BASIC_APP_SECRET=your_instagram_basic_app_secret_here
```

## What Will Work After Restart

✅ Modal will load and show both options correctly
✅ "Connect Business" button will work (redirects to Facebook OAuth)
❌ "Connect Basic" button will still return 500 error until you add real credentials

## Restart Instructions

### Option 1: Restart Both Servers

**Terminal 1 - Backend:**
```bash
cd apps/backend
# Press Ctrl+C to stop the current server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/frontend
# Press Ctrl+C to stop the current server
npm run dev
```

### Option 2: Use Process Manager (if running)

If you're using a process manager like PM2:
```bash
pm2 restart all
```

## Verify Backend Started Correctly

After restarting the backend, check the logs for:

```
[OAuth Config] ✅ OAuth environment validation passed
OAuth Provider Factory initialized
```

You should see:
- ✅ `Instagram Business provider initialized`
- ⚠️ `Instagram Basic Display provider not configured` (warning, not error)

This is expected because the credentials are placeholders.

## Test the Flow

1. Open http://localhost:5173
2. Navigate to Connected Accounts
3. Click "Connect" on Instagram
4. **Expected Result**: Modal appears with two options
5. Click "Connect Business" → Should redirect to Facebook OAuth ✅
6. Click "Connect Basic" → Will show 500 error until credentials are added ❌

## To Fix the "Connect Basic" 500 Error

You need to add real Instagram Basic Display credentials:

1. Go to https://developers.facebook.com/
2. Create an Instagram Basic Display app (or use existing)
3. Get your App ID and App Secret
4. Update `apps/backend/.env`:
   ```env
   INSTAGRAM_BASIC_APP_ID=123456789012345  # Your actual App ID
   INSTAGRAM_BASIC_APP_SECRET=abc123def456...  # Your actual App Secret
   ```
5. Restart backend server again
6. Both options will now work

## Quick Health Check

After restart, verify:

- [ ] Backend running on http://localhost:5000
- [ ] Frontend running on http://localhost:5173
- [ ] No compilation errors in terminal
- [ ] Backend logs show OAuth validation passed
- [ ] Modal loads when clicking "Connect Instagram"
- [ ] Both options are displayed in modal

## Need Help?

If you see errors after restart:
1. Check the terminal output for error messages
2. Check browser console (F12) for frontend errors
3. Verify both servers are running on correct ports
4. Make sure MongoDB and Redis are running

---

**Status**: Ready to restart
**Next**: Restart servers and test the modal
