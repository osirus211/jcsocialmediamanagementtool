# Milestone 0: Pre-Implementation Verification Checklist

**Milestone**: Schema and Worker Dual Compatibility  
**Date**: 2026-02-28  
**Classification**: PRE-IMPLEMENTATION VERIFICATION  
**Status**: VERIFICATION CONTROLS ONLY - NO CODING YET  

---

## OVERVIEW

This checklist must be completed BEFORE any code is written for Milestone 0. It establishes verification controls to ensure safe deployment of schema changes and worker dual compatibility.

**Milestone 0 Scope**:
- Task 1: V2 project structure and utilities
- Task 2.1: Social Account model extension (schema only)
- Task 2.3: MongoDB indexes creation
- Task 3.1: SecurityAuditService (logging infrastructure)
- Task 13: V1 controller rejects V2 accounts
- Task 14.1: TokenRefreshWorker preserves connectionVersion
- Task 15: PublishingWorker handles both versions

**Critical Principle**: Schema changes are additive (optional fields), workers gain dual compatibility BEFORE any V2 accounts exist, zero risk to existing V1 flows.

---

## SECTION 1: SCHEMA VERIFICATION

### 1.1 Schema Design Verification

**Objective**: Verify schema changes are additive and backward compatible

**Verification Controls**:

- [ ] **VC-S1.1**: Verify all new fields are OPTIONAL (not required)
  - connectionVersion: optional (default 'v2' for new connections only)
  - securityMetadata: optional
  - scopeValidation: optional
  - migrationStatus: optional
  - migratedAt: optional
  - **Verification method**: Review schema definition, confirm no `required: true`
  - **Pass criteria**: All new fields have `required: false` or are omitted (default optional)

- [ ] **VC-S1.2**: Verify NO changes to existing V1 fields
  - workspaceId: unchanged
  - provider: unchanged
  - providerUserId: unchanged
  - accountName: unchanged
  - accessToken: unchanged (string format, NOT object)
  - refreshToken: unchanged (string format, NOT object)
  - tokenExpiresAt: unchanged
  - encryptionKeyVersion: unchanged
  - scopes: unchanged
  - status: unchanged
  - lastRefreshedAt: unchanged
  - metadata: unchanged
  - lastSyncAt: unchanged
  - createdAt: unchanged
  - updatedAt: unchanged
  - **Verification method**: Diff schema before/after changes
  - **Pass criteria**: Zero modifications to existing fields

- [ ] **VC-S1.3**: Verify NO new required fields added
  - **Verification method**: Search schema for `required: true` on new fields
  - **Pass criteria**: Zero new required fields

- [ ] **VC-S1.4**: Verify encryption format unchanged
  - accessToken: string format (NOT object)
  - refreshToken: string format (NOT object)
  - NO accessTokenV2 field
  - NO refreshTokenV2 field
  - **Verification method**: Review schema definition
  - **Pass criteria**: Token fields remain string type


- [ ] **VC-S1.5**: Verify compound unique index unchanged
  - Existing index: (workspaceId, provider, providerUserId)
  - **Verification method**: Review index definitions
  - **Pass criteria**: Compound unique index remains unchanged

- [ ] **VC-S1.6**: Verify new indexes are non-blocking
  - connectionVersion: single field index
  - migrationStatus: single field index
  - securityMetadata.suspiciousActivityDetected: nested field index
  - **Verification method**: Review index creation script
  - **Pass criteria**: Indexes created with `background: true` option

---

### 1.2 Schema Migration Script Verification

**Objective**: Verify index creation script is safe and idempotent

**Verification Controls**:

- [ ] **VC-S2.1**: Verify script is idempotent
  - Script checks if index exists before creating
  - Script does NOT drop existing indexes
  - Script can be run multiple times safely
  - **Verification method**: Review script logic
  - **Pass criteria**: Script uses `createIndex` with `background: true`, checks existence

- [ ] **VC-S2.2**: Verify script has dry-run mode
  - Script supports --dry-run flag
  - Dry-run logs planned changes without executing
  - **Verification method**: Review script CLI arguments
  - **Pass criteria**: --dry-run flag implemented

