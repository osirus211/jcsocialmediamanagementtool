# Social Account Connection - Security Specification

**Document Version**: 1.0  
**Date**: 2026-02-27  
**Classification**: Internal - Security Sensitive  

---

## Security Validation Checklist

### 1. State Parameter Security

#### ✅ State Generation
- [ ] Generate cryptographically secure random state (32+ bytes)
- [ ] Include workspace ID in state
- [ ] Include user ID in state
- [ ] Include timestamp in state
- [ ] Include nonce (random value) in state
- [ ] Include platform in state
- [ ] Base64URL encode state
- [ ] Store state in Redis with TTL (10 minutes)

**Implementation**:
```typescript
function generateState(workspaceId: string, userId: string, platform: string): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  
  const stateData = {
    workspaceId,
    userId,
    platform,
    timestamp,
    nonce,
  };
  
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  
  // Store in Redis with 10-minute TTL
  await redis.setex(`oauth:state:${state}`, 600, JSON.stringify(stateData));
  
  return state;
}
```

#### ✅ State Validation
- [ ] Decode state parameter
- [ ] Verify state exists in Redis
- [ ] Check state not expired (< 10 minutes)
- [ ] Verify workspace ID matches
- [ ] Verify user ID matches
- [ ] Verify platform matches
- [ ] Check state not already used (replay protection)
- [ ] Mark state as used after validation
- [ ] Delete state from Redis after use

**Implementation**:
```typescript
async function validateState(state: string, expectedWorkspaceId: string, expectedPlatform: string): StateData {
  // Retrieve from Redis
  const storedData = await redis.get(`oauth:state:${state}`);
  
  if (!storedData) {
    throw new SecurityError('Invalid or expired state parameter');
  }
  
  const stateData = JSON.parse(storedData);
  
  // Check expiration
  const age = Date.now() - stateData.timestamp;
  if (age > 600000) { // 10 minutes
    await redis.del(`oauth:state:${state}`);
    throw new SecurityError('State expired');
  }
  
  // Verify workspace
  if (stateData.workspaceId !== expectedWorkspaceId) {
    throw new SecurityError('Workspace mismatch');
  }
  
  // Verify platform
  if (stateData.platform !== expectedPlatform) {
    throw new SecurityError('Platform mismatch');
  }
  
  // Check if already used
  const used = await redis.get(`oauth:state:used:${state}`);
  if (used) {
    // Log security incident
    await securityAuditService.logEvent({
      type: SecurityEventType.OAUTH_REPLAY_ATTACK,
      severity: 'critical',
      workspaceId: stateData.workspaceId,
      userId: stateData.userId,
      metadata: { state, platform: expectedPlatform },
    });
    
    throw new SecurityError('State already used - possible replay attack');
  }
  
  // Mark as used
  await redis.setex(`oauth:state:used:${state}`, 3600, 'true');
  
  // Delete original state
  await redis.del(`oauth:state:${state}`);
  
  return stateData;
}
```

### 2. CSRF Protection

#### ✅ CSRF Token
- [ ] Generate CSRF token on OAuth initiation
- [ ] Store CSRF token in session
- [ ] Include CSRF token in state parameter
- [ ] Validate CSRF token on callback
- [ ] Use double-submit cookie pattern
- [ ] Rotate CSRF token after use

**Implementation**:
```typescript
function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function validateCSRFToken(token: string, sessionToken: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(sessionToken)
  );
}
```

### 3. PKCE (Proof Key for Code Exchange)

#### ✅ PKCE for Twitter OAuth 2.0
- [ ] Generate code verifier (43-128 characters)
- [ ] Generate code challenge (SHA256 hash of verifier)
- [ ] Store code verifier in Redis with state
- [ ] Send code challenge in authorization request
- [ ] Send code verifier in token exchange
- [ ] Platform validates code challenge

