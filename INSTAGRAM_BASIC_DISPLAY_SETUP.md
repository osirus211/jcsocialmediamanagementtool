# Instagram Basic Display API Setup Guide

## Current Status

The Instagram dual provider flow is implemented and working on the frontend. However, the Instagram Basic Display option returns a 500 error because the credentials are not configured.

## What You Need

You need to create an Instagram Basic Display app in the Facebook Developer Console and add the credentials to your `.env` file.

## Setup Steps

### 1. Create Instagram Basic Display App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Consumer" as the app type
4. Fill in app details and create the app
5. In the app dashboard, click "Add Product"
6. Find "Instagram Basic Display" and click "Set Up"

### 2. Configure Instagram Basic Display

1. In the Instagram Basic Display settings:
   - **Valid OAuth Redirect URIs**: Add `http://localhost:5000/api/v1/oauth/instagram/callback`
   - **Deauthorize Callback URL**: Add `http://localhost:5000/api/v1/oauth/instagram/deauthorize`
   - **Data Deletion Request URL**: Add `http://localhost:5000/api/v1/oauth/instagram/delete`
2. Click "Save Changes"

### 3. Get Your Credentials

1. In the Instagram Basic Display settings, find:
   - **Instagram App ID** (numeric, e.g., `123456789012345`)
   - **Instagram App Secret** (long string, e.g., `abc123def456...`)
2. Copy these values

### 4. Update Your .env File

Open `apps/backend/.env` and replace the placeholder values:

```env
# Instagram Basic Display API (for personal accounts)
INSTAGRAM_BASIC_APP_ID=your_actual_app_id_here
INSTAGRAM_BASIC_APP_SECRET=your_actual_app_secret_here
INSTAGRAM_BASIC_REDIRECT_URI=http://localhost:5000/api/v1/oauth/instagram/callback
```

Replace:
- `your_actual_app_id_here` with your Instagram App ID
- `your_actual_app_secret_here` with your Instagram App Secret

### 5. Add Test Users (Development Only)

Instagram Basic Display requires you to add test users in development:

1. In the Instagram Basic Display settings, scroll to "User Token Generator"
2. Click "Add or Remove Instagram Testers"
3. Add your Instagram username
4. Accept the invitation on Instagram (Settings → Apps and Websites → Tester Invites)

### 6. Restart Backend Server

After updating the `.env` file:

```bash
cd apps/backend
# Stop the server (Ctrl+C)
npm run dev
```

The server will now initialize the Instagram Basic Display provider.

## Verification

### Check Server Logs

When the server starts, you should see:

```
[OAuth Config] ✅ OAuth environment validation passed
OAuth Provider Factory initialized { availableProviders: [ 'INSTAGRAM_BUSINESS', 'INSTAGRAM_BASIC' ] }
Instagram Basic Display provider initialized
```

### Test the Flow

1. Go to http://localhost:5173
2. Navigate to Connected Accounts
3. Click "Connect" on Instagram
4. You should see a modal with two options:
   - **Instagram API with Facebook Login** (Business) - Recommended
   - **Instagram API with Instagram Login** (Basic Display)
5. Click "Connect Basic" to test the Basic Display flow
6. You should be redirected to Instagram's authorization page

## Production Setup

For production deployment:

1. Create a production Instagram Basic Display app (or use the same app)
2. Update redirect URIs to use your production domain with HTTPS:
   - `https://yourdomain.com/api/v1/oauth/instagram/callback`
3. Update `.env.production` with production credentials
4. The validation will enforce HTTPS in production mode

## Troubleshooting

### Error: "OAuth provider INSTAGRAM_BASIC is not configured"

- Check that all three environment variables are set in `.env`
- Restart the backend server after updating `.env`
- Check server logs for initialization errors

### Error: "Invalid OAuth redirect URI"

- Make sure the redirect URI in Facebook Developer Console matches exactly
- Include the protocol (`http://` or `https://`)
- No trailing slashes

### Error: "User not authorized as a tester"

- Add your Instagram account as a tester in the Facebook Developer Console
- Accept the tester invitation on Instagram
- Wait a few minutes for the change to propagate

## Current Implementation Status

✅ Backend infrastructure complete
✅ Frontend modal and flow complete
✅ Security patches applied
✅ Rate limiting configured
✅ Token lifecycle management implemented
⚠️ Waiting for Instagram Basic Display credentials

## Next Steps

1. Create Instagram Basic Display app in Facebook Developer Console
2. Add credentials to `apps/backend/.env`
3. Restart backend server
4. Test both Instagram connection flows
5. Verify end-to-end functionality
6. Remove debug console.log statements from frontend components