- [ ] **VC-S2.3**: Verify script has rollback capability
  - Script can drop created indexes
  - Script logs index names for rollback
  - **Verification method**: Review script rollback logic
  - **Pass criteria**: Script has dropIndex capability

- [ ] **VC-S2.4**: Verify script has progress logging
  - Script logs each index creation
  - Script logs success/failure per index
  - Script logs total execution time
  - **Verification method**: Review script logging
  - **Pass criteria**: Comprehensive logging implemented

- [ ] **VC-S2.5**: Verify script has error handling
  - Script catches index creation errors
  - Script continues on non-critical errors
  - Script exits on critical errors
  - **Verification method**: Review script error handling
  - **Pass criteria**: Try-catch blocks around index operations

---

### 1.3 Schema Backward Compatibility Verification

**Objective**: Verify existing V1 accounts work with new schema

**Verification Controls**:

- [ ] **VC-S3.1**: Verify V1 accounts can be read
  - Accounts with undefined connectionVersion can be queried
  - Accounts with undefined securityMetadata can be queried
  - Accounts with undefined scopeValidation can be queried
  - **Verification method**: Test query with existing V1 account structure
  - **Pass criteria**: Queries succeed, no errors

- [ ] **VC-S3.2**: Verify V1 accounts can be updated
  - Update accessToken without touching new fields
  - Update refreshToken without touching new fields
  - Update status without touching new fields
  - **Verification method**: Test update operations on V1 accounts
  - **Pass criteria**: Updates succeed, new fields remain undefined

- [ ] **VC-S3.3**: Verify V1 accounts can be deleted
  - Delete operation works with undefined new fields
  - **Verification method**: Test delete operation on V1 accounts
  - **Pass criteria**: Delete succeeds, no errors

- [ ] **VC-S3.4**: Verify V1 encryption/decryption unchanged
  - Decrypt existing V1 accessToken
  - Decrypt existing V1 refreshToken
  - Encrypt new tokens with V1 format
  - **Verification method**: Test encryption utility with V1 accounts
  - **Pass criteria**: Encryption/decryption works unchanged

---

## SECTION 2: WORKER COMPATIBILITY TESTS

### 2.1 TokenRefreshWorker Verification

**Objective**: Verify TokenRefreshWorker preserves connectionVersion

**Verification Controls**:

- [ ] **VC-W1.1**: Verify worker reads connectionVersion safely
  - Worker handles undefined connectionVersion (legacy V1)
  - Worker handles connectionVersion='v1'
  - Worker handles connectionVersion='v2'
  - **Verification method**: Code review of worker logic
  - **Pass criteria**: Worker normalizes undefined to 'v1' for logging

- [ ] **VC-W1.2**: Verify worker NEVER modifies connectionVersion
  - Update query does NOT include connectionVersion in $set
  - Update query uses $unset guard to prevent accidental modification
  - **Verification method**: Code review of update query
  - **Pass criteria**: connectionVersion NOT in update document

- [ ] **VC-W1.3**: Verify worker updates only token fields
  - Update includes: accessToken, refreshToken, tokenExpiresAt, lastRefreshedAt, status, updatedAt
  - Update excludes: connectionVersion, securityMetadata, scopeValidation, migrationStatus
  - **Verification method**: Code review of update document
  - **Pass criteria**: Only token fields in update document

- [ ] **VC-W1.4**: Verify worker logs connectionVersion
  - Worker logs connectionVersion before refresh
  - Worker logs connectionVersion after refresh
  - Worker logs if connectionVersion was normalized
  - **Verification method**: Code review of logging statements
  - **Pass criteria**: connectionVersion logged at start and end

- [ ] **VC-W1.5**: Verify worker handles all scenarios
  - Scenario 1: V1 account (connectionVersion='v1') → refresh → remains 'v1'
  - Scenario 2: V2 account (connectionVersion='v2') → refresh → remains 'v2'
  - Scenario 3: Legacy account (connectionVersion=undefined) → refresh → remains undefined
  - **Verification method**: Test cases for all scenarios
  - **Pass criteria**: All scenarios pass, connectionVersion preserved

---

### 2.2 PublishingWorker Verification

