# Twitter OAuth - Quick Reference

## 🚀 Quick Start (3 Steps)

### 1. Add Twitter Credentials

Edit `apps/backend/.env`:
```bash
OAUTH_TEST_MODE=false
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
```

### 2. Restart Backend

```bash
# Stop current server (Ctrl+C)
cd apps/backend
npm run dev
```

### 3. Test OAuth Flow

1. Go to http://localhost:5173/social/accounts
2. Click "Connect Account" → Twitter
3. Authorize on Twitter
4. Done! ✅

---

## 📋 API Endpoints

### Initiate OAuth
```bash
POST /api/v1/oauth/twitter/authorize
Authorization: Bearer {jwt_token}

Response:
{
  "success": true,
  "authorizationUrl": "https://twitter.com/i/oauth2/authorize?...",
  "state": "...",
  "platform": "twitter"
}
```

### OAuth Callback
```bash
GET /api/v1/oauth/twitter/callback?code={code}&state={state}

Redirects to:
- Success: /social/accounts?success=true&platform=twitter&account={id}
- Error: /social/accounts?error={code}&message={message}
```

### Get Platforms
```bash
GET /api/v1/oauth/platforms
Authorization: Bearer {jwt_token}

Response:
{
  "success": true,
  "platforms": ["twitter"],
  "features": {
    "oauth2": true,
    "pkce": true,
    "refreshTokens": true,
    "encryption": "AES-256-GCM"
  }
}
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| **CSRF Protection** | 256-bit state, Redis storage, 10-min TTL |
| **PKCE** | 256-bit verifier, SHA-256 challenge (S256) |
| **Token Encryption** | AES-256-GCM, automatic via Mongoose |
| **Duplicate Prevention** | Unique DB index + app-level check |
| **State Storage** | Redis (10 min TTL) with in-memory fallback |

---

## 🗄️ Database Schema

```javascript
{
  workspaceId: ObjectId,
  provider: "twitter",
  providerUserId: "123456789",
  accountName: "John Doe",
  accessToken: "1:salt:iv:tag:encrypted", // Encrypted
  refreshToken: "1:salt:iv:tag:encrypted", // Encrypted
  tokenExpiresAt: Date,
  scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  status: "active",
  connectionVersion: "v2",
  metadata: {
    username: "johndoe",
    profileUrl: "https://twitter.com/johndoe",
    avatarUrl: "https://...",
    followerCount: 1000
  }
}
```

---

## ⚠️ Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `INVALID_PLATFORM` | Platform not supported | Use 'twitter' |
| `STATE_INVALID` | Invalid/expired state | Retry OAuth flow |
| `TOKEN_EXCHANGE_FAILED` | Token exchange failed | Check credentials |
| `PROFILE_FETCH_FAILED` | Profile fetch failed | Check Twitter API |
| `DUPLICATE_ACCOUNT` | Account already connected | Use different account |

---

## 🔍 Debugging

### Check Logs
```bash
# Backend logs show:
[OAuth] Authorization initiated
[OAuth] Token exchange successful
[OAuth] Profile fetched
[OAuth] Account created
```

### Check Database
```bash
mongosh
use social-media-scheduler
db.socialaccounts.find({ provider: 'twitter' }).pretty()
```

### Check Platforms
```bash
curl http://localhost:5000/api/v1/oauth/platforms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🛠️ Twitter Developer Portal Setup

1. **Go to**: https://developer.twitter.com/en/portal/dashboard
2. **Create/Select App**
3. **Set Callback URL**: `http://localhost:5000/api/v1/oauth/twitter/callback`
4. **Enable Scopes**:
   - ✅ tweet.read
   - ✅ tweet.write
   - ✅ users.read
   - ✅ offline.access
5. **Copy Credentials**: Client ID + Client Secret → `.env`

---

## 📊 OAuth Flow Diagram

```
Frontend → Authorize → Backend
                        ↓
                  Generate State + PKCE
                  Store in Redis
                        ↓
Frontend ← Auth URL ← Backend
    ↓
Twitter Authorization
    ↓
Backend ← Callback ← Twitter
    ↓
Validate State
Exchange Code (PKCE)
Fetch Profile
Encrypt Tokens
Save to DB
    ↓
Frontend ← Redirect ← Backend
```

---

## ✅ Testing Checklist

- [ ] Add Twitter credentials to `.env`
- [ ] Set `OAUTH_TEST_MODE=false`
- [ ] Restart backend server
- [ ] Navigate to `/social/accounts`
- [ ] Click "Connect Account" → Twitter
- [ ] Authorize on Twitter
- [ ] Verify redirect to success page
- [ ] Check account in database
- [ ] Verify tokens are encrypted
- [ ] Check logs for success messages

---

## 🚨 Common Issues

### "Twitter OAuth not configured"
→ Add `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` to `.env`

### "Invalid or expired state"
→ Complete OAuth within 10 minutes

### "Account already connected"
→ Delete existing account or use different Twitter account

### "Token exchange failed"
→ Verify credentials and callback URL match

---

## 📚 Documentation

- **Full Implementation**: `TWITTER_OAUTH_PRODUCTION_IMPLEMENTATION.md`
- **Testing Guide**: `TWITTER_OAUTH_TESTING_GUIDE.md`
- **Summary**: `TWITTER_OAUTH_IMPLEMENTATION_SUMMARY.md`
- **Quick Reference**: This file

---

## 🎯 Production Deployment

```bash
# Update .env for production
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
TWITTER_CLIENT_ID=production-client-id
TWITTER_CLIENT_SECRET=production-client-secret
OAUTH_TEST_MODE=false

# Update Twitter callback URL
https://api.yourdomain.com/api/v1/oauth/twitter/callback
```

---

## 📞 Support

**Issues?**
1. Check `TWITTER_OAUTH_TESTING_GUIDE.md`
2. Review backend logs
3. Verify Twitter credentials
4. Check callback URL matches
5. Test with different account

**Status**: ✅ READY FOR TESTING

**Servers**:
- Backend: http://localhost:5000 ✅
- Frontend: http://localhost:5173 ✅
- MongoDB: Connected ✅
