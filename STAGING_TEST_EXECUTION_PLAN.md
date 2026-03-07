# Staging Test Execution Plan - Instagram Dual Provider Integration

**Date**: 2026-03-01  
**System**: Instagram Dual Provider Integration (INSTAGRAM_BUSINESS + INSTAGRAM_BASIC)  
**Environment**: Staging (production-like configuration)  
**Assumption**: Hostile environment - test all security controls

---

## Pre-Test Setup

### Environment Verification
```bash
# 1. Verify staging environment variables
echo $NODE_ENV  # Must be: production
echo $INSTAGRAM_BASIC_APP_ID  # Must be set
echo $INSTAGRAM_BASIC_APP_SECRET  # Must be set (32+ chars)
echo $INSTAGRAM_BASIC_REDIRECT_URI  # Must be HTTPS

# 2. Verify Redis is running
redis-cli ping  # Must return: PONG

# 3. Verify server starts successfully
npm start  # Must not throw validation errors

# 4. Verify log aggregation is capturing logs
tail -f /var/log/app.log | grep "\[Security\]"
```

### Test Data Preparation
- **Test User Account**: Create staging user account
- **Test Workspace**: Create staging workspace
- **Instagram Business Account**: Prepare real Instagram Business account
- **Instagram Basic Account**: Prepare real Instagram Basic Display account
- **Log Monitoring**: Open separate terminal for real-time log monitoring

---

## TEST CATEGORY 1: OAUTH FLOW TESTS

### Test A: Instagram Business Connect ✓

**Objective**: Verify Instagram Business OAuth flow works end-to-end with correct metadata.

**Prerequisites**:
- Staging user logged in
- Instagram Business account credentials ready
- No existing Instagram Business connection

**Steps**:
1. Navigate to `/social/accounts` in frontend
2. Click "Connect Instagram Business"
3. **Capture**: Authorization URL from network tab
4. **Verify**: URL contains `providerType=INSTAGRAM_BUSINESS` in state
5. Complete OAuth flow on Instagram/Facebook
6. **Capture**: Callback URL from browser
7. Wait for redirect to success page

**Database Verification**:
```bash
# Connect to staging MongoDB
mongo staging-db

# Query the created account
db.socialaccounts.findOne({
  provider: "instagram",
  providerType: "INSTAGRAM_BUSINESS"
}, {
  providerType: 1,
  accountType: 1,
  tokenExpiresAt: 1,
  accessToken: 1,
  connectionMetadata: 1,
  createdAt: 1
})
```

**Expected Results**:
- ✅ Account created in database
- ✅ `providerType: "INSTAGRAM_BUSINESS"`
- ✅ `accountType: "BUSINESS"`
- ✅ `tokenExpiresAt` is set (60 days from now)
- ✅ `accessToken` is encrypted (looks like random string, not readable)
- ✅ `connectionMetadata.type: "INSTAGRAM_BUSINESS"`
- ✅ `connectionMetadata.businessAccountId` is set
- ✅ Success redirect to `/social/accounts?success=true`

**Log Verification**:
```bash
# Search logs for OAuth flow
grep "Instagram connection initiated" /var/log/app.log | tail -1
grep "Instagram accounts connected" /var/log/app.log | tail -1

# Verify structured logging
grep "providerType.*INSTAGRAM_BUSINESS" /var/log/app.log | tail -1
```

**Pass Criteria**:
- Account saved with correct providerType
- Token encrypted in database
- Token expiration set correctly
- No errors in logs

**Fail Criteria**:
- Account not created
- providerType missing or incorrect
- Token stored in plaintext
- Errors in logs

**Rollback Trigger**: If account creation fails or providerType incorrect

---

### Test B: Instagram Basic Connect ✓

**Objective**: Verify Instagram Basic Display OAuth flow with long-lived token exchange.

**Prerequisites**:
- Staging user logged in
- Instagram Basic Display account credentials ready
- No existing Instagram Basic connection