**Objective**: Verify PublishingWorker handles both V1 and V2 accounts

**Verification Controls**:

- [ ] **VC-W2.1**: Verify worker checks connectionVersion before decryption
  - Worker reads connectionVersion field
  - Worker branches on connectionVersion value
  - **Verification method**: Code review of worker logic
  - **Pass criteria**: Explicit connectionVersion check before decryption

- [ ] **VC-W2.2**: Verify worker handles undefined connectionVersion
  - Worker treats undefined as V1
  - Worker uses V1 decryption for undefined
  - **Verification method**: Code review of branching logic
  - **Pass criteria**: Undefined handled as V1

- [ ] **VC-W2.3**: Verify worker uses correct decryption
  - V1 accounts: use V1 decryption
  - V2 accounts: use V1 decryption (same format)
  - Legacy accounts: use V1 decryption
  - **Verification method**: Code review of decryption calls
  - **Pass criteria**: All paths use V1 decryption

- [ ] **VC-W2.4**: Verify worker logs connectionVersion
  - Worker logs connectionVersion in publish metrics
  - Worker logs connectionVersion on success
  - Worker logs connectionVersion on failure
  - **Verification method**: Code review of logging statements
  - **Pass criteria**: connectionVersion logged in all paths

- [ ] **VC-W2.5**: Verify worker handles all scenarios
  - Scenario 1: V1 account → publish → success
  - Scenario 2: V2 account → publish → success
  - Scenario 3: Legacy account → publish → success
  - **Verification method**: Test cases for all scenarios
  - **Pass criteria**: All scenarios pass, publishing works

---

### 2.3 V1 Controller Verification

**Objective**: Verify V1 controller rejects V2 accounts

**Verification Controls**:

- [ ] **VC-W3.1**: Verify controller checks connectionVersion
  - Controller reads connectionVersion field
  - Controller checks if connectionVersion='v2'
  - **Verification method**: Code review of controller logic
  - **Pass criteria**: Explicit connectionVersion check

- [ ] **VC-W3.2**: Verify controller rejects V2 accounts
  - If connectionVersion='v2', return error
  - Error message: "Please use V2 flow to reconnect"
  - HTTP status: 400 Bad Request
  - **Verification method**: Code review of error handling
  - **Pass criteria**: V2 accounts rejected with clear error

- [ ] **VC-W3.3**: Verify controller logs rejection
  - Log warning with accountId
  - Log warning with workspaceId
  - Log warning with provider
  - **Verification method**: Code review of logging statements
  - **Pass criteria**: Rejection logged with context

- [ ] **VC-W3.4**: Verify controller allows V1 accounts
  - connectionVersion='v1' → allow
  - connectionVersion=undefined → allow
  - **Verification method**: Code review of branching logic
  - **Pass criteria**: V1 and undefined allowed

- [ ] **VC-W3.5**: Verify controller prevents flip-flopping
  - V2 accounts cannot be downgraded to V1
  - V1 controller does NOT modify connectionVersion
  - **Verification method**: Code review of update logic
  - **Pass criteria**: No connectionVersion modification in V1 controller

---

## SECTION 3: BACKWARD COMPATIBILITY TESTS

### 3.1 V1 OAuth Flow Verification

**Objective**: Verify V1 OAuth flow remains 100% functional

**Verification Controls**:

- [ ] **VC-B1.1**: Verify V1 authorize endpoint unchanged
  - Route: POST /api/v1/oauth/:platform/authorize
  - Request format unchanged
  - Response format unchanged
  - **Verification method**: API contract test
  - **Pass criteria**: V1 authorize works unchanged

- [ ] **VC-B1.2**: Verify V1 callback endpoint unchanged
  - Route: GET /api/v1/oauth/:platform/callback
  - Request format unchanged
  - Response format unchanged
  - **Verification method**: API contract test
  - **Pass criteria**: V1 callback works unchanged

- [ ] **VC-B1.3**: Verify V1 account creation unchanged
  - New V1 accounts created with undefined connectionVersion
  - New V1 accounts have all required V1 fields
  - New V1 accounts do NOT have V2 fields populated
  - **Verification method**: Test V1 account creation
  - **Pass criteria**: V1 accounts created as before

