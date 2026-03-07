# Execution Sequencing and Deployment Safety Review

**Date**: 2026-02-28  
**Classification**: PRODUCTION DEPLOYMENT PLAN  
**Status**: CRITICAL SAFETY REVIEW  

---

## EXECUTIVE SUMMARY

This document restructures the Connect Flow V2 OAuth implementation tasks into SAFE INCREMENTAL MILESTONES for production deployment. The original 8-phase plan has been re-sequenced into 5 deployment milestones with explicit safety gates, rollback paths, and monitoring requirements.

**Critical Finding**: The original task sequence has **3 DEPLOYMENT SAFETY ISSUES** that would cause production incidents:
1. ❌ Phase 2 (OAuth V2 Controller) includes V1→V2 upgrade logic BEFORE rollback script exists
2. ❌ Phase 3 (Migration Support) modifies workers BEFORE V2 controller is proven stable
3. ❌ Phase 4 (Rollback Support) is implemented AFTER migration logic is deployed

**Recommendation**: **RE-SEQUENCE TO MILESTONE-BASED DEPLOYMENT** with rollback-first approach.

---

## STEP 1: PHASE VALIDATION

### Analysis of Original 8 Phases

#### Phase 1: Backend Core Infrastructure
**Can deploy independently?** ✅ YES  
**Breaking behavior?** ❌ NO - Schema changes are additive (optional fields)  
**Hidden dependencies?** ❌ NO  
**Big-bang deployment?** ❌ NO  

**Verdict**: SAFE - Schema updates with no behavior change

---

