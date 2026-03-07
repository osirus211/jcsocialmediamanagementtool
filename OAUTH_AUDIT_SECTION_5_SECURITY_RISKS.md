# OAuth Audit - Section 5: Security Risks & Vulnerabilities

## 5.1 Token Security

### Current Implementation: **EXCELLENT**

**Encryption**: AES-256-GCM with authenticated encryption  
**Key Derivation**: PBKDF2 with 100,000 iterations  
**Storage**: MongoDB with `select: false` (never returned by default)

### Critical Risks

#### 🔴 CRITICAL: Token Exposure in Debug Logs
**Location**: `OAuthController.ts:813+`  
**Severity**: HIGH  
**Impact**: Tokens visible in production logs, CloudWatch, Sentry

**Evidence**:
```typescript
console.log('Token response body:', JSON.stringify(tokenResponse.data, null, 2));
console.log('Using access_token:', tokens.accessToken.substring(0, 20) + '...');
```

**Attack Vector**:
1. Attacker gains access to log aggregation system (CloudWatch, Datadog)
2. Searches for "access_token" or "Token response body"
3. Extracts plaintext tokens from logs
4. Uses tokens to impersonate users

**Mitigation**:
```typescript
// REMOVE all console.log statements
// USE structured logging with token redaction
logger.info('Token exchange successful', {
  platform,
  workspaceId,
  expiresIn: tokens.expiresIn,
  // NEVER log tokens
});
```

**Status**: ❌ MUST FIX IMMEDIATELY

#### ⚠️ WARNING: No Token Rotation on Compromise
**Gap**: No mechanism to force token rotation if compromise detected  
**Risk**: Compromised tokens remain valid until natural expiry

**Recommendation**: Add emergency token rotation endpoint
```typescript
// POST /api/v1/admin/accounts/:accountId/rotate-token
async emergencyRotateToken(accountId: string, reason: string) {
  // Revoke current token on platform
  await provider.revokeToken(currentToken);
  
  // Mark account as REAUTH_REQUIRED
  await SocialAccount.findByIdAndUpdate(accountId, {
    status: AccountStatus.REAUTH_REQUIRED,
    'metadata.rotationReason': reason,
    'metadata.rotatedAt': new Date(),
  });
  
  // Audit log
  await securityAuditService.logEvent({
    type: SecurityEventType.TOKEN_ROTATED,
    accountId,
    reason,
  });
}
```

#### ⚠️ WARNING: No Encryption Key Rotation Schedule
**Current**: Manual rotation with grace period support  
**Gap**: No automated rotation or monitoring

**Recommendation**: Implement quarterly rotation
```typescript
// Cron job: Every 90 days
async rotateEncryptionKey() {
  const newVersion = getCurrentKeyVersion() + 1;
  
  // Start grace period (allows decryption with old key)
  startKeyRotation(getCurrentKeyVersion());
  
  // Re-encrypt all tokens with new key
  const accounts = await SocialAccount.find({
    encryptionKeyVersion: { $lt: newVersion }
  }).select('+accessToken +refreshToken');
  
  for (const account of accounts) {
    const decrypted = account.getDecryptedAccessToken();
    account.accessToken = encrypt(decrypted, newVersion);
    account.encryptionKeyVersion = newVersion;
    await account.save();
  }
  
  // End grace period after 5 minutes
  setTimeout(() => endKeyRotation(), 5 * 60 * 1000);
}
```

---

## 5.2 OAuth Security

### Current Implementation: **EXCELLENT**

**State Management**: 256-bit cryptographically secure  
**PKCE**: Server-side code verifier storage  
**IP Binding**: State tied to hashed client IP  
**Replay Protection**: Single-use state with atomic GETDEL

### Critical Risks

#### ⚠️ WARNING: No Rate Limiting on OAuth Endpoints
**Gap**: No rate limiting on `/oauth/:platform/authorize` and `/oauth/:platform/callback`  
**Risk**: Brute force attacks on state parameter

**Recommendation**: Add rate limiting
```typescript
// Rate limit: 10 authorize requests per minute per IP
app.post('/api/v1/oauth/:platform/authorize', 
  rateLimit({ windowMs: 60000, max: 10, keyGenerator: (req) => getClientIp(req) }),
  oauthController.authorize
);

// Rate limit: 20 callback requests per minute per IP
app.get('/api/v1/oauth/:platform/callback',
  rateLimit({ windowMs: 60000, max: 20, keyGenerator: (req) => getClientIp(req) }),
  oauthController.callback
);
```

**Status**: ⚠️ RECOMMENDED

#### ⚠️ WARNING: State TTL May Be Too Long
**Current**: 10-minute state expiry  
**Risk**: Extended window for state hijacking attacks

**Recommendation**: Reduce to 5 minutes
```typescript
private readonly STATE_TTL = 5 * 60 * 1000; // 5 minutes
```

**Trade-off**: May impact users with slow OAuth flows (mobile, slow networks)

---

## 5.3 Multi-Tenancy Security

### Current Implementation: **GOOD**

**Tenant Isolation**: All queries scoped to `workspaceId`  
**Middleware**: JWT-based workspace context injection

### Critical Risks

#### 🔴 CRITICAL: No Row-Level Security (RLS)
**Gap**: Application-level isolation only (no database-level enforcement)  
**Risk**: Bug in query logic could leak data across tenants

**Attack Vector**:
1. Developer forgets to add `workspaceId` filter in new query
2. Query returns data from all workspaces
3. User A sees User B's social accounts/posts

