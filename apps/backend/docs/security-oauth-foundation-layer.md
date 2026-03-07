# Security + OAuth Foundation Layer

## Overview

This document describes the **FOUNDATION LAYER** for Security Hardening and Real OAuth implementation. This layer provides core infrastructure required for both systems without implementing full user-facing features.

**Status**: ✅ Complete  
**Phase**: Phase 0-1 (Critical Blockers)  
**Dependencies**: Redis resilience, encryption utilities

---

## Architecture

### Foundation Components

```
┌─────────────────────────────────────────────────────────────┐
│                  SECURITY FOUNDATION                         │
├─────────────────────────────────────────────────────────────┤
│  TokenSafetyService      │  Distributed lock for refresh    │
│                          │  Atomic token write              │
│                          │  Corruption detection            │
│                          │  Audit trail                     │
├──────────────────────────┼──────────────────────────────────┤
│  SecurityAuditService    │  Centralized event logging       │
│                          │  IP hashing for privacy          │
│                          │  Automatic severity              │
│                          │  Query interface                 │
├──────────────────────────┼──────────────────────────────────┤
│  RateLimitMiddleware     │  IP-based throttling             │
│                          │  Workspace-based limits          │
│                          │  Sliding window algorithm        │
│                          │  Graceful degradation            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   OAUTH FOUNDATION                           │
├─────────────────────────────────────────────────────────────┤
│  OAuthErrorClassifier    │  Platform-agnostic errors        │
│                          │  User-friendly messages          │
│                          │  Retry decision logic            │
│                          │  Reconnect detection             │
├──────────────────────────┼──────────────────────────────────┤
│  TokenLifecycleService   │  Expiry detection (7-day warn)   │
│                          │  State machine                   │
│                          │  Reconnect flag management       │
│                          │  Automatic status updates        │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. TokenSafetyService

**Purpose**: Prevent token race conditions and corruption

**Features**:
- Distributed lock for token refresh (30s TTL)
- Atomic token write with version check
- Token corruption detection via checksums
- Token audit trail (90-day retention)

**Guarantees**:
- ✅ NO concurrent token refresh races
- ✅ NO token corruption
- ✅ Full audit trail for security analysis

**Usage**:
```typescript
import { tokenSafetyService } from './services/TokenSafetyService';

// Acquire lock before refresh
const lockId = await tokenSafetyService.acquireRefreshLock(accountId);
if (!lockId) {
  // Another process is refreshing, skip
  return;
}

try {
  // Refresh token logic here
  const newTokenData = await refreshToken();
  
  // Atomic write with version check
  const result = await tokenSafetyService.atomicTokenWrite(
    accountId,
    provider,
    newTokenData,
    expectedVersion,
    async (currentVersion) => {
      // Update database
      await SocialAccount.findByIdAndUpdate(accountId, {
        accessToken: newTokenData.accessToken,
        tokenExpiresAt: newTokenData.expiresAt,
      });
      return true;
    }
  );
  
  if (!result.success) {
    // Version mismatch, concurrent write detected
    logger.warn('Concurrent token write detected');
  }
} finally {
  // Always release lock
  await tokenSafetyService.releaseRefreshLock(accountId, lockId);
}
```

**Metrics**:
- `token_refresh_lock_acquired`: Lock acquisition count
- `token_refresh_lock_blocked`: Concurrent refresh blocked count
- `token_corruption_detected`: Corruption detection count
- `token_version_mismatch`: Version mismatch count

---

### 2. SecurityAuditService

**Purpose**: Centralized security event logging

**Features**:
- All security events logged to MongoDB
- IP addresses hashed with SHA-256 for privacy
- Automatic severity classification
- Efficient querying with compound indexes
- Automatic TTL-based cleanup (365 days)

**Event Types**:
- Authentication: login, logout, password change
- Authorization: permission denied, role change
- Token: refresh, revocation, corruption
- Rate limiting: throttled, blocked
- Admin actions: workspace deletion, user suspension
- OAuth: connect, disconnect, token expired

**Usage**:
```typescript
import { securityAuditService } from './services/SecurityAuditService';
import { SecurityEventType } from './models/SecurityEvent';

