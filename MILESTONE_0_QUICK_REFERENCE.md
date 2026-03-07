# Milestone 0: Quick Reference Card

**Goal**: Add optional connectionVersion field + worker dual compatibility  
**Time**: 1-2 days  
**Risk**: MINIMAL

---

## 🎯 What We're Doing

1. Add optional `connectionVersion` field to SocialAccount schema
2. Patch PublishingWorker to normalize undefined → 'v1'
3. Patch TokenRefreshWorker to preserve connectionVersion
4. Add 4 unit tests

---

## 🚫 What We're NOT Doing

- ❌ Creating indexes
- ❌ Adding securityMetadata, scopeValidation, migrationStatus
- ❌ Modifying V1 controller
- ❌ Creating SecurityAuditService
- ❌ Any V2 routes or controllers

---

## 📝 Schema Patch

**File**: `apps/backend/src/models/SocialAccount.ts`

```typescript
// Add to interface:
connectionVersion?: 'v1' | 'v2';

// Add to schema:
connectionVersion: {
  type: String,
  enum: ['v1', 'v2'],
  required: false,
  default: undefined,
}
```

---

## 🔧 PublishingWorker Patch

**File**: `apps/backend/src/workers/PublishingWorker.ts`

```typescript
// Line ~833: Add +connectionVersion to select
.select('+accessToken +refreshToken +connectionVersion')

// After fetching account:
const version = account.connectionVersion ?? 'v1';

logger.info('Publishing post', {
  accountId: account._id,
  provider: account.provider,
  connectionVersion: version,
  postId: post._id,
});
```

---

## 🔄 TokenRefreshWorker Patch

**File**: `apps/backend/src/workers/TokenRefreshWorker.ts`

```typescript
// Line ~127: Add +connectionVersion to select
.select('+accessToken +refreshToken +connectionVersion')

// In refreshAccountToken:
const version = account.connectionVersion ?? 'v1';

logger.info('Starting token refresh', {
  accountId,
  provider: account.provider,
  connectionVersion: version,
});

// After success:
logger.info('Token refreshed successfully', {
  accountId,
  provider: account.provider,
  connectionVersion: version,
  note: 'connectionVersion preserved',
});

// In updateAccountTokens - add comment:
// MILESTONE 0: CRITICAL - Update ONLY token fields, NEVER modify connectionVersion
```

---

## ✅ Testing

**Run tests**:
```bash
npm test -- PublishingWorker.milestone0.test.ts
npm test -- TokenRefreshWorker.milestone0.test.ts
npm test  # Full suite
```

**Expected**: 4 new tests pass, all existing tests pass

---

## 🚀 Deployment

**Staging**:
```bash
npm run deploy:staging
# Test V1 OAuth, token refresh, publishing
```

**Production**:
```bash
npm run deploy:production
# Monitor for 24 hours
```

---

## 📊 Monitoring (24 Hours)

**Success Criteria**:
- ✅ V1 OAuth success rate: No degradation (within 1%)
- ✅ Token refresh success rate: No degradation (within 1%)
- ✅ Publish success rate: No degradation (within 1%)
- ✅ Error logs: No new errors
- ✅ Worker logs: connectionVersion='v1' for undefined

**Rollback Triggers**:
- ❌ Any success rate drops > 5%
- ❌ New errors in logs
- ❌ Worker crashes

---

## 🔙 Rollback (5 Minutes)

```bash
git revert <commit-hash>
npm run deploy:production
# No data cleanup needed
```

---

## 📋 10-Item Checklist

1. [ ] Schema change verified (required: false, default: undefined)
2. [ ] Unit tests pass (4 new tests)
3. [ ] Worker patches verified
4. [ ] Staging deployment successful
5. [ ] V1 OAuth test passed
6. [ ] Token refresh test passed
7. [ ] Publishing test passed
8. [ ] Monitoring baseline captured
9. [ ] Rollback plan ready
10. [ ] Production deployment approved

---

## 🎉 Success = Proceed to Milestone 1

**Next**: V2 New Connections Only (Week 2)

---

**Files Modified**: 3  
**Files Created**: 6  
**Tests Added**: 4  
**Risk**: MINIMAL  
**Backward Compatible**: 100%