**Steps**:
1. Navigate to `/social/accounts` in frontend
2. Click "Connect Instagram Basic Display"
3. **Capture**: Authorization URL from network tab
4. **Verify**: URL contains `providerType=INSTAGRAM_BASIC` in state
5. Complete OAuth flow on Instagram
6. Wait for two-step token exchange:
   - Step 1: Authorization code → short-lived token
   - Step 2: Short-lived token → long-lived token (60 days)
7. Wait for redirect to success page

**Database Verification**:
```bash
# Query the created account
db.socialaccounts.findOne({
  provider: "instagram",
  providerType: "INSTAGRAM_BASIC"
}, {
  providerType: 1,
  accountType: 1,
  tokenExpiresAt: 1,
  accessToken: 1,
  connectionMetadata: 1,
  createdAt: 1
})
```

**Expected Results**:
- ✅ Account created in database
- ✅ `providerType: "INSTAGRAM_BASIC"`
- ✅ `accountType: "PERSONAL"`
- ✅ `tokenExpiresAt` is set (60 days from now)
- ✅ `accessToken` is encrypted (long-lived token)
- ✅ `connectionMetadata.type: "INSTAGRAM_BASIC"`
- ✅ `connectionMetadata.longLivedTokenExpiresAt` is set
- ✅ Success redirect to `/social/accounts?success=true`

**Log Verification**:
```bash
# Verify two-step token exchange
grep "Token exchange initiated" /var/log/app.log | tail -2
grep "Long-lived token obtained" /var/log/app.log | tail -1

# Verify structured logging
grep "providerType.*INSTAGRAM_BASIC" /var/log/app.log | tail -1
```

**Pass Criteria**:
- Account saved with correct providerType
- Long-lived token obtained and encrypted
- Token expiration set to 60 days
- Two-step exchange completed successfully

**Fail Criteria**:
- Short-lived token not exchanged
- providerType incorrect
- Token expiration not set
- Errors in token exchange

**Rollback Trigger**: If long-lived token exchange fails

---

### Test C: Replay Attack Prevention ✓

**Objective**: Verify that reusing a callback URL fails and logs security event.

**Prerequisites**:
- Completed Test A or Test B
- Captured callback URL from successful OAuth flow

**Steps**:
1. **Capture**: Full callback URL from Test A or B
   - Example: `https://staging.app.com/api/v1/oauth/instagram/callback?code=ABC123&state=XYZ789`
2. Wait 5 seconds (ensure state is consumed)
3. **Replay**: Paste callback URL into browser and press Enter
4. **Observe**: Response

**Expected Results**:
- ✅ Redirect to error page: `/social/accounts?error=STATE_INVALID&message=Invalid%20or%20expired%20state`
- ✅ HTTP 302 redirect (not 500 error)
- ✅ No account created
- ✅ No database changes

**Log Verification**:
```bash
# Search for replay attempt log
grep "OAUTH_REPLAY_ATTEMPT detected" /var/log/app.log | tail -1

# Verify structured logging format
grep -A 5 "OAUTH_REPLAY_ATTEMPT" /var/log/app.log | tail -6
```

**Expected Log Entry**:
```json
{
  "level": "warn",
  "message": "[Security] OAUTH_REPLAY_ATTEMPT detected",
  "event": "OAUTH_REPLAY_ATTEMPT",
  "platform": "instagram",
  "state": "XYZ789...",
  "ipHash": "abc123..."
}
```

**Pass Criteria**:
- Callback fails with STATE_INVALID error
- OAUTH_REPLAY_ATTEMPT logged with correct format
- No account created or modified
- User sees friendly error message

**Fail Criteria**:
- Callback succeeds (CRITICAL SECURITY FAILURE)
- No security event logged
- Server crashes or returns 500 error

**Rollback Trigger**: If replay attack succeeds → IMMEDIATE ROLLBACK

---

### Test D: ProviderType Tampering Prevention ✓

**Objective**: Verify that missing or invalid providerType fails and logs security event.

**Prerequisites**:
- Access to Redis CLI
- Staging user logged in

