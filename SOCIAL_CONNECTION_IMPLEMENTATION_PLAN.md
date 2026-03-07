# Social Account Connection - Implementation Plan

## Quick Reference

**Main Spec**: See `SOCIAL_ACCOUNT_CONNECTION_REDESIGN_SPEC.md` for complete analysis

**Status**: Ready for implementation  
**Estimated Effort**: 3-4 weeks (1 senior engineer)  
**Priority**: P0 - Blocking Production  

---

## Implementation Phases

### Phase 1: Backend OAuth Infrastructure (Week 1)

**Tasks:**
1. Implement real OAuth token exchange for each platform
2. Add Redis-based state storage
3. Implement PKCE for Twitter OAuth 2.0
4. Add scope validation logic
5. Add duplicate account prevention
6. Add cross-tenant connection checks
7. Implement token refresh logic
8. Add comprehensive error handling

**Files to Modify:**
- `apps/backend/src/services/OAuthService.ts`
- `apps/backend/src/services/oauth/TwitterOAuthService.ts` (create)
- `apps/backend/src/services/oauth/LinkedInOAuthService.ts` (create)
- `apps/backend/src/services/oauth/FacebookOAuthService.ts` (create)
- `apps/backend/src/services/oauth/InstagramOAuthService.ts` (create)
- `apps/backend/src/services/oauth/OAuthManager.ts`

**Deliverables:**
- Working OAuth flow for all 4 platforms
- State persistence in Redis
- Comprehensive validation
- Error categorization

### Phase 2: Frontend OAuth UX (Week 2)

**Tasks:**
1. Create OAuth popup window manager
2. Implement permission explanation modal
3. Add loading states for each OAuth step
4. Create success/error screens
5. Add account renaming UI
6. Implement callback URL handler
7. Add retry logic
8. Create error display components

**Files to Create:**
- `apps/frontend/src/components/social/ConnectModal.tsx`
- `apps/frontend/src/components/social/PermissionExplanation.tsx`
- `apps/frontend/src/components/social/OAuthCallback.tsx`
- `apps/frontend/src/components/social/ConnectionSuccess.tsx`
- `apps/frontend/src/components/social/ConnectionError.tsx`
- `apps/frontend/src/hooks/useOAuthFlow.ts`
- `apps/frontend/src/utils/oauthWindow.ts`

**Files to Modify:**
- `apps/frontend/src/components/social/ConnectButton.tsx`
- `apps/frontend/src/pages/social/ConnectedAccounts.tsx`
- `apps/frontend/src/store/social.store.ts`

**Deliverables:**
- Buffer-level connection UX
- Popup window management
- Clear error messages
- Loading states

### Phase 3: Security Hardening (Week 3)

**Tasks:**
1. Implement CSRF protection
2. Add state replay prevention
3. Implement encrypted token storage with key rotation
4. Add scope downgrade detection
5. Implement idempotent account creation
6. Add tenant ownership validation
7. Implement rate limiting for OAuth endpoints
8. Add security audit logging

**Files to Modify:**
- `apps/backend/src/middleware/csrf.ts` (create)
- `apps/backend/src/utils/encryption.ts`
- `apps/backend/src/services/SecurityAuditService.ts`
- `apps/backend/src/middleware/rateLimiter.ts`

**Deliverables:**
- Production-grade security
- Audit trail
- Rate limiting
- Key rotation support

### Phase 4: Account Health & Monitoring (Week 4)

**Tasks:**
1. Implement token expiry warnings
2. Add automatic token refresh
3. Create account health check endpoint
4. Add reconnection flow
5. Implement email notifications for expired tokens
6. Add metrics and monitoring
7. Create admin dashboard for OAuth health

**Files to Create:**
- `apps/backend/src/workers/TokenRefreshWorker.ts`
- `apps/backend/src/services/AccountHealthService.ts`
- `apps/frontend/src/components/social/TokenExpiryWarning.tsx`
- `apps/frontend/src/components/social/ReconnectPrompt.tsx`

**Deliverables:**
- Proactive token management
- User notifications
- Health monitoring
- Admin tools

---

## Testing Strategy

### Unit Tests
- OAuth state generation/validation
- Token exchange logic
- Scope validation
- Duplicate detection
- Error categorization

### Integration Tests
- Full OAuth flow (mocked platform APIs)
- Token refresh flow
- Account creation/update
- Error scenarios
- Security validations

### E2E Tests
- User connects account (happy path)
- User cancels OAuth
- User denies permissions
- Token expires and refreshes
- Duplicate account prevention
- Cross-tenant prevention

### Manual Testing
- Test with real OAuth credentials
- Test all 4 platforms
- Test error scenarios
- Test on different browsers
- Test popup blockers
- Test network failures

---

## Rollout Plan

### Stage 1: Internal Testing
- Deploy to staging environment
- Test with real OAuth credentials
- Verify all platforms work
- Test error scenarios

### Stage 2: Beta Testing
- Enable for select workspaces
- Monitor error rates
- Collect user feedback
- Fix critical issues

### Stage 3: Production Rollout
- Enable for all users
- Monitor metrics
- Set up alerts
- Prepare rollback plan

---

## Success Metrics

**Technical Metrics:**
- OAuth success rate > 95%
- Token refresh success rate > 98%
- Average connection time < 10 seconds
- Error rate < 2%

**User Experience Metrics:**
- Connection abandonment rate < 10%
- User satisfaction score > 4.5/5
- Support tickets related to connections < 5/week

**Security Metrics:**
- Zero CSRF attacks
- Zero state replay attacks
- Zero unauthorized account access
- 100% token encryption

---

## Risk Mitigation

**Risk 1: Platform API Changes**
- Mitigation: Version all API calls, monitor platform changelogs
- Fallback: Graceful degradation, user notifications

**Risk 2: OAuth Popup Blockers**
- Mitigation: Detect popup blockers, show instructions
- Fallback: Use redirect flow instead of popup

**Risk 3: Token Refresh Failures**
- Mitigation: Retry logic, exponential backoff
- Fallback: Prompt user to reconnect

**Risk 4: High Error Rates**
- Mitigation: Comprehensive error handling, clear messages
- Fallback: Rollback to previous version

---

## Dependencies

**External:**
- Twitter OAuth 2.0 credentials
- LinkedIn OAuth 2.0 credentials
- Facebook OAuth credentials
- Instagram OAuth credentials
- Redis for state storage

**Internal:**
- Email service for notifications
- Metrics service for monitoring
- Audit service for security logging

---

## Documentation Requirements

1. User-facing documentation
   - How to connect accounts
   - Troubleshooting guide
   - Privacy policy updates

2. Developer documentation
   - OAuth flow architecture
   - API documentation
   - Error codes reference

3. Operations documentation
   - Monitoring guide
   - Incident response
   - Rollback procedures

---

## Next Steps

1. Review and approve this plan
2. Set up OAuth credentials for all platforms
3. Create feature branch
4. Begin Phase 1 implementation
5. Schedule daily standups for progress tracking