- [ ] **VC-B1.4**: Verify V1 account update unchanged
  - Existing V1 accounts updated without touching new fields
  - connectionVersion remains undefined
  - securityMetadata remains undefined
  - scopeValidation remains undefined
  - **Verification method**: Test V1 account update
  - **Pass criteria**: V1 accounts updated as before

- [ ] **VC-B1.5**: Verify V1 error handling unchanged
  - V1 errors return same error codes
  - V1 errors return same error messages
  - V1 errors return same HTTP status codes
  - **Verification method**: Test V1 error scenarios
  - **Pass criteria**: V1 errors unchanged

---

### 3.2 V1 Token Refresh Verification

**Objective**: Verify V1 token refresh remains 100% functional

**Verification Controls**:

- [ ] **VC-B2.1**: Verify token refresh for V1 accounts
  - Refresh V1 account (connectionVersion='v1')
  - Refresh legacy account (connectionVersion=undefined)
  - **Verification method**: Test token refresh
  - **Pass criteria**: Refresh succeeds, connectionVersion preserved

- [ ] **VC-B2.2**: Verify token refresh updates only token fields
  - accessToken updated
  - refreshToken updated
  - tokenExpiresAt updated
  - lastRefreshedAt updated
  - status updated
  - connectionVersion NOT updated
  - **Verification method**: Test token refresh, inspect updated fields
  - **Pass criteria**: Only token fields updated

- [ ] **VC-B2.3**: Verify token refresh error handling unchanged
  - No refresh token → mark as expired
  - Decryption failed → mark as expired
  - Provider refresh failed → mark as expired
  - **Verification method**: Test error scenarios
  - **Pass criteria**: Error handling unchanged

---

### 3.3 V1 Publishing Verification

**Objective**: Verify V1 publishing remains 100% functional

**Verification Controls**:

- [ ] **VC-B3.1**: Verify publishing for V1 accounts
  - Publish with V1 account (connectionVersion='v1')
  - Publish with legacy account (connectionVersion=undefined)
  - **Verification method**: Test publishing
  - **Pass criteria**: Publishing succeeds

- [ ] **VC-B3.2**: Verify token decryption unchanged
  - Decrypt V1 accessToken
  - Decrypt V1 refreshToken
  - **Verification method**: Test decryption
  - **Pass criteria**: Decryption succeeds

- [ ] **VC-B3.3**: Verify publishing error handling unchanged
  - Account expired → fail gracefully
  - Token decryption failed → fail gracefully
  - Provider API failed → fail gracefully
  - **Verification method**: Test error scenarios
  - **Pass criteria**: Error handling unchanged

---

## SECTION 4: PRODUCTION READINESS CHECKLIST

### 4.1 Code Quality Verification

**Objective**: Verify code meets production quality standards

**Verification Controls**:

- [ ] **VC-P1.1**: Verify code review completed
  - All code changes reviewed by senior engineer
  - All review comments addressed
  - **Verification method**: Code review sign-off
  - **Pass criteria**: Code review approved

- [ ] **VC-P1.2**: Verify unit tests written
  - Task 2.2: SocialAccount model tests (100% coverage)
  - Task 3.2: SecurityAuditService tests (100% coverage)
  - Task 14.2: TokenRefreshWorker tests (100% coverage)
  - **Verification method**: Test coverage report
  - **Pass criteria**: 100% coverage for new code

- [ ] **VC-P1.3**: Verify unit tests pass
  - All unit tests pass in local environment
  - All unit tests pass in CI/CD pipeline
  - **Verification method**: Run test suite
  - **Pass criteria**: 100% pass rate

- [ ] **VC-P1.4**: Verify integration tests written
  - V1 OAuth flow end-to-end test
  - V1 token refresh test
  - V1 publishing test
  - V1 controller V2 rejection test
  - **Verification method**: Test suite review
  - **Pass criteria**: All scenarios covered

- [ ] **VC-P1.5**: Verify integration tests pass
  - All integration tests pass in staging
  - **Verification method**: Run integration test suite
  - **Pass criteria**: 100% pass rate