**Steps**:
1. Initiate Instagram Business connect flow
2. **Capture**: State value from authorization URL
3. **Tamper**: Modify state in Redis to remove providerType
   ```bash
   # Connect to Redis
   redis-cli
   
   # Find the state key
   KEYS oauth:state:*
   
   # Get the state data
   GET oauth:state:XYZ789
   
   # Modify to remove providerType (or set to invalid value)
   # Parse JSON, remove providerType field, save back
   SET oauth:state:XYZ789 '{"workspaceId":"...","userId":"...","platform":"instagram"}'
   ```
4. Complete OAuth flow on Instagram
5. **Observe**: Callback response

**Expected Results**:
- ✅ Callback fails with error
- ✅ Redirect to: `/social/accounts?error=oauth_failed&message=OAuth%20state%20missing%20provider%20type`
- ✅ No account created
- ✅ No database changes

**Log Verification**:
```bash
# Search for provider type mismatch log
grep "OAUTH_PROVIDER_TYPE_MISMATCH detected" /var/log/app.log | tail -1

# Verify structured logging format
grep -A 5 "OAUTH_PROVIDER_TYPE_MISMATCH" /var/log/app.log | tail -6
```

**Expected Log Entry**:
```json
{
  "level": "error",
  "message": "[Security] OAUTH_PROVIDER_TYPE_MISMATCH detected",
  "event": "OAUTH_PROVIDER_TYPE_MISMATCH",
  "reason": "missing_provider_type",
  "state": "XYZ789...",
  "workspaceId": "..."
}
```

**Pass Criteria**:
- Callback fails with clear error message
- OAUTH_PROVIDER_TYPE_MISMATCH logged
- No account created
- Fail-closed behavior (no default fallback)

**Fail Criteria**:
- Callback succeeds with missing providerType (CRITICAL SECURITY FAILURE)
- Account created with wrong providerType
- No security event logged

**Rollback Trigger**: If tampering succeeds → IMMEDIATE ROLLBACK

---

## TEST CATEGORY 2: FEATURE ENFORCEMENT

### Test E: Publish with Instagram Business ✓

**Objective**: Verify Instagram Business accounts can publish content.

**Prerequisites**:
- Instagram Business account connected (from Test A)
- Test post content prepared

**Steps**:
1. Navigate to composer in frontend
2. Create a test post with text and image
3. Select Instagram Business account
4. Click "Publish"
5. **Observe**: Response

**Expected Results**:
- ✅ HTTP 200 OK response
- ✅ Post published successfully
- ✅ Post appears on Instagram Business account
- ✅ Success message shown to user

**Log Verification**:
```bash
# Verify publish attempt
grep "Publishing to Instagram" /var/log/app.log | tail -1
grep "Instagram publish successful" /var/log/app.log | tail -1
```

**Pass Criteria**:
- Post publishes successfully
- No errors in logs
- Content appears on Instagram

**Fail Criteria**:
- Publish fails
- 403 Forbidden returned
- Errors in logs

**Rollback Trigger**: If Business accounts cannot publish

---

### Test F: Publish with Instagram Basic ✓

**Objective**: Verify Instagram Basic Display accounts CANNOT publish (feature enforcement).

**Prerequisites**:
- Instagram Basic Display account connected (from Test B)
- Test post content prepared

**Steps**:
1. Navigate to composer in frontend
2. Create a test post with text and image
3. Select Instagram Basic Display account
4. Click "Publish"
5. **Observe**: Response

**Expected Results**:
- ✅ HTTP 403 Forbidden response
- ✅ Error message: "Instagram Basic Display accounts cannot publish content"
- ✅ Post NOT published
- ✅ User sees clear error message

**API Response Verification**:
```bash
# Check response from publish endpoint
curl -X POST https://staging.app.com/api/v1/composer/posts/POST_ID/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accountId": "BASIC_ACCOUNT_ID"}'

# Expected response:
# {
#   "success": false,
#   "error": "FEATURE_NOT_SUPPORTED",
#   "message": "Instagram Basic Display accounts cannot publish content. Please connect an Instagram Business account."
# }
```

**Log Verification**:
```bash
# Verify feature authorization check
grep "Feature authorization check" /var/log/app.log | tail -1
grep "FEATURE_NOT_SUPPORTED" /var/log/app.log | tail -1
```