// Log security event
await securityAuditService.logEvent({
  type: SecurityEventType.LOGIN_SUCCESS,
  userId: user._id,
  workspaceId: user.workspaceId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  resource: '/api/auth/login',
  action: 'POST',
  success: true,
});

// Query events
const events = await securityAuditService.queryEvents({
  userId: user._id,
  type: SecurityEventType.LOGIN_FAILURE,
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  limit: 100,
});

// Get failed login attempts
const failedAttempts = await securityAuditService.getFailedLoginAttempts(
  user._id,
  new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
);
```

**Metrics**:
- `security_events_total`: Total events logged
- `security_events_by_severity`: Events by severity level
- `security_events_by_type`: Events by type
- `security_event_success_rate`: Success rate percentage

---

### 3. RateLimitMiddleware

**Purpose**: Prevent brute force and abuse

**Features**:
- IP-based rate limiting (prevents brute force)
- Workspace-based rate limiting (prevents abuse)
- Sliding window algorithm
- X-RateLimit-* headers in responses
- HTTP 429 with Retry-After header
- Graceful degradation when Redis unavailable

**Default Limits**:
- IP login: 10 attempts per 15 minutes
- IP API: 1000 requests per hour
- Workspace API: 1000 requests per hour
- Workspace posts: 100 posts per hour

**Usage**:
```typescript
import { 
  rateLimitMiddleware, 
  ipLoginRateLimit,
  workspaceApiRateLimit 
} from './middleware/RateLimitMiddleware';

// Use predefined rate limiters
app.post('/api/auth/login', ipLoginRateLimit, loginHandler);
app.use('/api/workspaces/:workspaceId', workspaceApiRateLimit);

// Custom rate limiter
app.post('/api/posts', rateLimitMiddleware({
  ip: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
    keyPrefix: 'ratelimit:ip:posts:',
  },
  workspace: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    keyPrefix: 'ratelimit:workspace:posts:',
  },
}), createPostHandler);
```

**Response Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1640000000000
Retry-After: 3600 (when limit exceeded)
```

**Metrics**:
- `rate_limit_checks_total`: Total rate limit checks
- `rate_limit_exceeded_total`: Total limit exceeded count
- `rate_limit_by_type`: Limits exceeded by type (IP/workspace)

---

### 4. OAuthErrorClassifier

**Purpose**: Unified OAuth error handling across platforms

**Features**:
- Platform-agnostic error classification
- User-friendly error messages
- Actionable error categories
- Retry decision logic
- Reconnect detection

**Error Categories**:
- `TOKEN_EXPIRED`: Token needs refresh
- `TOKEN_REVOKED`: User revoked access, needs reconnect
- `PERMISSION_LOST`: Scope downgrade, needs reconnect
- `RATE_LIMITED`: Temporary, retry with backoff
- `INVALID_REQUEST`: Permanent, don't retry
- `SERVER_ERROR`: Temporary, retry
- `NETWORK_ERROR`: Temporary, retry
- `UNKNOWN`: Log and alert

**Platform Support**:
- Twitter/X: Error codes 89, 326, 64, 187, 429
- LinkedIn: Error codes 401, 403, 429
- Facebook: Error codes 190, 200, 10, 4, 17, 32, 613
- Instagram: Same as Facebook (uses Graph API)

**Usage**:
```typescript
import { oauthErrorClassifier } from './services/OAuthErrorClassifier';
import { SocialPlatform } from './models/SocialAccount';

try {
  await publishToTwitter(post);
} catch (error) {
  const classified = oauthErrorClassifier.classify(
    SocialPlatform.TWITTER,
    error
  );
  
  if (classified.shouldReconnect) {
    // Mark account for reconnect
    await tokenLifecycleService.markReconnectRequired(
      accountId,
      classified.technicalMessage
    );
  }
  
  if (classified.shouldRetry) {
    // Schedule retry
    await scheduleRetry(post, classified.retryAfterSeconds);
  }
  
  // Show user-friendly message
  return res.status(400).json({
    error: classified.userMessage,
  });
}
```

**Metrics**:
- `oauth_errors_total`: Total OAuth errors
- `oauth_errors_by_category`: Errors by category
- `oauth_errors_by_platform`: Errors by platform
- `oauth_reconnect_required_total`: Reconnect required count

