# Milestone 1: Quick Reference

**Goal**: V2 OAuth for NEW accounts only  
**Time**: 3-5 days  
**Risk**: LOW

---

## 🎯 What We Did

1. Implemented `/api/v1/oauth-v2/:platform/authorize`
2. Implemented `/api/v1/oauth-v2/:platform/callback`
3. Reused V1 encryption utility (same format)
4. Created NEW accounts with `connectionVersion: 'v2'`
5. Return error if account exists (no upgrade)
6. Added 5 minimal error codes
7. Added 4 unit tests

---

## 🚫 What We Didn't Do

- ❌ V1→V2 upgrade (defer to Milestone 3)
- ❌ HMAC state validation (defer to later)
- ❌ IP binding (defer to later)
- ❌ PKCE (defer to later)
- ❌ Security audit logging (defer to later)

---

## 📝 V2 OAuth Flow

**Authorize**:
```
POST /api/v1/oauth-v2/:platform/authorize
→ Reuse V1 provider
→ Store state (reuse V1)
→ Redirect to OAuth provider
```

**Callback**:
```
GET /api/v1/oauth-v2/:platform/callback
→ Validate state (reuse V1)
→ Exchange code (reuse V1)
→ Fetch profile (reuse V1)
→ Check if account exists
  ✅ New: Create with connectionVersion='v2'
  ❌ Exists: Return error (no upgrade)
→ Encrypt tokens (reuse V1)
→ Save account
→ Redirect to frontend
```

---

## 🔧 V2 Account Structure

```typescript
{
  connectionVersion: 'v2', // NEW
  // ... all other fields same as V1
  accessToken: encrypt(token), // Same V1 encryption
  refreshToken: encrypt(token), // Same V1 encryption
}
```

---

## ⚠️ Error Codes

1. `ACCOUNT_EXISTS` - Account already connected
2. `INVALID_PLATFORM` - Invalid platform
3. `STATE_INVALID` - Invalid or expired state
4. `TOKEN_EXCHANGE_FAILED` - Token exchange failed
5. `PROFILE_FETCH_FAILED` - Profile fetch failed

---

## ✅ Testing

**Run tests**:
```bash
npm test -- OAuthControllerV2.milestone1.test.ts
```

**Expected**: 4 tests pass

**Staging tests**:
1. Create NEW V2 account (Twitter)
2. Try existing V1 account (should error)
3. Publish from V2 account

---

## 🚀 Deployment

**Staging**:
```bash
npm run deploy:staging
# Test V2 OAuth flow
# Test existing account error
# Test publishing
```

**Production**:
```bash
npm run deploy:production
# Enable for internal testing only
# Monitor for 24 hours
```

---

## 📊 Success Criteria

- ✅ NEW V2 accounts created
- ✅ V2 uses same encryption as V1
- ✅ V2 accounts can publish
- ✅ Existing V1 accounts return error
- ✅ V1 OAuth unchanged

---

## 🔙 Rollback

```bash
git revert <commit-hash>
npm run deploy:production
# No data cleanup needed
```

**Time**: 5 minutes  
**Data Loss**: None

---

## 🎉 Next: Milestone 2

**Scope**: Rollback Script + Monitoring (Week 3)

---

**Files Modified**: 1  
**Files Created**: 3  
**Tests Added**: 4  
**Risk**: LOW  
**Reuses V1**: 100%