- [ ] **VC-P1.6**: Verify linting passes
  - ESLint passes with zero errors
  - Prettier formatting applied
  - **Verification method**: Run linter
  - **Pass criteria**: Zero linting errors

- [ ] **VC-P1.7**: Verify TypeScript compilation passes
  - No TypeScript errors
  - No TypeScript warnings
  - **Verification method**: Run tsc
  - **Pass criteria**: Zero compilation errors

---

### 4.2 Security Verification

**Objective**: Verify security controls are in place

**Verification Controls**:

- [ ] **VC-P2.1**: Verify no sensitive data in logs
  - No access tokens logged
  - No refresh tokens logged
  - No encryption keys logged
  - IP addresses hashed before logging
  - **Verification method**: Log output review
  - **Pass criteria**: No sensitive data in logs

- [ ] **VC-P2.2**: Verify encryption unchanged
  - V1 encryption utility unchanged
  - PBKDF2 + AES-256-GCM unchanged
  - Encryption key version unchanged
  - **Verification method**: Code review
  - **Pass criteria**: Encryption unchanged

- [ ] **VC-P2.3**: Verify input validation
  - All user inputs validated
  - All user inputs sanitized before logging
  - **Verification method**: Code review
  - **Pass criteria**: Input validation present

- [ ] **VC-P2.4**: Verify error messages safe
  - No sensitive data in error messages
  - No stack traces exposed to users
  - **Verification method**: Error message review
  - **Pass criteria**: Error messages safe

---

### 4.3 Performance Verification

**Objective**: Verify performance is acceptable

**Verification Controls**:

- [ ] **VC-P3.1**: Verify index creation performance
  - Index creation completes in < 5 minutes (staging)
  - Index creation does not block writes
  - **Verification method**: Test index creation in staging
  - **Pass criteria**: < 5 minutes, non-blocking

- [ ] **VC-P3.2**: Verify query performance unchanged
  - V1 OAuth flow latency unchanged
  - Token refresh latency unchanged
  - Publishing latency unchanged
  - **Verification method**: Performance test in staging
  - **Pass criteria**: Latency within 5% of baseline

- [ ] **VC-P3.3**: Verify database load unchanged
  - Query count unchanged
  - Write count unchanged
  - Index usage unchanged
  - **Verification method**: Database monitoring in staging
  - **Pass criteria**: Load within 5% of baseline

---

### 4.4 Observability Verification

**Objective**: Verify monitoring and logging are in place

**Verification Controls**:

- [ ] **VC-P4.1**: Verify logging implemented
  - Schema changes logged
  - Index creation logged
  - Worker updates logged
  - V1 controller V2 rejection logged
  - **Verification method**: Log output review
  - **Pass criteria**: All events logged

- [ ] **VC-P4.2**: Verify structured logging
  - Logs in JSON format
  - Logs include correlation ID
  - Logs include timestamp
  - Logs include severity level
  - **Verification method**: Log format review
  - **Pass criteria**: Structured logging implemented

- [ ] **VC-P4.3**: Verify metrics exposed
  - V1 OAuth success rate metric
  - Token refresh success rate metric
  - Publish success rate metric
  - V1 controller V2 rejection count metric
  - **Verification method**: Metrics endpoint review
  - **Pass criteria**: All metrics exposed

- [ ] **VC-P4.4**: Verify alerts configured
  - Alert on V1 OAuth success rate < 95%
  - Alert on token refresh success rate < 95%
  - Alert on publish success rate < 95%
  - Alert on V1 controller V2 rejection count > 0
  - **Verification method**: Alert configuration review
  - **Pass criteria**: All alerts configured

---

### 4.5 Documentation Verification

**Objective**: Verify documentation is complete

**Verification Controls**:

- [ ] **VC-P5.1**: Verify schema changes documented
  - New fields documented in schema file
  - New indexes documented in schema file
  - Migration script documented
  - **Verification method**: Documentation review
  - **Pass criteria**: Schema changes documented

- [ ] **VC-P5.2**: Verify worker changes documented
  - TokenRefreshWorker changes documented
  - PublishingWorker changes documented
  - V1 controller changes documented
  - **Verification method**: Documentation review
  - **Pass criteria**: Worker changes documented

