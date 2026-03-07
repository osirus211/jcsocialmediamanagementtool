# Milestone 0: Minimal Safe Implementation

**Goal**: Ship Milestone 0 safely within 1-2 days  
**Scope**: Add optional connectionVersion field, patch workers for dual compatibility  
**Risk Level**: MINIMAL (additive changes only, no behavior change for existing V1 flows)

---

## IMPLEMENTATION SCOPE

### What We're Doing
1. Add optional `connectionVersion` field to SocialAccount schema
2. Patch PublishingWorker to default undefined to 'v1'
3. Ensure TokenRefreshWorker never modifies connectionVersion
4. Add 4 unit tests to verify safety

### What We're NOT Doing
- ❌ Creating indexes (defer to later)
- ❌ Adding securityMetadata, scopeValidation, migrationStatus fields (defer to later)
- ❌ Modifying V1 controller (defer to later)
- ❌ Creating SecurityAuditService (defer to later)
- ❌ Any V2 routes or controllers (defer to later)

---

## PART 1: SCHEMA PATCH

### File: `apps/backend/src/models/SocialAccount.ts`

**Add this field to the ISocialAccount interface:**

```typescript
// Add after existing fields, before the closing brace
connectionVersion?: 'v1' | 'v2';  // Optional field for V1/V2 tracking
```

**Add this to the Mongoose schema definition:**

```typescript
// Add after existing schema fields, before the closing brace
connectionVersion: {
  type: String,
  enum: ['v1', 'v2'],
  required: false,  // CRITICAL: Must be optional for backward compatibility
  default: undefined  // CRITICAL: No default for existing accounts
}
```

**Verification**:
- [ ] Field is optional (`required: false`)
- [ ] Field has no default value for existing accounts
- [ ] Field accepts 'v1' or 'v2' only
- [ ] Existing V1 accounts will have `connectionVersion: undefined`

---

## PART 2: PUBLISHING WORKER PATCH

### File: `apps/backend/src/workers/PublishingWorker.ts`

**Find the token decryption logic and add version normalization:**

```typescript
// BEFORE (existing code):
async function publishPost(post: IPublishQueue) {
  const account = await SocialAccount.findById(post.accountId)
    .select('+accessToken +refreshToken');
  
  if (!account) {
    throw new Error('Account not found');
  }
  
  // Decrypt tokens
  const accessToken = decrypt(account.accessToken, account.encryptionKeyVersion);
  // ... rest of publishing logic
}

// AFTER (patched code):
async function publishPost(post: IPublishQueue) {
  const account = await SocialAccount.findById(post.accountId)
    .select('+accessToken +refreshToken +connectionVersion');  // ✅ Add connectionVersion
  
  if (!account) {
    throw new Error('Account not found');
  }
  
  // ✅ NORMALIZE: Default undefined to 'v1' for logging
  const version = account.connectionVersion ?? 'v1';
  
  logger.info('Publishing post', {
    accountId: account._id,
    provider: account.provider,
    connectionVersion: version,  // ✅ Log version for monitoring
    postId: post._id
  });
  
  // Decrypt tokens (same logic for V1 and V2 - both use V1 encryption)
  const accessToken = decrypt(account.accessToken, account.encryptionKeyVersion);
  // ... rest of publishing logic (unchanged)
}
```

**Key Changes**:
1. Add `+connectionVersion` to select query
2. Normalize undefined to 'v1' for logging: `const version = account.connectionVersion ?? 'v1'`
3. Log connectionVersion for monitoring
4. No change to decryption logic (V1 and V2 use same encryption)

**Verification**:
- [ ] Worker reads connectionVersion field
- [ ] Worker normalizes undefined to 'v1'
- [ ] Worker logs connectionVersion
- [ ] Worker uses same decryption for all versions

---

## PART 3: TOKEN REFRESH WORKER PATCH

### File: `apps/backend/src/workers/TokenRefreshWorker.ts`

**Find the token update logic and ensure connectionVersion is NOT modified:**

```typescript
// BEFORE (existing code):
async function refreshToken(accountId: ObjectId) {
  const account = await SocialAccount.findById(accountId)
    .select('+accessToken +refreshToken');
  
  // ... decrypt, call provider API, encrypt new tokens ...
  
  // Update account with new tokens
  await SocialAccount.updateOne(
    { _id: accountId },
    {
      $set: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: newExpiresAt,
        lastRefreshedAt: Date.now(),
        status: 'active',
        updatedAt: Date.now()
      }
    }
  );
}

// AFTER (patched code):
async function refreshToken(accountId: ObjectId) {
  const account = await SocialAccount.findById(accountId)
    .select('+accessToken +refreshToken +connectionVersion');  // ✅ Add connectionVersion
  
  // ✅ NORMALIZE: Default undefined to 'v1' for logging
  const version = account.connectionVersion ?? 'v1';
  
  logger.info('Starting token refresh', {
    accountId: accountId,
    provider: account.provider,
    connectionVersion: version  // ✅ Log version for monitoring
  });
  
  // ... decrypt, call provider API, encrypt new tokens ...
  
  // ✅ CRITICAL: Update ONLY token fields, NEVER modify connectionVersion
  await SocialAccount.updateOne(
    { _id: accountId },
    {
      $set: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: newExpiresAt,
        lastRefreshedAt: Date.now(),
        status: 'active',
        updatedAt: Date.now()
        // ✅ CRITICAL: connectionVersion NOT in $set (preserved)
      }
    }
  );
  
  logger.info('Token refreshed successfully', {
    accountId: accountId,
    provider: account.provider,
    connectionVersion: version,
    note: 'connectionVersion preserved'  // ✅ Confirm preservation
  });
}
```