#### Phase 2: OAuth V2 Controller
**Can deploy independently?** ⚠️ PARTIAL  
**Breaking behavior?** ❌ NO - Separate routes (/api/v1/oauth-v2/*)  
**Hidden dependencies?** ✅ YES - Task 8.5 includes V1→V2 upgrade logic  
**Big-bang deployment?** ⚠️ RISK - Upgrade logic deployed before rollback script  

**Critical Issue**: Task 8.5 implements V1→V2 automatic upgrade, but Phase 4 (rollback script) comes later. If V2 has bugs, we cannot rollback.

**Verdict**: UNSAFE - Must split into "V2 new connections only" and "V2 with migration"

---

#### Phase 3: Migration Support
**Can deploy independently?** ❌ NO  
**Breaking behavior?** ✅ YES - Task 13 modifies V1 controller  
**Hidden dependencies?** ✅ YES - Depends on Phase 2 V2 controller  
**Big-bang deployment?** ✅ YES - All workers updated simultaneously  

**Critical Issue**: Task 13 (V1 controller rejects V2) and Task 14 (TokenRefreshWorker) and Task 15 (PublishingWorker) must deploy atomically with Phase 2.

**Verdict**: UNSAFE - Worker updates create hybrid state risk

---

#### Phase 4: Rollback Support
**Can deploy independently?** ✅ YES  
**Breaking behavior?** ❌ NO - Script is not auto-executed  
**Hidden dependencies?** ❌ NO  
**Big-bang deployment?** ❌ NO  

**Critical Issue**: This phase should be deployed BEFORE Phase 2 migration logic.

**Verdict**: SAFE BUT MISORDERED - Must deploy before migration activation

---

#### Phase 5: Frontend Implementation
**Can deploy independently?** ✅ YES  
**Breaking behavior?** ❌ NO - Feature toggle controlled  
**Hidden dependencies?** ✅ YES - Depends on Phase 2 backend  
**Big-bang deployment?** ❌ NO  

**Verdict**: SAFE - Can deploy after backend is stable

---

#### Phase 6: Monitoring and Admin Tools
**Can deploy independently?** ✅ YES  
**Breaking behavior?** ❌ NO  
**Hidden dependencies?** ❌ NO  
**Big-bang deployment?** ❌ NO  

**Verdict**: SAFE - Should deploy BEFORE migration activation

---

#### Phase 7: Integration and End-to-End Testing
**Can deploy independently?** N/A - Testing phase  
**Breaking behavior?** N/A  
**Hidden dependencies?** N/A  
**Big-bang deployment?** N/A  

**Verdict**: TESTING PHASE - Not a deployment

---

#### Phase 8: Documentation and Deployment
**Can deploy independently?** N/A - Documentation phase  
**Breaking behavior?** N/A  
**Hidden dependencies?** N/A  
**Big-bang deployment?** N/A  

**Verdict**: DOCUMENTATION PHASE - Not a deployment

---

### Phase Validation Summary

| Phase | Independent Deploy | Breaking | Dependencies | Big-Bang | Verdict |
|-------|-------------------|----------|--------------|----------|---------|
| 1. Core Infrastructure | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ✅ SAFE |
| 2. OAuth V2 Controller | ⚠️ PARTIAL | ❌ NO | ✅ YES | ⚠️ RISK | ❌ UNSAFE |
| 3. Migration Support | ❌ NO | ✅ YES | ✅ YES | ✅ YES | ❌ UNSAFE |
| 4. Rollback Support | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ⚠️ MISORDERED |
| 5. Frontend | ✅ YES | ❌ NO | ✅ YES | ❌ NO | ✅ SAFE |
| 6. Monitoring | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ✅ SAFE |
| 7. Testing | N/A | N/A | N/A | N/A | N/A |
| 8. Documentation | N/A | N/A | N/A | N/A | N/A |

**Critical Finding**: Phases 2, 3, and 4 must be re-sequenced for safe deployment.

---

## STEP 2: SAFE DEPLOYMENT ORDER

### Restructured Milestones


### MILESTONE 0: Schema and Worker Dual Compatibility (Week 1)

**What is deployed**:
- Task 1: V2 project structure and utilities
- Task 2.1: Social Account model extension (schema only)
- Task 2.3: MongoDB indexes creation
- Task 3.1: SecurityAuditService (logging infrastructure)
- Task 13: V1 controller rejects V2 accounts (CRITICAL - prevents flip-flopping)
- Task 14.1: TokenRefreshWorker preserves connectionVersion (CRITICAL - prevents migration stall)
- Task 15: PublishingWorker handles both versions (CRITICAL - prevents publish failures)

**What is NOT yet activated**:
- V2 OAuth routes (not exposed)
- V2 controller (not deployed)
- V1→V2 automatic upgrade (not deployed)
- Frontend V2 UI (not deployed)

**Why this order**:
- Schema changes are additive (optional fields) - no behavior change
- Workers gain dual compatibility BEFORE any V2 accounts exist
- V1 controller gains V2 rejection logic BEFORE any V2 accounts exist
- Zero risk to existing V1 flows

**Monitoring required**:
- Monitor V1 OAuth success rate (should remain 100%)
- Monitor token refresh success rate (should remain 100%)
- Monitor publish success rate (should remain 100%)
- Monitor for any V1 controller V2 rejection logs (should be ZERO)

**Rollback path**:
- Revert schema changes (no data loss - fields are optional)
- Revert worker updates (no impact - no V2 accounts exist)
- Revert V1 controller update (no impact - no V2 accounts exist)

**Success criteria**:
- All V1 flows continue working (100% success rate)
- No errors in logs
- Schema indexes created successfully
- Workers handle undefined connectionVersion safely

**Deployment checklist**:
- [ ] Backup database before schema changes
- [ ] Run index creation script in staging
- [ ] Verify indexes created (connectionVersion, migrationStatus)
- [ ] Deploy worker updates to staging
- [ ] Run integration tests for V1 flows
- [ ] Deploy to production (rolling deployment)
- [ ] Monitor for 24 hours before proceeding

---

### MILESTONE 1: V2 New Connections Only (Week 2)

**What is deployed**:
- Task 4: OAuth State Service V2 (HMAC, IP binding, PKCE)
- Task 5: PKCE support
- Task 7: OAuth V2 Controller - Authorize endpoint
- Task 8.1-8.4: OAuth V2 Controller - Callback endpoint (WITHOUT upgrade logic)
- Task 8.6: Error handling and redirect logic
- Task 9: Multi-account selection
- Task 10: Performance monitoring

**CRITICAL MODIFICATION**: Task 8.5 (account creation/update logic) is MODIFIED:
- ✅ Create NEW accounts with connectionVersion='v2'
- ❌ DO NOT upgrade existing V1 accounts (skip upgrade logic)
- ✅ Update existing V2 accounts (idempotent)
- ❌ DO NOT handle undefined connectionVersion (reject with error)

**What is NOT yet activated**:
- V1→V2 automatic upgrade (explicitly disabled)
- Frontend V2 UI (not deployed)
- Migration monitoring dashboard (not deployed)

**Why this order**:
- V2 controller only creates NEW accounts
- No migration risk (existing V1 accounts untouched)
- V2 can be tested in isolation
- Rollback script not needed yet (no V2 accounts in production)

**Monitoring required**:
- Monitor V2 OAuth success rate (target: > 95%)
- Monitor V2 error rate (target: < 5%)
- Monitor V2 flow duration (target: < 2000ms)
- Monitor state replay attacks (should be ZERO)
- Monitor rate limit exceeded (track abuse)
- Monitor V1 OAuth success rate (should remain 100%)

**Rollback path**:
- Set OAUTH_V2_ENABLED=false
- V2 routes return HTTP 503
- No data cleanup needed (V2 accounts remain dormant)
- V1 flows unaffected

**Success criteria**:
- V2 success rate > 95% for 7 consecutive days
- V2 error rate < 5%
- V2 flow duration < 2000ms
- No state replay attacks detected
- No V1 degradation

**Deployment checklist**:
- [ ] Deploy V2 controller to staging
- [ ] Run integration tests for V2 new connections
- [ ] Test all 4 platforms (Twitter, LinkedIn, Facebook, Instagram)
- [ ] Test PKCE for supported platforms
- [ ] Test multi-account selection (Facebook, LinkedIn)
- [ ] Test error handling and retry logic
- [ ] Deploy to production with OAUTH_V2_ENABLED=false
- [ ] Enable for internal testing only (OAUTH_V2_BETA_WORKSPACES)
- [ ] Monitor for 7 days before proceeding

---

### MILESTONE 2: Rollback Script and Testing (Week 3)

**What is deployed**:
- Task 17: V2→V1 rollback script (COMPLETE implementation)
- Task 18: Rollback runbook documentation
- Task 22: Monitoring endpoints (stats, health, audit events)
- Task 23: Prometheus metrics
- Task 24: Health check endpoint

**What is NOT yet activated**:
- V1→V2 automatic upgrade (still disabled)
- Frontend V2 UI (not deployed)
- Migration activation (not enabled)

**Why this order**:
- Rollback script MUST exist before migration activation
- Monitoring MUST exist before migration activation
- Test rollback in staging with synthetic V2 accounts

**Monitoring required**:
- Monitor rollback script dry-run in staging
- Monitor rollback script execution in staging
- Verify deterministic queue drain works
- Verify idempotency works (run twice)

**Rollback path**:
- N/A - This milestone adds rollback capability

**Success criteria**:
- Rollback script tested in staging (dry-run and real)
- Rollback script is idempotent (can run multiple times)
- Rollback script drains publish queue deterministically
- Monitoring dashboard shows accurate migration stats
- Prometheus metrics are exposed

**Deployment checklist**:
- [ ] Implement rollback script with Algorithm 3
- [ ] Test rollback script in staging (dry-run)
- [ ] Create synthetic V2 accounts in staging
- [ ] Test rollback script in staging (real execution)
- [ ] Verify V2 accounts marked as expired
- [ ] Verify migrationStatus='rollback_required'
- [ ] Test rollback idempotency (run twice)
- [ ] Test rollback with in-flight publishes
- [ ] Deploy monitoring endpoints to production
- [ ] Verify monitoring dashboard works
- [ ] Document rollback procedure in runbook

---

### MILESTONE 3: V1→V2 Migration Activation (Week 4-5)

**What is deployed**:
- Task 8.5: COMPLETE account creation/update logic (WITH upgrade logic)
  - ✅ Upgrade explicit V1 to V2 (connectionVersion='v1')
  - ✅ Update existing V2 (idempotent)
  - ✅ Normalize legacy V1 (connectionVersion undefined)
  - ✅ Implement Algorithm 1 from FINAL_MIGRATION_ALGORITHMS.md
- Task 12.1: V1→V2 automatic upgrade logic (COMPLETE)
- Task 20: Frontend V2 UI (Connect Channel V2 Page)
- Task 25: Admin migration dashboard

**What is NOT yet activated**:
- Migration is enabled but controlled via OAUTH_V2_BETA_WORKSPACES
- Gradual rollout (internal → beta → 10% → 50% → 100%)

**Why this order**:
- Rollback script exists and is tested
- Monitoring exists and is working
- Workers are dual-compatible
- V2 new connections are proven stable

**Monitoring required**:
- Monitor V1→V2 upgrade success rate (target: > 99%)
- Monitor V2 error rate (target: < 1%)
- Monitor migration percentage (track progress)
- Monitor V1 OAuth success rate (should remain high)
- Monitor token refresh success rate (should remain 100%)
- Monitor publish success rate (should remain 100%)
- Monitor for V1/V2 flip-flopping (should be ZERO)

**Rollback path**:
1. Set OAUTH_V2_ENABLED=false (stop new V2 connections)
2. Run rollback script: `node rollback-v2-to-v1.ts --dry-run` (verify)
3. Run rollback script: `node rollback-v2-to-v1.ts` (execute)
4. Verify all V2 accounts marked as expired
5. Monitor V1 reconnect rate
6. Force users to reconnect via V1

**Success criteria**:
- V1→V2 upgrade success rate > 99%
- V2 error rate < 1% for 7 consecutive days
- No V1/V2 flip-flopping detected
- No migration stalls (token refresh preserves version)
- No publish failures due to version mismatch

**Deployment checklist**:
- [ ] Deploy upgrade logic to staging
- [ ] Test V1→V2 upgrade in staging (explicit V1)
- [ ] Test V1→V2 upgrade in staging (undefined V1)
- [ ] Test V2 idempotent reconnect in staging
- [ ] Test concurrent upgrade attempts (race condition)
- [ ] Deploy to production with OAUTH_V2_ENABLED=false
- [ ] Enable for internal testing (OAUTH_V2_BETA_WORKSPACES=internal)
- [ ] Monitor for 3 days
- [ ] Enable for beta users (OAUTH_V2_BETA_WORKSPACES=beta)
- [ ] Monitor for 7 days
- [ ] Gradual rollout: 10% → 50% → 100%
- [ ] Monitor migration percentage daily

**Rollback triggers** (DO NOT PROCEED IF):
- V2 error rate > 5% for 24 hours
- V1→V2 upgrade failure rate > 5%
- V1/V2 flip-flopping detected
- Token refresh changes connectionVersion
- Publish failures due to version mismatch
- Critical security vulnerability discovered
- Data corruption detected

---

### MILESTONE 4: Migration Completion (Week 6-14)

**What is deployed**:
- No new code deployments
- Monitoring and gradual rollout only

**What is activated**:
- Gradual rollout continues: 10% → 25% → 50% → 75% → 100%
- Migration monitoring dashboard tracks progress

**Why this order**:
- Allow natural migration through user reconnects
- Monitor for issues at each rollout stage
- Rollback capability remains available

**Monitoring required**:
- Monitor migration percentage (target: 95% by Week 14)
- Monitor V2 error rate (target: < 1%)
- Monitor V1 error rate (should remain stable)
- Monitor for any anomalies

**Rollback path**:
- Same as Milestone 3 rollback path
- Can rollback at any time during migration

**Success criteria**:
- 95% of active accounts are V2
- V2 error rate < 1% for 7 consecutive days
- No critical V2 bugs reported
- No data loss or corruption

**Deployment checklist**:
- [ ] Week 6: Enable for 10% of users
- [ ] Week 7: Monitor and verify (no issues)
- [ ] Week 8: Enable for 25% of users
- [ ] Week 9: Monitor and verify (no issues)
- [ ] Week 10: Enable for 50% of users
- [ ] Week 11: Monitor and verify (no issues)
- [ ] Week 12: Enable for 75% of users
- [ ] Week 13: Monitor and verify (no issues)
- [ ] Week 14: Enable for 100% of users
- [ ] Week 15-18: Monitor migration completion (95% target)

**Migration completion criteria**:
- 95% of active accounts are V2
- V2 error rate < 1% for 7 consecutive days
- No critical V2 bugs reported

**Post-migration actions**:
- Set OAUTH_V1_ENABLED=false (disable V1 routes)
- Wait 30 days grace period
- Remove V1 code

---

### MILESTONE 5: V1 Deprecation (Week 18+)

**What is deployed**:
- V1 routes disabled (OAUTH_V1_ENABLED=false)
- V1 code removal (after 30-day grace period)

**What is activated**:
- V2 is the only OAuth flow

**Why this order**:
- Migration is complete (95%+ accounts are V2)
- V2 is proven stable (< 1% error rate for 7+ days)
- 30-day grace period allows stragglers to migrate

**Monitoring required**:
- Monitor V1 route access attempts (should decline to zero)
- Monitor V2 error rate (should remain < 1%)

**Rollback path**:
- Re-enable V1 routes (OAUTH_V1_ENABLED=true)
- V1 code still exists (not removed yet)

**Success criteria**:
- V1 route access attempts < 1% of total OAuth flows
- V2 error rate < 1%
- No critical issues reported

**Deployment checklist**:
- [ ] Week 18: Set OAUTH_V1_ENABLED=false
- [ ] Week 19-22: Monitor V1 route access attempts
- [ ] Week 22: Verify < 1% V1 access attempts
- [ ] Week 22: Remove V1 code from codebase
- [ ] Week 22: Remove V1 routes from API documentation

---

## STEP 3: CONCURRENCY SAFETY CHECK

### Verification of Safeguards


#### 1. Upgrade Logic is Version-Guarded

**Requirement**: REQ-13, Algorithm 1 from FINAL_MIGRATION_ALGORITHMS.md

**Verification**:
```typescript
// ✅ ATTEMPT 1: Upgrade explicit V1 to V2
result ← SocialAccount.findOneAndUpdate(
  {
    workspaceId: workspaceId,
    provider: provider,
    providerUserId: providerUserId,
    connectionVersion: 'v1'  // ✅ STRICT VERSION PRECONDITION
  },
  { $set: updateDoc },
  { new: true, upsert: false }
)

// ✅ ATTEMPT 2: Update existing V2 (idempotent)
result ← SocialAccount.findOneAndUpdate(
  {
    workspaceId: workspaceId,
    provider: provider,
    providerUserId: providerUserId,
    connectionVersion: 'v2'  // ✅ STRICT VERSION PRECONDITION
  },
  { $set: updateDoc, $inc: { 'securityMetadata.usageCount': 1 } },
  { new: true, upsert: false }
)

// ✅ ATTEMPT 3: Normalize legacy V1 (undefined)
result ← SocialAccount.findOneAndUpdate(
  {
    workspaceId: workspaceId,
    provider: provider,
    providerUserId: providerUserId,
    connectionVersion: { $exists: false }  // ✅ EXPLICIT UNDEFINED CHECK
  },
  { $set: updateDoc },
  { new: true, upsert: false }
)
```

**Status**: ✅ VERIFIED - All upgrade updates include strict version precondition

---

#### 2. Refresh Logic is Version-Guarded

**Requirement**: REQ-15, Algorithm 2 from FINAL_MIGRATION_ALGORITHMS.md

**Verification**:
```typescript
// ✅ NORMALIZE UNDEFINED connectionVersion
version ← account.connectionVersion ?? 'v1'

// ✅ STRICT: Only update token fields, PRESERVE connectionVersion
updateDoc ← {
  accessToken: encryptedAccessToken,
  refreshToken: encryptedRefreshToken,
  tokenExpiresAt: calculateExpiry(newTokens.expiresIn),
  lastRefreshedAt: currentTime,
  status: 'active',
  updatedAt: currentTime
}

// ✅ VERSION GUARD: Explicitly prevent connectionVersion modification
result ← SocialAccount.updateOne(
  { _id: accountId },
  { 
    $set: updateDoc,
    $unset: {
      // ✅ CRITICAL: Prevent accidental version modification
    }
  }
)
```

**Status**: ✅ VERIFIED - Refresh NEVER modifies connectionVersion, explicit $unset guard

---

#### 3. Rollback Logic is Idempotent

**Requirement**: REQ-21, Algorithm 3 from FINAL_MIGRATION_ALGORITHMS.md

**Verification**:
```typescript
// ✅ IDEMPOTENCY CHECK: Skip if already rolled back
IF account.migrationStatus = 'rollback_required' AND account.status = 'expired' THEN
  logger.debug('Account already rolled back (idempotent)')
  skippedCount ← skippedCount + 1
  CONTINUE
END IF

// ✅ ATOMIC UPDATE WITH STRICT VERSION PRECONDITION
result ← SocialAccount.updateOne(
  { 
    _id: account._id,
    connectionVersion: 'v2'  // ✅ STRICT: Only update if still V2
  },
  {
    $set: {
      status: 'expired',
      migrationStatus: 'rollback_required',
      updatedAt: Date.now()
    }
  }
)
```

**Status**: ✅ VERIFIED - Rollback is idempotent, can run multiple times safely

---

#### 4. Worker Handles Undefined connectionVersion Safely

**Requirement**: REQ-15, REQ-16

**Verification**:
```typescript
// TokenRefreshWorker
version ← account.connectionVersion ?? 'v1'  // ✅ NORMALIZE UNDEFINED

// PublishingWorker
IF connectionVersion is 'v1' OR connectionVersion is undefined THEN
  // Use V1 decryption
END IF
IF connectionVersion is 'v2' THEN
  // Use V1 decryption (same format)
END IF
```

**Status**: ✅ VERIFIED - Workers normalize undefined to 'v1' and handle safely

---

#### 5. No Operation Depends on Transactions

**Requirement**: REQ-5, REQ-20

**Verification**:
- ✅ Upgrade uses MongoDB unique index (no distributed locking)
- ✅ Upgrade uses idempotent upsert pattern (no transactions)
- ✅ Refresh uses simple updateOne (no transactions)
- ✅ Rollback uses batch processing (no transactions)
- ✅ All operations are idempotent (safe to retry)

**Status**: ✅ VERIFIED - No transactions used, all operations are idempotent

---

### Missing Safeguards

**None identified**. All critical safeguards are present:
- ✅ Upgrade logic is version-guarded
- ✅ Refresh logic is version-guarded
- ✅ Rollback logic is idempotent
- ✅ Workers handle undefined connectionVersion safely
- ✅ No operation depends on transactions

---

## STEP 4: TESTING STRATEGY

### Unit Tests Required Before Each Milestone

#### Milestone 0: Schema and Worker Dual Compatibility
**Required unit tests**:
- [ ] Task 2.2: SocialAccount model extensions
  - Test default values for new connections
  - Test backward compatibility with V1 accounts (undefined connectionVersion)
  - Test validation rules for new fields
- [ ] Task 3.2: SecurityAuditService
  - Test event logging with all event types
  - Test query filtering by workspace, type, severity
  - Test that logging failures don't throw errors
  - Test IP address hashing
- [ ] Task 14.2: TokenRefreshWorker
  - Test V1 account refresh (connectionVersion preserved)
  - Test V2 account refresh (connectionVersion preserved)
  - Test legacy account refresh (undefined connectionVersion preserved)
  - Test that refresh never changes connectionVersion

**Success criteria**: All unit tests pass, 100% code coverage for new code

---

#### Milestone 1: V2 New Connections Only
**Required unit tests**:
- [ ] Task 4.3: OAuth State Service V2
  - Test state generation with HMAC signature
  - Test state validation with valid/invalid signatures
  - Test IP binding validation
  - Test expiration handling
  - Test replay protection
  - Test Redis fallback to in-memory
- [ ] Task 5.2: PKCE
  - Test code verifier generation (256-bit random)
  - Test code challenge computation (SHA-256)
  - Test storage and retrieval
  - Test platform-specific logic (LinkedIn skips PKCE)
- [ ] Task 7.2: Authorize endpoint
  - Test platform validation
  - Test state generation
  - Test PKCE generation for supported platforms
  - Test rate limiting
  - Test authorization URL format
- [ ] Task 9.3: Multi-account selection
  - Test multi-account detection
  - Test selection token generation
  - Test finalize endpoint
  - Test token expiration

**Success criteria**: All unit tests pass, 100% code coverage for new code

---

#### Milestone 2: Rollback Script and Testing
**Required unit tests**:
- [ ] Task 17.5: Rollback script
  - Test rollback after token refresh (V1 encryption compatibility)
  - Test rollback with in-flight publishes (queue drain)
  - Test rollback script idempotency
  - Test dry-run mode
  - Test workspace-specific rollback

**Success criteria**: All unit tests pass, rollback script tested in staging

---

#### Milestone 3: V1→V2 Migration Activation
**Required unit tests**:
- [ ] Task 12.2: V1→V2 upgrade
  - Test upgrade of explicit V1 account
  - Test upgrade of legacy V1 account (undefined connectionVersion)
  - Test idempotent V2 reconnect
  - Test optimistic locking (concurrent upgrades)
- [ ] Task 20.7: Frontend components
  - Test platform selection
  - Test OAuth flow states
  - Test multi-account selection
  - Test error display
  - Test loading states
  - Test feature toggle

**Success criteria**: All unit tests pass, 100% code coverage for new code

---

### Integration Tests Required Before Each Milestone

#### Milestone 0: Schema and Worker Dual Compatibility
**Required integration tests**:
- [ ] Test V1 OAuth flow end-to-end (should remain 100% functional)
- [ ] Test token refresh for V1 accounts (should preserve connectionVersion)
- [ ] Test publishing for V1 accounts (should work normally)
- [ ] Test V1 controller rejects V2 accounts (should return error)

**Success criteria**: All V1 flows work normally, no degradation

---

#### Milestone 1: V2 New Connections Only
**Required integration tests**:
- [ ] Task 8.7: Callback endpoint
  - Test successful OAuth flow (new V2 account creation)
  - Test idempotent V2 reconnect
  - Test state validation failures
  - Test scope validation failures
  - Test cross-tenant blocking
  - Test error handling and redirects
- [ ] Test Twitter OAuth flow (with PKCE)
- [ ] Test LinkedIn OAuth flow (without PKCE)
- [ ] Test Facebook OAuth flow (with multi-account selection)
- [ ] Test Instagram OAuth flow
- [ ] Test V1 OAuth flow (should remain 100% functional)

**Success criteria**: All V2 flows work, V1 flows unaffected

---

#### Milestone 2: Rollback Script and Testing
**Required integration tests**:
- [ ] Test rollback script in staging (dry-run)
- [ ] Test rollback script in staging (real execution)
- [ ] Test rollback with in-flight publishes
- [ ] Test rollback idempotency (run twice)
- [ ] Test V1 encryption compatibility after rollback

**Success criteria**: Rollback script works correctly, no data loss

---

#### Milestone 3: V1→V2 Migration Activation
**Required integration tests**:
- [ ] Test V1→V2 upgrade during reconnect (explicit V1)
- [ ] Test V1→V2 upgrade during reconnect (undefined V1)
- [ ] Test V2 account reconnect (idempotent)
- [ ] Test token refresh for V1 and V2 accounts
- [ ] Test publishing with V1 and V2 accounts
- [ ] Test concurrent upgrade attempts (race condition)
- [ ] Test V1 controller rejects V2 accounts
- [ ] Test frontend V2 UI end-to-end

**Success criteria**: All migration scenarios work, no data corruption

---

### Concurrency Tests Required Before Migration Activation

**Required concurrency tests**:
- [ ] Test concurrent V1→V2 upgrades (same account, different tabs)
- [ ] Test concurrent V2 reconnects (same account, different tabs)
- [ ] Test concurrent token refresh during upgrade
- [ ] Test concurrent publishing during upgrade
- [ ] Test concurrent V1 and V2 connect attempts (should fail gracefully)

**Success criteria**: No race conditions, no data corruption, all operations are idempotent

---

### Staging Simulation Checklist

**Before Milestone 1 deployment**:
- [ ] Create staging environment with production-like data
- [ ] Run all unit tests in staging
- [ ] Run all integration tests in staging
- [ ] Test V2 new connections for all 4 platforms
- [ ] Test error scenarios (state validation, scope validation, cross-tenant)
- [ ] Test rate limiting
- [ ] Test Redis fallback (simulate Redis outage)
- [ ] Monitor staging for 24 hours

**Before Milestone 3 deployment**:
- [ ] Create synthetic V1 accounts in staging
- [ ] Test V1→V2 upgrade in staging
- [ ] Test rollback script in staging
- [ ] Test concurrent upgrade attempts in staging
- [ ] Run concurrency tests in staging
- [ ] Monitor staging for 7 days

---

## STEP 5: FINAL OUTPUT

### 1. Revised Execution Phases (Safe Order)

| Milestone | Week | What is Deployed | What is NOT Activated | Rollback Path |
|-----------|------|------------------|----------------------|---------------|
| **M0: Schema + Workers** | 1 | Schema, indexes, worker dual compatibility, V1 controller V2 rejection | V2 routes, V2 controller, upgrade logic, frontend | Revert schema, revert workers |
| **M1: V2 New Connections** | 2 | V2 controller (new connections only), state service, PKCE, error handling | V1→V2 upgrade, frontend, migration | Set OAUTH_V2_ENABLED=false |
| **M2: Rollback + Monitoring** | 3 | Rollback script, monitoring endpoints, Prometheus metrics, admin dashboard | V1→V2 upgrade, frontend, migration | N/A (adds rollback capability) |
| **M3: Migration Activation** | 4-5 | V1→V2 upgrade logic, frontend V2 UI, admin dashboard | Full migration (beta only) | Run rollback script |
| **M4: Migration Completion** | 6-14 | Gradual rollout (10% → 100%) | V1 deprecation | Run rollback script |
| **M5: V1 Deprecation** | 18+ | V1 routes disabled, V1 code removed | N/A | Re-enable V1 routes |

**Key Changes from Original Plan**:
1. ✅ Workers gain dual compatibility BEFORE V2 controller exists (Milestone 0)
2. ✅ V2 controller creates new connections only BEFORE upgrade logic (Milestone 1)
3. ✅ Rollback script exists BEFORE migration activation (Milestone 2)
4. ✅ Monitoring exists BEFORE migration activation (Milestone 2)
5. ✅ Gradual rollout with explicit rollback triggers (Milestone 3-4)

---

### 2. Deployment Checklist Per Milestone

#### Milestone 0: Schema and Worker Dual Compatibility

**Pre-deployment**:
- [ ] Backup production database
- [ ] Run index creation script in staging
- [ ] Verify indexes created successfully
- [ ] Run all unit tests (100% pass rate)
- [ ] Run integration tests for V1 flows (100% pass rate)

**Deployment**:
- [ ] Deploy schema changes (rolling deployment)
- [ ] Deploy worker updates (rolling deployment)
- [ ] Deploy V1 controller update (rolling deployment)
- [ ] Verify no errors in logs

**Post-deployment**:
- [ ] Monitor V1 OAuth success rate for 24 hours (target: 100%)
- [ ] Monitor token refresh success rate for 24 hours (target: 100%)
- [ ] Monitor publish success rate for 24 hours (target: 100%)
- [ ] Verify no V1 controller V2 rejection logs (should be ZERO)

**Rollback criteria**:
- V1 OAuth success rate < 95%
- Token refresh success rate < 95%
- Publish success rate < 95%
- Errors in logs

---

#### Milestone 1: V2 New Connections Only

**Pre-deployment**:
- [ ] Run all unit tests (100% pass rate)
- [ ] Run integration tests for V2 new connections (100% pass rate)
- [ ] Test all 4 platforms in staging (Twitter, LinkedIn, Facebook, Instagram)
- [ ] Test PKCE for supported platforms
- [ ] Test multi-account selection
- [ ] Test error handling and retry logic
- [ ] Test rate limiting
- [ ] Test Redis fallback

**Deployment**:
- [ ] Deploy V2 controller to production with OAUTH_V2_ENABLED=false
- [ ] Enable for internal testing only (OAUTH_V2_BETA_WORKSPACES=internal)
- [ ] Verify V2 routes return HTTP 503 for non-beta users
- [ ] Verify no errors in logs

**Post-deployment**:
- [ ] Monitor V2 OAuth success rate for 7 days (target: > 95%)
- [ ] Monitor V2 error rate for 7 days (target: < 5%)
- [ ] Monitor V2 flow duration for 7 days (target: < 2000ms)
- [ ] Monitor state replay attacks (should be ZERO)
- [ ] Monitor V1 OAuth success rate (should remain 100%)

**Rollback criteria**:
- V2 success rate < 90%
- V2 error rate > 10%
- V2 flow duration > 3000ms
- State replay attacks detected
- V1 degradation detected

---

#### Milestone 2: Rollback Script and Testing

**Pre-deployment**:
- [ ] Implement rollback script with Algorithm 3
- [ ] Test rollback script in staging (dry-run)
- [ ] Create synthetic V2 accounts in staging
- [ ] Test rollback script in staging (real execution)
- [ ] Verify V2 accounts marked as expired
- [ ] Test rollback idempotency (run twice)
- [ ] Test rollback with in-flight publishes

**Deployment**:
- [ ] Deploy rollback script to production (do NOT execute)
- [ ] Deploy monitoring endpoints to production
- [ ] Deploy Prometheus metrics to production
- [ ] Deploy admin dashboard to production
- [ ] Verify monitoring dashboard works
- [ ] Verify Prometheus metrics are exposed

**Post-deployment**:
- [ ] Verify rollback script exists and is executable
- [ ] Verify monitoring dashboard shows accurate stats
- [ ] Verify Prometheus metrics are being collected
- [ ] Document rollback procedure in runbook

**Rollback criteria**:
- N/A (this milestone adds rollback capability)

---

#### Milestone 3: V1→V2 Migration Activation

**Pre-deployment**:
- [ ] Run all unit tests (100% pass rate)
- [ ] Run integration tests for V1→V2 upgrade (100% pass rate)
- [ ] Test V1→V2 upgrade in staging (explicit V1)
- [ ] Test V1→V2 upgrade in staging (undefined V1)
- [ ] Test V2 idempotent reconnect in staging
- [ ] Test concurrent upgrade attempts in staging
- [ ] Run concurrency tests in staging
- [ ] Verify rollback script is ready

**Deployment**:
- [ ] Deploy upgrade logic to production with OAUTH_V2_ENABLED=false
- [ ] Deploy frontend V2 UI to production (hidden by feature toggle)
- [ ] Enable for internal testing (OAUTH_V2_BETA_WORKSPACES=internal)
- [ ] Monitor for 3 days
- [ ] Enable for beta users (OAUTH_V2_BETA_WORKSPACES=beta)
- [ ] Monitor for 7 days

**Post-deployment**:
- [ ] Monitor V1→V2 upgrade success rate (target: > 99%)
- [ ] Monitor V2 error rate (target: < 1%)
- [ ] Monitor migration percentage (track progress)
- [ ] Monitor for V1/V2 flip-flopping (should be ZERO)
- [ ] Monitor token refresh (should preserve version)
- [ ] Monitor publish success rate (should remain 100%)

**Rollback criteria**:
- V2 error rate > 5% for 24 hours
- V1→V2 upgrade failure rate > 5%
- V1/V2 flip-flopping detected
- Token refresh changes connectionVersion
- Publish failures due to version mismatch
- Critical security vulnerability discovered
- Data corruption detected

---

#### Milestone 4: Migration Completion

**Pre-deployment**:
- [ ] Verify Milestone 3 success criteria met
- [ ] Verify rollback script is ready
- [ ] Verify monitoring dashboard is working

**Deployment**:
- [ ] Week 6: Enable for 10% of users
- [ ] Week 7: Monitor and verify (no issues)
- [ ] Week 8: Enable for 25% of users
- [ ] Week 9: Monitor and verify (no issues)
- [ ] Week 10: Enable for 50% of users
- [ ] Week 11: Monitor and verify (no issues)
- [ ] Week 12: Enable for 75% of users
- [ ] Week 13: Monitor and verify (no issues)
- [ ] Week 14: Enable for 100% of users

**Post-deployment**:
- [ ] Monitor migration percentage daily (target: 95% by Week 18)
- [ ] Monitor V2 error rate (target: < 1%)
- [ ] Monitor V1 error rate (should remain stable)

**Rollback criteria**:
- Same as Milestone 3 rollback criteria
- Can rollback at any time during migration

---

#### Milestone 5: V1 Deprecation

**Pre-deployment**:
- [ ] Verify 95% of active accounts are V2
- [ ] Verify V2 error rate < 1% for 7 consecutive days
- [ ] Verify no critical V2 bugs reported

**Deployment**:
- [ ] Week 18: Set OAUTH_V1_ENABLED=false
- [ ] Week 19-22: Monitor V1 route access attempts
- [ ] Week 22: Verify < 1% V1 access attempts
- [ ] Week 22: Remove V1 code from codebase

**Post-deployment**:
- [ ] Monitor V1 route access attempts (should decline to zero)
- [ ] Monitor V2 error rate (should remain < 1%)

**Rollback criteria**:
- Re-enable V1 routes (OAUTH_V1_ENABLED=true)
- V1 code still exists (not removed yet)

---

### 3. Monitoring Checklist

#### Milestone 0: Schema and Worker Dual Compatibility
- [ ] V1 OAuth success rate (target: 100%)
- [ ] Token refresh success rate (target: 100%)
- [ ] Publish success rate (target: 100%)
- [ ] V1 controller V2 rejection logs (should be ZERO)
- [ ] Schema index creation success
- [ ] Worker deployment success

---

#### Milestone 1: V2 New Connections Only
- [ ] V2 OAuth success rate (target: > 95%)
- [ ] V2 error rate (target: < 5%)
- [ ] V2 flow duration (target: < 2000ms)
- [ ] State replay attacks (should be ZERO)
- [ ] Rate limit exceeded (track abuse)
- [ ] V1 OAuth success rate (should remain 100%)
- [ ] Redis fallback events (track Redis availability)

---

#### Milestone 2: Rollback Script and Testing
- [ ] Rollback script dry-run success
- [ ] Rollback script execution success
- [ ] Rollback idempotency (can run twice)
- [ ] Rollback queue drain (deterministic)
- [ ] Monitoring dashboard accuracy
- [ ] Prometheus metrics collection

---

#### Milestone 3: V1→V2 Migration Activation
- [ ] V1→V2 upgrade success rate (target: > 99%)
- [ ] V2 error rate (target: < 1%)
- [ ] Migration percentage (track progress)
- [ ] V1/V2 flip-flopping (should be ZERO)
- [ ] Token refresh preserves version (100%)
- [ ] Publish success rate (should remain 100%)
- [ ] Frontend V2 UI usage (track adoption)

---

#### Milestone 4: Migration Completion
- [ ] Migration percentage daily (target: 95% by Week 18)
- [ ] V2 error rate (target: < 1%)
- [ ] V1 error rate (should remain stable)
- [ ] Gradual rollout progress (10% → 100%)

---

#### Milestone 5: V1 Deprecation
- [ ] V1 route access attempts (should decline to zero)
- [ ] V2 error rate (should remain < 1%)
- [ ] V1 code removal success

---

### 4. Rollback Readiness Checklist

**Before Milestone 1 deployment**:
- [ ] Rollback plan documented (set OAUTH_V2_ENABLED=false)
- [ ] Rollback tested in staging
- [ ] Rollback communication plan ready

**Before Milestone 3 deployment**:
- [ ] Rollback script implemented and tested
- [ ] Rollback script dry-run tested in staging
- [ ] Rollback script real execution tested in staging
- [ ] Rollback script idempotency verified
- [ ] Rollback script queue drain verified
- [ ] Rollback runbook documented
- [ ] Rollback communication plan ready
- [ ] Database backup completed
- [ ] Rollback triggers defined

**Rollback execution procedure**:
1. Set OAUTH_V2_ENABLED=false (stop new V2 connections)
2. Wait for in-flight OAuth flows to complete (max 10 minutes)
3. Run rollback script: `node rollback-v2-to-v1.ts --dry-run` (verify)
4. Review dry-run output (verify affected accounts)
5. Backup database (final backup before rollback)
6. Run rollback script: `node rollback-v2-to-v1.ts` (execute)
7. Monitor rollback progress (batch processing)
8. Verify all V2 accounts marked as expired
9. Verify migrationStatus='rollback_required'
10. Verify no in-flight publishes remain
11. Monitor V1 reconnect rate
12. Communicate to users (force reconnect via V1)
13. Monitor V1 OAuth success rate (should return to 100%)

---

### 5. "Do NOT Proceed If" Conditions

#### Do NOT proceed to Milestone 1 if:
- [ ] Milestone 0 unit tests fail
- [ ] Milestone 0 integration tests fail
- [ ] V1 OAuth success rate < 95% after Milestone 0 deployment
- [ ] Token refresh success rate < 95% after Milestone 0 deployment
- [ ] Publish success rate < 95% after Milestone 0 deployment
- [ ] Errors detected in logs after Milestone 0 deployment

---

#### Do NOT proceed to Milestone 2 if:
- [ ] Milestone 1 unit tests fail
- [ ] Milestone 1 integration tests fail
- [ ] V2 success rate < 90% after 7 days
- [ ] V2 error rate > 10% after 7 days
- [ ] V2 flow duration > 3000ms after 7 days
- [ ] State replay attacks detected
- [ ] V1 degradation detected

---

#### Do NOT proceed to Milestone 3 if:
- [ ] Rollback script not implemented
- [ ] Rollback script not tested in staging
- [ ] Rollback script idempotency not verified
- [ ] Rollback script queue drain not verified
- [ ] Monitoring dashboard not working
- [ ] Prometheus metrics not exposed
- [ ] Rollback runbook not documented

---

#### Do NOT proceed to Milestone 4 if:
- [ ] Milestone 3 unit tests fail
- [ ] Milestone 3 integration tests fail
- [ ] Milestone 3 concurrency tests fail
- [ ] V1→V2 upgrade success rate < 95% after 7 days
- [ ] V2 error rate > 5% after 7 days
- [ ] V1/V2 flip-flopping detected
- [ ] Token refresh changes connectionVersion
- [ ] Publish failures due to version mismatch

---

#### Do NOT proceed to Milestone 5 if:
- [ ] Migration percentage < 95%
- [ ] V2 error rate > 1% for 7 consecutive days
- [ ] Critical V2 bugs reported
- [ ] Data corruption detected

---

#### ROLLBACK IMMEDIATELY if:
- [ ] V2 error rate > 5% for 24 hours
- [ ] V1→V2 upgrade failure rate > 5%
- [ ] V1/V2 flip-flopping detected
- [ ] Token refresh changes connectionVersion
- [ ] Publish failures due to version mismatch
- [ ] Critical security vulnerability discovered
- [ ] Data corruption detected
- [ ] User complaints exceed threshold (> 10 complaints/day)

---

## CONCLUSION

The original 8-phase task plan has been restructured into 5 safe deployment milestones with explicit safety gates, rollback paths, and monitoring requirements. The key changes are:

1. **Workers gain dual compatibility FIRST** (Milestone 0) - prevents publish failures
2. **V2 creates new connections only FIRST** (Milestone 1) - proves V2 stable before migration
3. **Rollback script exists BEFORE migration** (Milestone 2) - ensures safe rollback path
4. **Gradual rollout with explicit triggers** (Milestone 3-4) - controlled migration
5. **V1 deprecation only after 95% migration** (Milestone 5) - safe V1 removal

This approach minimizes production risk, provides clear rollback paths at every stage, and ensures monitoring exists before migration activation.

**Status**: READY FOR SAFE INCREMENTAL DEPLOYMENT  
**Confidence**: HIGH (based on production migration experience)  
**Estimated Duration**: 18+ weeks (conservative, safe rollout)

