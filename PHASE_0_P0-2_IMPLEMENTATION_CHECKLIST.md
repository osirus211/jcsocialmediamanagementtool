# Phase 0, Task P0-2: Implementation Checklist

Use this checklist to track implementation progress.

## Pre-Implementation

- [ ] Review integration plan (`PHASE_0_P0-2_INTEGRATION_PLAN.md`)
- [ ] Create feature branch: `feature/phase-0-p0-2-redis-state-integration`
- [ ] Backup current OAuthManager and OAuthController
- [ ] Verify Redis is running and accessible
- [ ] Verify OAuthStateService tests pass

## Code Changes

### 1. Create New Utilities

- [ ] Create `apps/backend/src/utils/ipExtraction.ts`
  - [ ] Implement `getClientIp(req)` function
  - [ ] Implement `getUserAgent(req)` function
  - [ ] Add TRUSTED_PROXIES configuration
  - [ ] Add JSDoc comments

- [ ] Create `apps/backend/src/middleware/correlationId.ts`
  - [ ] Implement correlation ID middleware
  - [ ] Generate UUID for each request
  - [ ] Attach to `req.correlationId`
  - [ ] Add to response headers (`X-Correlation-ID`)

### 2. Update OAuthManager

- [ ] Open `apps/backend/src/services/oauth/OAuthManager.ts`
- [ ] Remove `private stateStore: Map<string, OAuthState>`
- [ ] Remove `private readonly STATE_EXPIRY_MS`
- [ ] Remove `interface OAuthState` (if not used elsewhere)
- [ ] Delete `storeState()` method
- [ ] Delete `retrieveState()` method
- [ ] Delete `startStateCleanup()` method
- [ ] Remove `this.startStateCleanup()` from constructor
- [ ] Verify no compilation errors

### 3. Update OAuthController Imports

- [ ] Open `apps/backend/src/controllers/OAuthController.ts`
- [ ] Update import: `import { oauthStateService } from '../services/oauth/OAuthStateService'`
- [ ] Add import: `import { getClientIp, getUserAgent } from '../utils/ipExtraction'`
- [ ] Add import: `import type { StateValidationResult } from '../services/oauth/OAuthStateService'`
- [ ] Verify imports resolve correctly

### 4. Update OAuthController.authorize()

- [ ] Add IP extraction: `const clientIp = getClientIp(req)`
- [ ] Add UA extraction: `const userAgent = getUserAgent(req)`
- [ ] Add correlation ID: `const correlationId = req.correlationId || crypto.randomUUID()`

**For Twitter:**
- [ ] Update `createState()` call with new interface
- [ ] Add try-catch for Redis errors (fail-closed)
- [ ] Update logging with correlation ID
- [ ] Test Twitter OAuth flow

**For Facebook:**
- [ ] Update `createState()` call with new interface
- [ ] Add try-catch for Redis errors (fail-closed)
- [ ] Update logging with correlation ID
- [ ] Test Facebook OAuth flow

**For Instagram:**
- [ ] Update `createState()` call with new interface
- [ ] Add try-catch for Redis errors (fail-closed)
- [ ] Update logging with correlation ID
- [ ] Test Instagram OAuth flow

**For YouTube:**
- [ ] Update `createState()` call with new interface
- [ ] Add try-catch for Redis errors (fail-closed)
- [ ] Update logging with correlation ID
- [ ] Test YouTube OAuth flow

**For LinkedIn:**
- [ ] Update `createState()` call with new interface
- [ ] Add try-catch for Redis errors (fail-closed)
- [ ] Update logging with correlation ID
- [ ] Test LinkedIn OAuth flow

**For Threads:**
- [ ] Update `createState()` call with new interface
- [ ] Add try-catch for Redis errors (fail-closed)
- [ ] Update logging with correlation ID
- [ ] Test Threads OAuth flow

**For Google Business:**
- [ ] Update `createState()` call with new interface
- [ ] Add try-catch for Redis errors (fail-closed)
- [ ] Update logging with correlation ID
- [ ] Test Google Business OAuth flow

### 5. Update OAuthController.callback()

- [ ] Add IP extraction: `const clientIp = getClientIp(req)`
- [ ] Add UA extraction: `const userAgent = getUserAgent(req)`
- [ ] Add correlation ID: `const correlationId = req.correlationId || crypto.randomUUID()`
- [ ] Replace `consumeState()` call with new interface
- [ ] Handle `StateValidationResult` response
- [ ] Add fail-closed error handling for Redis errors
- [ ] Update all logging with correlation IDs
- [ ] Update error redirects with correlation IDs

### 6. Register Correlation ID Middleware

- [ ] Open `apps/backend/src/app.ts` or main server file
- [ ] Import correlation ID middleware
- [ ] Register before OAuth routes: `app.use(correlationIdMiddleware)`
- [ ] Verify middleware runs for all requests

### 7. Update Environment Configuration

- [ ] Add to `.env.example`: `TRUSTED_PROXIES=`
- [ ] Add to `.env.development`: `TRUSTED_PROXIES=127.0.0.1,::1`
- [ ] Add to `.env.production.example`: `TRUSTED_PROXIES=10.0.0.0/8`
- [ ] Document TRUSTED_PROXIES in README

## Testing

### Unit Tests

- [ ] Run existing OAuthStateService tests: `npm test OAuthStateService.test.ts`
- [ ] Run existing OAuthStateService integration tests: `npm test OAuthStateService.integration.test.ts`
- [ ] Verify all tests pass

### Integration Tests