**Pass Criteria**:
- Publish blocked with 403 Forbidden
- Clear error message returned
- No content published to Instagram
- Feature authorization middleware working

**Fail Criteria**:
- Publish succeeds (CRITICAL FEATURE ENFORCEMENT FAILURE)
- No error message shown
- Content published to Instagram Basic account

**Rollback Trigger**: If Basic accounts can publish → IMMEDIATE ROLLBACK

---

## TEST CATEGORY 3: TOKEN LIFECYCLE

### Test G: Force Expired Token ✓

**Objective**: Verify expired tokens are detected and return 401.

**Prerequisites**:
- Instagram account connected (Business or Basic)
- Access to staging database

**Steps**:
1. **Manually expire token** in database:
   ```bash
   # Connect to MongoDB
   mongo staging-db
   
   # Find the account
   db.socialaccounts.findOne({ provider: "instagram" })
   
   # Set tokenExpiresAt to past date
   db.socialaccounts.updateOne(
     { _id: ObjectId("ACCOUNT_ID") },
     { $set: { tokenExpiresAt: new Date("2026-01-01") } }
   )
   ```
2. Attempt to publish a post using this account
3. **Observe**: Response

**Expected Results**:
- ✅ HTTP 401 Unauthorized response
- ✅ Error message: "Instagram access token expired. Please reconnect your account."
- ✅ Account status updated to TOKEN_EXPIRING or REAUTH_REQUIRED
- ✅ User prompted to reconnect

**Log Verification**:
```bash
# Verify token expiration detection
grep "Token expired" /var/log/app.log | tail -1
grep "expirationGuard" /var/log/app.log | tail -1
```

**Pass Criteria**:
- API call blocked with 401
- Clear error message returned
- Account status updated
- Expiration guard working

**Fail Criteria**:
- API call succeeds with expired token
- No error returned
- Account status not updated

**Rollback Trigger**: If expired tokens are not detected

---

### Test H: Token Refresh ✓

**Objective**: Verify token refresh service works and extends expiration.

**Prerequisites**:
- Instagram account connected (Business or Basic)
- Access to staging database

**Steps**:
1. **Simulate near-expiry** in database:
   ```bash
   # Set tokenExpiresAt to 5 days from now (below 7-day threshold)
   db.socialaccounts.updateOne(
     { _id: ObjectId("ACCOUNT_ID") },
     { $set: { tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) } }
   )
   ```
2. **Trigger refresh service**:
   ```bash
   # Run token refresh job manually
   node apps/backend/scripts/refresh-tokens.js
   
   # OR trigger via API endpoint
   curl -X POST https://staging.app.com/api/v1/admin/refresh-tokens \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
3. **Verify** token was refreshed in database

**Database Verification**:
```bash
# Check updated token expiration
db.socialaccounts.findOne(
  { _id: ObjectId("ACCOUNT_ID") },
  { tokenExpiresAt: 1, lastRefreshedAt: 1, connectionMetadata: 1 }
)
```

**Expected Results**:
- ✅ `tokenExpiresAt` extended to ~60 days from now
- ✅ `lastRefreshedAt` updated to current timestamp
- ✅ `connectionMetadata.refreshFailureCount` reset to 0
- ✅ `connectionMetadata.lastRefreshAttempt` updated
- ✅ Account status remains ACTIVE

**Log Verification**:
```bash
# Verify refresh attempt
grep "Refreshing Instagram.*token" /var/log/app.log | tail -1
grep "token refreshed successfully" /var/log/app.log | tail -1

