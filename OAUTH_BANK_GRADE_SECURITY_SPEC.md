# OAuth Module - Bank-Grade Security Specification

**Classification**: CONFIDENTIAL - Security Architecture  
**Version**: 1.0  
**Date**: 2026-02-27  
**Compliance**: OWASP ASVS Level 3, SOC 2 Type II  

---

## Table of Contents

1. [Threat Model](#1-threat-model)
2. [Attack Vectors & Mitigations](#2-attack-vectors--mitigations)
3. [Security Architecture](#3-security-architecture)
4. [Database Schema](#4-database-schema)
5. [Transaction Boundaries](#5-transaction-boundaries)
6. [Implementation Tasks](#6-implementation-tasks)
7. [Security Testing](#7-security-testing)

---

## 1. THREAT MODEL

### 1.1 Assets to Protect

**Critical Assets**:
1. OAuth access tokens (enables account takeover)
2. OAuth refresh tokens (enables persistent access)
3. User account credentials
4. Workspace data access
5. OAuth state parameters (CSRF protection)
6. Encryption keys (master + data encryption keys)

**Asset Classification**:
- **Tier 1 (Critical)**: Access tokens, refresh tokens, encryption keys
- **Tier 2 (High)**: State parameters, user sessions, workspace IDs
- **Tier 3 (Medium)**: Profile data, metadata, audit logs

### 1.2 Threat Actors

**External Attackers**:
- **Skill Level**: Advanced persistent threat (APT)
- **Motivation**: Financial gain, data theft, account takeover
- **Capabilities**: Network interception, phishing, social engineering
- **Access**: Public internet, no internal access

**Insider Threats**:
- **Skill Level**: Varies (low to high)
- **Motivation**: Curiosity, financial gain, sabotage
- **Capabilities**: Database access, code access, log access
- **Access**: Internal systems, production environment

**Compromised Dependencies**:
- **Skill Level**: High (supply chain attack)
- **Motivation**: Widespread compromise
- **Capabilities**: Code injection, backdoors
- **Access**: Application runtime

### 1.3 Attack Surface

**Network Layer**:
- OAuth redirect URLs
- Callback endpoints
- Token exchange endpoints
- API endpoints

**Application Layer**:
- State parameter generation
- Token storage
- Token decryption
- Session management

**Data Layer**:
- Database connections
- Redis connections
- Encryption key storage
- Audit logs

### 1.4 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ UNTRUSTED ZONE (Internet)                                   │
│  - User browsers                                             │
│  - OAuth providers (Twitter, LinkedIn, Facebook, Instagram) │
│  - Attackers                                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ DMZ (Load Balancer + WAF)                                   │
│  - TLS termination                                           │
│  - DDoS protection                                           │
│  - Rate limiting                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ SEMI-TRUSTED ZONE (Application Servers)                     │
│  - OAuth controllers                                         │
│  - State validation                                          │
│  - Token exchange                                            │
│  - NO DECRYPTION HERE                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TRUSTED ZONE (Secure Services)                              │
│  - Token Encryption Service (isolated)                       │
│  - Key Management Service (HSM-backed)                       │
│  - Audit Service (append-only)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ DATA ZONE (Encrypted at Rest)                               │
│  - MongoDB (encrypted tokens)                                │
│  - Redis (ephemeral state)                                   │
│  - Audit logs (immutable)                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ATTACK VECTORS & MITIGATIONS

### 2.1 CSRF (Cross-Site Request Forgery)

**Attack Vector**:
Attacker tricks user into initiating OAuth flow with attacker-controlled state parameter.

**Attack Scenario**:
```
1. Attacker creates malicious page: evil.com
2. Page contains: <img src="https://app.com/oauth/twitter/authorize?state=ATTACKER_STATE">
3. Victim visits evil.com while logged into app.com
4. OAuth flow completes with attacker's state
5. Attacker's Twitter account connected to victim's workspace
```

**Mitigation**:
```typescript
// ✅ 256-bit cryptographically secure state parameter
function generateState(userId: string, workspaceId: string, ipHash: string): string {
  const nonce = crypto.randomBytes(32); // 256 bits
  const timestamp = Date.now();
  
  const stateData = {
    userId,
    workspaceId,
    ipHash,
    timestamp,
    nonce: nonce.toString('hex'),
    version: 1,
  };
  
  // Sign state with HMAC to prevent tampering
  const stateJson = JSON.stringify(stateData);
  const signature = crypto
    .createHmac('sha256', getStateSigningKey())
    .update(stateJson)
    .digest('hex');
  
  const signedState = {
    data: stateData,
    signature,
  };
  
  return Buffer.from(JSON.stringify(signedState)).toString('base64url');
}

// ✅ Strict state validation
async function validateState(
  state: string,
  userId: string,
  workspaceId: string,
  ipAddress: string
): Promise<StateData> {
  // Decode and verify signature
  const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
  
  const stateJson = JSON.stringify(decoded.data);
  const expectedSignature = crypto
    .createHmac('sha256', getStateSigningKey())
    .update(stateJson)
    .digest('hex');
  
  // Timing-safe comparison
  if (!crypto.timingSafeEqual(
    Buffer.from(decoded.signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )) {
    throw new SecurityError('State signature invalid');
  }
  
  const stateData = decoded.data;
  
  // Verify not expired (10 minutes max)
  if (Date.now() - stateData.timestamp > 600000) {
    throw new SecurityError('State expired');
  }
  
  // Verify user ID matches
  if (stateData.userId !== userId) {
    throw new SecurityError('User ID mismatch');
  }
  
  // Verify workspace ID matches
  if (stateData.workspaceId !== workspaceId) {
    throw new SecurityError('Workspace ID mismatch');
  }
  
  // Verify IP hash matches (prevent session hijacking)
  const currentIpHash = hashIP(ipAddress);
  if (stateData.ipHash !== currentIpHash) {
    throw new SecurityError('IP address mismatch');
  }
  
  // Check Redis for replay protection
  const used = await redis.get(`oauth:state:used:${state}`);
  if (used) {
    await logSecurityIncident('STATE_REPLAY_ATTACK', { state, userId, workspaceId });
    throw new SecurityError('State already used');
  }
  
  // Mark as used (1 hour TTL for audit trail)
  await redis.setex(`oauth:state:used:${state}`, 3600, JSON.stringify({
    usedAt: Date.now(),
    userId,
    workspaceId,
    ipAddress: currentIpHash,
  }));
  
  return stateData;
}

// ✅ IP hashing for privacy + security
function hashIP(ipAddress: string): string {
  // Hash IP with salt to prevent rainbow table attacks
  // But consistent for same IP during session
  const salt = getIPHashSalt(); // Rotated daily
  return crypto
    .createHmac('sha256', salt)
    .update(ipAddress)
    .digest('hex')
    .substring(0, 16); // First 16 chars sufficient
}
```

**Security Controls**:
- ✅ 256-bit random nonce
- ✅ HMAC signature verification
- ✅ Timing-safe comparison
- ✅ User ID binding
- ✅ Workspace ID binding
- ✅ IP hash binding
- ✅ 10-minute expiration
- ✅ Single-use enforcement (Redis)
- ✅ Replay attack detection

---

### 2.2 Authorization Code Interception

**Attack Vector**:
Attacker intercepts authorization code during redirect.

**Attack Scenario**:
```
1. Victim initiates OAuth flow
2. Attacker intercepts redirect: https://app.com/callback?code=ABC123&state=XYZ
3. Attacker uses code before victim
4. Attacker's request completes first
5. Victim's request fails (code already used)
```

**Mitigation**:
```typescript
// ✅ PKCE (Proof Key for Code Exchange) with S256
interface PKCEChallenge {
  codeVerifier: string;  // 128 characters, base64url
  codeChallenge: string; // SHA256(codeVerifier), base64url
  method: 'S256';
}

function generatePKCE(): PKCEChallenge {
  // Generate 96-byte random value (128 chars base64url)
  const codeVerifier = crypto
    .randomBytes(96)
    .toString('base64url')
    .substring(0, 128);
  
  // Generate SHA256 challenge
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return {
    codeVerifier,
    codeChallenge,
    method: 'S256',
  };
}

// ✅ Store PKCE with state in Redis
async function storePKCE(state: string, pkce: PKCEChallenge): Promise<void> {
  await redis.setex(
    `oauth:pkce:${state}`,
    600, // 10 minutes
    JSON.stringify({
      codeVerifier: pkce.codeVerifier,
      codeChallenge: pkce.codeChallenge,
      createdAt: Date.now(),
    })
  );
}

// ✅ Retrieve and validate PKCE
async function retrievePKCE(state: string): Promise<string> {
  const pkceData = await redis.get(`oauth:pkce:${state}`);
  
  if (!pkceData) {
    throw new SecurityError('PKCE data not found or expired');
  }
  
  const pkce = JSON.parse(pkceData);
  
  // Delete immediately after retrieval (single use)
  await redis.del(`oauth:pkce:${state}`);
  
  return pkce.codeVerifier;
}

// ✅ Send code_challenge in authorization request
function buildAuthorizationUrl(platform: string, state: string, pkce: PKCEChallenge): string {
  const config = getOAuthConfig(platform);
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    response_type: 'code',
    state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: 'S256',
  });
  
  return `${config.authUrl}?${params.toString()}`;
}

// ✅ Send code_verifier in token exchange
async function exchangeCodeForToken(
  code: string,
  state: string,
  platform: string
): Promise<TokenResponse> {
  const config = getOAuthConfig(platform);
  const codeVerifier = await retrievePKCE(state);
  
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier, // PKCE verification
    }),
  });
  
  if (!response.ok) {
    throw new OAuthError('Token exchange failed');
  }
  
  return response.json();
}
```

**Security Controls**:
- ✅ PKCE with S256 (SHA256)
- ✅ 128-character code verifier
- ✅ Code verifier stored in Redis
- ✅ Single-use code verifier
- ✅ Code challenge sent to OAuth provider
- ✅ Provider validates code_challenge = SHA256(code_verifier)

---

### 2.3 Token Theft from Database

**Attack Vector**:
Attacker gains database access and steals encrypted tokens.

**Attack Scenario**:
```
1. Attacker compromises database credentials
2. Attacker dumps SocialAccount collection
3. Attacker extracts encrypted tokens
4. Attacker attempts to decrypt tokens
```

**Mitigation**:
```typescript
// ✅ Envelope Encryption (Two-layer encryption)
// Layer 1: Data Encryption Key (DEK) - unique per token
// Layer 2: Key Encryption Key (KEK) - master key in KMS/HSM

interface EncryptedToken {
  version: number;           // Encryption version
  algorithm: 'aes-256-gcm';  // Encryption algorithm
  encryptedData: string;     // Base64 encrypted token
  encryptedDEK: string;      // Base64 encrypted DEK
  iv: string;                // Base64 initialization vector
  authTag: string;           // Base64 authentication tag
  keyId: string;             // KEK identifier
}

// ✅ Token Encryption Service (isolated microservice)
class TokenEncryptionService {
  private kmsClient: KMSClient;
  
  async encryptToken(plainToken: string): Promise<EncryptedToken> {
    // Generate unique DEK for this token
    const dek = crypto.randomBytes(32); // 256 bits
    
    // Generate IV for AES-GCM
    const iv = crypto.randomBytes(16); // 128 bits
    
    // Encrypt token with DEK
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    let encryptedData = cipher.update(plainToken, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    
    // Encrypt DEK with KEK (from KMS/HSM)
    const kekId = await this.kmsClient.getCurrentKeyId();
    const encryptedDEK = await this.kmsClient.encrypt(dek, kekId);
    
    return {
      version: 1,
      algorithm: 'aes-256-gcm',
      encryptedData,
      encryptedDEK: encryptedDEK.toString('base64'),
      iv: iv.toString('base64'),
      authTag,
      keyId: kekId,
    };
  }
  
  async decryptToken(encryptedToken: EncryptedToken): Promise<string> {
    // Decrypt DEK with KEK (from KMS/HSM)
    const encryptedDEKBuffer = Buffer.from(encryptedToken.encryptedDEK, 'base64');
    const dek = await this.kmsClient.decrypt(encryptedDEKBuffer, encryptedToken.keyId);
    
    // Decrypt token with DEK
    const iv = Buffer.from(encryptedToken.iv, 'base64');
    const authTag = Buffer.from(encryptedToken.authTag, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedToken.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Zero out DEK from memory
    dek.fill(0);
    
    return decrypted;
  }
  
  // ✅ Key rotation support
  async rotateKey(oldKeyId: string, newKeyId: string): Promise<void> {
    // Re-encrypt all tokens with new KEK
    // This is done in batches to avoid memory issues
    const batchSize = 100;
    let processed = 0;
    
    while (true) {
      const accounts = await SocialAccount.find({
        'accessToken.keyId': oldKeyId,
      })
      .limit(batchSize)
      .select('+accessToken +refreshToken');
      
      if (accounts.length === 0) break;
      
      for (const account of accounts) {
        // Decrypt with old key
        const plainAccessToken = await this.decryptToken(account.accessToken);
        const plainRefreshToken = account.refreshToken 
          ? await this.decryptToken(account.refreshToken)
          : null;
        
        // Re-encrypt with new key
        account.accessToken = await this.encryptToken(plainAccessToken);
        if (plainRefreshToken) {
          account.refreshToken = await this.encryptToken(plainRefreshToken);
        }
        
        await account.save();
        processed++;
      }
      
      logger.info('Key rotation progress', { processed });
    }
  }
}

// ✅ KMS Client (AWS KMS, Google Cloud KMS, or Azure Key Vault)
class KMSClient {
  async encrypt(data: Buffer, keyId: string): Promise<Buffer> {
    // Call KMS API to encrypt data
    // KEK never leaves KMS/HSM
    const response = await kms.encrypt({
      KeyId: keyId,
      Plaintext: data,
    });
    
    return response.CiphertextBlob;
  }
  
  async decrypt(encryptedData: Buffer, keyId: string): Promise<Buffer> {
    // Call KMS API to decrypt data
    // KEK never leaves KMS/HSM
    const response = await kms.decrypt({
      KeyId: keyId,
      CiphertextBlob: encryptedData,
    });
    
    return response.Plaintext;
  }
  
  async getCurrentKeyId(): Promise<string> {
    // Get current active key ID
    return process.env.KMS_KEY_ID || 'default-key-id';
  }
}
```

**Security Controls**:
- ✅ Envelope encryption (DEK + KEK)
- ✅ AES-256-GCM authenticated encryption
- ✅ Unique DEK per token
- ✅ KEK stored in KMS/HSM (never in application)
- ✅ Authentication tag prevents tampering
- ✅ Key rotation support
- ✅ Memory zeroing after decryption
- ✅ Isolated encryption service

---


### 2.4 Scope Downgrade Attack

**Attack Vector**:
User grants fewer permissions than required, bypassing scope validation.

**Attack Scenario**:
```
1. App requests scopes: ['tweet.read', 'tweet.write', 'offline.access']
2. User denies 'tweet.write' permission
3. OAuth provider returns token with scopes: ['tweet.read', 'offline.access']
4. App accepts token without validation
5. App fails when trying to post tweets
```

**Mitigation**:
```typescript
// ✅ Strict scope validation after token exchange
interface ScopeRequirement {
  platform: string;
  required: string[];
  optional: string[];
}

const SCOPE_REQUIREMENTS: Record<string, ScopeRequirement> = {
  twitter: {
    platform: 'twitter',
    required: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    optional: ['follows.read', 'follows.write'],
  },
  linkedin: {
    platform: 'linkedin',
    required: ['w_member_social', 'r_liteprofile'],
    optional: ['r_organization_social'],
  },
  facebook: {
    platform: 'facebook',
    required: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
    optional: ['pages_manage_metadata'],
  },
  instagram: {
    platform: 'instagram',
    required: ['instagram_basic', 'instagram_content_publish'],
    optional: ['instagram_manage_insights', 'instagram_manage_comments'],
  },
};

async function validateScopes(
  platform: string,
  receivedScopes: string[]
): Promise<ScopeValidationResult> {
  const requirements = SCOPE_REQUIREMENTS[platform];
  
  if (!requirements) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  
  // Check all required scopes are present
  const missingRequired = requirements.required.filter(
    scope => !receivedScopes.includes(scope)
  );
  
  if (missingRequired.length > 0) {
    // Log security event
    await logSecurityEvent({
      type: 'SCOPE_DOWNGRADE_DETECTED',
      severity: 'high',
      platform,
      requiredScopes: requirements.required,
      receivedScopes,
      missingScopes: missingRequired,
    });
    
    throw new ScopeError(
      `Missing required permissions: ${missingRequired.join(', ')}`,
      {
        code: 'INSUFFICIENT_SCOPES',
        missingScopes: missingRequired,
        requiredScopes: requirements.required,
        receivedScopes,
      }
    );
  }
  
  // Check for unexpected scopes (potential attack)
  const allExpected = [...requirements.required, ...requirements.optional];
  const unexpected = receivedScopes.filter(
    scope => !allExpected.includes(scope)
  );
  
  if (unexpected.length > 0) {
    // Log but don't fail (user may have granted extra permissions)
    await logSecurityEvent({
      type: 'UNEXPECTED_SCOPES_GRANTED',
      severity: 'medium',
      platform,
      expectedScopes: allExpected,
      receivedScopes,
      unexpectedScopes: unexpected,
    });
  }
  
  return {
    valid: true,
    requiredScopes: requirements.required,
    receivedScopes,
    optionalScopes: requirements.optional.filter(s => receivedScopes.includes(s)),
  };
}

// ✅ Scope validation before account creation
async function createSocialAccount(
  tokens: TokenResponse,
  profile: UserProfile,
  platform: string,
  workspaceId: string
): Promise<ISocialAccount> {
  // Parse scopes from token response
  const receivedScopes = tokens.scope ? tokens.scope.split(' ') : [];
  
  // Validate scopes
  const scopeValidation = await validateScopes(platform, receivedScopes);
  
  if (!scopeValidation.valid) {
    throw new ScopeError('Scope validation failed');
  }
  
  // Create account with validated scopes
  const account = new SocialAccount({
    workspaceId,
    provider: platform,
    providerUserId: profile.id,
    accountName: profile.displayName,
    accessToken: await tokenEncryptionService.encryptToken(tokens.access_token),
    refreshToken: tokens.refresh_token 
      ? await tokenEncryptionService.encryptToken(tokens.refresh_token)
      : undefined,
    tokenExpiresAt: tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined,
    scopes: receivedScopes, // Store validated scopes
    status: AccountStatus.ACTIVE,
    metadata: {
      ...profile,
      scopeValidation: {
        validatedAt: new Date(),
        requiredScopes: scopeValidation.requiredScopes,
        optionalScopes: scopeValidation.optionalScopes,
      },
    },
  });
  
  await account.save();
  
  return account;
}
```

**Security Controls**:
- ✅ Explicit required scopes per platform
- ✅ Validation after token exchange
- ✅ Rejection if missing required scopes
- ✅ Detection of unexpected scopes
- ✅ Audit logging of scope issues
- ✅ Scope metadata stored with account

---

### 2.5 Token Replay Attack

**Attack Vector**:
Attacker captures and reuses valid access token.

**Attack Scenario**:
```
1. Attacker intercepts network traffic (MITM)
2. Attacker captures access token
3. Attacker uses token to make API calls
4. Token is still valid (not expired)
```

**Mitigation**:
```typescript
// ✅ Short-lived access tokens (15 minutes)
// ✅ Refresh token rotation
// ✅ Token binding to client

interface TokenMetadata {
  accountId: string;
  issuedAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  lastUsedIP: string;
  usageCount: number;
  rotationCount: number;
}

// ✅ Track token usage
async function trackTokenUsage(
  accountId: string,
  ipAddress: string
): Promise<void> {
  const key = `token:usage:${accountId}`;
  
  const metadata = await redis.get(key);
  const current: TokenMetadata = metadata ? JSON.parse(metadata) : {
    accountId,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    lastUsedAt: new Date(),
    lastUsedIP: ipAddress,
    usageCount: 0,
    rotationCount: 0,
  };
  
  // Check for suspicious usage patterns
  if (current.lastUsedIP !== ipAddress) {
    // IP changed - potential token theft
    await logSecurityEvent({
      type: 'TOKEN_IP_CHANGE_DETECTED',
      severity: 'high',
      accountId,
      previousIP: current.lastUsedIP,
      currentIP: ipAddress,
      usageCount: current.usageCount,
    });
    
    // Force token refresh
    throw new SecurityError('Token usage from different IP - please reconnect');
  }
  
  // Update metadata
  current.lastUsedAt = new Date();
  current.usageCount++;
  
  await redis.setex(key, 900, JSON.stringify(current)); // 15 minutes
}

// ✅ Refresh token rotation
async function refreshAccessToken(
  accountId: string,
  refreshToken: string
): Promise<TokenResponse> {
  const account = await SocialAccount.findById(accountId)
    .select('+accessToken +refreshToken');
  
  if (!account) {
    throw new NotFoundError('Account not found');
  }
  
  // Decrypt refresh token
  const decryptedRefreshToken = await tokenEncryptionService.decryptToken(
    account.refreshToken
  );
  
  // Verify refresh token matches
  if (decryptedRefreshToken !== refreshToken) {
    // Potential token theft - revoke account
    await logSecurityEvent({
      type: 'REFRESH_TOKEN_MISMATCH',
      severity: 'critical',
      accountId,
      action: 'account_revoked',
    });
    
    account.status = AccountStatus.REVOKED;
    await account.save();
    
    throw new SecurityError('Invalid refresh token - account revoked');
  }
  
  // Call OAuth provider to refresh
  const newTokens = await oauthProvider.refreshToken(decryptedRefreshToken);
  
  // Encrypt new tokens
  account.accessToken = await tokenEncryptionService.encryptToken(
    newTokens.access_token
  );
  
  // Rotate refresh token if provider returns new one
  if (newTokens.refresh_token) {
    account.refreshToken = await tokenEncryptionService.encryptToken(
      newTokens.refresh_token
    );
  }
  
  account.tokenExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
  account.lastRefreshedAt = new Date();
  
  // Increment rotation counter
  account.metadata.rotationCount = (account.metadata.rotationCount || 0) + 1;
  
  await account.save();
  
  // Log successful refresh
  await logSecurityEvent({
    type: 'TOKEN_REFRESH_SUCCESS',
    severity: 'info',
    accountId,
    rotationCount: account.metadata.rotationCount,
  });
  
  return newTokens;
}
```

**Security Controls**:
- ✅ Short-lived access tokens (15 minutes)
- ✅ Refresh token rotation
- ✅ Token usage tracking
- ✅ IP address monitoring
- ✅ Automatic revocation on suspicious activity
- ✅ Usage count tracking
- ✅ Rotation count tracking

---

### 2.6 Race Condition in Account Creation

**Attack Vector**:
Attacker creates multiple requests simultaneously to bypass duplicate checks.

**Attack Scenario**:
```
1. Attacker initiates OAuth flow
2. Attacker completes OAuth and gets code
3. Attacker sends 10 simultaneous requests to callback endpoint
4. All requests pass duplicate check (race condition)
5. Multiple accounts created for same provider user
```

**Mitigation**:
```typescript
// ✅ Idempotent transaction with distributed lock

async function handleOAuthCallback(
  code: string,
  state: string,
  platform: string,
  userId: string,
  workspaceId: string,
  ipAddress: string
): Promise<ISocialAccount> {
  // Acquire distributed lock
  const lockKey = `oauth:lock:${workspaceId}:${platform}:${code}`;
  const lock = await acquireDistributedLock(lockKey, 30000); // 30 second timeout
  
  if (!lock) {
    throw new ConcurrencyError('OAuth callback already in progress');
  }
  
  try {
    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
    
    try {
      // 1. Validate state (with replay protection)
      const stateData = await validateState(state, userId, workspaceId, ipAddress);
      
      // 2. Exchange code for tokens
      const tokens = await exchangeCodeForToken(code, state, platform);
      
      // 3. Fetch user profile
      const profile = await fetchUserProfile(tokens.access_token, platform);
      
      // 4. Validate scopes
      await validateScopes(platform, tokens.scope?.split(' ') || []);
      
      // 5. Check for duplicate account (within transaction)
      const existingAccount = await SocialAccount.findOne({
        workspaceId,
        provider: platform,
        providerUserId: profile.id,
        status: { $ne: AccountStatus.REVOKED },
      }).session(session);
      
      if (existingAccount) {
        // Idempotent: return existing account
        await session.abortTransaction();
        
        await logSecurityEvent({
          type: 'DUPLICATE_ACCOUNT_DETECTED',
          severity: 'medium',
          accountId: existingAccount._id,
          workspaceId,
          platform,
          providerUserId: profile.id,
        });
        
        return existingAccount;
      }
      
      // 6. Check cross-tenant connection
      const crossTenantAccount = await SocialAccount.findOne({
        workspaceId: { $ne: workspaceId },
        provider: platform,
        providerUserId: profile.id,
        status: AccountStatus.ACTIVE,
      }).session(session);
      
      if (crossTenantAccount) {
        await session.abortTransaction();
        
        await logSecurityEvent({
          type: 'CROSS_TENANT_CONNECTION_BLOCKED',
          severity: 'high',
          workspaceId,
          existingWorkspaceId: crossTenantAccount.workspaceId,
          platform,
          providerUserId: profile.id,
        });
        
        throw new ConflictError(
          'This account is already connected to another workspace'
        );
      }
      
      // 7. Encrypt tokens
      const encryptedAccessToken = await tokenEncryptionService.encryptToken(
        tokens.access_token
      );
      const encryptedRefreshToken = tokens.refresh_token
        ? await tokenEncryptionService.encryptToken(tokens.refresh_token)
        : undefined;
      
      // 8. Create account
      const account = new SocialAccount({
        workspaceId,
        provider: platform,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        scopes: tokens.scope?.split(' ') || [],
        status: AccountStatus.ACTIVE,
        metadata: {
          ...profile,
          connectedAt: new Date(),
          connectedBy: userId,
          connectedIP: hashIP(ipAddress),
        },
      });
      
      await account.save({ session });
      
      // 9. Update usage tracking
      await usageService.incrementAccounts(workspaceId, { session });
      
      // 10. Commit transaction
      await session.commitTransaction();
      
      // 11. Log success
      await logSecurityEvent({
        type: 'OAUTH_CONNECT_SUCCESS',
        severity: 'info',
        accountId: account._id,
        workspaceId,
        userId,
        platform,
        providerUserId: profile.id,
      });
      
      return account;
      
    } catch (error) {
      // Rollback transaction
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } finally {
    // Release distributed lock
    await releaseDistributedLock(lock);
  }
}

// ✅ Distributed lock using Redis
async function acquireDistributedLock(
  key: string,
  ttlMs: number
): Promise<string | null> {
  const lockValue = crypto.randomBytes(16).toString('hex');
  
  // SET NX EX - atomic set if not exists with expiration
  const result = await redis.set(key, lockValue, 'PX', ttlMs, 'NX');
  
  if (result === 'OK') {
    return lockValue;
  }
  
  return null;
}

async function releaseDistributedLock(lockValue: string): Promise<void> {
  // Lua script for atomic check-and-delete
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  await redis.eval(script, 1, lockValue);
}
```

**Security Controls**:
- ✅ Distributed lock (Redis)
- ✅ MongoDB transaction with snapshot isolation
- ✅ Idempotent callback handling
- ✅ Duplicate check within transaction
- ✅ Cross-tenant check within transaction
- ✅ Atomic lock acquisition
- ✅ Automatic lock release
- ✅ 30-second lock timeout

---

### 2.7 Logging Sensitive Data

**Attack Vector**:
Tokens accidentally logged, exposing them to log viewers.

**Attack Scenario**:
```
1. Developer adds debug logging
2. Log statement includes token: logger.debug('Token:', token)
3. Token written to log file
4. Attacker gains access to logs
5. Attacker extracts tokens from logs
```

**Mitigation**:
```typescript
// ✅ Token redaction in logs

class SecureLogger {
  private sensitivePatterns = [
    /access_token["\s:=]+([a-zA-Z0-9_-]+)/gi,
    /refresh_token["\s:=]+([a-zA-Z0-9_-]+)/gi,
    /bearer\s+([a-zA-Z0-9_-]+)/gi,
    /authorization:\s*bearer\s+([a-zA-Z0-9_-]+)/gi,
  ];
  
  private redactSensitiveData(message: string): string {
    let redacted = message;
    
    for (const pattern of this.sensitivePatterns) {
      redacted = redacted.replace(pattern, (match, token) => {
        // Keep first 4 and last 4 characters for debugging
        if (token.length > 8) {
          return match.replace(token, `${token.substring(0, 4)}...${token.substring(token.length - 4)}`);
        }
        return match.replace(token, '***REDACTED***');
      });
    }
    
    return redacted;
  }
  
  log(level: string, message: string, metadata?: any): void {
    const redactedMessage = this.redactSensitiveData(message);
    const redactedMetadata = metadata ? this.redactObject(metadata) : undefined;
    
    winston.log(level, redactedMessage, redactedMetadata);
  }
  
  private redactObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const redacted = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Redact sensitive keys
      if (this.isSensitiveKey(key)) {
        redacted[key] = '***REDACTED***';
      } else if (typeof value === 'object') {
        redacted[key] = this.redactObject(value);
      } else if (typeof value === 'string') {
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }
  
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'accessToken',
      'refreshToken',
      'access_token',
      'refresh_token',
      'token',
      'password',
      'secret',
      'apiKey',
      'api_key',
      'privateKey',
      'private_key',
    ];
    
    return sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()));
  }
}

// ✅ Use secure logger everywhere
const logger = new SecureLogger();

// ✅ Never log tokens
// ❌ BAD: logger.info('Token received', { token: accessToken });
// ✅ GOOD: logger.info('Token received', { tokenLength: accessToken.length });

// ✅ Audit log for security events (separate from application logs)
async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  // Security events go to separate, append-only log
  await SecurityEventLog.create({
    type: event.type,
    severity: event.severity,
    timestamp: new Date(),
    userId: event.userId,
    workspaceId: event.workspaceId,
    ipAddress: event.ipAddress ? hashIP(event.ipAddress) : undefined,
    userAgent: event.userAgent,
    metadata: event.metadata,
    // NO TOKENS EVER
  });
}
```

**Security Controls**:
- ✅ Automatic token redaction in logs
- ✅ Sensitive key detection
- ✅ Pattern-based redaction
- ✅ Separate security audit log
- ✅ IP address hashing in logs
- ✅ No tokens in any logs
- ✅ Append-only audit log

---


## 3. SECURITY ARCHITECTURE

### 3.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER (Browser)                                              │
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │   User       │────────▶│  OAuth       │                         │
│  │   Browser    │         │  Provider    │                         │
│  └──────────────┘         └──────────────┘                         │
│         │                        │                                  │
│         │ HTTPS                  │ OAuth Redirect                   │
│         ▼                        ▼                                  │
└─────────────────────────────────────────────────────────────────────┘
         │                        │
         │                        │
┌─────────────────────────────────────────────────────────────────────┐
│ EDGE LAYER (CDN + WAF)                                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Cloudflare / AWS WAF                                     │      │
│  │  - DDoS Protection                                        │      │
│  │  - Rate Limiting (Layer 7)                                │      │
│  │  - Bot Detection                                          │      │
│  │  - TLS 1.3 Termination                                    │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ HTTPS (TLS 1.3)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER (Node.js)                                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  OAuth Controller                                       │        │
│  │  - State generation (256-bit)                           │        │
│  │  - PKCE generation (S256)                               │        │
│  │  - State validation                                     │        │
│  │  - Scope validation                                     │        │
│  │  - Duplicate prevention                                 │        │
│  │  - Rate limiting (application level)                    │        │
│  │  - NO TOKEN DECRYPTION                                  │        │
│  └────────────────────────────────────────────────────────┘        │
│         │                                                            │
│         │ Internal API                                              │
│         ▼                                                            │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  Social Account Service                                 │        │
│  │  - Account creation (idempotent)                        │        │
│  │  - Duplicate checks                                     │        │
│  │  - Cross-tenant checks                                  │        │
│  │  - Usage tracking                                       │        │
│  │  - NO TOKEN DECRYPTION                                  │        │
│  └────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SECURE SERVICES LAYER (Isolated)                                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  Token Encryption Service (Microservice)                │        │
│  │  - Envelope encryption (DEK + KEK)                      │        │
│  │  - AES-256-GCM                                          │        │
│  │  - Key rotation                                         │        │
│  │  - Memory zeroing                                       │        │
│  │  - ONLY service that decrypts tokens                    │        │
│  └────────────────────────────────────────────────────────┘        │
│         │                                                            │
│         │ gRPC / Internal API                                       │
│         ▼                                                            │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  Key Management Service (KMS)                           │        │
│  │  - AWS KMS / Google Cloud KMS / Azure Key Vault        │        │
│  │  - HSM-backed key storage                               │        │
│  │  - KEK never leaves KMS                                 │        │
│  │  - Automatic key rotation                               │        │
│  │  - Audit logging                                        │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  Security Audit Service                                 │        │
│  │  - Append-only log storage                              │        │
│  │  - Immutable audit trail                                │        │
│  │  - Real-time alerting                                   │        │
│  │  - Compliance reporting                                 │        │
│  └────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DATA LAYER (Encrypted at Rest)                                      │
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐                      │
│  │  MongoDB         │    │  Redis           │                      │
│  │  - Encrypted     │    │  - State storage │                      │
│  │    tokens        │    │  - PKCE storage  │                      │
│  │  - Unique        │    │  - Lock storage  │                      │
│  │    constraints   │    │  - TTL: 10 min   │                      │
│  │  - Transactions  │    │  - Ephemeral     │                      │
│  └──────────────────┘    └──────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────┐          │
│  │  Security Event Log (Append-Only)                    │          │
│  │  - Immutable audit trail                             │          │
│  │  - 90-day retention minimum                          │          │
│  │  - Compliance reporting                              │          │
│  └──────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 OAuth Flow Sequence (Bank-Grade)

```
┌──────┐         ┌─────────┐         ┌──────────┐         ┌─────────┐
│Client│         │  App    │         │  Redis   │         │ OAuth   │
│      │         │ Server  │         │          │         │Provider │
└──┬───┘         └────┬────┘         └────┬─────┘         └────┬────┘
   │                  │                   │                    │
   │ 1. Initiate OAuth│                   │                    │
   │─────────────────▶│                   │                    │
   │                  │                   │                    │
   │                  │ 2. Generate state (256-bit)            │
   │                  │    + PKCE (S256)                       │
   │                  │    + IP hash                           │
   │                  │                   │                    │
   │                  │ 3. Store state    │                    │
   │                  │──────────────────▶│                    │
   │                  │    TTL: 10 min    │                    │
   │                  │                   │                    │
   │                  │ 4. Store PKCE     │                    │
   │                  │──────────────────▶│                    │
   │                  │    TTL: 10 min    │                    │
   │                  │                   │                    │
   │ 5. Redirect URL  │                   │                    │
   │◀─────────────────│                   │                    │
   │                  │                   │                    │
   │ 6. Redirect to OAuth provider        │                    │
   │──────────────────────────────────────────────────────────▶│
   │    + state                           │                    │
   │    + code_challenge                  │                    │
   │                  │                   │                    │
   │ 7. User authorizes                   │                    │
   │◀─────────────────────────────────────────────────────────│
   │                  │                   │                    │
   │ 8. Callback with code + state        │                    │
   │─────────────────▶│                   │                    │
   │                  │                   │                    │
   │                  │ 9. Acquire distributed lock            │
   │                  │──────────────────▶│                    │
   │                  │    (prevent race) │                    │
   │                  │                   │                    │
   │                  │ 10. Validate state│                    │
   │                  │◀──────────────────│                    │
   │                  │    - Signature    │                    │
   │                  │    - Expiration   │                    │
   │                  │    - User ID      │                    │
   │                  │    - Workspace ID │                    │
   │                  │    - IP hash      │                    │
   │                  │    - Replay check │                    │
   │                  │                   │                    │
   │                  │ 11. Mark state used                    │
   │                  │──────────────────▶│                    │
   │                  │                   │                    │
   │                  │ 12. Retrieve PKCE │                    │
   │                  │◀──────────────────│                    │
   │                  │    (single use)   │                    │
   │                  │                   │                    │
   │                  │ 13. Exchange code for token            │
   │                  │    + code_verifier│                    │
   │                  │──────────────────────────────────────▶│
   │                  │                   │                    │
   │                  │ 14. Tokens        │                    │
   │                  │◀──────────────────────────────────────│
   │                  │    + access_token │                    │
   │                  │    + refresh_token│                    │
   │                  │    + scope        │                    │
   │                  │                   │                    │
   │                  │ 15. Validate scopes                    │
   │                  │    (required vs received)              │
   │                  │                   │                    │
   │                  │ 16. Start MongoDB transaction          │
   │                  │    (snapshot isolation)                │
   │                  │                   │                    │
   │                  │ 17. Check duplicate                    │
   │                  │    (within transaction)                │
   │                  │                   │                    │
   │                  │ 18. Encrypt tokens                     │
   │                  │    (envelope encryption)               │
   │                  │                   │                    │
   │                  │ 19. Create account                     │
   │                  │    (idempotent)   │                    │
   │                  │                   │                    │
   │                  │ 20. Commit transaction                 │
   │                  │                   │                    │
   │                  │ 21. Release lock  │                    │
   │                  │──────────────────▶│                    │
   │                  │                   │                    │
   │                  │ 22. Log security event                 │
   │                  │    (audit trail)  │                    │
   │                  │                   │                    │
   │ 23. Success      │                   │                    │
   │◀─────────────────│                   │                    │
   │                  │                   │                    │
```

### 3.3 Security Layers

**Layer 1: Network Security**
- TLS 1.3 only
- Certificate pinning
- HSTS headers
- DDoS protection
- WAF rules

**Layer 2: Application Security**
- Rate limiting (10 req/min per user)
- Input validation
- CSRF protection (state parameter)
- PKCE (S256)
- IP binding

**Layer 3: Data Security**
- Envelope encryption (DEK + KEK)
- AES-256-GCM
- Key rotation
- Encrypted at rest
- Encrypted in transit

**Layer 4: Access Control**
- Authentication required
- Workspace authorization
- Role-based permissions
- Tenant isolation
- Audit logging

**Layer 5: Monitoring & Response**
- Real-time alerting
- Anomaly detection
- Incident response
- Compliance reporting
- Security metrics

---

## 4. DATABASE SCHEMA

### 4.1 SocialAccount Collection (Updated)

```typescript
interface ISocialAccount {
  _id: ObjectId;
  
  // Tenant isolation
  workspaceId: ObjectId;  // Indexed
  
  // Platform identification
  provider: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  providerUserId: string;  // Platform's user ID
  accountName: string;
  
  // Encrypted tokens (envelope encryption)
  accessToken: EncryptedToken;  // Never selected by default
  refreshToken?: EncryptedToken;  // Never selected by default
  
  // Token metadata
  tokenExpiresAt?: Date;
  lastRefreshedAt?: Date;
  
  // Scope tracking
  scopes: string[];
  scopeValidation: {
    validatedAt: Date;
    requiredScopes: string[];
    optionalScopes: string[];
  };
  
  // Status
  status: 'active' | 'expired' | 'revoked';
  
  // Security metadata
  securityMetadata: {
    connectedAt: Date;
    connectedBy: ObjectId;  // User ID
    connectedIP: string;  // Hashed IP
    lastUsedAt?: Date;
    lastUsedIP?: string;  // Hashed IP
    usageCount: number;
    rotationCount: number;
    suspiciousActivityDetected: boolean;
  };
  
  // Profile metadata
  metadata: {
    username?: string;
    email?: string;
    profileUrl?: string;
    avatarUrl?: string;
    followerCount?: number;
    [key: string]: any;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Encrypted token structure
interface EncryptedToken {
  version: number;           // Encryption version
  algorithm: 'aes-256-gcm';  // Encryption algorithm
  encryptedData: string;     // Base64 encrypted token
  encryptedDEK: string;      // Base64 encrypted DEK
  iv: string;                // Base64 initialization vector
  authTag: string;           // Base64 authentication tag
  keyId: string;             // KEK identifier
}
```

### 4.2 Indexes

```typescript
// Unique constraint: one account per provider per workspace per user
db.socialaccounts.createIndex(
  { workspaceId: 1, provider: 1, providerUserId: 1 },
  { 
    unique: true,
    name: 'unique_account_per_workspace',
    partialFilterExpression: { status: { $ne: 'revoked' } }
  }
);

// Query by workspace
db.socialaccounts.createIndex(
  { workspaceId: 1, status: 1, createdAt: -1 },
  { name: 'workspace_accounts' }
);

// Query by platform
db.socialaccounts.createIndex(
  { workspaceId: 1, provider: 1, status: 1 },
  { name: 'workspace_platform_accounts' }
);

// Token expiration monitoring
db.socialaccounts.createIndex(
  { status: 1, tokenExpiresAt: 1 },
  { name: 'token_expiration' }
);

// Security monitoring
db.socialaccounts.createIndex(
  { 'securityMetadata.suspiciousActivityDetected': 1, status: 1 },
  { name: 'suspicious_accounts' }
);

// Cross-tenant check
db.socialaccounts.createIndex(
  { provider: 1, providerUserId: 1, status: 1 },
  { name: 'cross_tenant_check' }
);
```

### 4.3 SecurityEvent Collection (New)

```typescript
interface ISecurityEvent {
  _id: ObjectId;
  
  // Event classification
  type: SecurityEventType;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  
  // Context
  timestamp: Date;
  userId?: ObjectId;
  workspaceId?: ObjectId;
  accountId?: ObjectId;
  
  // Network context (hashed for privacy)
  ipAddress?: string;  // Hashed
  userAgent?: string;
  
  // Platform context
  platform?: string;
  providerUserId?: string;
  
  // Event details
  metadata: {
    [key: string]: any;
    // NO TOKENS EVER
  };
  
  // Incident tracking
  incidentId?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: ObjectId;
  
  // Immutable
  createdAt: Date;  // No updatedAt - append-only
}

enum SecurityEventType {
  // OAuth events
  OAUTH_INITIATED = 'oauth_initiated',
  OAUTH_CONNECT_SUCCESS = 'oauth_connect_success',
  OAUTH_CONNECT_FAILURE = 'oauth_connect_failure',
  
  // Security events
  STATE_REPLAY_ATTACK = 'state_replay_attack',
  STATE_VALIDATION_FAILED = 'state_validation_failed',
  SCOPE_DOWNGRADE_DETECTED = 'scope_downgrade_detected',
  DUPLICATE_ACCOUNT_DETECTED = 'duplicate_account_detected',
  CROSS_TENANT_CONNECTION_BLOCKED = 'cross_tenant_connection_blocked',
  TOKEN_IP_CHANGE_DETECTED = 'token_ip_change_detected',
  REFRESH_TOKEN_MISMATCH = 'refresh_token_mismatch',
  SUSPICIOUS_ACTIVITY_DETECTED = 'suspicious_activity_detected',
  
  // Token events
  TOKEN_REFRESH_SUCCESS = 'token_refresh_success',
  TOKEN_REFRESH_FAILURE = 'token_refresh_failure',
  TOKEN_ROTATION = 'token_rotation',
  
  // Account events
  ACCOUNT_REVOKED = 'account_revoked',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
}
```

### 4.4 Indexes for SecurityEvent

```typescript
// Query by type and severity
db.securityevents.createIndex(
  { type: 1, severity: 1, timestamp: -1 },
  { name: 'event_type_severity' }
);

// Query by workspace
db.securityevents.createIndex(
  { workspaceId: 1, timestamp: -1 },
  { name: 'workspace_events' }
);

// Query by user
db.securityevents.createIndex(
  { userId: 1, timestamp: -1 },
  { name: 'user_events' }
);

// Query unresolved incidents
db.securityevents.createIndex(
  { resolved: 1, severity: 1, timestamp: -1 },
  { name: 'unresolved_incidents' }
);

// TTL index for automatic cleanup (90 days)
db.securityevents.createIndex(
  { createdAt: 1 },
  { 
    name: 'event_ttl',
    expireAfterSeconds: 7776000  // 90 days
  }
);
```

### 4.5 Redis Keys

```typescript
// OAuth state storage
// Key: oauth:state:{state}
// Value: JSON { userId, workspaceId, platform, timestamp, nonce, ipHash }
// TTL: 600 seconds (10 minutes)

// PKCE storage
// Key: oauth:pkce:{state}
// Value: JSON { codeVerifier, codeChallenge, createdAt }
// TTL: 600 seconds (10 minutes)

// State replay protection
// Key: oauth:state:used:{state}
// Value: JSON { usedAt, userId, workspaceId, ipAddress }
// TTL: 3600 seconds (1 hour for audit trail)

// Distributed lock
// Key: oauth:lock:{workspaceId}:{platform}:{code}
// Value: random lock ID
// TTL: 30000 milliseconds (30 seconds)

// Token usage tracking
// Key: token:usage:{accountId}
// Value: JSON { issuedAt, expiresAt, lastUsedAt, lastUsedIP, usageCount }
// TTL: 900 seconds (15 minutes)

// Rate limiting
// Key: ratelimit:oauth:{userId}
// Value: request count
// TTL: 60 seconds (1 minute)
```

---


## 5. TRANSACTION BOUNDARIES

### 5.1 Transaction 1: OAuth Initiation

**Scope**: Generate and store OAuth state + PKCE

**Isolation Level**: Not applicable (Redis operations are atomic)

**Operations**:
1. Generate 256-bit state parameter
2. Generate PKCE challenge (S256)
3. Hash user's IP address
4. Store state in Redis (TTL: 10 minutes)
5. Store PKCE in Redis (TTL: 10 minutes)
6. Log security event

**Rollback Strategy**:
```typescript
async function initiateOAuth(
  userId: string,
  workspaceId: string,
  platform: string,
  ipAddress: string
): Promise<OAuthInitiation> {
  const state = generateState(userId, workspaceId, hashIP(ipAddress));
  const pkce = generatePKCE();
  
  try {
    // Store state
    await redis.setex(
      `oauth:state:${state}`,
      600,
      JSON.stringify({
        userId,
        workspaceId,
        platform,
        timestamp: Date.now(),
        ipHash: hashIP(ipAddress),
      })
    );
    
    // Store PKCE
    await redis.setex(
      `oauth:pkce:${state}`,
      600,
      JSON.stringify(pkce)
    );
    
    // Log event
    await logSecurityEvent({
      type: SecurityEventType.OAUTH_INITIATED,
      severity: 'info',
      userId,
      workspaceId,
      platform,
      ipAddress: hashIP(ipAddress),
    });
    
    return {
      authUrl: buildAuthorizationUrl(platform, state, pkce),
      state,
    };
    
  } catch (error) {
    // Rollback: delete Redis keys
    await redis.del(`oauth:state:${state}`);
    await redis.del(`oauth:pkce:${state}`);
    throw error;
  }
}
```

**Failure Modes**:
- Redis unavailable → Fail fast, return error to user
- State generation fails → Retry with new random bytes
- PKCE generation fails → Retry with new random bytes

---

### 5.2 Transaction 2: OAuth Callback (CRITICAL)

**Scope**: Validate state, exchange code, create account

**Isolation Level**: SNAPSHOT (MongoDB)

**ACID Properties**:
- **Atomicity**: All operations succeed or all fail
- **Consistency**: Unique constraints enforced
- **Isolation**: Snapshot isolation prevents dirty reads
- **Durability**: Write concern = majority

**Operations**:
1. Acquire distributed lock (Redis)
2. Validate state parameter
3. Mark state as used (Redis)
4. Retrieve PKCE (Redis, single-use)
5. Exchange code for tokens (external API)
6. Fetch user profile (external API)
7. Validate scopes
8. **START MONGODB TRANSACTION**
9. Check duplicate account (within transaction)
10. Check cross-tenant connection (within transaction)
11. Encrypt tokens (external service)
12. Create SocialAccount document
13. Update usage tracking
14. **COMMIT TRANSACTION**
15. Release distributed lock (Redis)
16. Log security event

**Implementation**:
```typescript
async function handleOAuthCallback(
  code: string,
  state: string,
  platform: string,
  userId: string,
  workspaceId: string,
  ipAddress: string
): Promise<ISocialAccount> {
  // 1. Acquire distributed lock
  const lockKey = `oauth:lock:${workspaceId}:${platform}:${code}`;
  const lock = await acquireDistributedLock(lockKey, 30000);
  
  if (!lock) {
    throw new ConcurrencyError('OAuth callback already in progress');
  }
  
  try {
    // 2-7. Pre-transaction operations
    const stateData = await validateState(state, userId, workspaceId, ipAddress);
    const codeVerifier = await retrievePKCE(state);
    const tokens = await exchangeCodeForToken(code, codeVerifier, platform);
    const profile = await fetchUserProfile(tokens.access_token, platform);
    await validateScopes(platform, tokens.scope?.split(' ') || []);
    
    // 8. START TRANSACTION
    const session = await mongoose.startSession();
    await session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority', j: true },
      readPreference: 'primary',
    });
    
    try {
      // 9. Check duplicate (within transaction)
      const existingAccount = await SocialAccount.findOne({
        workspaceId,
        provider: platform,
        providerUserId: profile.id,
        status: { $ne: AccountStatus.REVOKED },
      }).session(session);
      
      if (existingAccount) {
        // Idempotent: return existing account
        await session.abortTransaction();
        return existingAccount;
      }
      
      // 10. Check cross-tenant (within transaction)
      const crossTenantAccount = await SocialAccount.findOne({
        workspaceId: { $ne: workspaceId },
        provider: platform,
        providerUserId: profile.id,
        status: AccountStatus.ACTIVE,
      }).session(session);
      
      if (crossTenantAccount) {
        await session.abortTransaction();
        throw new ConflictError('Account connected to another workspace');
      }
      
      // 11. Encrypt tokens
      const encryptedAccessToken = await tokenEncryptionService.encryptToken(
        tokens.access_token
      );
      const encryptedRefreshToken = tokens.refresh_token
        ? await tokenEncryptionService.encryptToken(tokens.refresh_token)
        : undefined;
      
      // 12. Create account
      const account = new SocialAccount({
        workspaceId,
        provider: platform,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        scopes: tokens.scope?.split(' ') || [],
        scopeValidation: {
          validatedAt: new Date(),
          requiredScopes: SCOPE_REQUIREMENTS[platform].required,
          optionalScopes: SCOPE_REQUIREMENTS[platform].optional.filter(
            s => tokens.scope?.includes(s)
          ),
        },
        status: AccountStatus.ACTIVE,
        securityMetadata: {
          connectedAt: new Date(),
          connectedBy: userId,
          connectedIP: hashIP(ipAddress),
          usageCount: 0,
          rotationCount: 0,
          suspiciousActivityDetected: false,
        },
        metadata: profile,
      });
      
      await account.save({ session });
      
      // 13. Update usage
      await usageService.incrementAccounts(workspaceId, { session });
      
      // 14. COMMIT TRANSACTION
      await session.commitTransaction();
      
      // 16. Log success
      await logSecurityEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        severity: 'info',
        userId,
        workspaceId,
        accountId: account._id,
        platform,
        providerUserId: profile.id,
        ipAddress: hashIP(ipAddress),
      });
      
      return account;
      
    } catch (error) {
      // Rollback transaction
      await session.abortTransaction();
      
      // Log failure
      await logSecurityEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        severity: 'high',
        userId,
        workspaceId,
        platform,
        metadata: { error: error.message },
      });
      
      throw error;
      
    } finally {
      session.endSession();
    }
    
  } finally {
    // 15. Release lock (always)
    await releaseDistributedLock(lock);
  }
}
```

**Failure Modes**:
- Lock acquisition fails → Return 409 Conflict
- State validation fails → Return 403 Forbidden, log security event
- Token exchange fails → Return 502 Bad Gateway, retry allowed
- Profile fetch fails → Return 502 Bad Gateway, retry allowed
- Scope validation fails → Return 400 Bad Request, user must reconnect
- Duplicate found → Return existing account (idempotent)
- Cross-tenant found → Return 409 Conflict
- Encryption fails → Rollback transaction, return 500
- Database write fails → Rollback transaction, return 500
- Lock release fails → Log error, continue (lock will expire)

**Retry Policy**:
- State validation failure: NO RETRY (security violation)
- Token exchange failure: RETRY 3 times with exponential backoff
- Profile fetch failure: RETRY 3 times with exponential backoff
- Database failure: NO RETRY (user must restart flow)

---

### 5.3 Transaction 3: Token Refresh

**Scope**: Refresh access token, rotate refresh token

**Isolation Level**: READ_COMMITTED (MongoDB)

**Operations**:
1. Find account with encrypted tokens
2. Decrypt refresh token
3. Call OAuth provider to refresh
4. Encrypt new tokens
5. **START TRANSACTION**
6. Update account with new tokens
7. Increment rotation counter
8. **COMMIT TRANSACTION**
9. Log security event

**Implementation**:
```typescript
async function refreshAccessToken(
  accountId: string,
  workspaceId: string
): Promise<TokenResponse> {
  // 1. Find account
  const account = await SocialAccount.findOne({
    _id: accountId,
    workspaceId,
    status: AccountStatus.ACTIVE,
  }).select('+accessToken +refreshToken');
  
  if (!account) {
    throw new NotFoundError('Account not found');
  }
  
  if (!account.refreshToken) {
    throw new BadRequestError('No refresh token available');
  }
  
  // 2. Decrypt refresh token
  const decryptedRefreshToken = await tokenEncryptionService.decryptToken(
    account.refreshToken
  );
  
  // 3. Call OAuth provider
  const newTokens = await oauthProvider.refreshToken(
    decryptedRefreshToken,
    account.provider
  );
  
  // 4. Encrypt new tokens
  const encryptedAccessToken = await tokenEncryptionService.encryptToken(
    newTokens.access_token
  );
  const encryptedRefreshToken = newTokens.refresh_token
    ? await tokenEncryptionService.encryptToken(newTokens.refresh_token)
    : account.refreshToken; // Keep old if not rotated
  
  // 5. START TRANSACTION
  const session = await mongoose.startSession();
  await session.startTransaction({
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority', j: true },
  });
  
  try {
    // 6. Update account
    account.accessToken = encryptedAccessToken;
    account.refreshToken = encryptedRefreshToken;
    account.tokenExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
    account.lastRefreshedAt = new Date();
    
    // 7. Increment rotation counter
    account.securityMetadata.rotationCount++;
    
    await account.save({ session });
    
    // 8. COMMIT
    await session.commitTransaction();
    
    // 9. Log success
    await logSecurityEvent({
      type: SecurityEventType.TOKEN_REFRESH_SUCCESS,
      severity: 'info',
      accountId: account._id,
      workspaceId,
      platform: account.provider,
      metadata: {
        rotationCount: account.securityMetadata.rotationCount,
      },
    });
    
    return newTokens;
    
  } catch (error) {
    await session.abortTransaction();
    
    // Log failure
    await logSecurityEvent({
      type: SecurityEventType.TOKEN_REFRESH_FAILURE,
      severity: 'high',
      accountId: account._id,
      workspaceId,
      platform: account.provider,
      metadata: { error: error.message },
    });
    
    throw error;
    
  } finally {
    session.endSession();
  }
}
```

**Failure Modes**:
- Account not found → Return 404
- No refresh token → Return 400
- Decryption fails → Return 500, log security event
- OAuth provider fails → Return 502, retry allowed
- Encryption fails → Rollback, return 500
- Database write fails → Rollback, return 500

**Retry Policy**:
- OAuth provider failure: RETRY 3 times with exponential backoff
- Database failure: NO RETRY (user must manually retry)

---

### 5.4 Transaction 4: Account Revocation

**Scope**: Revoke account and clean up

**Isolation Level**: READ_COMMITTED (MongoDB)

**Operations**:
1. **START TRANSACTION**
2. Find account
3. Update status to REVOKED
4. Update usage tracking
5. **COMMIT TRANSACTION**
6. Revoke token on OAuth provider (best effort)
7. Log security event

**Implementation**:
```typescript
async function revokeAccount(
  accountId: string,
  workspaceId: string,
  userId: string,
  reason: string
): Promise<void> {
  const session = await mongoose.startSession();
  await session.startTransaction({
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority', j: true },
  });
  
  try {
    // 2. Find account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
    }).session(session);
    
    if (!account) {
      await session.abortTransaction();
      throw new NotFoundError('Account not found');
    }
    
    // 3. Update status
    account.status = AccountStatus.REVOKED;
    account.metadata.revokedAt = new Date();
    account.metadata.revokedBy = userId;
    account.metadata.revokeReason = reason;
    
    await account.save({ session });
    
    // 4. Update usage
    await usageService.decrementAccounts(workspaceId, { session });
    
    // 5. COMMIT
    await session.commitTransaction();
    
    // 6. Revoke on provider (best effort, don't fail if this fails)
    try {
      await oauthProvider.revokeToken(account.accessToken, account.provider);
    } catch (error) {
      logger.warn('Failed to revoke token on provider', {
        accountId,
        platform: account.provider,
        error: error.message,
      });
    }
    
    // 7. Log event
    await logSecurityEvent({
      type: SecurityEventType.ACCOUNT_REVOKED,
      severity: 'medium',
      accountId,
      workspaceId,
      userId,
      platform: account.provider,
      metadata: { reason },
    });
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

---

## 6. IMPLEMENTATION TASKS

### Phase 1: Core Security Infrastructure (Week 1)

**Task 1.1: Token Encryption Service**
- [ ] Create isolated microservice for token encryption
- [ ] Implement envelope encryption (DEK + KEK)
- [ ] Integrate with AWS KMS / Google Cloud KMS
- [ ] Implement AES-256-GCM encryption
- [ ] Add memory zeroing after decryption
- [ ] Implement key rotation support
- [ ] Add encryption performance monitoring
- [ ] Write unit tests for encryption/decryption
- [ ] Write integration tests with KMS

**Task 1.2: State Parameter Security**
- [ ] Implement 256-bit state generation
- [ ] Add HMAC signature to state
- [ ] Implement IP address hashing
- [ ] Add state validation with timing-safe comparison
- [ ] Implement Redis-backed state storage
- [ ] Add state replay protection
- [ ] Add state expiration (10 minutes)
- [ ] Write unit tests for state generation/validation

**Task 1.3: PKCE Implementation**
- [ ] Implement PKCE generation (S256)
- [ ] Add PKCE storage in Redis
- [ ] Implement single-use PKCE retrieval
- [ ] Add PKCE to authorization URL
- [ ] Add code_verifier to token exchange
- [ ] Write unit tests for PKCE flow

**Task 1.4: Distributed Locking**
- [ ] Implement Redis-based distributed lock
- [ ] Add lock acquisition with timeout
- [ ] Implement atomic lock release
- [ ] Add lock expiration (30 seconds)
- [ ] Write unit tests for lock behavior
- [ ] Test lock under concurrent requests

### Phase 2: OAuth Flow Implementation (Week 2)

**Task 2.1: OAuth Controller**
- [ ] Implement OAuth initiation endpoint
- [ ] Implement OAuth callback endpoint
- [ ] Add rate limiting (10 req/min per user)
- [ ] Add input validation
- [ ] Add error handling
- [ ] Write integration tests

**Task 2.2: Token Exchange**
- [ ] Implement token exchange for Twitter
- [ ] Implement token exchange for LinkedIn
- [ ] Implement token exchange for Facebook
- [ ] Implement token exchange for Instagram
- [ ] Add retry logic with exponential backoff
- [ ] Add timeout handling
- [ ] Write integration tests with mocked providers

**Task 2.3: Scope Validation**
- [ ] Define required scopes per platform
- [ ] Implement scope validation logic
- [ ] Add scope downgrade detection
- [ ] Add unexpected scope detection
- [ ] Write unit tests for scope validation

**Task 2.4: Profile Fetching**
- [ ] Implement profile fetch for Twitter
- [ ] Implement profile fetch for LinkedIn
- [ ] Implement profile fetch for Facebook
- [ ] Implement profile fetch for Instagram
- [ ] Add retry logic
- [ ] Write integration tests

### Phase 3: Database & Transactions (Week 3)

**Task 3.1: Schema Updates**
- [ ] Update SocialAccount schema
- [ ] Add EncryptedToken structure
- [ ] Add securityMetadata fields
- [ ] Add scopeValidation fields
- [ ] Create SecurityEvent collection
- [ ] Add all required indexes
- [ ] Write migration script

**Task 3.2: Transaction Implementation**
- [ ] Implement OAuth callback transaction
- [ ] Add duplicate check within transaction
- [ ] Add cross-tenant check within transaction
- [ ] Implement token refresh transaction
- [ ] Implement account revocation transaction
- [ ] Add transaction retry logic
- [ ] Write integration tests

**Task 3.3: Duplicate Prevention**
- [ ] Add unique constraint to database
- [ ] Implement duplicate check logic
- [ ] Add cross-tenant check logic
- [ ] Test race condition handling
- [ ] Write property-based tests

### Phase 4: Security Monitoring (Week 4)

**Task 4.1: Security Audit Logging**
- [ ] Create SecurityEvent model
- [ ] Implement logSecurityEvent function
- [ ] Add logging for all security events
- [ ] Implement append-only log storage
- [ ] Add log retention (90 days)
- [ ] Write unit tests

**Task 4.2: Token Usage Tracking**
- [ ] Implement token usage tracking
- [ ] Add IP address monitoring
- [ ] Add usage count tracking
- [ ] Add rotation count tracking
- [ ] Implement suspicious activity detection
- [ ] Write unit tests

**Task 4.3: Secure Logging**
- [ ] Implement token redaction in logs
- [ ] Add sensitive key detection
- [ ] Add pattern-based redaction
- [ ] Test log output for token leaks
- [ ] Write unit tests

**Task 4.4: Monitoring & Alerting**
- [ ] Add metrics for OAuth success rate
- [ ] Add metrics for token refresh rate
- [ ] Add alerts for security events
- [ ] Add alerts for suspicious activity
- [ ] Create security dashboard
- [ ] Write runbook for incidents

---

## 7. SECURITY TESTING

### 7.1 Penetration Testing Checklist

**OAuth Flow Testing**:
- [ ] Test CSRF attack with forged state parameter
- [ ] Test state parameter tampering (modify signature)
- [ ] Test state parameter replay attack
- [ ] Test expired state parameter
- [ ] Test state parameter with wrong user ID
- [ ] Test state parameter with wrong workspace ID
- [ ] Test state parameter with wrong IP address
- [ ] Test authorization code interception
- [ ] Test authorization code replay attack
- [ ] Test PKCE bypass attempt
- [ ] Test code_verifier tampering
- [ ] Test missing code_challenge in authorization
- [ ] Test missing code_verifier in token exchange

**Token Security Testing**:
- [ ] Test token extraction from database dump
- [ ] Test token decryption without KEK
- [ ] Test token decryption with wrong KEK
- [ ] Test authentication tag tampering
- [ ] Test encrypted data tampering
- [ ] Test IV reuse attack
- [ ] Test token replay from logs
- [ ] Test token usage from different IP
- [ ] Test refresh token theft and reuse
- [ ] Test refresh token rotation bypass

**Scope Security Testing**:
- [ ] Test scope downgrade attack (user denies required scope)
- [ ] Test scope injection (add unauthorized scopes)
- [ ] Test missing scope validation
- [ ] Test scope validation bypass
- [ ] Test unexpected scope handling

**Race Condition Testing**:
- [ ] Test concurrent OAuth callbacks with same code
- [ ] Test duplicate account creation race condition
- [ ] Test distributed lock bypass
- [ ] Test transaction isolation violation
- [ ] Test lock timeout handling
- [ ] Test lock release failure

**Cross-Tenant Security Testing**:
- [ ] Test connecting same account to multiple workspaces
- [ ] Test workspace ID tampering in state
- [ ] Test cross-tenant data access
- [ ] Test tenant isolation in queries
- [ ] Test workspace authorization bypass

**Input Validation Testing**:
- [ ] Test SQL injection in OAuth parameters
- [ ] Test NoSQL injection in queries
- [ ] Test XSS in OAuth callback
- [ ] Test command injection in state parameter
- [ ] Test path traversal in redirect URI
- [ ] Test SSRF in OAuth provider URL
- [ ] Test oversized state parameter
- [ ] Test malformed JSON in state
- [ ] Test null byte injection

**Rate Limiting Testing**:
- [ ] Test rate limit bypass with multiple IPs
- [ ] Test rate limit bypass with multiple users
- [ ] Test rate limit enforcement accuracy
- [ ] Test rate limit reset timing
- [ ] Test distributed rate limiting

**Session Security Testing**:
- [ ] Test session fixation attack
- [ ] Test session hijacking
- [ ] Test concurrent session handling
- [ ] Test session timeout enforcement
- [ ] Test session invalidation on logout

---

### 7.2 Vulnerability Scanning

**Automated Scanning Tools**:
- [ ] Run OWASP ZAP against OAuth endpoints
- [ ] Run Burp Suite Professional scan
- [ ] Run Nessus vulnerability scan
- [ ] Run npm audit for dependency vulnerabilities
- [ ] Run Snyk for security issues
- [ ] Run SonarQube for code quality and security

**Dependency Scanning**:
- [ ] Scan all npm packages for known CVEs
- [ ] Check for outdated dependencies
- [ ] Verify package integrity (checksums)
- [ ] Check for malicious packages
- [ ] Review package permissions

**Container Scanning** (if applicable):
- [ ] Scan Docker images for vulnerabilities
- [ ] Check base image for CVEs
- [ ] Verify image signatures
- [ ] Check for exposed secrets in images
- [ ] Review container runtime security

**Infrastructure Scanning**:
- [ ] Scan MongoDB for misconfigurations
- [ ] Scan Redis for security issues
- [ ] Check TLS configuration (SSL Labs)
- [ ] Verify firewall rules
- [ ] Check IAM permissions (AWS/GCP/Azure)
- [ ] Review KMS key policies

---

### 7.3 Security Test Cases

#### 7.3.1 Unit Tests

**State Parameter Tests**:
```typescript
describe('State Parameter Security', () => {
  test('should generate 256-bit random state', () => {
    const state1 = generateState(userId, workspaceId, ipHash);
    const state2 = generateState(userId, workspaceId, ipHash);
    expect(state1).not.toBe(state2);
    expect(Buffer.from(state1, 'base64url').length).toBeGreaterThanOrEqual(32);
  });
  
  test('should include HMAC signature in state', () => {
    const state = generateState(userId, workspaceId, ipHash);
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    expect(decoded.signature).toBeDefined();
    expect(decoded.signature.length).toBe(64); // SHA256 hex
  });
  
  test('should reject tampered state signature', async () => {
    const state = generateState(userId, workspaceId, ipHash);
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    decoded.data.userId = 'attacker-id';
    const tamperedState = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    
    await expect(
      validateState(tamperedState, userId, workspaceId, ipAddress)
    ).rejects.toThrow('State signature invalid');
  });
  
  test('should reject expired state', async () => {
    const state = generateState(userId, workspaceId, ipHash);
    
    // Fast-forward time by 11 minutes
    jest.advanceTimersByTime(11 * 60 * 1000);
    
    await expect(
      validateState(state, userId, workspaceId, ipAddress)
    ).rejects.toThrow('State expired');
  });
  
  test('should reject state with wrong user ID', async () => {
    const state = generateState(userId, workspaceId, ipHash);
    
    await expect(
      validateState(state, 'wrong-user-id', workspaceId, ipAddress)
    ).rejects.toThrow('User ID mismatch');
  });
  
  test('should reject state with wrong IP', async () => {
    const state = generateState(userId, workspaceId, ipHash);
    
    await expect(
      validateState(state, userId, workspaceId, 'different-ip')
    ).rejects.toThrow('IP address mismatch');
  });
  
  test('should reject replayed state', async () => {
    const state = generateState(userId, workspaceId, ipHash);
    
    // First use succeeds
    await validateState(state, userId, workspaceId, ipAddress);
    
    // Second use fails
    await expect(
      validateState(state, userId, workspaceId, ipAddress)
    ).rejects.toThrow('State already used');
  });
});
```

**PKCE Tests**:
```typescript
describe('PKCE Security', () => {
  test('should generate 128-character code verifier', () => {
    const pkce = generatePKCE();
    expect(pkce.codeVerifier.length).toBe(128);
    expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  
  test('should generate SHA256 code challenge', () => {
    const pkce = generatePKCE();
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(pkce.codeVerifier)
      .digest('base64url');
    expect(pkce.codeChallenge).toBe(expectedChallenge);
    expect(pkce.method).toBe('S256');
  });
  
  test('should store and retrieve PKCE once', async () => {
    const state = 'test-state';
    const pkce = generatePKCE();
    
    await storePKCE(state, pkce);
    
    // First retrieval succeeds
    const retrieved = await retrievePKCE(state);
    expect(retrieved).toBe(pkce.codeVerifier);
    
    // Second retrieval fails (single use)
    await expect(retrievePKCE(state)).rejects.toThrow('PKCE data not found');
  });
});
```

**Token Encryption Tests**:
```typescript
describe('Token Encryption Security', () => {
  test('should encrypt and decrypt token correctly', async () => {
    const plainToken = 'test-access-token-12345';
    const encrypted = await tokenEncryptionService.encryptToken(plainToken);
    const decrypted = await tokenEncryptionService.decryptToken(encrypted);
    expect(decrypted).toBe(plainToken);
  });
  
  test('should use unique DEK for each token', async () => {
    const token = 'test-token';
    const encrypted1 = await tokenEncryptionService.encryptToken(token);
    const encrypted2 = await tokenEncryptionService.encryptToken(token);
    expect(encrypted1.encryptedDEK).not.toBe(encrypted2.encryptedDEK);
    expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
  });
  
  test('should use unique IV for each encryption', async () => {
    const token = 'test-token';
    const encrypted1 = await tokenEncryptionService.encryptToken(token);
    const encrypted2 = await tokenEncryptionService.encryptToken(token);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });
  
  test('should reject tampered encrypted data', async () => {
    const plainToken = 'test-token';
    const encrypted = await tokenEncryptionService.encryptToken(plainToken);
    
    // Tamper with encrypted data
    encrypted.encryptedData = encrypted.encryptedData.replace('A', 'B');
    
    await expect(
      tokenEncryptionService.decryptToken(encrypted)
    ).rejects.toThrow();
  });
  
  test('should reject tampered auth tag', async () => {
    const plainToken = 'test-token';
    const encrypted = await tokenEncryptionService.encryptToken(plainToken);
    
    // Tamper with auth tag
    encrypted.authTag = encrypted.authTag.replace('A', 'B');
    
    await expect(
      tokenEncryptionService.decryptToken(encrypted)
    ).rejects.toThrow();
  });
});
```

**Scope Validation Tests**:
```typescript
describe('Scope Validation Security', () => {
  test('should accept all required scopes', async () => {
    const result = await validateScopes('twitter', [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
    ]);
    expect(result.valid).toBe(true);
  });
  
  test('should reject missing required scope', async () => {
    await expect(
      validateScopes('twitter', ['tweet.read', 'users.read'])
    ).rejects.toThrow('Missing required permissions');
  });
  
  test('should detect unexpected scopes', async () => {
    const result = await validateScopes('twitter', [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
      'admin.write', // unexpected
    ]);
    expect(result.valid).toBe(true);
    // Should log security event for unexpected scope
  });
});
```

#### 7.3.2 Integration Tests

**OAuth Flow Integration Tests**:
```typescript
describe('OAuth Flow Integration', () => {
  test('should complete full OAuth flow successfully', async () => {
    // 1. Initiate OAuth
    const { authUrl, state } = await initiateOAuth(
      userId,
      workspaceId,
      'twitter',
      ipAddress
    );
    expect(authUrl).toContain('code_challenge');
    
    // 2. Simulate OAuth provider callback
    const code = 'mock-authorization-code';
    
    // 3. Handle callback
    const account = await handleOAuthCallback(
      code,
      state,
      'twitter',
      userId,
      workspaceId,
      ipAddress
    );
    
    expect(account.workspaceId.toString()).toBe(workspaceId);
    expect(account.provider).toBe('twitter');
    expect(account.status).toBe('active');
    expect(account.accessToken).toBeDefined();
  });
  
  test('should prevent duplicate account creation', async () => {
    // Create first account
    const account1 = await handleOAuthCallback(
      'code1',
      state1,
      'twitter',
      userId,
      workspaceId,
      ipAddress
    );
    
    // Try to create duplicate
    const account2 = await handleOAuthCallback(
      'code2',
      state2,
      'twitter',
      userId,
      workspaceId,
      ipAddress
    );
    
    // Should return same account (idempotent)
    expect(account2._id.toString()).toBe(account1._id.toString());
  });
  
  test('should prevent cross-tenant connection', async () => {
    // Connect to workspace 1
    await handleOAuthCallback(
      'code1',
      state1,
      'twitter',
      userId1,
      workspaceId1,
      ipAddress
    );
    
    // Try to connect same account to workspace 2
    await expect(
      handleOAuthCallback(
        'code2',
        state2,
        'twitter',
        userId2,
        workspaceId2,
        ipAddress
      )
    ).rejects.toThrow('Account connected to another workspace');
  });
  
  test('should handle concurrent callbacks with lock', async () => {
    const promises = Array(10).fill(null).map(() =>
      handleOAuthCallback(code, state, 'twitter', userId, workspaceId, ipAddress)
    );
    
    const results = await Promise.allSettled(promises);
    
    // Only one should succeed
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(9);
  });
});
```

**Token Refresh Integration Tests**:
```typescript
describe('Token Refresh Integration', () => {
  test('should refresh token successfully', async () => {
    const account = await createTestAccount();
    
    const newTokens = await refreshAccessToken(
      account._id.toString(),
      account.workspaceId.toString()
    );
    
    expect(newTokens.access_token).toBeDefined();
    
    // Verify account updated
    const updated = await SocialAccount.findById(account._id);
    expect(updated.lastRefreshedAt).toBeDefined();
    expect(updated.securityMetadata.rotationCount).toBe(1);
  });
  
  test('should detect refresh token mismatch', async () => {
    const account = await createTestAccount();
    
    // Tamper with refresh token in database
    account.refreshToken = await tokenEncryptionService.encryptToken('wrong-token');
    await account.save();
    
    await expect(
      refreshAccessToken(account._id.toString(), account.workspaceId.toString())
    ).rejects.toThrow('Invalid refresh token');
    
    // Account should be revoked
    const revoked = await SocialAccount.findById(account._id);
    expect(revoked.status).toBe('revoked');
  });
});
```

#### 7.3.3 End-to-End Tests

**E2E OAuth Flow Test**:
```typescript
describe('E2E OAuth Flow', () => {
  test('should complete OAuth flow from browser to database', async () => {
    // 1. User clicks "Connect Twitter"
    const response1 = await request(app)
      .post('/api/v1/oauth/twitter/authorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ workspaceId });
    
    expect(response1.status).toBe(200);
    expect(response1.body.authUrl).toContain('twitter.com');
    
    const { authUrl, state } = response1.body;
    
    // 2. User authorizes on Twitter (simulated)
    const code = 'mock-code-from-twitter';
    
    // 3. OAuth callback
    const response2 = await request(app)
      .get('/api/v1/oauth/twitter/callback')
      .query({ code, state })
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(response2.status).toBe(200);
    expect(response2.body.account).toBeDefined();
    expect(response2.body.account.provider).toBe('twitter');
    
    // 4. Verify account in database
    const account = await SocialAccount.findById(response2.body.account._id);
    expect(account).toBeDefined();
    expect(account.accessToken).toBeDefined();
    expect(account.status).toBe('active');
    
    // 5. Verify security event logged
    const events = await SecurityEvent.find({
      type: 'oauth_connect_success',
      accountId: account._id,
    });
    expect(events.length).toBe(1);
  });
});
```

---

### 7.4 Compliance Testing

#### 7.4.1 OWASP ASVS Level 3 Checklist

**V2: Authentication**
- [ ] V2.1.1: User credentials are protected with bcrypt/Argon2
- [ ] V2.1.2: Password reset tokens are single-use
- [ ] V2.2.1: Anti-automation controls on authentication
- [ ] V2.2.2: Rate limiting on authentication endpoints
- [ ] V2.3.1: Credential stuffing protection
- [ ] V2.5.1: OAuth state parameter is cryptographically secure
- [ ] V2.5.2: OAuth redirect URI is validated
- [ ] V2.5.3: OAuth tokens are stored securely
- [ ] V2.8.1: Multi-factor authentication available

**V3: Session Management**
- [ ] V3.2.1: Session tokens are cryptographically random
- [ ] V3.2.2: Session tokens are at least 128 bits
- [ ] V3.2.3: Session tokens are stored securely
- [ ] V3.3.1: Session logout invalidates tokens
- [ ] V3.3.2: Session timeout is enforced
- [ ] V3.5.1: Session tokens are not in URLs

**V6: Cryptography**
- [ ] V6.2.1: All random values use cryptographically secure RNG
- [ ] V6.2.2: Encryption uses approved algorithms (AES-256)
- [ ] V6.2.3: Encryption uses authenticated encryption (GCM)
- [ ] V6.2.4: Encryption keys are managed securely (KMS)
- [ ] V6.2.5: Encryption keys are rotated regularly
- [ ] V6.2.6: Deprecated algorithms are not used

**V8: Data Protection**
- [ ] V8.2.1: Sensitive data is encrypted at rest
- [ ] V8.2.2: Sensitive data is encrypted in transit (TLS 1.3)
- [ ] V8.2.3: Sensitive data is not logged
- [ ] V8.3.1: Sensitive data is not cached
- [ ] V8.3.4: Sensitive data is removed from memory after use

**V9: Communications**
- [ ] V9.1.1: TLS is used for all connections
- [ ] V9.1.2: TLS version is 1.2 or higher
- [ ] V9.1.3: Strong cipher suites are used
- [ ] V9.2.1: Certificate validation is enforced

**V10: Malicious Code**
- [ ] V10.2.1: Dependencies are scanned for vulnerabilities
- [ ] V10.2.2: Dependencies are kept up to date
- [ ] V10.3.1: Code is reviewed for security issues

#### 7.4.2 SOC 2 Type II Controls

**CC6.1: Logical and Physical Access Controls**
- [ ] Access to production systems requires MFA
- [ ] Access to encryption keys is restricted
- [ ] Access to database is logged
- [ ] Access to logs is restricted
- [ ] Privileged access is reviewed quarterly

**CC6.6: Logical and Physical Access Controls - Encryption**
- [ ] Data at rest is encrypted (AES-256)
- [ ] Data in transit is encrypted (TLS 1.3)
- [ ] Encryption keys are managed in KMS/HSM
- [ ] Key rotation is automated
- [ ] Encryption is tested regularly

**CC6.7: Logical and Physical Access Controls - Transmission**
- [ ] All API calls use HTTPS
- [ ] TLS configuration is hardened
- [ ] Certificate expiration is monitored
- [ ] Certificate pinning is implemented

**CC7.2: System Operations - Monitoring**
- [ ] Security events are logged
- [ ] Logs are monitored in real-time
- [ ] Alerts are configured for anomalies
- [ ] Incident response plan exists
- [ ] Security metrics are tracked

---

### 7.5 Security Code Review Checklist

**OAuth Controller Review**:
- [ ] All inputs are validated
- [ ] Rate limiting is enforced
- [ ] Error messages don't leak sensitive info
- [ ] State parameter is validated correctly
- [ ] PKCE is implemented correctly
- [ ] Tokens are never logged
- [ ] Transactions are used correctly
- [ ] Locks are released in finally blocks

**Token Encryption Service Review**:
- [ ] Envelope encryption is implemented correctly
- [ ] AES-256-GCM is used
- [ ] IV is unique per encryption
- [ ] Auth tag is verified
- [ ] Memory is zeroed after decryption
- [ ] Key rotation is supported
- [ ] KMS integration is secure
- [ ] Error handling doesn't leak keys

**Database Schema Review**:
- [ ] Unique constraints are correct
- [ ] Indexes are optimized
- [ ] Sensitive fields are not selected by default
- [ ] Soft delete is implemented
- [ ] Audit fields are present
- [ ] Foreign keys are correct
- [ ] Migrations are reversible

**Security Logging Review**:
- [ ] All security events are logged
- [ ] Tokens are redacted from logs
- [ ] Sensitive keys are redacted
- [ ] Log format is consistent
- [ ] Logs are append-only
- [ ] Log retention is configured
- [ ] Logs are monitored

---

### 7.6 Incident Response Procedures

#### 7.6.1 Token Compromise Response

**Detection**:
- Alert triggered for suspicious token usage
- Multiple failed refresh attempts
- Token usage from unexpected IP
- Token usage from multiple IPs simultaneously

**Response Steps**:
1. **Immediate Actions** (within 5 minutes):
   - [ ] Identify affected account(s)
   - [ ] Revoke compromised tokens in database
   - [ ] Revoke tokens on OAuth provider
   - [ ] Block suspicious IP addresses
   - [ ] Notify security team

2. **Investigation** (within 1 hour):
   - [ ] Review security event logs
   - [ ] Identify attack vector
   - [ ] Determine scope of compromise
   - [ ] Check for other affected accounts
   - [ ] Document findings

3. **Containment** (within 4 hours):
   - [ ] Force token refresh for all accounts in workspace
   - [ ] Rotate encryption keys if needed
   - [ ] Update security rules
   - [ ] Deploy patches if vulnerability found

4. **Recovery** (within 24 hours):
   - [ ] Notify affected users
   - [ ] Provide reconnection instructions
   - [ ] Monitor for continued attacks
   - [ ] Verify all accounts are secure

5. **Post-Incident** (within 1 week):
   - [ ] Complete incident report
   - [ ] Update security procedures
   - [ ] Conduct lessons learned session
   - [ ] Implement preventive measures

#### 7.6.2 Database Breach Response

**Detection**:
- Unauthorized database access detected
- Unusual query patterns
- Data exfiltration detected
- Encryption key access attempts

**Response Steps**:
1. **Immediate Actions** (within 5 minutes):
   - [ ] Isolate affected database
   - [ ] Block unauthorized access
   - [ ] Preserve forensic evidence
   - [ ] Notify security team
   - [ ] Activate incident response team

2. **Investigation** (within 2 hours):
   - [ ] Review database access logs
   - [ ] Identify compromised data
   - [ ] Determine attack vector
   - [ ] Check encryption key access
   - [ ] Assess data exposure

3. **Containment** (within 8 hours):
   - [ ] Rotate all encryption keys
   - [ ] Re-encrypt all tokens
   - [ ] Revoke all active sessions
   - [ ] Update firewall rules
   - [ ] Deploy security patches

4. **Recovery** (within 48 hours):
   - [ ] Restore from clean backup if needed
   - [ ] Verify data integrity
   - [ ] Re-establish secure access
   - [ ] Monitor for continued attacks
   - [ ] Notify affected users

5. **Post-Incident** (within 2 weeks):
   - [ ] Complete incident report
   - [ ] Notify regulatory authorities if required
   - [ ] Conduct security audit
   - [ ] Implement preventive measures
   - [ ] Update disaster recovery plan

#### 7.6.3 OAuth Provider Compromise Response

**Detection**:
- OAuth provider announces breach
- Unusual token behavior across multiple accounts
- Mass token revocations
- Provider API changes unexpectedly

**Response Steps**:
1. **Immediate Actions** (within 1 hour):
   - [ ] Assess impact on our users
   - [ ] Review provider's security advisory
   - [ ] Identify affected accounts
   - [ ] Prepare user communication

2. **Containment** (within 4 hours):
   - [ ] Force token refresh for affected platform
   - [ ] Implement additional validation
   - [ ] Monitor for suspicious activity
   - [ ] Update security rules

3. **Recovery** (within 24 hours):
   - [ ] Follow provider's remediation steps
   - [ ] Notify affected users
   - [ ] Provide reconnection instructions
   - [ ] Verify all accounts are secure

4. **Post-Incident** (within 1 week):
   - [ ] Document lessons learned
   - [ ] Update OAuth integration
   - [ ] Review provider security practices
   - [ ] Consider alternative providers if needed

---

### 7.7 Security Metrics & KPIs

**OAuth Security Metrics**:
- OAuth success rate (target: >99%)
- OAuth failure rate by reason
- State validation failure rate
- PKCE validation failure rate
- Scope validation failure rate
- Average OAuth completion time

**Token Security Metrics**:
- Token encryption success rate (target: 100%)
- Token decryption success rate (target: 100%)
- Token refresh success rate (target: >98%)
- Token rotation frequency
- Average token lifetime
- Expired token count

**Security Event Metrics**:
- Security events per day by type
- Critical security events per week (target: 0)
- High severity events per week (target: <5)
- Average incident response time
- Incident resolution rate
- False positive rate

**Compliance Metrics**:
- OWASP ASVS compliance score (target: 100%)
- SOC 2 control effectiveness
- Vulnerability scan pass rate (target: 100%)
- Penetration test pass rate (target: 100%)
- Security code review coverage (target: 100%)

**Performance Metrics**:
- OAuth initiation latency (target: <200ms)
- OAuth callback latency (target: <1s)
- Token encryption latency (target: <50ms)
- Token decryption latency (target: <50ms)
- Database transaction latency (target: <500ms)

---

## APPENDIX A: Security Glossary

**AES-256-GCM**: Advanced Encryption Standard with 256-bit key in Galois/Counter Mode (authenticated encryption)

**CSRF**: Cross-Site Request Forgery attack

**DEK**: Data Encryption Key (used to encrypt data)

**Envelope Encryption**: Two-layer encryption where data is encrypted with DEK, and DEK is encrypted with KEK

**HMAC**: Hash-based Message Authentication Code (used for signature verification)

**HSM**: Hardware Security Module (physical device for key storage)

**KEK**: Key Encryption Key (used to encrypt DEKs)

**KMS**: Key Management Service (cloud service for key management)

**OWASP ASVS**: Open Web Application Security Project Application Security Verification Standard

**PKCE**: Proof Key for Code Exchange (OAuth security extension)

**S256**: SHA256 hashing method for PKCE

**SOC 2**: Service Organization Control 2 (security compliance framework)

**TLS**: Transport Layer Security (encryption for data in transit)

---

## APPENDIX B: References

1. **OAuth 2.0 RFC 6749**: https://tools.ietf.org/html/rfc6749
2. **OAuth 2.0 Security Best Practices**: https://tools.ietf.org/html/draft-ietf-oauth-security-topics
3. **PKCE RFC 7636**: https://tools.ietf.org/html/rfc7636
4. **OWASP ASVS**: https://owasp.org/www-project-application-security-verification-standard/
5. **NIST Cryptographic Standards**: https://csrc.nist.gov/publications/fips
6. **SOC 2 Trust Services Criteria**: https://www.aicpa.org/soc

---

**END OF SPECIFICATION**

**Document Status**: COMPLETE  
**Last Updated**: 2026-02-27  
**Next Review**: 2026-03-27  
**Owner**: Security Team  
**Approvers**: CTO, CISO, Lead Security Engineer
