# Single-Version Architecture Cutover Plan

## Overview

**Goal**: Simplify to V2-only architecture by removing all V1/V2 branching logic.

**Philosophy**: Since V2 uses the same encryption format and infrastructure as V1, there's no behavioral difference. The `connectionVersion` field becomes unnecessary.

## Pre-Cutover Checklist

### 1. Verify V2 Works in Production
- [ ] V2 OAuth flow tested and working
- [ ] V2 accounts can publish successfully
- [ ] V2 accounts can refresh tokens
- [ ] No errors in production logs

### 2. Backup Current State
- [ ] MongoDB backup created
- [ ] Git commit with current state
- [ ] Document current V1/V2 account counts

### 3. Communication
- [ ] Notify team of cutover window
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window (if needed)

## Cutover Steps

### Step 1: Database Migration (5 minutes)

**Set all accounts to V2**:

```bash
# Connect to MongoDB
mongosh mongodb://127.0.0.1:27017/social-media-scheduler

# Check current state
db.socialaccounts.aggregate([
  { $group: { _id: "$connectionVersion", count: { $sum: 1 } } }
])

# Migrate all accounts to V2
db.socialaccounts.updateMany(
  {},
  { $set: { connectionVersion: "v2" } }
)

# Verify
db.socialaccounts.find({ connectionVersion: { $ne: "v2" } }).count()
// Should return 0
```

### Step 2: Code Changes (Deploy)

**Remove**:
1. V1 OAuth routes (`/api/v1/oauth/*`)
2. V1 OAuth controller
3. Dual-version worker logic (normalize undefined → v1)
4. Rollback script
5. V2-specific routes (merge into main OAuth routes)

**Keep**:
1. V2 OAuth controller (rename to OAuthController)
2. V2 routes (rename to main OAuth routes)
3. `connectionVersion` field (always 'v2', for future use)

### Step 3: Frontend Changes

**Update**:
1. Remove "Connect V2 (Test)" sidebar link
2. Update main "Connected Accounts" to use V2 OAuth
3. Remove any V1/V2 conditional logic

### Step 4: Verification (Post-Deploy)

- [ ] OAuth flow works
- [ ] Publishing works
- [ ] Token refresh works
- [ ] No errors in logs
- [ ] All accounts show `connectionVersion='v2'`

## Detailed Implementation

### 1. Remove V1 OAuth Routes

**File**: `apps/backend/src/routes/v1/index.ts`

```typescript
// REMOVE
import oauthRoutes from './oauth.routes';
router.use('/oauth', oauthRoutes); // V1 OAuth (legacy)

// KEEP (rename from oauth-v2 to oauth)
import oauthRoutes from './oauth.routes'; // Renamed from oauth-v2.routes.ts
router.use('/oauth', oauthRoutes);
```

**Action**: Delete `apps/backend/src/routes/v1/oauth.routes.ts` (V1)

### 2. Remove V1 OAuth Controller

**Action**: Delete `apps/backend/src/controllers/OAuthController.ts` (V1)

### 3. Rename V2 to Main

**Files to rename**:
- `oauth-v2.routes.ts` → `oauth.routes.ts`
- `OAuthControllerV2.ts` → `OAuthController.ts`

**Update route paths**:
- `/api/v1/oauth-v2/*` → `/api/v1/oauth/*`

### 4. Remove Worker Dual-Version Logic

**File**: `apps/backend/src/workers/PublishingWorker.ts`

```typescript
// REMOVE
const version = account.connectionVersion || 'v1';
logger.info('Publishing with connection version', { version });

// KEEP (no version check needed)
logger.info('Publishing post', { accountId: account._id });
```

**File**: `apps/backend/src/workers/TokenRefreshWorker.ts`

```typescript
// REMOVE
const version = account.connectionVersion || 'v1';
logger.info('Refreshing token', { version });

// KEEP (no version check needed)
logger.info('Refreshing token', { accountId: account._id });
```

### 5. Remove Rollback Script

**Action**: Delete:
- `apps/backend/scripts/rollback-v2-to-v1.ts`
- `apps/backend/scripts/__tests__/rollback-v2-to-v1.test.ts`