# Verify no TOKEN_REFRESH_FAILURE events
grep "TOKEN_REFRESH_FAILURE" /var/log/app.log | tail -1
# Should return: no matches (or old entries only)
```

**Pass Criteria**:
- Token expiration extended
- lastRefreshedAt updated
- Failure count reset
- No errors in logs

**Fail Criteria**:
- Token not refreshed
- Expiration not extended
- Errors in logs
- TOKEN_REFRESH_FAILURE logged

**Rollback Trigger**: If token refresh fails consistently

---

## TEST CATEGORY 4: RATE LIMITING

### Test I: Callback Flood ✓

**Objective**: Verify callback endpoint rate limiting (20 req/min per IP).

**Prerequisites**:
- Access to staging API
- Tool for rapid requests (curl, Postman, or custom script)

**Steps**:
1. **Prepare test script**:
   ```bash
   #!/bin/bash
   # callback-flood-test.sh
   
   CALLBACK_URL="https://staging.app.com/api/v1/oauth/instagram/callback"
   
   echo "Sending 25 rapid requests to callback endpoint..."
   
   for i in {1..25}; do
     RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
       "$CALLBACK_URL?code=test$i&state=test$i")
     echo "Request $i: HTTP $RESPONSE"
     
     # Small delay to ensure requests are rapid but not instant
     sleep 0.1
   done
   ```
2. **Execute test**:
   ```bash
   chmod +x callback-flood-test.sh
   ./callback-flood-test.sh
   ```
3. **Observe**: Response codes

**Expected Results**:
- ✅ Requests 1-20: HTTP 302 (redirect to error page - invalid state)
- ✅ Requests 21-25: HTTP 429 (Too Many Requests)
- ✅ Response headers on 429:
  - `X-RateLimit-Limit: 20`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: <timestamp>`
  - `Retry-After: <seconds>`

**Log Verification**:
```bash
# Verify rate limit triggered
grep "OAuth Rate Limit.*Limit exceeded" /var/log/app.log | tail -1

# Count rate limit events
grep "OAuth Rate Limit.*Limit exceeded" /var/log/app.log | wc -l
# Should be: 5 (requests 21-25)
```

**Pass Criteria**:
- First 20 requests processed (even if they fail validation)
- Requests 21+ return 429
- Rate limit headers present
- Rate limit logged

**Fail Criteria**:
- All 25 requests processed (rate limiting not working)
- No 429 responses
- No rate limit headers
- No rate limit logs

**Rollback Trigger**: If rate limiting not working → HIGH PRIORITY ROLLBACK

---

### Test J: Connect Flood ✓

**Objective**: Verify connect endpoint rate limiting (10 req/min per user).

**Prerequisites**:
- Staging user logged in
- Valid authentication token

**Steps**:
1. **Prepare test script**:
   ```bash
   #!/bin/bash
   # connect-flood-test.sh
   
   CONNECT_URL="https://staging.app.com/api/v1/oauth/instagram/connect"
   AUTH_TOKEN="YOUR_AUTH_TOKEN"
   
   echo "Sending 12 rapid requests to connect endpoint..."
   
   for i in {1..12}; do
     RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
       -X POST "$CONNECT_URL" \
       -H "Authorization: Bearer $AUTH_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"providerType": "INSTAGRAM_BUSINESS"}')
     echo "Request $i: HTTP $RESPONSE"
     
     sleep 0.1
   done
   ```
2. **Execute test**:
   ```bash
   chmod +x connect-flood-test.sh
   ./connect-flood-test.sh
   ```
3. **Observe**: Response codes

**Expected Results**:
- ✅ Requests 1-10: HTTP 200 (authorization URL returned)
- ✅ Requests 11-12: HTTP 429 (Too Many Requests)
- ✅ Response headers on 429:
  - `X-RateLimit-Limit: 10`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: <timestamp>`
  - `Retry-After: <seconds>`

**Log Verification**:
```bash
# Verify rate limit triggered
grep "OAuth Rate Limit.*Limit exceeded.*connect" /var/log/app.log | tail -1