- [ ] **VC-P5.3**: Verify deployment guide updated
  - Milestone 0 deployment steps documented
  - Index creation steps documented
  - Rollback steps documented
  - **Verification method**: Deployment guide review
  - **Pass criteria**: Deployment guide complete

- [ ] **VC-P5.4**: Verify runbook updated
  - Troubleshooting steps documented
  - Common issues documented
  - Escalation procedures documented
  - **Verification method**: Runbook review
  - **Pass criteria**: Runbook complete

---

## SECTION 5: ROLLBACK READINESS

### 5.1 Rollback Plan Verification

**Objective**: Verify rollback plan is ready

**Verification Controls**:

- [ ] **VC-R1.1**: Verify rollback plan documented
  - Rollback steps documented
  - Rollback triggers documented
  - Rollback communication plan documented
  - **Verification method**: Rollback plan review
  - **Pass criteria**: Rollback plan complete

- [ ] **VC-R1.2**: Verify rollback tested in staging
  - Schema rollback tested
  - Index rollback tested
  - Worker rollback tested
  - **Verification method**: Rollback test in staging
  - **Pass criteria**: Rollback succeeds in staging

- [ ] **VC-R1.3**: Verify rollback is non-destructive
  - Schema rollback does not delete data
  - Index rollback does not delete data
  - Worker rollback does not delete data
  - **Verification method**: Rollback test review
  - **Pass criteria**: No data loss during rollback

- [ ] **VC-R1.4**: Verify rollback communication ready
  - Rollback notification template ready
  - Rollback escalation contacts identified
  - **Verification method**: Communication plan review
  - **Pass criteria**: Communication plan ready

---

### 5.2 Rollback Procedure Verification

**Objective**: Verify rollback procedure is executable

**Verification Controls**:

- [ ] **VC-R2.1**: Verify schema rollback procedure
  - Step 1: Stop application servers
  - Step 2: Drop new indexes
  - Step 3: Revert schema changes
  - Step 4: Restart application servers
  - **Verification method**: Procedure review
  - **Pass criteria**: Procedure documented and tested

- [ ] **VC-R2.2**: Verify worker rollback procedure
  - Step 1: Deploy previous worker version
  - Step 2: Verify workers running
  - Step 3: Monitor worker metrics
  - **Verification method**: Procedure review
  - **Pass criteria**: Procedure documented and tested

- [ ] **VC-R2.3**: Verify rollback verification steps
  - Verify V1 OAuth success rate returns to 100%
  - Verify token refresh success rate returns to 100%
  - Verify publish success rate returns to 100%
  - Verify no errors in logs
  - **Verification method**: Verification steps review
  - **Pass criteria**: Verification steps documented

---

### 5.3 Rollback Triggers Verification

**Objective**: Verify rollback triggers are defined

**Verification Controls**:

- [ ] **VC-R3.1**: Verify rollback triggers defined
  - Trigger 1: V1 OAuth success rate < 95%
  - Trigger 2: Token refresh success rate < 95%
  - Trigger 3: Publish success rate < 95%
  - Trigger 4: Errors in logs
  - Trigger 5: Database performance degradation
  - **Verification method**: Trigger list review
  - **Pass criteria**: All triggers documented

- [ ] **VC-R3.2**: Verify rollback decision process
  - Who makes rollback decision
  - How quickly rollback can be executed
  - Who executes rollback
  - **Verification method**: Decision process review
  - **Pass criteria**: Decision process documented

---

## SECTION 6: MONITORING SIGNALS

### 6.1 Pre-Deployment Monitoring Baseline

**Objective**: Establish baseline metrics before deployment

**Verification Controls**:

- [ ] **VC-M1.1**: Capture V1 OAuth success rate baseline
  - Measure V1 OAuth success rate for 7 days
  - Calculate average, min, max, p50, p95, p99
  - **Verification method**: Metrics collection
  - **Pass criteria**: Baseline captured
  - **Expected baseline**: > 99% success rate

