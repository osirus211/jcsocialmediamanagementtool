# Milestone 0: Deployment Checklist

**Goal**: Deploy schema and worker patches safely within 1-2 days  
**Risk Level**: MINIMAL (additive changes only, no behavior change for V1)

---

## Pre-Deployment Checklist

### 1. Schema Change Verified
- [ ] `connectionVersion` field added to ISocialAccount interface
- [ ] `connectionVersion` field added to Mongoose schema with `required: false`
- [ ] Field has no default value (`default: undefined`)
- [ ] Field accepts only 'v1' or 'v2' values
- [ ] TypeScript compiles without errors: `npm run build`

### 2. Unit Tests Pass
- [ ] All 4 new Milestone 0 tests pass
- [ ] All existing tests still pass
- [ ] Run: `npm test -- PublishingWorker.milestone0.test.ts`
- [ ] Run: `npm test -- TokenRefreshWorker.milestone0.test.ts`
- [ ] Run: `npm test` (full test suite)

### 3. Worker Patches Verified
- [ ] PublishingWorker selects `+connectionVersion` in query
- [ ] PublishingWorker normalizes undefined to 'v1' for logging
- [ ] PublishingWorker logs connectionVersion
- [ ] TokenRefreshWorker selects `+connectionVersion` in query
- [ ] TokenRefreshWorker normalizes undefined to 'v1' for logging
- [ ] TokenRefreshWorker does NOT include connectionVersion in update
- [ ] TokenRefreshWorker logs connectionVersion before and after refresh

### 4. Staging Deployment
- [ ] Deploy to staging environment
- [ ] Verify no errors in logs
- [ ] Check TypeScript compilation
- [ ] Check worker startup logs

### 5. V1 OAuth Flow Test (Staging)
- [ ] Create new V1 OAuth connection in staging
- [ ] Verify account created with connectionVersion=undefined
- [ ] Verify OAuth flow works normally
- [ ] Check database: account should have no connectionVersion field

### 6. Token Refresh Test (Staging)
- [ ] Trigger token refresh for V1 account in staging
- [ ] Verify connectionVersion remains undefined
- [ ] Verify tokens refreshed successfully
- [ ] Check logs: should show connectionVersion='v1' (normalized)

### 7. Publishing Test (Staging)
- [ ] Publish post with V1 account in staging
- [ ] Verify connectionVersion logged as 'v1'
- [ ] Verify post published successfully
- [ ] Check logs: should show connectionVersion='v1' (normalized)

### 8. Monitoring Baseline (Production)
- [ ] Capture current V1 OAuth success rate: ____%
- [ ] Capture current token refresh success rate: ____%
- [ ] Capture current publish success rate: ____%
- [ ] Document baseline metrics for comparison

### 9. Rollback Plan Ready
- [ ] Rollback script prepared: `git revert <commit-hash>`
- [ ] Rollback tested in staging: YES / NO
- [ ] Team notified of deployment window
- [ ] Rollback contact person identified: __________

### 10. Production Deployment Approved
- [ ] Code review approved by: __________
- [ ] All staging tests passed: YES / NO
- [ ] Rollback plan documented: YES / NO
- [ ] Deploy to production: `npm run deploy:production`

---

## Deployment Steps

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge milestone-0-schema-workers
   git push origin main
   ```

2. **Deploy to production**
   ```bash
   npm run deploy:production
   # OR use your deployment pipeline
   ```

3. **Verify deployment**
   - Check application logs for errors
   - Verify workers started successfully
   - Check database connection

---

## Post-Deployment Monitoring (24 Hours)

### Success Criteria (All must be true)

- [ ] **V1 OAuth success rate**: No degradation (within 1% of baseline)
- [ ] **Token refresh success rate**: No degradation (within 1% of baseline)
- [ ] **Publish success rate**: No degradation (within 1% of baseline)
- [ ] **Error logs**: No new errors related to connectionVersion
- [ ] **Worker logs**: connectionVersion logged correctly ('v1' for undefined)

### Monitoring Checklist

**Hour 1** (Immediate):
- [ ] Check application logs for errors
- [ ] Verify workers are running
- [ ] Check first V1 OAuth connection works
- [ ] Check first token refresh works
- [ ] Check first publish works

**Hour 4**:
- [ ] Review error logs (should be zero new errors)
- [ ] Check V1 OAuth success rate
- [ ] Check token refresh success rate
- [ ] Check publish success rate

**Hour 12**:
- [ ] Review metrics dashboard
- [ ] Verify no connectionVersion-related errors
- [ ] Check worker heartbeat logs

**Hour 24**:
- [ ] Final metrics review
- [ ] Compare to baseline (should be within 1%)
- [ ] Document any anomalies
- [ ] Approve or rollback

---

## Rollback Triggers (Immediate rollback if ANY occur)

- [ ] V1 OAuth success rate drops > 5%
- [ ] Token refresh success rate drops > 5%
- [ ] Publish success rate drops > 5%
- [ ] New errors in logs related to connectionVersion
- [ ] Worker crashes or failures
- [ ] Database connection issues
- [ ] Any production incident reported

---

## Rollback Procedure (5 Minutes)

### Step 1: Revert Code
```bash
git revert <commit-hash>
git push origin main
npm run deploy:production
```

### Step 2: Verify Rollback
- [ ] Check V1 OAuth success rate returns to baseline
- [ ] Check token refresh success rate returns to baseline
- [ ] Check publish success rate returns to baseline
- [ ] Check no errors in logs
- [ ] Verify workers running normally

### Step 3: No Data Cleanup Needed
- connectionVersion field is optional
- Existing accounts with connectionVersion set will ignore it
- No data loss or corruption
- No manual database changes required

---

## Success Criteria Summary

**Milestone 0 is successful if**:
- All V1 flows work unchanged (100% backward compatible)
- Workers log connectionVersion correctly ('v1' for undefined)
- No errors in logs
- No performance degradation
- 24-hour monitoring shows stable metrics

**If successful, proceed to Milestone 1 planning**

---

## Notes

- **Risk Level**: MINIMAL - Schema change is additive (optional field)
- **Backward Compatibility**: 100% - All V1 flows unchanged
- **Rollback**: Easy - Revert code, no data cleanup needed
- **Duration**: 1-2 days (implementation + testing + deployment)
- **Next Milestone**: Milestone 1 - V2 New Connections Only (Week 2)

---

**Deployment Date**: __________  
**Deployed By**: __________  
**Approved By**: __________  
**Status**: [ ] Not Started [ ] In Progress [ ] Completed [ ] Rolled Back