# Count rate limit events
grep "OAuth Rate Limit.*Limit exceeded.*connect" /var/log/app.log | wc -l
# Should be: 2 (requests 11-12)
```

**Pass Criteria**:
- First 10 requests processed
- Requests 11+ return 429
- Rate limit headers present
- Rate limit logged

**Fail Criteria**:
- All 12 requests processed
- No 429 responses
- No rate limit headers

**Rollback Trigger**: If rate limiting not working → HIGH PRIORITY ROLLBACK

---

## TEST CATEGORY 5: LOGGING VERIFICATION

### Test K: Token Logging Audit ✓

**Objective**: Verify NO sensitive data appears in logs.

**Prerequisites**:
- Completed Tests A-J (generates comprehensive logs)
- Access to staging logs

**Steps**:
1. **Search for sensitive patterns** in logs:
   ```bash
   # Search for access tokens
   grep -i "accessToken" /var/log/app.log | grep -v "accessToken:" | grep -v "accessTokenSet"
   # Expected: No matches (or only safe metadata like "accessTokenSet: true")
   
   # Search for refresh tokens
   grep -i "refreshToken" /var/log/app.log | grep -v "refreshToken:" | grep -v "refreshTokenSet"
   # Expected: No matches
   
   # Search for OAuth codes
   grep -i "code:" /var/log/app.log | grep -v "errorCode" | grep -v "statusCode"
   # Expected: No matches (or only error codes)
   
   # Search for response bodies
   grep -i "response.data" /var/log/app.log
   # Expected: No matches
   
   grep -i "tokenResponse.data" /var/log/app.log
   # Expected: No matches
   
   # Search for console.log statements
   grep "console.log" /var/log/app.log
   # Expected: No matches
   ```

2. **Verify structured logging format**:
   ```bash
   # Check security events have correct format
   grep "\[Security\]" /var/log/app.log | tail -10
   
   # Verify each event has 'event' field
   grep "\[Security\]" /var/log/app.log | grep -v '"event":' 
   # Expected: No matches (all security logs have event field)
   ```

3. **Sample log entries** for manual review:
   ```bash
   # Get sample of OAuth flow logs
   grep "OAuth" /var/log/app.log | tail -50 > oauth-logs-sample.txt
   
   # Manually review for any sensitive data
   less oauth-logs-sample.txt
   ```

**Expected Results**:
- ✅ NO access tokens in logs
- ✅ NO refresh tokens in logs
- ✅ NO OAuth codes in logs
- ✅ NO response bodies in logs
- ✅ NO console.log statements in logs
- ✅ All security events have structured format
- ✅ Only safe metadata logged (IDs, step names, durations)

**Pass Criteria**:
- Zero matches for sensitive patterns
- All security events properly formatted
- Only safe metadata in logs

**Fail Criteria**:
- ANY tokens found in logs (CRITICAL SECURITY FAILURE)
- ANY OAuth codes in logs
- ANY response bodies in logs
- console.log statements present

**Rollback Trigger**: If tokens found in logs → IMMEDIATE ROLLBACK

---

## COMPREHENSIVE TEST EXECUTION CHECKLIST

### Pre-Test Phase
- [ ] Staging environment configured with production-like settings
- [ ] All environment variables set and validated
- [ ] Redis running and accessible
- [ ] MongoDB running and accessible
- [ ] Log aggregation configured
- [ ] Test accounts prepared (user, workspace, Instagram accounts)
- [ ] Monitoring dashboard open
- [ ] Rollback plan documented

### Test Execution Phase
- [ ] Test A: Instagram Business Connect
- [ ] Test B: Instagram Basic Connect
- [ ] Test C: Replay Attack Prevention
- [ ] Test D: ProviderType Tampering Prevention
- [ ] Test E: Publish with Instagram Business
- [ ] Test F: Publish with Instagram Basic (403 expected)
- [ ] Test G: Force Expired Token
- [ ] Test H: Token Refresh
- [ ] Test I: Callback Flood (rate limiting)
- [ ] Test J: Connect Flood (rate limiting)
- [ ] Test K: Token Logging Audit

### Post-Test Phase
- [ ] All tests passed
- [ ] No critical failures
- [ ] Logs reviewed for anomalies
- [ ] Database state verified
- [ ] Performance metrics acceptable
- [ ] Security events logged correctly
- [ ] Test report generated

---

## ROLLBACK TRIGGERS

### IMMEDIATE ROLLBACK (Critical Security Failures)
1. **Replay attack succeeds** (Test C fails)
   - State can be reused
   - No OAUTH_REPLAY_ATTEMPT logged
   
2. **ProviderType tampering succeeds** (Test D fails)
   - Missing providerType accepted
   - Account created with wrong type
   
3. **Feature enforcement fails** (Test F fails)
   - Instagram Basic can publish content
   - 403 not returned
   
4. **Tokens in logs** (Test K fails)
   - Access tokens visible in logs
   - OAuth codes visible in logs

### HIGH PRIORITY ROLLBACK (Security/Stability Issues)
1. **Rate limiting not working** (Tests I or J fail)
   - All requests processed
   - No 429 responses
   
2. **Token refresh fails consistently** (Test H fails)
   - Tokens not refreshed
   - Expiration not extended

### MEDIUM PRIORITY ROLLBACK (Functional Issues)
1. **OAuth flows fail** (Tests A or B fail)
   - Accounts not created
   - Tokens not stored correctly
   
2. **Expired token detection fails** (Test G fails)
   - Expired tokens accepted
   - No 401 returned

---

## SUCCESS CRITERIA

### All Tests Must Pass
- ✅ 11/11 tests passed
- ✅ Zero critical failures
- ✅ Zero high-priority failures
- ✅ All security events logged correctly
- ✅ No sensitive data in logs
- ✅ Rate limiting working
- ✅ Feature enforcement working

### Performance Criteria
- Response times < 2 seconds for OAuth flows
- Database queries < 100ms
- Rate limiting overhead < 10ms
- No memory leaks during flood tests

### Security Criteria
- Zero tokens in logs
- All replay attacks blocked
- All tampering attempts blocked
- All security events logged with correct format

---

## TEST REPORT TEMPLATE

```markdown
# Staging Test Execution Report

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**: Staging
**Duration**: [X hours]

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| A: Instagram Business Connect | ✅ PASS | Account created successfully |
| B: Instagram Basic Connect | ✅ PASS | Long-lived token obtained |
| C: Replay Attack Prevention | ✅ PASS | Replay blocked, event logged |
| D: ProviderType Tampering | ✅ PASS | Tampering blocked, event logged |
| E: Publish with Business | ✅ PASS | Content published successfully |
| F: Publish with Basic | ✅ PASS | 403 returned as expected |
| G: Force Expired Token | ✅ PASS | 401 returned, account updated |
| H: Token Refresh | ✅ PASS | Token refreshed, expiration extended |
| I: Callback Flood | ✅ PASS | Rate limit at 20 req/min |
| J: Connect Flood | ✅ PASS | Rate limit at 10 req/min |
| K: Token Logging Audit | ✅ PASS | No sensitive data in logs |