**Example Vulnerable Code**:
```typescript
// VULNERABLE: Missing workspaceId filter
const accounts = await SocialAccount.find({
  provider: 'twitter',
  status: AccountStatus.ACTIVE
});
// Returns accounts from ALL workspaces!
```

**Mitigation Options**:

**Option 1: Query Validation Middleware**
```typescript
// Add pre-query hook to validate workspaceId
SocialAccountSchema.pre(/^find/, function() {
  const query = this.getQuery();
  if (!query.workspaceId) {
    throw new Error('SECURITY: workspaceId required for all queries');
  }
});
```

**Option 2: Database-Level RLS (PostgreSQL)**
```sql
-- If migrating to PostgreSQL
CREATE POLICY tenant_isolation ON social_accounts
  USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
```

**Status**: 🔴 HIGH PRIORITY

#### ⚠️ WARNING: No Workspace-Level Rate Limiting
**Gap**: No Redis-based rate limiting per workspace  
**Risk**: One tenant can exhaust API quotas for all tenants

**Recommendation**: Implement workspace-scoped rate limiting
```typescript
// Rate limit key per workspace
const rateLimitKey = `ratelimit:${workspaceId}:posts:${Date.now() / 86400000 | 0}`;
const count = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 86400); // 24 hours

const workspace = await Workspace.findById(workspaceId);
const maxPostsPerDay = getMaxPostsForPlan(workspace.plan);

if (count > maxPostsPerDay) {
  throw new Error('Daily post limit reached for your plan');
}
```

---

## 5.4 API Security

### Current Implementation: **GOOD**

**Authentication**: JWT-based with workspace context  
**Authorization**: Workspace-scoped queries

### Critical Risks

#### ⚠️ WARNING: No API Key Rotation
**Gap**: OAuth client secrets never rotated  
**Risk**: Long-lived secrets increase compromise risk

**Recommendation**: Implement annual rotation
```typescript
// Store multiple client secrets with versions
oauth: {
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecrets: [
      { version: 2, secret: process.env.TWITTER_CLIENT_SECRET_V2, active: true },
      { version: 1, secret: process.env.TWITTER_CLIENT_SECRET_V1, active: false }, // Grace period
    ],
  },
}

// Try all active secrets during token exchange
for (const secretConfig of config.oauth.twitter.clientSecrets.filter(s => s.active)) {
  try {
    return await exchangeToken(code, secretConfig.secret);
  } catch (error) {
    if (error.code === 'invalid_client') continue;
    throw error;
  }
}
```

#### ⚠️ WARNING: No Request Signing
**Gap**: No HMAC signing for webhook callbacks  
**Risk**: Webhook spoofing attacks

**Recommendation**: Implement webhook signature verification
```typescript
// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## 5.5 Injection Attacks

### Current Implementation: **EXCELLENT**

**MongoDB**: Mongoose schema validation prevents NoSQL injection  
**Input Validation**: Zod schemas for all user inputs

### Critical Risks

#### ✅ PROTECTED: NoSQL Injection
**Mitigation**: Mongoose schema validation + type checking

**Example**:
```typescript
// SAFE: Mongoose validates types
const account = await SocialAccount.findOne({
  workspaceId: req.workspace.workspaceId, // ObjectId type enforced
  provider: req.params.platform, // Enum validation
});
```

#### ⚠️ WARNING: No Content Security Policy (CSP)
**Gap**: No CSP headers for frontend  
**Risk**: XSS attacks via injected scripts

**Recommendation**: Add CSP headers
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.twitter.com", "https://graph.facebook.com"],
    },
  },
}));
```

---

## 5.6 Compliance & Audit

### Current Implementation: **GOOD**

**Audit Logging**: SecurityAuditService tracks all OAuth events  
**Retention**: 90 days (configurable)

### Critical Risks

#### ⚠️ WARNING: No GDPR Data Export
**Gap**: No mechanism to export user data for GDPR compliance  
**Risk**: Non-compliance with GDPR Article 20 (Right to Data Portability)

**Recommendation**: Implement data export endpoint
```typescript
// GET /api/v1/workspaces/:workspaceId/export
async exportWorkspaceData(workspaceId: string) {
  const accounts = await SocialAccount.find({ workspaceId })
    .select('-accessToken -refreshToken'); // Exclude tokens
  
  const posts = await Post.find({ workspaceId });
  
  const auditLogs = await SecurityEvent.find({ workspaceId });
  
  return {
    accounts,
    posts,
    auditLogs,
    exportedAt: new Date(),
  };
}
```

#### ⚠️ WARNING: No Data Deletion on Account Disconnect
**Gap**: Tokens remain in database after account disconnection  
**Risk**: Stale tokens increase attack surface

**Recommendation**: Purge tokens on disconnect
```typescript
// When disconnecting account
account.status = AccountStatus.DISCONNECTED;
account.accessToken = null; // Purge token
account.refreshToken = null; // Purge token
account.metadata.disconnectedAt = new Date();
await account.save();
```

---

## 5.7 Recommendations

### IMMEDIATE (This Sprint)
1. **Remove debug logging** that exposes tokens (OAuthController.ts)
2. **Add query validation** to prevent missing workspaceId filters
3. **Implement workspace-level rate limiting**

### SHORT-TERM (Next 2 Sprints)
4. **Add rate limiting** to OAuth endpoints
5. **Implement emergency token rotation** endpoint
6. **Add CSP headers** for frontend
7. **Purge tokens** on account disconnect

### LONG-TERM (Next Quarter)
8. **Implement encryption key rotation** schedule (quarterly)
9. **Add GDPR data export** endpoint
10. **Implement webhook signature verification**
11. **Add database-level RLS** (if migrating to PostgreSQL)
12. **Implement API key rotation** (annual)
