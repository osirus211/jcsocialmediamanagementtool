# Single-Version Implementation Checklist

## Phase 1: Database Migration (Do First)

### 1. Add Migration Script to package.json

```json
"scripts": {
  "migrate:all-to-v2": "tsx scripts/migrate-all-to-v2.ts"
}
```

### 2. Run Migration

```bash
cd apps/backend

# Dry run first
npm run migrate:all-to-v2

# Execute migration
npm run migrate:all-to-v2 -- --execute
```

### 3. Verify Migration

```bash
mongosh mongodb://127.0.0.1:27017/social-media-scheduler

db.socialaccounts.aggregate([
  { $group: { _id: "$connectionVersion", count: { $sum: 1 } } }
])

# Should show: { _id: "v2", count: <total> }
```

## Phase 2: Code Changes (Deploy After Migration)

### Backend Changes

#### 1. Rename V2 Files to Main

```bash
cd apps/backend/src

# Rename controller
mv controllers/OAuthControllerV2.ts controllers/OAuthController.ts

# Rename routes
mv routes/v1/oauth-v2.routes.ts routes/v1/oauth.routes.ts

# Rename tests
mv controllers/__tests__/OAuthControllerV2.milestone1.test.ts controllers/__tests__/OAuthController.test.ts
```

#### 2. Update Controller Content

**File**: `apps/backend/src/controllers/OAuthController.ts`

```typescript
// Remove all "V2" references in comments
// Remove milestone comments
// Keep all functionality as-is

// Change class name
export class OAuthController { // was OAuthControllerV2
  // ... keep all methods
}

export const oauthController = new OAuthController();
```

#### 3. Update Routes

**File**: `apps/backend/src/routes/v1/oauth.routes.ts`

```typescript
// Change import
import { oauthController } from '../../controllers/OAuthController';

// Change route paths
router.get('/:platform/callback', oauthController.callback.bind(oauthController));
router.get('/platforms', oauthController.getPlatforms.bind(oauthController));
router.post('/:platform/authorize', oauthController.authorize.bind(oauthController));
router.post('/:platform/finalize', oauthController.finalize.bind(oauthController));

// Remove V2-specific comments
```

#### 4. Update Route Registration

**File**: `apps/backend/src/routes/v1/index.ts`

```typescript
// Remove old V1 import
// import oauthRoutes from './oauth.routes'; // OLD V1

// Keep new import (rename from oauth-v2)
import oauthRoutes from './oauth.routes';

// Update registration
router.use('/oauth', oauthRoutes); // Single version
```

#### 5. Remove Worker Version Logic

**File**: `apps/backend/src/workers/PublishingWorker.ts`

```typescript
// REMOVE these lines:
const version = account.connectionVersion || 'v1';
logger.info('Publishing with connection version', { 
  accountId: account._id,
  connectionVersion: version 
});

// REPLACE with:
logger.info('Publishing post', { 
  accountId: account._id,
  platform: account.provider 
});
```

**File**: `apps/backend/src/workers/TokenRefreshWorker.ts`

```typescript
// REMOVE these lines:
const version = account.connectionVersion || 'v1';
logger.info('Token refresh with connection version', { 
  accountId: account._id,
  connectionVersion: version 
});

// REPLACE with:
logger.info('Refreshing token', { 
  accountId: account._id,
  platform: account.provider 
});
```

#### 6. Delete Old Files

```bash
cd apps/backend

# Delete V1 OAuth files (if they exist)
rm src/controllers/OAuthController.ts # OLD V1 version
rm src/routes/v1/oauth.routes.ts # OLD V1 version

# Delete rollback script
rm scripts/rollback-v2-to-v1.ts
rm scripts/__tests__/rollback-v2-to-v1.test.ts

# Delete milestone tests
rm src/workers/__tests__/PublishingWorker.milestone0.test.ts
rm src/workers/__tests__/TokenRefreshWorker.milestone0.test.ts
```

#### 7. Update package.json

```json
{
  "scripts": {
    // REMOVE
    "rollback:v2-to-v1": "tsx scripts/rollback-v2-to-v1.ts",
    
    // ADD
    "migrate:all-to-v2": "tsx scripts/migrate-all-to-v2.ts"
  }
}
```

#### 8. Update Environment Variables

**File**: `apps/backend/.env`

```env
# REMOVE (no longer needed)
OAUTH_V2_ENABLED=true

# KEEP
OAUTH_TEST_MODE=true
```

### Frontend Changes

#### 1. Remove V2 Sidebar Link

**File**: `apps/frontend/src/components/layout/Sidebar.tsx`

```typescript
// REMOVE this entire <li> block:
<li>
  <a href="/connect-v2">
    <span>🔐</span>
    <span>Connect V2 (Test)</span>
  </a>
</li>
```

#### 2. Update API Calls (if needed)

**File**: Check all files that call OAuth endpoints

```typescript
// Change from:
apiClient.get('/oauth-v2/platforms')
apiClient.post('/oauth-v2/:platform/authorize')

// To:
apiClient.get('/oauth/platforms')
apiClient.post('/oauth/:platform/authorize')
```

#### 3. Delete V2 Page (Optional)

```bash
cd apps/frontend

# If you want to remove the V2 test page
rm -rf src/pages/connect-v2/
```

## Phase 3: Testing

### 1. Run Tests

```bash
cd apps/backend
npm test

cd apps/frontend
npm test
```

### 2. Manual Testing

- [ ] Connect new account
- [ ] Publish to account
- [ ] Token refresh works
- [ ] Disconnect account
- [ ] Reconnect account

### 3. Check Logs

```bash
# No version-related errors
grep -i "version" logs/*.log

# OAuth working
grep -i "oauth" logs/*.log
```

## Phase 4: Cleanup

### 1. Delete Milestone Documentation

```bash
rm MILESTONE_0_*.md
rm MILESTONE_1_*.md
rm MILESTONE_2_*.md
rm EXECUTION_SEQUENCING_*.md
rm FINAL_MIGRATION_ALGORITHMS.md
rm MIGRATION_ROLLBACK_ALGORITHMS.md
```

### 2. Update README (if exists)

Remove any references to:
- V1 vs V2
- Migration process
- Rollback scripts
- Dual-version architecture

### 3. Git Commit

```bash
git add .
git commit -m "feat: migrate to single-version OAuth architecture

- Migrated all accounts to connectionVersion='v2'
- Removed V1 OAuth routes and controller
- Removed dual-version worker logic
- Removed rollback script
- Simplified to single OAuth implementation

BREAKING CHANGE: V1 OAuth endpoints removed"

git push
```

## Rollback Procedure

### If Issues Arise

```bash
# 1. Revert code changes
git revert HEAD
git push

# 2. Redeploy
npm run build
npm run start

# 3. Database rollback (if needed)
mongosh mongodb://127.0.0.1:27017/social-media-scheduler

db.socialaccounts.updateMany(
  {},
  { $unset: { connectionVersion: "" } }
)
```

## Success Criteria

✅ All accounts have `connectionVersion='v2'`
✅ No V1 OAuth code remains
✅ No version branching in workers
✅ OAuth flow works
✅ Publishing works
✅ Token refresh works
✅ Tests pass
✅ No errors in logs

---

**Status**: Ready for implementation
**Estimated Time**: 1-2 hours
**Risk**: Low (easy rollback via git revert)
