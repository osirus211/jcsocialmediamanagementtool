# Milestone 1: Testing Guide

**Goal**: Verify V2 OAuth flow works end-to-end  
**Time**: 1-2 hours  
**Environment**: Staging

---

## Prerequisites

### Backend
- [ ] Milestone 0 deployed (schema + workers)
- [ ] Milestone 1 backend deployed (V2 controller)
- [ ] Backend running on staging
- [ ] OAuth credentials configured (Twitter, LinkedIn, Facebook, Instagram)

### Frontend
- [ ] Milestone 1 frontend deployed
- [ ] Frontend running on staging
- [ ] `VITE_API_URL` configured correctly

### Database
- [ ] MongoDB accessible
- [ ] Can query SocialAccount collection

---

## Test 1: Connect NEW V2 Account (Happy Path)

### Steps
1. **Navigate to V2 page**
   ```
   http://staging.yourdomain.com/connect-v2
   ```

2. **Verify platform list loads**
   - Should see 4 platforms: Twitter, LinkedIn, Facebook, Instagram
   - Each platform has "Connect" button
   - No errors in console

3. **Click "Connect" for Twitter**
   - Should redirect to Twitter OAuth page
   - URL should be: `https://twitter.com/i/oauth2/authorize?...`

4. **Authorize on Twitter**
   - Click "Authorize app" on Twitter
   - Should redirect back to your app

5. **Verify success**
   - Should redirect to `/connect-v2?success=true&platform=twitter&account=...`
   - Should show success alert: "✅ Success! Connected twitter account"
   - URL should clean up to `/connect-v2`

6. **Verify in database**
   ```javascript
   db.socialaccounts.findOne({ provider: 'twitter' })
   ```
   - Should have `connectionVersion: 'v2'`
   - Should have `status: 'active'`
   - Should have encrypted `accessToken` and `refreshToken`

### Expected Result
✅ NEW V2 account created successfully

---

## Test 2: Existing V1 Account Returns Error

### Steps
1. **Create V1 account first**
   - Use V1 OAuth flow: `/oauth/twitter/authorize`
   - Complete authorization
   - Verify account created with `connectionVersion: undefined`

2. **Try V2 flow with same account**
   - Navigate to `/connect-v2`
   - Click "Connect" for Twitter
   - Authorize on Twitter (same account)

3. **Verify error**
   - Should redirect to `/connect-v2?error=ACCOUNT_EXISTS&message=...`
   - Should show error message: "❌ Error: Account already connected"
   - Should NOT create new account

4. **Verify in database**
   ```javascript
   db.socialaccounts.find({ provider: 'twitter' }).count()
   ```
   - Should still be 1 account (V1 account)
   - V1 account should be unchanged
   - `connectionVersion` should still be `undefined`

### Expected Result
✅ Error returned, V1 account NOT modified

---

## Test 3: Publish from V2 Account

### Steps
1. **Create V2 account** (from Test 1)

2. **Create post for V2 account**
   - Navigate to `/posts/create`
   - Select V2 account
   - Write post content
   - Schedule post

3. **Wait for publish**
   - Check PublishingWorker logs
   - Should see: `connectionVersion: 'v2'`

4. **Verify post published**
   - Check post status: should be `published`
   - Check platform: post should appear on Twitter
   - Check logs: no errors

### Expected Result
✅ V2 account can publish successfully

---

## Test 4: Multiple Platforms

### Steps
1. **Connect Twitter** (from Test 1)
2. **Connect LinkedIn**
   - Click "Connect" for LinkedIn
   - Authorize on LinkedIn
   - Verify success

3. **Connect Facebook**
   - Click "Connect" for Facebook
   - Authorize on Facebook
   - Verify success

4. **Verify in database**
   ```javascript
   db.socialaccounts.find({ connectionVersion: 'v2' }).count()
   ```
   - Should have 3 accounts (Twitter, LinkedIn, Facebook)
   - All should have `connectionVersion: 'v2'`

### Expected Result
✅ Multiple V2 accounts created

---

## Test 5: Error Handling

### Test 5a: Invalid Platform
1. Navigate to `/api/v1/oauth-v2/invalid/authorize`
2. Should return 400 error

### Test 5b: Missing OAuth Credentials
1. Remove Twitter OAuth credentials from backend
2. Try to connect Twitter
3. Should return error

### Test 5c: OAuth Denial
1. Click "Connect" for Twitter
2. Click "Cancel" on Twitter OAuth page
3. Should redirect with error

### Expected Result
✅ Errors handled gracefully

---

## Verification Checklist

### Backend
- [ ] V2 controller responds to `/oauth-v2/platforms`
- [ ] V2 controller redirects to OAuth provider
- [ ] V2 controller handles callback
- [ ] V2 controller creates account with `connectionVersion='v2'`
- [ ] V2 controller returns error if account exists
- [ ] Logs show `[V2]` prefix

### Frontend
- [ ] Platform list loads
- [ ] Connect button works
- [ ] OAuth redirect works
- [ ] Success callback shows alert
- [ ] Error callback shows message
- [ ] No TypeScript errors
- [ ] No console errors

### Database
- [ ] V2 accounts have `connectionVersion='v2'`
- [ ] V2 accounts use same encryption as V1
- [ ] V1 accounts unchanged
- [ ] No duplicate accounts

### Workers
- [ ] PublishingWorker logs `connectionVersion='v2'`
- [ ] TokenRefreshWorker preserves `connectionVersion`
- [ ] Posts publish successfully from V2 accounts

---

## Common Issues

### Issue 1: Platform list doesn't load
**Symptom**: Empty platform list or error message  
**Cause**: API URL not configured or backend not running  
**Fix**: Check `VITE_API_URL` environment variable

### Issue 2: OAuth redirect fails
**Symptom**: 404 or 500 error after clicking Connect  
**Cause**: Backend route not registered or OAuth credentials missing  
**Fix**: Check backend logs, verify OAuth credentials

### Issue 3: Callback shows error
**Symptom**: Error message after OAuth authorization  
**Cause**: State validation failed or account already exists  
**Fix**: Check backend logs for detailed error

### Issue 4: Success but no account in database
**Symptom**: Success message but account not found  
**Cause**: Database connection issue or save failed  
**Fix**: Check backend logs, verify MongoDB connection

---

## Success Criteria

All tests pass if:
- ✅ NEW V2 accounts can be created
- ✅ V2 accounts have `connectionVersion='v2'`
- ✅ V2 accounts use same encryption as V1
- ✅ Existing V1 accounts return error
- ✅ V2 accounts can publish posts
- ✅ Multiple platforms work
- ✅ Errors handled gracefully
- ✅ No console errors
- ✅ No backend errors

---

## Monitoring (24 Hours)

After successful testing, monitor:
- [ ] V2 OAuth success rate > 95%
- [ ] V1 OAuth success rate unchanged
- [ ] No errors in logs
- [ ] V2 accounts publishing successfully
- [ ] No duplicate accounts created

---

## Rollback Triggers

Rollback if:
- ❌ V2 OAuth success rate < 90%
- ❌ V1 OAuth degraded
- ❌ Errors in logs
- ❌ V2 accounts can't publish
- ❌ Duplicate accounts created

---

**Testing Time**: 1-2 hours  
**Status**: Ready for testing  
**Next**: Deploy to production after successful staging tests