## Overall Status: ✅ READY FOR PRODUCTION

## Critical Findings
[None / List any critical issues]

## Recommendations
[Any recommendations for production deployment]

## Rollback Decision
[PROCEED / ROLLBACK]

## Sign-off
- Tester: [Name] [Date]
- Tech Lead: [Name] [Date]
- Security Review: [Name] [Date]
```

---

## APPENDIX: USEFUL COMMANDS

### Log Monitoring
```bash
# Real-time security events
tail -f /var/log/app.log | grep "\[Security\]"

# Real-time OAuth events
tail -f /var/log/app.log | grep "\[OAuth\]"

# Search for specific event
grep "OAUTH_REPLAY_ATTEMPT" /var/log/app.log

# Count security events
grep "\[Security\]" /var/log/app.log | wc -l
```

### Database Queries
```bash
# Count Instagram accounts by provider type
db.socialaccounts.aggregate([
  { $match: { provider: "instagram" } },
  { $group: { _id: "$providerType", count: { $sum: 1 } } }
])

# Find accounts with expired tokens
db.socialaccounts.find({
  provider: "instagram",
  tokenExpiresAt: { $lt: new Date() }
})

# Check token encryption
db.socialaccounts.findOne(
  { provider: "instagram" },
  { accessToken: 1 }
)
# accessToken should look like: "enc:abc123..." (encrypted)
```

### Redis Queries
```bash
# Check rate limit keys
redis-cli KEYS "oauth:ratelimit:*"

# Check state keys
redis-cli KEYS "oauth:state:*"

# Get rate limit count
redis-cli GET "oauth:ratelimit:callback:HASHED_IP"

# Check TTL
redis-cli TTL "oauth:ratelimit:callback:HASHED_IP"
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-01  
**Prepared By**: Kiro AI Assistant  
**Review Status**: Ready for Execution
