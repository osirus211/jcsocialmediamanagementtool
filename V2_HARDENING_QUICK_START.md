# V2 OAuth Hardening - Quick Start Guide

## Overview

This guide provides a quick reference for implementing military-grade security hardening for the V2 OAuth system.

---

## Prerequisites

✅ V2-only architecture complete
✅ MongoDB running
✅ Redis running
✅ AWS account (for KMS)
✅ Cloudflare account (for DDoS protection)

---

## Phase 1: HMAC State Security (Week 1)

### Step 1: Add Environment Variables

```bash
# apps/backend/.env
OAUTH_STATE_SECRET=<generate-with-openssl-rand-hex-32>
IP_HASH_SALT=<generate-with-openssl-rand-hex-32>
```

### Step 2: Create OAuthStateService

```bash
# Create file
touch apps/backend/src/services/OAuthStateService.ts

# Implement HMAC state generation and validation
# See V2_MILITARY_GRADE_HARDENING_PLAN.md Section 1.1
```

### Step 3: Update OAuth Controller

```typescript
// apps/backend/src/controllers/OAuthController.ts

// In authorize():
const state = oauthStateService.generateState({
  platform,
  workspaceId,
  userId,
}, req.ip);

// In callback():
const payload = await oauthStateService.validateState(state, req.ip);
if (!payload) {
  throw new Error('Invalid state');
}
```

### Step 4: Test

```bash
npm test -- OAuthController
```

---

## Phase 2: PKCE Implementation (Week 1)

### Step 1: Create PKCEService

```bash
touch apps/backend/src/services/PKCEService.ts
```

### Step 2: Update OAuth Flow

```typescript
// In authorize():
const { codeVerifier, codeChallenge } = pkceService.generatePKCE();
await pkceService.storePKCE(state, codeVerifier);

// Add to authorization URL
url += `&code_challenge=${codeChallenge}&code_challenge_method=S256`;

// In callback():
const codeVerifier = await pkceService.retrievePKCE(state);
// Include in token exchange
```

---

## Phase 3: Security Audit Logging (Week 2)

### Step 1: Create Security Event Model

```bash
touch apps/backend/src/models/SecurityEvent.ts
```

### Step 2: Create SecurityAuditService

```bash
touch apps/backend/src/services/SecurityAuditService.ts
```

### Step 3: Add Logging to OAuth Flow

```typescript
// Log all security events
await securityAuditService.logEvent({
  type: SecurityEventType.OAUTH_INITIATED,
  severity: SecurityEventSeverity.INFO,
  ipAddress: req.ip,
  userId,
  workspaceId,
  platform,
  metadata: {},
});
```

### Step 4: Create MongoDB Indexes

```bash
npm run create-security-indexes
```

---

## Phase 4: Token Encryption (Week 3-4)

### Step 1: Set Up AWS KMS

```bash
# Create KMS key
aws kms create-key --description "OAuth Token Encryption"

# Add to .env
AWS_KMS_KEY_ID=<key-id>
AWS_REGION=us-east-1
```

### Step 2: Install Dependencies

```bash
npm install @aws-sdk/client-kms
```

### Step 3: Create TokenEncryptionService

```bash
touch apps/backend/src/services/TokenEncryptionService.ts
```

### Step 4: Update SocialAccount Model

```typescript
// Use new encryption service
account.accessToken = await tokenEncryptionService.encrypt(accessToken);
```

---

## Phase 5: Rate Limiting (Week 5)

### Step 1: Install Dependencies

```bash
npm install express-rate-limit rate-limit-redis
```

### Step 2: Create Rate Limiting Middleware

```bash
touch apps/backend/src/middleware/rateLimiting.ts
```

### Step 3: Apply to OAuth Routes

```typescript
// apps/backend/src/routes/v1/oauth.routes.ts
import { ipRateLimiter, userRateLimiter } from '../../middleware/rateLimiting';

router.use(ipRateLimiter);
router.use(userRateLimiter);
```

---

## Phase 6: Kill Switches (Week 11)

### Step 1: Create KillSwitchService

```bash
touch apps/backend/src/services/KillSwitchService.ts
```

### Step 2: Add Middleware

```typescript
// apps/backend/src/routes/v1/oauth.routes.ts
import { killSwitchMiddleware } from '../../middleware/killSwitch';

router.use(killSwitchMiddleware);
```

### Step 3: Create Admin API

```typescript
// POST /api/v1/admin/kill-switch/activate
router.post('/kill-switch/activate', adminAuth, async (req, res) => {
  await killSwitchService.activate(req.body);
  res.json({ success: true });
});
```

---

## Testing Checklist

### Security Tests
- [ ] HMAC state validation
- [ ] PKCE flow
- [ ] Rate limiting
- [ ] Kill switch activation
- [ ] Token encryption/decryption
- [ ] Audit logging

### Load Tests
- [ ] 100 concurrent OAuth flows
- [ ] 1000 concurrent OAuth flows
- [ ] Rate limit enforcement
- [ ] Circuit breaker activation

### Penetration Tests
- [ ] State replay attacks
- [ ] CSRF attacks
- [ ] Token theft attempts
- [ ] Rate limit bypass attempts
- [ ] SQL injection
- [ ] XSS attacks

---

## Monitoring Setup

### Prometheus Metrics

```bash
# Add to prometheus.yml
scrape_configs:
  - job_name: 'oauth-backend'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
```

### Grafana Dashboards

```bash
# Import dashboards
- OAuth Flow Metrics
- Security Events
- Rate Limiting
- Circuit Breakers
- Kill Switches
```

### Alerts

```yaml
# alerts.yml
groups:
  - name: oauth_security
    rules:
      - alert: HighThreatScore
        expr: threat_score > 80
        for: 1m
        annotations:
          summary: "High threat score detected"
      
      - alert: StateReplayAttack
        expr: rate(state_replay_attempts_total[5m]) > 10
        for: 1m
        annotations:
          summary: "State replay attack detected"
```

---

## Emergency Procedures

### Activate Global Kill Switch

```bash
curl -X POST http://localhost:5000/api/v1/admin/kill-switch/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "GLOBAL",
    "reason": "Security breach detected",
    "activatedBy": "admin@example.com"
  }'
```

### Rotate Encryption Keys

```bash
curl -X POST http://localhost:5000/api/v1/admin/keys/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Check System Health

```bash
curl http://localhost:5000/api/v1/oauth/health
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Security audit complete
- [ ] Load testing complete
- [ ] Documentation updated
- [ ] Team trained on emergency procedures

### Deployment
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production (canary)
- [ ] Monitor for 24 hours
- [ ] Full rollout

### Post-Deployment
- [ ] Verify metrics
- [ ] Check error rates
- [ ] Review security events
- [ ] Update runbooks

---

## Support

### Documentation
- Full Plan: `V2_MILITARY_GRADE_HARDENING_PLAN.md`
- Architecture: `.kiro/specs/connect-flow-v2-oauth/design.md`
- Requirements: `.kiro/specs/connect-flow-v2-oauth/requirements.md`

### Monitoring
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Sentry: https://sentry.io

### Emergency Contacts
- Security Team: security@example.com
- On-Call: +1-XXX-XXX-XXXX
- PagerDuty: https://example.pagerduty.com

---

**Last Updated**: 2025-01-XX
**Version**: 1.0.0