**Implementation**:
```typescript
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // Generate code verifier (random 128-character string)
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  
  // Generate code challenge (SHA256 hash of verifier)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

// Store with state
await redis.setex(
  `oauth:pkce:${state}`,
  600,
  JSON.stringify({ codeVerifier, codeChallenge })
);

// Retrieve for token exchange
const pkceData = await redis.get(`oauth:pkce:${state}`);
const { codeVerifier } = JSON.parse(pkceData);
```

### 4. Token Storage Security

#### ✅ Encryption at Rest
- [ ] Encrypt access tokens with AES-256-GCM
- [ ] Encrypt refresh tokens with AES-256-GCM
- [ ] Use unique IV for each encryption
- [ ] Store encryption key version
- [ ] Support key rotation
- [ ] Never log decrypted tokens

**Implementation**:
```typescript
function encryptToken(token: string): string {
  const key = getEncryptionKey(); // 32 bytes
  const iv = crypto.randomBytes(16); // 16 bytes for AES-GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: version:iv:authTag:encrypted
  return `1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const [version, ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  
  const key = getEncryptionKeyForVersion(parseInt(version));
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### ✅ Key Rotation
- [ ] Support multiple encryption key versions
- [ ] Store key version with encrypted data
- [ ] Implement key rotation process
- [ ] Re-encrypt tokens on key rotation
- [ ] Audit key usage

### 5. Scope Validation

#### ✅ Required Scopes Check
- [ ] Define required scopes per platform
- [ ] Validate received scopes match required
- [ ] Reject if missing required scopes
- [ ] Log scope downgrade attempts
- [ ] Alert on suspicious scope changes

**Implementation**:
```typescript
const REQUIRED_SCOPES = {
  twitter: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  linkedin: ['w_member_social', 'r_liteprofile'],
  facebook: ['pages_manage_posts', 'pages_read_engagement'],
  instagram: ['instagram_basic', 'instagram_content_publish'],
};

function validateScopes(platform: string, receivedScopes: string[]): void {
  const required = REQUIRED_SCOPES[platform];
  const missing = required.filter(scope => !receivedScopes.includes(scope));
  
  if (missing.length > 0) {
    // Log security event
    await securityAuditService.logEvent({
      type: SecurityEventType.OAUTH_SCOPE_DOWNGRADE,
      severity: 'high',
      platform,
      requiredScopes: required,
      receivedScopes,
      missingScopes: missing,
    });
    
    throw new ScopeError(`Missing required scopes: ${missing.join(', ')}`);
  }
}
```

### 6. Duplicate Prevention

#### ✅ Duplicate Account Check
- [ ] Check if account already connected to workspace
- [ ] Check if account connected to different workspace
- [ ] Use unique index on (workspaceId, provider, providerUserId)
- [ ] Handle race conditions with database constraints
- [ ] Return clear error message

**Implementation**:
```typescript
async function checkDuplicateAccount(
  workspaceId: string,
  platform: string,
  platformUserId: string
): Promise<void> {
  // Check same workspace
  const existingInWorkspace = await SocialAccount.findOne({
    workspaceId,
    provider: platform,
    providerUserId: platformUserId,
    status: { $ne: AccountStatus.REVOKED },
  });
  
  if (existingInWorkspace) {
    throw new DuplicateAccountError('This account is already connected to this workspace');
  }
  
  // Check other workspaces
  const existingInOtherWorkspace = await SocialAccount.findOne({
    workspaceId: { $ne: workspaceId },
    provider: platform,
    providerUserId: platformUserId,
    status: AccountStatus.ACTIVE,
  });
  
  if (existingInOtherWorkspace) {
    throw new CrossTenantError('This account is already connected to another workspace');
  }
}
```

### 7. Tenant Ownership Validation

#### ✅ Workspace Access Check
- [ ] Verify user has access to workspace
- [ ] Check workspace exists
- [ ] Verify workspace not deleted
- [ ] Check user role permissions
- [ ] Validate workspace plan limits

**Implementation**:
```typescript
async function validateWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<void> {
  // Check workspace exists
  const workspace = await Workspace.findById(workspaceId);
  
  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }
  
  if (workspace.deletedAt) {
    throw new BadRequestError('Workspace is deleted');
  }
  
  // Check user has access
  const member = await WorkspaceMember.findOne({
    workspaceId,
    userId,
    status: 'active',
  });
  
  if (!member) {
    throw new UnauthorizedError('You do not have access to this workspace');
  }
  
  // Check permissions
  if (!member.permissions.includes('manage_accounts')) {
    throw new ForbiddenError('You do not have permission to connect accounts');
  }
}
```

### 8. Rate Limiting

#### ✅ OAuth Endpoint Rate Limits
- [ ] Limit OAuth initiation: 10 requests/minute per user
- [ ] Limit callback processing: 20 requests/minute per IP
- [ ] Limit token refresh: 30 requests/hour per account
- [ ] Use Redis for distributed rate limiting
- [ ] Return 429 Too Many Requests

**Implementation**:
```typescript
const oauthRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:oauth:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many OAuth requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/oauth/:platform/initiate', oauthRateLimiter, ...);
```

### 9. Security Audit Logging

#### ✅ Log Security Events
- [ ] Log all OAuth initiations
- [ ] Log all OAuth completions
- [ ] Log all OAuth failures
- [ ] Log state validation failures
- [ ] Log scope downgrade attempts
- [ ] Log duplicate account attempts
- [ ] Log cross-tenant attempts
- [ ] Log replay attack attempts
- [ ] Include IP address, user agent, timestamp
- [ ] Store logs for 90 days minimum

**Implementation**:
```typescript
await securityAuditService.logEvent({
  type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
  severity: 'info',
  workspaceId,
  userId,
  platform,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  metadata: {
    accountId: account._id,
    providerUserId: profile.id,
    scopes: tokens.scope,
  },
  timestamp: new Date(),
});
```

---

## Database Transaction Boundaries

### Transaction 1: OAuth State Creation

**Scope**: Create OAuth state and store in Redis

**Operations**:
1. Generate state parameter
2. Generate PKCE (if applicable)
3. Store state in Redis with TTL
4. Store PKCE in Redis with TTL

**Rollback**: Delete Redis keys if any operation fails

**Isolation**: Not required (Redis operations are atomic)

```typescript
async function createOAuthState(
  workspaceId: string,
  userId: string,
  platform: string
): Promise<OAuthState> {
  const state = generateState(workspaceId, userId, platform);
  const pkce = platform === 'twitter' ? generatePKCE() : null;
  
  try {
    // Store state
    await redis.setex(
      `oauth:state:${state}`,
      600,
      JSON.stringify({ workspaceId, userId, platform, timestamp: Date.now() })
    );
    
    // Store PKCE if applicable
    if (pkce) {
      await redis.setex(
        `oauth:pkce:${state}`,
        600,
        JSON.stringify(pkce)
      );
    }
    
    return { state, pkce };
  } catch (error) {
    // Rollback
    await redis.del(`oauth:state:${state}`);
    if (pkce) {
      await redis.del(`oauth:pkce:${state}`);
    }
    throw error;
  }
}
```

### Transaction 2: Account Creation

**Scope**: Create or update social account with encrypted tokens

**Operations**:
1. Validate state parameter
2. Exchange code for tokens
3. Fetch user profile
4. Validate scopes
5. Check duplicates
6. Encrypt tokens
7. Create/update SocialAccount document
8. Update usage tracking
9. Mark state as used
10. Log security event

**Rollback**: Delete account if any post-creation operation fails

**Isolation**: SERIALIZABLE (prevent duplicate accounts)

```typescript
async function createSocialAccount(
  code: string,
  state: string,
  platform: string
): Promise<ISocialAccount> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Validate state
    const stateData = await validateState(state, workspaceId, platform);
    
    // 2. Exchange code for tokens
    const tokens = await exchangeCodeForToken(code, platform, stateData);
    
    // 3. Fetch user profile
    const profile = await fetchUserProfile(tokens.accessToken, platform);
    
    // 4. Validate scopes
    validateScopes(platform, tokens.scope);
    
    // 5. Check duplicates (with session for isolation)
    await checkDuplicateAccount(
      stateData.workspaceId,
      platform,
      profile.id,
      { session }
    );
    
    // 6. Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken 
      ? encryptToken(tokens.refreshToken)
      : undefined;
    
    // 7. Create account (with session)
    const account = new SocialAccount({
      workspaceId: stateData.workspaceId,
      provider: platform,
      providerUserId: profile.id,
      accountName: profile.displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scope,
      status: AccountStatus.ACTIVE,
      metadata: {
        username: profile.username,
        email: profile.email,
        profileUrl: profile.profileUrl,
        avatarUrl: profile.avatarUrl,
        followerCount: profile.followerCount,
      },
      lastSyncAt: new Date(),
    });
    
    await account.save({ session });
    
    // 8. Update usage tracking (with session)
    await usageService.incrementAccounts(stateData.workspaceId, { session });
    
    // 9. Mark state as used
    await redis.setex(`oauth:state:used:${state}`, 3600, 'true');
    await redis.del(`oauth:state:${state}`);
    
    // 10. Log security event
    await securityAuditService.logEvent({
      type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
      workspaceId: stateData.workspaceId,
      userId: stateData.userId,
      platform,
      metadata: { accountId: account._id, providerUserId: profile.id },
    });
    
    // Commit transaction
    await session.commitTransaction();
    
    return account;
    
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();
    
    // Log failure
    await securityAuditService.logEvent({
      type: SecurityEventType.OAUTH_CONNECT_FAILURE,
      workspaceId: stateData?.workspaceId,
      userId: stateData?.userId,
      platform,
      errorMessage: error.message,
    });
    
    throw error;
    
  } finally {
    session.endSession();
  }
}
```

### Transaction 3: Account Disconnection

**Scope**: Revoke account and update usage

**Operations**:
1. Find account
2. Validate ownership
3. Update status to REVOKED
4. Update usage tracking
5. Log security event

**Rollback**: Restore account status if usage update fails

**Isolation**: READ_COMMITTED

```typescript
async function disconnectAccount(
  accountId: string,
  workspaceId: string,
  userId: string
): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Find account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
    }).session(session);
    
    if (!account) {
      throw new NotFoundError('Account not found');
    }
    
    // 2. Update status
    account.status = AccountStatus.REVOKED;
    account.metadata.revokedAt = new Date();
    account.metadata.revokedBy = userId;
    
    await account.save({ session });
    
    // 3. Update usage tracking
    await usageService.decrementAccounts(workspaceId, { session });
    
    // 4. Log security event
    await securityAuditService.logEvent({
      type: SecurityEventType.OAUTH_DISCONNECT,
      workspaceId,
      userId,
      platform: account.provider,
      metadata: { accountId: account._id },
    });
    
    // Commit transaction
    await session.commitTransaction();
    
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();
    throw error;
    
  } finally {
    session.endSession();
  }
}
```

---

## Security Testing Checklist

### Penetration Testing
- [ ] Test state parameter tampering
- [ ] Test state replay attacks
- [ ] Test CSRF attacks
- [ ] Test SQL injection in OAuth parameters
- [ ] Test XSS in OAuth callback
- [ ] Test token extraction attempts
- [ ] Test rate limit bypass
- [ ] Test duplicate account creation race conditions

### Vulnerability Scanning
- [ ] Run OWASP ZAP scan
- [ ] Run Burp Suite scan
- [ ] Check for known CVEs in dependencies
- [ ] Test SSL/TLS configuration
- [ ] Verify HTTPS enforcement

### Code Review
- [ ] Review all OAuth-related code
- [ ] Review encryption implementation
- [ ] Review state validation logic
- [ ] Review error handling
- [ ] Review logging (no sensitive data)

---

This security specification provides comprehensive protection for the OAuth connection flow at production-grade standards.