---

### 5. TokenLifecycleService

**Purpose**: Proactive token lifecycle management

**Features**:
- Token expiry detection (7-day warning)
- Token state machine (active → expiring → expired → revoked)
- Reconnect-required flag management
- Automatic status updates
- Periodic lifecycle checks

**Token States**:
- `ACTIVE`: Token valid and not expiring soon
- `EXPIRING_SOON`: Token expires within 7 days (warning)
- `EXPIRED`: Token expired, needs refresh
- `REVOKED`: Token revoked by user, needs reconnect

**Usage**:
```typescript
import { tokenLifecycleService } from './services/TokenLifecycleService';

// Get token lifecycle info
const info = await tokenLifecycleService.getTokenLifecycleInfo(accountId);
if (info.state === 'expiring_soon') {
  // Proactively refresh token
  await refreshToken(accountId);
}

// Mark account for reconnect
await tokenLifecycleService.markReconnectRequired(
  accountId,
  'Token revoked by user'
);

// Run periodic lifecycle check (every 6 hours)
const results = await tokenLifecycleService.runLifecycleCheck();
console.log(`Checked ${results.checked} accounts, found ${results.expired} expired`);

// Find accounts expiring soon
const expiring = await tokenLifecycleService.findAccountsExpiringSoon();
for (const account of expiring) {
  // Send notification to user
  await sendExpiryWarning(account);
}
```

**Metrics**:
- `token_lifecycle_checks_total`: Total lifecycle checks
- `token_expiring_soon_total`: Tokens expiring soon count
- `token_expired_total`: Expired tokens count
- `token_reconnect_required_total`: Reconnect required count

---

## Data Models

### SecurityEvent

```typescript
{
  type: SecurityEventType,
  severity: SecurityEventSeverity,
  userId?: ObjectId,
  workspaceId?: ObjectId,
  ipAddress: string, // Hashed with SHA-256
  userAgent?: string,
  resource?: string,
  action?: string,
  success: boolean,
  errorMessage?: string,
  metadata?: Record<string, any>,
  timestamp: Date,
}
```

**Indexes**:
- `{ userId: 1, timestamp: -1 }`
- `{ workspaceId: 1, timestamp: -1 }`
- `{ type: 1, timestamp: -1 }`
- `{ severity: 1, timestamp: -1 }`
- `{ timestamp: 1 }` (TTL index, 365 days)

---

## Testing

### Test Coverage

**TokenSafetyService**:
- ✅ Lock acquisition and release
- ✅ Concurrent refresh prevention
- ✅ Token corruption detection
- ✅ Atomic token write with version check
- ✅ Audit trail logging

**RateLimitMiddleware**:
- ✅ IP-based rate limiting
- ✅ Workspace-based rate limiting
- ✅ Sliding window algorithm
- ✅ Graceful degradation
- ✅ Rate limit headers
- ✅ Security event logging

**OAuthErrorClassifier**:
- ✅ Twitter error classification
- ✅ LinkedIn error classification
- ✅ Facebook error classification
- ✅ Instagram error classification
- ✅ Retry decision logic
- ✅ Reconnect detection

**TokenLifecycleService**:
- ✅ Token state determination
- ✅ Expiry detection
- ✅ Reconnect flag management
- ✅ Lifecycle checks

### Running Tests

```bash
# Run all foundation layer tests
npm test -- TokenSafetyService
npm test -- RateLimitMiddleware
npm test -- OAuthErrorClassifier
npm test -- TokenLifecycleService

# Run with coverage
npm test -- --coverage
```

---

## Integration

### Backward Compatibility

All foundation components are **backward compatible** with existing code:

- TokenSafetyService: Optional, can be integrated incrementally
- SecurityAuditService: Passive logging, no breaking changes
- RateLimitMiddleware: Applied per-route, no global impact
- OAuthErrorClassifier: Utility service, no schema changes
- TokenLifecycleService: Works with existing SocialAccount model

### Migration Path