- [ ] **VC-M1.2**: Capture token refresh success rate baseline
  - Measure token refresh success rate for 7 days
  - Calculate average, min, max, p50, p95, p99
  - **Verification method**: Metrics collection
  - **Pass criteria**: Baseline captured
  - **Expected baseline**: > 99% success rate

- [ ] **VC-M1.3**: Capture publish success rate baseline
  - Measure publish success rate for 7 days
  - Calculate average, min, max, p50, p95, p99
  - **Verification method**: Metrics collection
  - **Pass criteria**: Baseline captured
  - **Expected baseline**: > 95% success rate

- [ ] **VC-M1.4**: Capture database performance baseline
  - Measure query latency for 7 days
  - Measure write latency for 7 days
  - Measure connection count for 7 days
  - **Verification method**: Database monitoring
  - **Pass criteria**: Baseline captured

- [ ] **VC-M1.5**: Capture application performance baseline
  - Measure API latency for 7 days
  - Measure error rate for 7 days
  - Measure throughput for 7 days
  - **Verification method**: APM monitoring
  - **Pass criteria**: Baseline captured

---

### 6.2 Post-Deployment Monitoring Signals

**Objective**: Define monitoring signals for post-deployment

**Verification Controls**:

- [ ] **VC-M2.1**: Define V1 OAuth success rate monitoring
  - Monitor V1 OAuth success rate every 5 minutes
  - Alert if success rate < 95%
  - Alert if success rate drops > 5% from baseline
  - **Verification method**: Alert configuration
  - **Pass criteria**: Alerts configured
  - **Target**: > 99% success rate (no degradation)

- [ ] **VC-M2.2**: Define token refresh success rate monitoring
  - Monitor token refresh success rate every 5 minutes
  - Alert if success rate < 95%
  - Alert if success rate drops > 5% from baseline
  - **Verification method**: Alert configuration
  - **Pass criteria**: Alerts configured
  - **Target**: > 99% success rate (no degradation)

- [ ] **VC-M2.3**: Define publish success rate monitoring
  - Monitor publish success rate every 5 minutes
  - Alert if success rate < 90%
  - Alert if success rate drops > 5% from baseline
  - **Verification method**: Alert configuration
  - **Pass criteria**: Alerts configured
  - **Target**: > 95% success rate (no degradation)

- [ ] **VC-M2.4**: Define V1 controller V2 rejection monitoring
  - Monitor V1 controller V2 rejection count every 5 minutes
  - Alert if rejection count > 0
  - **Verification method**: Alert configuration
  - **Pass criteria**: Alerts configured
  - **Target**: 0 rejections (no V2 accounts exist yet)

- [ ] **VC-M2.5**: Define database performance monitoring
  - Monitor query latency every 5 minutes
  - Alert if latency increases > 20% from baseline
  - Monitor connection count every 5 minutes
  - Alert if connection count increases > 20% from baseline
  - **Verification method**: Alert configuration
  - **Pass criteria**: Alerts configured
  - **Target**: No performance degradation

- [ ] **VC-M2.6**: Define error log monitoring
  - Monitor error logs every 5 minutes
  - Alert on any new error patterns
  - Alert on error rate increase > 10% from baseline
  - **Verification method**: Log monitoring configuration
  - **Pass criteria**: Log monitoring configured
  - **Target**: No new errors

---

### 6.3 Monitoring Dashboard Verification

**Objective**: Verify monitoring dashboard is ready

**Verification Controls**:

- [ ] **VC-M3.1**: Verify dashboard displays V1 metrics
  - V1 OAuth success rate chart
  - Token refresh success rate chart
  - Publish success rate chart
  - **Verification method**: Dashboard review
  - **Pass criteria**: All charts present

- [ ] **VC-M3.2**: Verify dashboard displays worker metrics
  - TokenRefreshWorker execution count
  - PublishingWorker execution count
  - V1 controller V2 rejection count
  - **Verification method**: Dashboard review
  - **Pass criteria**: All metrics present

- [ ] **VC-M3.3**: Verify dashboard displays database metrics
  - Query latency chart
  - Write latency chart
  - Connection count chart
  - Index usage chart
  - **Verification method**: Dashboard review
  - **Pass criteria**: All charts present