**Key Changes**:
1. Add `+connectionVersion` to select query
2. Normalize undefined to 'v1' for logging: `const version = account.connectionVersion ?? 'v1'`
3. Log connectionVersion before and after refresh
4. Ensure connectionVersion is NOT in $set update (it's preserved)

**Verification**:
- [ ] Worker reads connectionVersion field
- [ ] Worker normalizes undefined to 'v1'
- [ ] Worker logs connectionVersion before and after
- [ ] Worker does NOT include connectionVersion in $set update
- [ ] connectionVersion is preserved (not modified)

---

## PART 4: UNIT TESTS

### File: `apps/backend/src/workers/__tests__/PublishingWorker.test.ts`

```typescript
describe('PublishingWorker - Milestone 0 Compatibility', () => {
  
  test('V1 publish unchanged - legacy account with undefined connectionVersion', async () => {
    // Create V1 account (connectionVersion undefined)
    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerUserId: 'test123',
      accessToken: encryptedToken,
      refreshToken: encryptedRefreshToken,
      // connectionVersion: undefined (not set)
    });
    
    const post = await PublishQueue.create({
      accountId: account._id,
      content: 'Test post',
      status: 'pending'
    });
    
    // Publish post
    await publishPost(post);
    
    // Verify: Post published successfully
    const updatedPost = await PublishQueue.findById(post._id);
    expect(updatedPost.status).toBe('published');
    
    // Verify: Account connectionVersion still undefined (unchanged)
    const updatedAccount = await SocialAccount.findById(account._id);
    expect(updatedAccount.connectionVersion).toBeUndefined();
  });
  
  test('Undefined version treated as V1 - worker logs correctly', async () => {
    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerUserId: 'test456',
      accessToken: encryptedToken,
      // connectionVersion: undefined
    });
    
    const post = await PublishQueue.create({
      accountId: account._id,
      content: 'Test post',
      status: 'pending'
    });
    
    // Spy on logger
    const loggerSpy = jest.spyOn(logger, 'info');
    
    await publishPost(post);
    
    // Verify: Logger called with normalized version 'v1'
    expect(loggerSpy).toHaveBeenCalledWith(
      'Publishing post',
      expect.objectContaining({
        connectionVersion: 'v1'  // undefined normalized to 'v1'
      })
    );
  });
  
});
```

### File: `apps/backend/src/workers/__tests__/TokenRefreshWorker.test.ts`

```typescript
describe('TokenRefreshWorker - Milestone 0 Compatibility', () => {
  
  test('V1 refresh unchanged - legacy account with undefined connectionVersion', async () => {
    // Create V1 account (connectionVersion undefined)
    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerUserId: 'test789',
      accessToken: encryptedToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: Date.now() - 1000,  // Expired
      // connectionVersion: undefined (not set)
    });
    
    // Mock provider refresh API
    mockProviderRefreshAPI.mockResolvedValue({
      accessToken: 'new_token',
      refreshToken: 'new_refresh_token',
      expiresIn: 3600
    });
    
    // Refresh token
    await refreshToken(account._id);
    
    // Verify: Token refreshed successfully
    const updatedAccount = await SocialAccount.findById(account._id);
    expect(updatedAccount.status).toBe('active');
    expect(updatedAccount.accessToken).not.toBe(account.accessToken);
    
    // Verify: connectionVersion still undefined (preserved)
    expect(updatedAccount.connectionVersion).toBeUndefined();
  });
  
  test('connectionVersion preserved during refresh - never modified', async () => {
    // Create V1 account with explicit connectionVersion='v1'
    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerUserId: 'test101',
      accessToken: encryptedToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: Date.now() - 1000,
      connectionVersion: 'v1'  // Explicit V1
    });
    
    mockProviderRefreshAPI.mockResolvedValue({
      accessToken: 'new_token',
      refreshToken: 'new_refresh_token',
      expiresIn: 3600
    });
    
    await refreshToken(account._id);
    
    // Verify: connectionVersion preserved (still 'v1')
    const updatedAccount = await SocialAccount.findById(account._id);
    expect(updatedAccount.connectionVersion).toBe('v1');
    
    // Verify: Logger confirms preservation
    expect(logger.info).toHaveBeenCalledWith(
      'Token refreshed successfully',
      expect.objectContaining({
        connectionVersion: 'v1',
        note: 'connectionVersion preserved'
      })
    );
  });
  
});
```

**Test Coverage**:
- ✅ Test 1: V1 publish unchanged (undefined connectionVersion)
- ✅ Test 2: Undefined version treated as V1 (logging)
- ✅ Test 3: V1 refresh unchanged (undefined connectionVersion)
- ✅ Test 4: connectionVersion preserved during refresh

---

## PART 5: SIMPLE PRE-DEPLOY CHECKLIST

### Pre-Deploy Checklist (10 Items)

- [ ] **1. Schema Change Verified**
  - connectionVersion field is optional (`required: false`)
  - No default value for existing accounts
  - Run: `npm run build` (TypeScript compiles without errors)

- [ ] **2. Unit Tests Pass**
  - All 4 new tests pass
  - All existing tests still pass
  - Run: `npm test`

- [ ] **3. Worker Patches Verified**
  - PublishingWorker normalizes undefined to 'v1'
  - TokenRefreshWorker does NOT modify connectionVersion
  - Both workers log connectionVersion

- [ ] **4. Staging Deployment**
  - Deploy to staging environment
  - Verify no errors in logs
  - Run: `npm run deploy:staging`

- [ ] **5. V1 OAuth Flow Test**
  - Test V1 OAuth flow in staging (create new account)
  - Verify account created with connectionVersion=undefined
  - Verify OAuth flow works normally

- [ ] **6. Token Refresh Test**
  - Trigger token refresh for V1 account in staging
  - Verify connectionVersion remains undefined
  - Verify tokens refreshed successfully

- [ ] **7. Publishing Test**
  - Publish post with V1 account in staging
  - Verify connectionVersion logged as 'v1'
  - Verify post published successfully

- [ ] **8. Monitoring Baseline**
  - Capture V1 OAuth success rate (current: ___%)
  - Capture token refresh success rate (current: ___%)
  - Capture publish success rate (current: ___%)

- [ ] **9. Rollback Plan Ready**
  - Rollback: Revert schema change (remove connectionVersion field)
  - Rollback: Revert worker patches
  - Rollback tested in staging: YES / NO

- [ ] **10. Production Deployment Approved**
  - Code review approved: YES / NO
  - Staging tests passed: YES / NO
  - Rollback plan ready: YES / NO
  - Deploy to production: `npm run deploy:production`

---

## POST-DEPLOY MONITORING (24 Hours)

### Monitor These Metrics

**Success Criteria** (all must be true):
- ✅ V1 OAuth success rate: No degradation (within 1% of baseline)
- ✅ Token refresh success rate: No degradation (within 1% of baseline)
- ✅ Publish success rate: No degradation (within 1% of baseline)
- ✅ Error logs: No new errors related to connectionVersion
- ✅ Worker logs: connectionVersion logged correctly ('v1' for undefined)

**Rollback Triggers** (any triggers immediate rollback):
- ❌ V1 OAuth success rate drops > 5%
- ❌ Token refresh success rate drops > 5%
- ❌ Publish success rate drops > 5%
- ❌ New errors in logs related to connectionVersion
- ❌ Worker crashes or failures

---

## ROLLBACK PROCEDURE (If Needed)

### Rollback Steps (5 Minutes)

1. **Revert Code**
   ```bash
   git revert <commit-hash>
   npm run deploy:production
   ```

2. **Verify Rollback**
   - Check V1 OAuth success rate returns to baseline
   - Check token refresh success rate returns to baseline
   - Check publish success rate returns to baseline
   - Check no errors in logs

3. **No Data Cleanup Needed**
   - connectionVersion field is optional
   - Existing accounts with connectionVersion set will ignore it
   - No data loss or corruption

---

## SUMMARY

**Implementation Time**: 1-2 days

**Day 1**:
- Morning: Implement schema patch + worker patches (2 hours)
- Afternoon: Write 4 unit tests (2 hours)
- Evening: Deploy to staging, run tests (2 hours)

**Day 2**:
- Morning: Verify staging tests, get code review (2 hours)
- Afternoon: Deploy to production (1 hour)
- Evening: Monitor for 24 hours

**Risk Level**: MINIMAL
- Schema change is additive (optional field)
- Workers gain dual compatibility (no behavior change for V1)
- 100% backward compatible
- Easy rollback (revert code, no data cleanup)

**Success Criteria**: All V1 flows work unchanged, workers log connectionVersion correctly

---

**Status**: READY FOR IMPLEMENTATION  
**Confidence**: HIGH (minimal scope, low risk)  
**Estimated Effort**: 8-10 hours total