1. **Phase 1**: Deploy foundation services (no user impact)
2. **Phase 2**: Integrate TokenSafetyService into token refresh logic
3. **Phase 3**: Add RateLimitMiddleware to critical endpoints
4. **Phase 4**: Use OAuthErrorClassifier in publishing workers
5. **Phase 5**: Enable TokenLifecycleService periodic checks

---

## Monitoring

### Health Checks

```typescript
// Token safety metrics
GET /api/admin/metrics/token-safety
{
  activeLocks: 5,
  totalAudits: 1234,
  corruptionDetections: 0,
  concurrentRefreshBlocks: 12,
}

// Security audit metrics
GET /api/admin/metrics/security-audit
{
  totalEvents: 50000,
  eventsBySeverity: {
    info: 45000,
    warning: 4500,
    error: 450,
    critical: 50,
  },
  successRate: 98.5,
}

// Rate limit metrics
GET /api/admin/metrics/rate-limits
{
  totalChecks: 100000,
  totalExceeded: 150,
  byType: {
    ip: 100,
    workspace: 50,
  },
}
```

### Alerts

**Critical Alerts**:
- Token corruption detected
- Concurrent refresh rate > 10%
- Rate limit exceeded rate > 5%
- Security event error rate > 10%

**Warning Alerts**:
- Tokens expiring soon > 100
- Failed login attempts > 50/hour
- OAuth errors > 100/hour

---

## Security Considerations

### Token Safety

- ✅ Distributed locks prevent concurrent refresh races
- ✅ Atomic writes with version check prevent corruption
- ✅ Checksums detect data corruption
- ✅ Audit trail for forensic analysis

### Privacy

- ✅ IP addresses hashed with SHA-256
- ✅ No plaintext tokens in logs
- ✅ User agents sanitized
- ✅ Metadata filtered for PII

### Rate Limiting

- ✅ Sliding window algorithm (accurate)
- ✅ Graceful degradation (no false positives)
- ✅ X-Forwarded-For validation (prevent spoofing)
- ✅ Retry-After headers (client-friendly)

---

## Performance

### Redis Usage

- Token locks: ~100 bytes per lock, 30s TTL
- Rate limit counters: ~500 bytes per key, auto-expiry
- Token metadata: ~1KB per account, 90-day TTL
- Audit trail: ~500 bytes per entry, 90-day TTL

**Estimated Redis Memory** (10k workspaces, 50k accounts):
- Locks: 100 bytes × 100 active = 10 KB
- Rate limits: 500 bytes × 10k = 5 MB
- Token metadata: 1 KB × 50k = 50 MB
- Audit trail: 500 bytes × 100k = 50 MB
- **Total**: ~105 MB

### MongoDB Usage

- SecurityEvent: ~500 bytes per event
- Indexes: ~50 bytes per document

**Estimated MongoDB Storage** (1M events/month):
- Events: 500 bytes × 1M = 500 MB/month
- Indexes: 50 bytes × 1M = 50 MB/month
- **Total**: ~550 MB/month (auto-cleanup after 365 days)

---

## Next Steps

### User-Facing Features (NOT in Foundation Layer)

The following features are **NOT** implemented in the foundation layer and will be added in subsequent phases:

- ❌ Password reset flow (Task 2.1.1)
- ❌ Email verification flow (Task 2.1.2)
- ❌ 2FA with TOTP (Task 2.1.3)
- ❌ Real OAuth flows (Tasks 3.2.1-3.2.4)
- ❌ Token refresh UI (Task 3.3.3)
- ❌ Reconnect UI flow (Task 3.3.3)

### Foundation Layer Complete ✅

The foundation layer provides:
- ✅ Token safety infrastructure
- ✅ Security audit logging
- ✅ Rate limiting middleware
- ✅ OAuth error classification
- ✅ Token lifecycle management
- ✅ Comprehensive test coverage
- ✅ Backward compatibility
- ✅ Production-ready monitoring

**Ready for integration into existing codebase with zero breaking changes.**

---

## References

- [Task List](.kiro/specs/saas-production-transformation-phase-0-1/tasks.md)
- [Redis Resilience](./redis-resilience.md)
- [Encryption Utilities](../src/utils/encryption.ts)
- [Queue Reliability](./queue-scheduler-reliability-final-guarantees.md)
