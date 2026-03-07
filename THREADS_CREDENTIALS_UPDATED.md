# Threads Credentials Updated & Servers Restarted

## Updated Credentials

Updated Threads OAuth credentials in `apps/backend/.env`:
- **App ID**: 2018107795266132
- **App Secret**: 15bfa46cc128455912ab20845ab06f9d
- **Callback URL**: https://8f0b-103-233-122-147.ngrok-free.app/api/v1/oauth/threads/callback

## Ngrok Public URL

- **Public URL**: https://8f0b-103-233-122-147.ngrok-free.app
- **Local Target**: http://localhost:5000

## Server Status

All servers successfully restarted with ngrok URL:
- ✅ Frontend (Vite): http://localhost:5173/
- ✅ Backend (Express): http://localhost:5000
- ✅ Ngrok tunnel: https://8f0b-103-233-122-147.ngrok-free.app

## Important: Update Meta Developer Console

You need to update the Threads app settings in Meta Developer Console:
1. Go to https://developers.facebook.com/apps/2018107795266132
2. Navigate to Threads > Settings
3. Update the OAuth Redirect URI to: `https://8f0b-103-233-122-147.ngrok-free.app/api/v1/oauth/threads/callback`
4. Save changes

## Next Steps

The Threads integration is now configured with the new credentials and ngrok URL. You can:
1. Update the callback URL in Meta Developer Console (see above)
2. Test the Threads OAuth flow in your application
3. Connect a Threads account through the UI
4. Verify the OAuth callback is working correctly

All systems operational.