**Update**: `apps/backend/package.json`
```json
// REMOVE
"rollback:v2-to-v1": "tsx scripts/rollback-v2-to-v1.ts"
```

### 6. Update Frontend

**File**: `apps/frontend/src/components/layout/Sidebar.tsx`

```typescript
// REMOVE
<li>
  <a href="/connect-v2">
    <span>🔐</span>
    <span>Connect V2 (Test)</span>
  </a>
</li>

// UPDATE existing "Connected Accounts" to use new OAuth routes
// (Routes already point to /api/v1/oauth, no change needed)
```

**File**: `apps/frontend/src/pages/connect-v2/ConnectChannelV2.tsx`

**Action**: Delete this file (merge functionality into main connect page if needed)

### 7. Update Environment Variables

**File**: `apps/backend/.env`

```env
# REMOVE (no longer needed)
OAUTH_V2_ENABLED=true

# KEEP
OAUTH_TEST_MODE=true
```

## Rollback Plan

### Option 1: Git Revert (Recommended)

```bash
# Revert code changes
git revert <cutover-commit-hash>
git push

# Redeploy previous version
npm run build
npm run start
```

### Option 2: Database Rollback (If Needed)

```bash
# Restore MongoDB backup
mongorestore --drop --gzip --archive=backup.gz

# Or manually revert accounts
db.socialaccounts.updateMany(
  { connectionVersion: "v2" },
  { $unset: { connectionVersion: "" } }
)
```

## Post-Cutover Cleanup

### Remove Milestone Documentation

**Delete**:
- `MILESTONE_0_*.md`
- `MILESTONE_1_*.md`
- `MILESTONE_2_*.md`
- `EXECUTION_SEQUENCING_*.md`
- `FINAL_MIGRATION_ALGORITHMS.md`

**Keep**:
- `SINGLE_VERSION_CUTOVER_PLAN.md` (this file)
- Design and requirements docs

### Update Tests

**Remove**:
- `PublishingWorker.milestone0.test.ts`
- `TokenRefreshWorker.milestone0.test.ts`
- `OAuthControllerV2.milestone1.test.ts`

**Update**:
- Main OAuth controller tests
- Worker tests (remove version checks)

## Verification Checklist

### Functional Testing

- [ ] User can connect new account
- [ ] User can publish to connected account
- [ ] Token refresh works automatically
- [ ] Account sync works
- [ ] Disconnect works
- [ ] Reconnect works

### Database Verification

```bash
# All accounts should be V2
db.socialaccounts.find({ connectionVersion: { $ne: "v2" } }).count()
# Expected: 0

# Check sample account
db.socialaccounts.findOne()
# Should have: connectionVersion: "v2"
```

### Log Verification

```bash
# No version-related logs
grep -i "connection.*version" logs/*.log
# Should be minimal/none

# No V1 OAuth calls
grep -i "/oauth/" logs/*.log | grep -v "/oauth-v2/"
# Should be empty
```

## Risk Assessment

### Low Risk
- ✅ V2 uses same encryption as V1
- ✅ V2 uses same infrastructure as V1
- ✅ No behavioral differences
- ✅ Database change is simple (set field)
- ✅ Easy rollback (git revert)

### Mitigation
- 🔒 MongoDB backup before cutover
- 🔒 Git commit before changes
- 🔒 Maintenance window for cutover
- 🔒 Rollback plan ready
- 🔒 Team on standby

## Timeline

**Total Time**: ~30 minutes

1. **Pre-cutover** (10 min): Backup, verify, communicate
2. **Database migration** (5 min): Update all accounts to V2
3. **Code deploy** (10 min): Deploy single-version code
4. **Verification** (5 min): Test OAuth, publishing, refresh

## Success Criteria

✅ All accounts have `connectionVersion='v2'`
✅ OAuth flow works without errors
✅ Publishing works without errors
✅ Token refresh works without errors
✅ No version-related code remains
✅ No version-related logs appear

---

**Status**: Ready for execution
**Risk Level**: Low
**Rollback**: Git revert
**Estimated Downtime**: 0 minutes (rolling deploy)