- [ ] **VC-M3.4**: Verify dashboard displays error metrics
  - Error rate chart
  - Error count by type chart
  - **Verification method**: Dashboard review
  - **Pass criteria**: All charts present

---

## SECTION 7: FINAL VERIFICATION CHECKLIST

### 7.1 Pre-Implementation Sign-Off

**Objective**: Final verification before implementation begins

**Verification Controls**:

- [ ] **VC-F1.1**: All schema verification controls passed
  - Section 1.1: Schema Design Verification (6 controls)
  - Section 1.2: Schema Migration Script Verification (5 controls)
  - Section 1.3: Schema Backward Compatibility Verification (4 controls)
  - **Pass criteria**: 15/15 controls passed

- [ ] **VC-F1.2**: All worker compatibility controls passed
  - Section 2.1: TokenRefreshWorker Verification (5 controls)
  - Section 2.2: PublishingWorker Verification (5 controls)
  - Section 2.3: V1 Controller Verification (5 controls)
  - **Pass criteria**: 15/15 controls passed

- [ ] **VC-F1.3**: All backward compatibility controls passed
  - Section 3.1: V1 OAuth Flow Verification (5 controls)
  - Section 3.2: V1 Token Refresh Verification (3 controls)
  - Section 3.3: V1 Publishing Verification (3 controls)
  - **Pass criteria**: 11/11 controls passed

- [ ] **VC-F1.4**: All production readiness controls passed
  - Section 4.1: Code Quality Verification (7 controls)
  - Section 4.2: Security Verification (4 controls)
  - Section 4.3: Performance Verification (3 controls)
  - Section 4.4: Observability Verification (4 controls)
  - Section 4.5: Documentation Verification (4 controls)
  - **Pass criteria**: 22/22 controls passed

- [ ] **VC-F1.5**: All rollback readiness controls passed
  - Section 5.1: Rollback Plan Verification (4 controls)
  - Section 5.2: Rollback Procedure Verification (3 controls)
  - Section 5.3: Rollback Triggers Verification (2 controls)
  - **Pass criteria**: 9/9 controls passed

- [ ] **VC-F1.6**: All monitoring signal controls passed
  - Section 6.1: Pre-Deployment Monitoring Baseline (5 controls)
  - Section 6.2: Post-Deployment Monitoring Signals (6 controls)
  - Section 6.3: Monitoring Dashboard Verification (4 controls)
  - **Pass criteria**: 15/15 controls passed

---

### 7.2 Implementation Authorization

**Objective**: Authorize implementation to begin

**Authorization Checklist**:

- [ ] **AUTH-1**: All 87 verification controls passed
- [ ] **AUTH-2**: Code review approved by senior engineer
- [ ] **AUTH-3**: Security review approved by security team
- [ ] **AUTH-4**: Architecture review approved by architect
- [ ] **AUTH-5**: Rollback plan approved by operations team
- [ ] **AUTH-6**: Monitoring plan approved by SRE team
- [ ] **AUTH-7**: Deployment plan approved by release manager

**Authorization Sign-Off**:

- [ ] Senior Engineer: _________________ Date: _______
- [ ] Security Team: _________________ Date: _______
- [ ] Architect: _________________ Date: _______
- [ ] Operations Team: _________________ Date: _______
- [ ] SRE Team: _________________ Date: _______
- [ ] Release Manager: _________________ Date: _______

---

## SUMMARY

**Total Verification Controls**: 87

**Breakdown by Section**:
- Section 1: Schema Verification (15 controls)
- Section 2: Worker Compatibility Tests (15 controls)
- Section 3: Backward Compatibility Tests (11 controls)
- Section 4: Production Readiness Checklist (22 controls)
- Section 5: Rollback Readiness (9 controls)
- Section 6: Monitoring Signals (15 controls)

**Pass Criteria**: 87/87 controls must pass before implementation begins

**Status**: VERIFICATION CONTROLS DEFINED - READY FOR IMPLEMENTATION PLANNING

---

**Document Status**: COMPLETE  
**Next Step**: Begin implementation ONLY after all 87 controls pass  
**Confidence**: HIGH (comprehensive verification controls)