- [ ] Create `apps/backend/src/controllers/__tests__/OAuthController.integration.test.ts`
- [ ] Test Twitter OAuth flow end-to-end
- [ ] Test Facebook OAuth flow end-to-end
- [ ] Test Instagram OAuth flow end-to-end
- [ ] Test YouTube OAuth flow end-to-end
- [ ] Test LinkedIn OAuth flow end-to-end
- [ ] Test Threads OAuth flow end-to-end
- [ ] Test Google Business OAuth flow end-to-end
- [ ] Test state validation failures (invalid, expired, replay, IP mismatch)
- [ ] Test Redis failure scenarios (fail-closed behavior)
- [ ] Test concurrent OAuth flows (no race conditions)

### Manual Testing

- [ ] Start Redis: `docker run -d -p 6379:6379 redis:7-alpine`
- [ ] Start backend: `npm run dev`
- [ ] Test Twitter OAuth flow manually
- [ ] Test Facebook OAuth flow manually
- [ ] Test Instagram OAuth flow manually
- [ ] Verify state stored in Redis: `redis-cli KEYS "oauth:state:*"`
- [ ] Verify state deleted after consumption: `redis-cli KEYS "oauth:state:*"`
- [ ] Test IP mismatch scenario
- [ ] Test replay attack scenario
- [ ] Test expired state scenario

### Multi-Instance Testing

- [ ] Create `docker-compose.multi-instance.yml` (if not exists)
- [ ] Start 3 backend instances
- [ ] Run multi-instance validation: `node apps/backend/scripts/validate-multi-instance.js`
- [ ] Verify 0% callback failure rate
- [ ] Verify state created on one instance consumed on another

## Code Quality

- [ ] Run linter: `npm run lint`
- [ ] Fix all linting errors
- [ ] Run TypeScript compiler: `npm run build`
- [ ] Fix all compilation errors
- [ ] Run formatter: `npm run format`
- [ ] Remove all console.log statements
- [ ] Remove all TODO comments
- [ ] Add JSDoc comments to new functions

## Documentation

- [ ] Update README with TRUSTED_PROXIES configuration
- [ ] Document correlation ID usage
- [ ] Document IP extraction logic
- [ ] Update API documentation (if exists)
- [ ] Create runbook for Redis failures
- [ ] Document rollback procedures

## Verification

### Code Verification

- [ ] Search for legacy state references: `grep -r "stateStore" apps/backend/src/`
- [ ] Verify no matches (except comments)
- [ ] Search for legacy methods: `grep -r "storeState\|retrieveState" apps/backend/src/`
- [ ] Verify no matches (except comments)
- [ ] Verify all OAuth platforms use OAuthStateService
- [ ] Verify all state operations include correlation IDs

### Metrics Verification

- [ ] OAuth authorization success rate > 99%
- [ ] OAuth callback success rate > 98%
- [ ] State creation p99 latency < 10ms
- [ ] State consumption p99 latency < 10ms
- [ ] Redis connection error rate < 0.1%
- [ ] No in-memory state references in code

## Deployment

### Staging Deployment

- [ ] Create pull request with detailed description
- [ ] Request code review
- [ ] Address review comments
- [ ] Merge to staging branch
- [ ] Deploy to staging: `kubectl apply -f k8s/staging/`
- [ ] Run smoke tests on staging
- [ ] Monitor staging for 24 hours
- [ ] Verify metrics stable

### Production Deployment

- [ ] Create production deployment plan
- [ ] Schedule deployment window
- [ ] Deploy canary (10% traffic): `kubectl apply -f k8s/production/canary/`
- [ ] Monitor canary for 2 hours
- [ ] Verify metrics stable
- [ ] Increase to 50% traffic
- [ ] Monitor for 1 hour
- [ ] Full rollout (100% traffic): `kubectl apply -f k8s/production/`
- [ ] Monitor for 24 hours
- [ ] Verify metrics stable

## Post-Deployment

- [ ] Monitor OAuth success rates
- [ ] Monitor Redis health
- [ ] Monitor correlation ID propagation
- [ ] Check for any errors in logs
- [ ] Verify no legacy state references in production
- [ ] Update monitoring dashboards
- [ ] Update alert rules
- [ ] Document any issues encountered
- [ ] Create post-mortem if needed

## Definition of Done

- [ ] All code changes complete
- [ ] All tests passing
- [ ] All platforms tested end-to-end
- [ ] Multi-instance validation passing
- [ ] Deployed to staging successfully
- [ ] Staging stable for 24 hours
- [ ] Deployed to production successfully
- [ ] Production stable for 24 hours
- [ ] Metrics within acceptable ranges
- [ ] Zero legacy state references confirmed
- [ ] Documentation updated
- [ ] Runbooks created
- [ ] Team trained on new system

## Rollback Plan

If issues arise:

- [ ] Identify issue severity (P0, P1, P2)
- [ ] If P0: Execute immediate rollback
- [ ] Rollback command: `kubectl rollout undo deployment/oauth-api`
- [ ] Verify rollback successful
- [ ] Monitor metrics for 10 minutes
- [ ] Investigate root cause
- [ ] Fix issues
- [ ] Re-test in staging
- [ ] Re-deploy to production

## Sign-Off

**Implemented By:** ___________________

**Date:** ___________________

**Code Review By:** ___________________

**Date:** ___________________

**QA Tested By:** ___________________

**Date:** ___________________

**Deployed By:** ___________________

**Date:** ___________________

**Production Verified By:** ___________________

**Date:** ___________________

---

**Status:** ⏳ IN PROGRESS / ✅ COMPLETE / ❌ BLOCKED

**Notes:**
```
[Add any notes or issues encountered during implementation]
```

