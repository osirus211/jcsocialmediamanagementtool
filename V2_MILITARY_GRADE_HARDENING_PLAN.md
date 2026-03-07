# V2 OAuth Military-Grade Hardening Plan

## Executive Summary

This document outlines a comprehensive security hardening plan for the V2 OAuth system, implementing military-grade security controls, defense-in-depth strategies, and zero-trust principles.

**Threat Model**: Nation-state actors, organized cybercrime, insider threats
**Security Posture**: Defense-in-depth with multiple layers of protection
**Compliance**: SOC 2, ISO 27001, GDPR, CCPA ready

---

## Table of Contents

1. [OAuth State Security](#1-oauth-state-security)
2. [Token Encryption & Key Rotation](#2-token-encryption--key-rotation)
3. [Publish Invariants & Data Integrity](#3-publish-invariants--data-integrity)
4. [Rate Limiting & DDoS Protection](#4-rate-limiting--ddos-protection)
5. [Observability & Threat Detection](#5-observability--threat-detection)
6. [Kill Switches & Circuit Breakers](#6-kill-switches--circuit-breakers)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. OAuth State Security

### 1.1 HMAC-Signed State Tokens

**Current State**: Basic state validation
**Target State**: Cryptographically signed state with replay protection

#### Implementation

```typescript
// apps/backend/src/services/OAuthStateService.ts
import crypto from 'crypto';

interface StatePayload {
  platform: string;
  workspaceId: string;
  userId: string;
  timestamp: number;
  nonce: string;
  ipHash: string;
}

class OAuthStateService {
  private readonly SECRET_KEY = process.env.OAUTH_STATE_SECRET!;
  private readonly STATE_TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate HMAC-signed state token
   */
  generateState(payload: Omit<StatePayload, 'timestamp' | 'nonce' | 'ipHash'>, ipAddress: string): string {
    const statePayload: StatePayload = {
      ...payload,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
      ipHash: this.hashIP(ipAddress),
    };

    const stateJson = JSON.stringify(statePayload);
    const stateBase64 = Buffer.from(stateJson).toString('base64url');
    
    // Generate HMAC signature
    const hmac = crypto.createHmac('sha256', this.SECRET_KEY);
    hmac.update(stateBase64);
    const signature = hmac.digest('base64url');

    return `${stateBase64}.${signature}`;
  }

  /**
   * Validate HMAC-signed state token
   */
  validateState(state: string, ipAddress: string): StatePayload | null {
    const [stateBase64, signature] = state.split('.');
    
    if (!stateBase64 || !signature) {
      return null;
    }

    // Verify HMAC signature (timing-safe comparison)
    const hmac = crypto.createHmac('sha256', this.SECRET_KEY);
    hmac.update(stateBase64);
    const expectedSignature = hmac.digest('base64url');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    // Decode payload
    const stateJson = Buffer.from(stateBase64, 'base64url').toString('utf-8');
    const payload: StatePayload = JSON.parse(stateJson);

    // Verify timestamp (not expired)
    if (Date.now() - payload.timestamp > this.STATE_TTL) {
      return null;
    }

    // Verify IP address binding
    const currentIpHash = this.hashIP(ipAddress);
    if (payload.ipHash !== currentIpHash) {
      return null;
    }

    // Check replay protection (Redis)
    if (await this.isStateUsed(payload.nonce)) {
      return null;
    }

    // Mark state as used
    await this.markStateUsed(payload.nonce);

    return payload;
  }

  private hashIP(ipAddress: string): string {
    const salt = process.env.IP_HASH_SALT!;
    return crypto.createHash('sha256').update(ipAddress + salt).digest('hex');
  }

  private async isStateUsed(nonce: string): Promise<boolean> {
    const redis = getRedisClient();
    const key = `oauth:state:used:${nonce}`;
    return await redis.exists(key) === 1;
  }

  private async markStateUsed(nonce: string): Promise<void> {
    const redis = getRedisClient();
    const key = `oauth:state:used:${nonce}`;
    await redis.setex(key, 3600, '1'); // 1 hour TTL
  }
}
```

#### Security Properties
- ✅ **Integrity**: HMAC signature prevents tampering
- ✅ **Authenticity**: Only server can generate valid states
- ✅ **Freshness**: Timestamp prevents replay attacks
- ✅ **Binding**: IP address binding prevents MITM
- ✅ **Uniqueness**: Nonce prevents duplicate use

#### Environment Variables
```env
OAUTH_STATE_SECRET=<256-bit-random-key>
IP_HASH_SALT=<256-bit-random-salt>
```

---

### 1.2 PKCE (Proof Key for Code Exchange)

**Current State**: Not implemented
**Target State**: PKCE for all OAuth flows

#### Implementation

```typescript
// apps/backend/src/services/PKCEService.ts
import crypto from 'crypto';

class PKCEService {
  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    // Generate 256-bit random code verifier
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Compute SHA-256 code challenge
    const hash = crypto.createHash('sha256');
    hash.update(codeVerifier);
    const codeChallenge = hash.digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Store PKCE data in Redis
   */
  async storePKCE(state: string, codeVerifier: string): Promise<void> {
    const redis = getRedisClient();
    const key = `oauth:pkce:${state}`;
    await redis.setex(key, 600, codeVerifier); // 10 minutes
  }

  /**
   * Retrieve and delete PKCE data
   */
  async retrievePKCE(state: string): Promise<string | null> {
    const redis = getRedisClient();
    const key = `oauth:pkce:${state}`;
    const codeVerifier = await redis.get(key);
    
    if (codeVerifier) {
      await redis.del(key); // Delete after retrieval
    }
    
    return codeVerifier;
  }
}
```

#### Platform Support
- ✅ Twitter/X: PKCE required
- ✅ Facebook: PKCE supported
- ✅ Instagram: PKCE supported
- ⚠️ LinkedIn: PKCE not supported (use state only)

---

## 2. Token Encryption & Key Rotation

### 2.1 Multi-Layer Encryption

**Current State**: Single encryption key
**Target State**: Multi-layer encryption with key rotation

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Token Encryption                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Plaintext Token                                         │
│       ↓                                                  │
│  Layer 1: AES-256-GCM (Data Encryption Key - DEK)       │
│       ↓                                                  │
│  Layer 2: Envelope Encryption (Key Encryption Key - KEK)│
│       ↓                                                  │
│  Layer 3: AWS KMS / HashiCorp Vault (Master Key)        │
│       ↓                                                  │
│  Encrypted Token (stored in MongoDB)                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Implementation

```typescript
// apps/backend/src/services/TokenEncryptionService.ts
import crypto from 'crypto';
import { KMS } from '@aws-sdk/client-kms';

interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  algorithm: 'aes-256-gcm';
}

class TokenEncryptionService {
  private kms: KMS;
  private currentKeyVersion: number = 1;
  private keyCache: Map<number, Buffer> = new Map();

  constructor() {
    this.kms = new KMS({ region: process.env.AWS_REGION });
  }

  /**
   * Encrypt token with envelope encryption
   */
  async encrypt(plaintext: string): Promise<string> {
    // Generate Data Encryption Key (DEK)
    const dek = crypto.randomBytes(32); // 256-bit key

    // Encrypt plaintext with DEK (AES-256-GCM)
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    // Encrypt DEK with KEK (AWS KMS)
    const encryptedDEK = await this.encryptDEK(dek);

    // Package encrypted token
    const encryptedToken: EncryptedToken = {
      ciphertext,
      iv: iv.toString('base64'),
      authTag,
      keyVersion: this.currentKeyVersion,
      algorithm: 'aes-256-gcm',
    };

    // Return as JSON string with encrypted DEK
    return JSON.stringify({
      ...encryptedToken,
      encryptedDEK,
    });
  }

  /**
   * Decrypt token with envelope encryption
   */
  async decrypt(encryptedData: string): Promise<string> {
    const data = JSON.parse(encryptedData);
    const { ciphertext, iv, authTag, keyVersion, encryptedDEK } = data;

    // Decrypt DEK with KEK (AWS KMS)
    const dek = await this.decryptDEK(encryptedDEK, keyVersion);

    // Decrypt ciphertext with DEK
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Encrypt DEK with AWS KMS
   */
  private async encryptDEK(dek: Buffer): Promise<string> {
    const result = await this.kms.encrypt({
      KeyId: process.env.AWS_KMS_KEY_ID,
      Plaintext: dek,
    });

    return result.CiphertextBlob!.toString('base64');
  }

  /**
   * Decrypt DEK with AWS KMS
   */
  private async decryptDEK(encryptedDEK: string, keyVersion: number): Promise<Buffer> {
    // Check cache first
    const cacheKey = `${encryptedDEK}-${keyVersion}`;
    if (this.keyCache.has(keyVersion)) {
      return this.keyCache.get(keyVersion)!;
    }

    const result = await this.kms.decrypt({
      CiphertextBlob: Buffer.from(encryptedDEK, 'base64'),
    });

    const dek = Buffer.from(result.Plaintext!);
    
    // Cache DEK (with TTL)
    this.keyCache.set(keyVersion, dek);
    setTimeout(() => this.keyCache.delete(keyVersion), 3600000); // 1 hour

    return dek;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(): Promise<void> {
    this.currentKeyVersion++;
    this.keyCache.clear();
    
    // Log key rotation event
    await this.auditLog({
      event: 'KEY_ROTATION',
      oldVersion: this.currentKeyVersion - 1,
      newVersion: this.currentKeyVersion,
      timestamp: new Date(),
    });
  }

  /**
   * Re-encrypt all tokens with new key
   */
  async reencryptAllTokens(): Promise<void> {
    const accounts = await SocialAccount.find({}).select('+accessToken +refreshToken');
    
    for (const account of accounts) {
      try {
        // Decrypt with old key
        const accessToken = await this.decrypt(account.accessToken);
        const refreshToken = account.refreshToken ? await this.decrypt(account.refreshToken) : null;

        // Encrypt with new key
        account.accessToken = await this.encrypt(accessToken);
        if (refreshToken) {
          account.refreshToken = await this.encrypt(refreshToken);
        }

        await account.save();
      } catch (error) {
        logger.error('Token re-encryption failed', {
          accountId: account._id,
          error: error.message,
        });
      }
    }
  }
}
```

#### Key Rotation Schedule
- **Automatic**: Every 90 days
- **Manual**: On-demand via admin API
- **Emergency**: Immediate rotation on breach detection

#### Environment Variables
```env
AWS_KMS_KEY_ID=<kms-key-id>
AWS_REGION=us-east-1
TOKEN_ENCRYPTION_KEY_VERSION=1
```

---

## 3. Publish Invariants & Data Integrity

### 3.1 Publish Invariants

**Invariants**: Properties that must ALWAYS be true

#### Core Invariants

```typescript
// apps/backend/src/services/PublishInvariantService.ts

enum InvariantViolation {
  DUPLICATE_PUBLISH = 'DUPLICATE_PUBLISH',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  MISSING_PLATFORM_POST_ID = 'MISSING_PLATFORM_POST_ID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  CONTENT_HASH_MISMATCH = 'CONTENT_HASH_MISMATCH',
}

class PublishInvariantService {
  /**
   * INVARIANT 1: No duplicate publishes
   * A post can only be published once to a platform
   */
  async checkNoDuplicatePublish(postId: string): Promise<void> {
    const post = await Post.findById(postId);
    
    if (post.status === PostStatus.PUBLISHED) {
      throw new InvariantViolationError(
        InvariantViolation.DUPLICATE_PUBLISH,
        `Post ${postId} already published`
      );
    }

    if (post.metadata?.platformPostId) {
      throw new InvariantViolationError(
        InvariantViolation.DUPLICATE_PUBLISH,
        `Post ${postId} has platformPostId but status is ${post.status}`
      );
    }
  }

  /**
   * INVARIANT 2: Valid state transitions
   * Posts can only transition through valid states
   */
  async checkValidStateTransition(postId: string, fromState: PostStatus, toState: PostStatus): Promise<void> {
    const validTransitions: Record<PostStatus, PostStatus[]> = {
      [PostStatus.DRAFT]: [PostStatus.SCHEDULED, PostStatus.CANCELLED],
      [PostStatus.SCHEDULED]: [PostStatus.QUEUED, PostStatus.CANCELLED],
      [PostStatus.QUEUED]: [PostStatus.PUBLISHING, PostStatus.CANCELLED],
      [PostStatus.PUBLISHING]: [PostStatus.PUBLISHED, PostStatus.FAILED],
      [PostStatus.PUBLISHED]: [], // Terminal state
      [PostStatus.FAILED]: [PostStatus.QUEUED], // Retry
      [PostStatus.CANCELLED]: [], // Terminal state
    };

    if (!validTransitions[fromState]?.includes(toState)) {
      throw new InvariantViolationError(
        InvariantViolation.INVALID_STATE_TRANSITION,
        `Invalid transition: ${fromState} → ${toState}`
      );
    }
  }

  /**
   * INVARIANT 3: Published posts have platformPostId
   * If status is PUBLISHED, platformPostId must exist
   */
  async checkPublishedHasPlatformId(postId: string): Promise<void> {
    const post = await Post.findById(postId);
    
    if (post.status === PostStatus.PUBLISHED && !post.metadata?.platformPostId) {
      throw new InvariantViolationError(
        InvariantViolation.MISSING_PLATFORM_POST_ID,
        `Published post ${postId} missing platformPostId`
      );
    }
  }

  /**
   * INVARIANT 4: Active account with valid token
   * Account must be active and token must not be expired
   */
  async checkAccountValid(accountId: string): Promise<void> {
    const account = await SocialAccount.findById(accountId);
    
    if (!account) {
      throw new InvariantViolationError(
        InvariantViolation.ACCOUNT_INACTIVE,
        `Account ${accountId} not found`
      );
    }

    if (account.status !== AccountStatus.ACTIVE) {
      throw new InvariantViolationError(
        InvariantViolation.ACCOUNT_INACTIVE,
        `Account ${accountId} is ${account.status}`
      );
    }

    if (account.isTokenExpired()) {
      throw new InvariantViolationError(
        InvariantViolation.TOKEN_EXPIRED,
        `Account ${accountId} token expired`
      );
    }
  }

  /**
   * INVARIANT 5: Content integrity
   * Content hash must match stored hash
   */
  async checkContentIntegrity(postId: string, content: string): Promise<void> {
    const post = await Post.findById(postId);
    const expectedHash = this.hashContent(content);
    
    if (post.metadata?.contentHash && post.metadata.contentHash !== expectedHash) {
      throw new InvariantViolationError(
        InvariantViolation.CONTENT_HASH_MISMATCH,
        `Content hash mismatch for post ${postId}`
      );
    }
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Verify all invariants before publish
   */
  async verifyAllInvariants(postId: string, accountId: string): Promise<void> {
    await this.checkNoDuplicatePublish(postId);
    await this.checkAccountValid(accountId);
    
    const post = await Post.findById(postId);
    await this.checkValidStateTransition(post.status, PostStatus.PUBLISHING);
    await this.checkContentIntegrity(postId, post.content);
  }

  /**
   * Verify invariants after publish
   */
  async verifyPostPublishInvariants(postId: string): Promise<void> {
    await this.checkPublishedHasPlatformId(postId);
  }
}

class InvariantViolationError extends Error {
  constructor(
    public readonly violation: InvariantViolation,
    message: string
  ) {
    super(message);
    this.name = 'InvariantViolationError';
  }
}
```

#### Invariant Monitoring

```typescript
// apps/backend/src/services/InvariantMonitorService.ts

class InvariantMonitorService {
  /**
   * Periodic invariant checks (every 5 minutes)
   */
  async runInvariantChecks(): Promise<void> {
    const violations: InvariantViolation[] = [];

    // Check 1: No published posts without platformPostId
    const publishedWithoutId = await Post.countDocuments({
      status: PostStatus.PUBLISHED,
      'metadata.platformPostId': { $exists: false },
    });

    if (publishedWithoutId > 0) {
      violations.push({
        type: 'PUBLISHED_WITHOUT_PLATFORM_ID',
        count: publishedWithoutId,
        severity: 'CRITICAL',
      });
    }

    // Check 2: No posts stuck in PUBLISHING for > 5 minutes
    const stuckPublishing = await Post.countDocuments({
      status: PostStatus.PUBLISHING,
      updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
    });

    if (stuckPublishing > 0) {
      violations.push({
        type: 'STUCK_IN_PUBLISHING',
        count: stuckPublishing,
        severity: 'HIGH',
      });
    }

    // Check 3: No duplicate platformPostIds
    const duplicates = await Post.aggregate([
      { $match: { 'metadata.platformPostId': { $exists: true } } },
      { $group: { _id: '$metadata.platformPostId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (duplicates.length > 0) {
      violations.push({
        type: 'DUPLICATE_PLATFORM_POST_ID',
        count: duplicates.length,
        severity: 'CRITICAL',
      });
    }

    // Alert on violations
    if (violations.length > 0) {
      await this.alertInvariantViolations(violations);
    }
  }

  private async alertInvariantViolations(violations: InvariantViolation[]): Promise<void> {
    // Send to monitoring system
    logger.error('Invariant violations detected', { violations });
    
    // Send to Sentry
    captureException(new Error('Invariant violations detected'), {
      level: 'error',
      tags: { type: 'invariant_violation' },
      extra: { violations },
    });

    // Send to PagerDuty (if critical)
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length > 0) {
      await this.sendPagerDutyAlert(criticalViolations);
    }
  }
}
```

---

## 4. Rate Limiting & DDoS Protection

### 4.1 Multi-Layer Rate Limiting

**Layers**:
1. IP-based rate limiting (Cloudflare/nginx)
2. User-based rate limiting (Redis)
3. Workspace-based rate limiting (Redis)
4. Platform-specific rate limiting (per OAuth provider)

#### Implementation

```typescript
// apps/backend/src/middleware/rateLimiting.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';

/**
 * Layer 1: IP-based rate limiting
 */
export const ipRateLimiter = rateLimit({
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:ip:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('IP rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter: 60,
    });
  },
});

/**
 * Layer 2: User-based rate limiting
 */
export const userRateLimiter = rateLimit({
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:user:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 OAuth requests per minute per user
  keyGenerator: (req) => req.user?.userId || req.ip,
  skip: (req) => !req.user, // Skip if not authenticated
  message: 'Too many OAuth requests, please try again later',
});

/**
 * Layer 3: Workspace-based rate limiting
 */
export const workspaceRateLimiter = rateLimit({
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:workspace:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 OAuth requests per minute per workspace
  keyGenerator: (req) => req.workspace?.workspaceId || req.ip,
  skip: (req) => !req.workspace,
});

/**
 * Layer 4: Platform-specific rate limiting
 */
class PlatformRateLimiter {
  private limits: Record<string, { max: number; windowMs: number }> = {
    twitter: { max: 300, windowMs: 15 * 60 * 1000 }, // 300 per 15 min
    linkedin: { max: 100, windowMs: 60 * 1000 }, // 100 per minute
    facebook: { max: 200, windowMs: 60 * 60 * 1000 }, // 200 per hour
    instagram: { max: 200, windowMs: 60 * 60 * 1000 }, // 200 per hour
  };

  async checkLimit(platform: string, accountId: string): Promise<boolean> {
    const limit = this.limits[platform];
    if (!limit) return true;

    const redis = getRedisClient();
    const key = `rl:platform:${platform}:${accountId}`;
    
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.pexpire(key, limit.windowMs);
    }

    if (current > limit.max) {
      logger.warn('Platform rate limit exceeded', {
        platform,
        accountId,
        current,
        max: limit.max,
      });
      return false;
    }

    return true;
  }
}

/**
 * Adaptive rate limiting (adjusts based on system load)
 */
class AdaptiveRateLimiter {
  private baseLimit = 100;
  private currentLimit = 100;

  async adjustLimit(): Promise<void> {
    const systemLoad = await this.getSystemLoad();
    
    if (systemLoad > 0.8) {
      // High load: reduce limit by 50%
      this.currentLimit = Math.floor(this.baseLimit * 0.5);
    } else if (systemLoad > 0.6) {
      // Medium load: reduce limit by 25%
      this.currentLimit = Math.floor(this.baseLimit * 0.75);
    } else {
      // Normal load: use base limit
      this.currentLimit = this.baseLimit;
    }

    logger.info('Adaptive rate limit adjusted', {
      systemLoad,
      currentLimit: this.currentLimit,
    });
  }

  private async getSystemLoad(): Promise<number> {
    // Check queue depth, CPU usage, memory usage
    const queueDepth = await this.getQueueDepth();
    const cpuUsage = process.cpuUsage().user / 1000000; // Convert to seconds
    const memoryUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;

    return Math.max(queueDepth / 1000, cpuUsage / 100, memoryUsage);
  }

  private async getQueueDepth(): Promise<number> {
    const queueManager = QueueManager.getInstance();
    const stats = await queueManager.getQueueStats('posting-queue');
    return stats.waiting + stats.active;
  }
}
```

### 4.2 DDoS Protection

#### Cloudflare Configuration
```yaml
# cloudflare-rules.yaml
rules:
  - name: "Block suspicious IPs"
    expression: |
      (cf.threat_score > 50) or
      (cf.bot_management.score < 30)
    action: "block"

  - name: "Rate limit OAuth endpoints"
    expression: |
      (http.request.uri.path contains "/oauth/") and
      (rate(1m) > 100)
    action: "challenge"

  - name: "Block known bad actors"
    expression: |
      (ip.geoip.country in {"CN" "RU" "KP"}) and
      (cf.threat_score > 30)
    action: "block"

  - name: "Challenge high-risk requests"
    expression: |
      (http.request.uri.path contains "/oauth/callback") and
      (cf.threat_score > 20)
    action: "managed_challenge"
```

#### nginx Configuration
```nginx
# /etc/nginx/conf.d/rate-limiting.conf

# Define rate limit zones
limit_req_zone $binary_remote_addr zone=ip_limit:10m rate=100r/m;
limit_req_zone $http_authorization zone=user_limit:10m rate=10r/m;

# Connection limits
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

server {
    # Apply rate limits
    limit_req zone=ip_limit burst=20 nodelay;
    limit_req zone=user_limit burst=5 nodelay;
    limit_conn conn_limit 10;

    # OAuth endpoints
    location /api/v1/oauth/ {
        limit_req zone=ip_limit burst=10 nodelay;
        limit_req_status 429;
        
        # Additional security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        
        proxy_pass http://backend;
    }
}
```

---

## 5. Observability & Threat Detection

### 5.1 Security Event Logging

#### Event Types

```typescript
// apps/backend/src/services/SecurityAuditService.ts

enum SecurityEventType {
  // OAuth events
  OAUTH_INITIATED = 'OAUTH_INITIATED',
  OAUTH_CALLBACK_SUCCESS = 'OAUTH_CALLBACK_SUCCESS',
  OAUTH_CALLBACK_FAILURE = 'OAUTH_CALLBACK_FAILURE',
  
  // State validation
  STATE_VALIDATION_FAILED = 'STATE_VALIDATION_FAILED',
  STATE_REPLAY_DETECTED = 'STATE_REPLAY_DETECTED',
  STATE_EXPIRED = 'STATE_EXPIRED',
  STATE_IP_MISMATCH = 'STATE_IP_MISMATCH',
  
  // Token events
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  TOKEN_REFRESH_SUCCESS = 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Account events
  ACCOUNT_CONNECTED = 'ACCOUNT_CONNECTED',
  ACCOUNT_DISCONNECTED = 'ACCOUNT_DISCONNECTED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  CROSS_TENANT_BLOCKED = 'CROSS_TENANT_BLOCKED',
  SCOPE_VALIDATION_FAILED = 'SCOPE_VALIDATION_FAILED',
  
  // Publish events
  PUBLISH_SUCCESS = 'PUBLISH_SUCCESS',
  PUBLISH_FAILED = 'PUBLISH_FAILED',
  DUPLICATE_PUBLISH_BLOCKED = 'DUPLICATE_PUBLISH_BLOCKED',
  INVARIANT_VIOLATION = 'INVARIANT_VIOLATION',
  
  // Admin events
  KEY_ROTATION = 'KEY_ROTATION',
  KILL_SWITCH_ACTIVATED = 'KILL_SWITCH_ACTIVATED',
  KILL_SWITCH_DEACTIVATED = 'KILL_SWITCH_DEACTIVATED',
}

enum SecurityEventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: Date;
  userId?: string;
  workspaceId?: string;
  accountId?: string;
  ipAddress: string; // Hashed
  platform?: string;
  metadata: Record<string, any>;
}

class SecurityAuditService {
  /**
   * Log security event
   */
  async logEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    try {
      // Hash IP address
      const ipHash = this.hashIP(event.ipAddress);

      // Create event document
      const securityEvent = {
        ...event,
        ipAddress: ipHash,
        timestamp: new Date(),
      };

      // Store in MongoDB
      await SecurityEventModel.create(securityEvent);

      // Send to monitoring systems
      if (event.severity === SecurityEventSeverity.CRITICAL) {
        await this.alertCriticalEvent(securityEvent);
      }

      // Update metrics
      this.updateMetrics(event.type, event.severity);
    } catch (error) {
      // Never throw - logging failures should not block OAuth flow
      logger.error('Security audit logging failed', {
        error: error.message,
        eventType: event.type,
      });
    }
  }

  /**
   * Query security events
   */
  async queryEvents(filters: {
    workspaceId?: string;
    type?: SecurityEventType;
    severity?: SecurityEventSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SecurityEvent[]> {
    const query: any = {};

    if (filters.workspaceId) query.workspaceId = filters.workspaceId;
    if (filters.type) query.type = filters.type;
    if (filters.severity) query.severity = filters.severity;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return SecurityEventModel.find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 100);
  }

  /**
   * Detect suspicious patterns
   */
  async detectSuspiciousActivity(workspaceId: string): Promise<boolean> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Pattern 1: Multiple failed OAuth attempts
    const failedAttempts = await SecurityEventModel.countDocuments({
      workspaceId,
      type: SecurityEventType.OAUTH_CALLBACK_FAILURE,
      timestamp: { $gte: last24h },
    });

    if (failedAttempts > 10) {
      await this.logEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecurityEventSeverity.WARNING,
        workspaceId,
        ipAddress: 'system',
        metadata: {
          pattern: 'MULTIPLE_FAILED_OAUTH',
          count: failedAttempts,
        },
      });
      return true;
    }

    // Pattern 2: Multiple state validation failures
    const stateFailures = await SecurityEventModel.countDocuments({
      workspaceId,
      type: SecurityEventType.STATE_VALIDATION_FAILED,
      timestamp: { $gte: last24h },
    });

    if (stateFailures > 5) {
      await this.logEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecurityEventSeverity.WARNING,
        workspaceId,
        ipAddress: 'system',
        metadata: {
          pattern: 'MULTIPLE_STATE_FAILURES',
          count: stateFailures,
        },
      });
      return true;
    }

    // Pattern 3: Rapid account connections from different IPs
    const recentConnections = await SecurityEventModel.find({
      workspaceId,
      type: SecurityEventType.ACCOUNT_CONNECTED,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    });

    const uniqueIPs = new Set(recentConnections.map(e => e.ipAddress));
    if (uniqueIPs.size > 5) {
      await this.logEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecurityEventSeverity.WARNING,
        workspaceId,
        ipAddress: 'system',
        metadata: {
          pattern: 'MULTIPLE_IPS',
          count: uniqueIPs.size,
        },
      });
      return true;
    }

    return false;
  }

  private hashIP(ipAddress: string): string {
    const salt = process.env.IP_HASH_SALT!;
    return crypto.createHash('sha256').update(ipAddress + salt).digest('hex');
  }

  private async alertCriticalEvent(event: SecurityEvent): Promise<void> {
    // Send to Sentry
    captureException(new Error(`Critical security event: ${event.type}`), {
      level: 'error',
      tags: {
        type: 'security_event',
        eventType: event.type,
      },
      extra: event,
    });

    // Send to PagerDuty
    await this.sendPagerDutyAlert(event);

    // Send to Slack
    await this.sendSlackAlert(event);
  }

  private updateMetrics(type: SecurityEventType, severity: SecurityEventSeverity): void {
    // Prometheus metrics
    securityEventsTotal.labels(type, severity).inc();
  }
}
```

### 5.2 Real-Time Threat Detection

#### Anomaly Detection

```typescript
// apps/backend/src/services/ThreatDetectionService.ts

class ThreatDetectionService {
  /**
   * Real-time threat scoring
   */
  async calculateThreatScore(request: Request): Promise<number> {
    let score = 0;

    // Factor 1: IP reputation (0-30 points)
    const ipReputation = await this.checkIPReputation(request.ip);
    score += ipReputation * 30;

    // Factor 2: Request frequency (0-20 points)
    const frequency = await this.checkRequestFrequency(request.ip);
    score += frequency * 20;

    // Factor 3: Failed attempts (0-25 points)
    const failedAttempts = await this.checkFailedAttempts(request.user?.userId);
    score += failedAttempts * 25;

    // Factor 4: Geolocation anomaly (0-15 points)
    const geoAnomaly = await this.checkGeolocationAnomaly(request.user?.userId, request.ip);
    score += geoAnomaly * 15;

    // Factor 5: User agent anomaly (0-10 points)
    const uaAnomaly = this.checkUserAgentAnomaly(request.headers['user-agent']);
    score += uaAnomaly * 10;

    return Math.min(score, 100);
  }

  /**
   * Check IP reputation using external services
   */
  private async checkIPReputation(ip: string): Promise<number> {
    // Check against known bad IP lists
    // 0 = clean, 1 = malicious
    
    // Example: Check AbuseIPDB
    const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
      headers: { 'Key': process.env.ABUSEIPDB_API_KEY! },
    });
    
    const data = await response.json();
    return data.data.abuseConfidenceScore / 100;
  }

  /**
   * Check request frequency
   */
  private async checkRequestFrequency(ip: string): Promise<number> {
    const redis = getRedisClient();
    const key = `threat:freq:${ip}`;
    
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60); // 1 minute window
    }

    // 0-10 requests = 0, 10-50 = 0.5, 50+ = 1
    if (count < 10) return 0;
    if (count < 50) return 0.5;
    return 1;
  }

  /**
   * Check failed authentication attempts
   */
  private async checkFailedAttempts(userId?: string): Promise<number> {
    if (!userId) return 0;

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failures = await SecurityEventModel.countDocuments({
      userId,
      type: {
        $in: [
          SecurityEventType.OAUTH_CALLBACK_FAILURE,
          SecurityEventType.STATE_VALIDATION_FAILED,
        ],
      },
      timestamp: { $gte: last24h },
    });

    // 0-3 failures = 0, 3-10 = 0.5, 10+ = 1
    if (failures < 3) return 0;
    if (failures < 10) return 0.5;
    return 1;
  }

  /**
   * Check geolocation anomaly
   */
  private async checkGeolocationAnomaly(userId?: string, ip: string): Promise<number> {
    if (!userId) return 0;

    // Get user's typical locations
    const recentEvents = await SecurityEventModel.find({
      userId,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }).limit(100);

    const typicalCountries = new Set(
      recentEvents.map(e => e.metadata?.country).filter(Boolean)
    );

    // Get current location
    const currentCountry = await this.getCountryFromIP(ip);

    // If current location is new, flag as anomaly
    if (!typicalCountries.has(currentCountry)) {
      return 1;
    }

    return 0;
  }

  /**
   * Check user agent anomaly
   */
  private checkUserAgentAnomaly(userAgent?: string): number {
    if (!userAgent) return 1;

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        return 1;
      }
    }

    return 0;
  }

  /**
   * Take action based on threat score
   */
  async handleThreatScore(request: Request, score: number): Promise<void> {
    if (score >= 80) {
      // Critical threat: Block immediately
      await this.blockRequest(request, 'CRITICAL_THREAT', score);
      throw new Error('Request blocked due to high threat score');
    } else if (score >= 60) {
      // High threat: Challenge with CAPTCHA
      await this.challengeRequest(request, 'HIGH_THREAT', score);
    } else if (score >= 40) {
      // Medium threat: Log and monitor
      await this.logThreat(request, 'MEDIUM_THREAT', score);
    }
    // Low threat (< 40): Allow
  }

  private async blockRequest(request: Request, reason: string, score: number): Promise<void> {
    await securityAuditService.logEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecurityEventSeverity.CRITICAL,
      ipAddress: request.ip,
      userId: request.user?.userId,
      metadata: {
        reason,
        threatScore: score,
        blocked: true,
      },
    });
  }
}
```

### 5.3 Prometheus Metrics

```typescript
// apps/backend/src/metrics/oauthMetrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// OAuth flow metrics
export const oauthFlowsTotal = new Counter({
  name: 'oauth_flows_total',
  help: 'Total number of OAuth flows initiated',
  labelNames: ['platform', 'status'],
});

export const oauthFlowDuration = new Histogram({
  name: 'oauth_flow_duration_seconds',
  help: 'OAuth flow duration in seconds',
  labelNames: ['platform', 'step'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Security metrics
export const securityEventsTotal = new Counter({
  name: 'security_events_total',
  help: 'Total number of security events',
  labelNames: ['type', 'severity'],
});

export const threatScoreGauge = new Gauge({
  name: 'threat_score',
  help: 'Current threat score',
  labelNames: ['ip', 'userId'],
});

export const stateReplayAttemptsTotal = new Counter({
  name: 'state_replay_attempts_total',
  help: 'Total number of state replay attack attempts',
  labelNames: ['platform'],
});

// Rate limiting metrics
export const rateLimitExceededTotal = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit violations',
  labelNames: ['layer', 'type'],
});

// Token metrics
export const tokenEncryptionDuration = new Histogram({
  name: 'token_encryption_duration_seconds',
  help: 'Token encryption duration in seconds',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
});

export const tokenRotationsTotal = new Counter({
  name: 'token_rotations_total',
  help: 'Total number of token key rotations',
});

// Invariant metrics
export const invariantViolationsTotal = new Counter({
  name: 'invariant_violations_total',
  help: 'Total number of invariant violations',
  labelNames: ['type', 'severity'],
});
```

---

## 6. Kill Switches & Circuit Breakers

### 6.1 Kill Switch System

**Purpose**: Immediately disable OAuth flows in case of security breach or system failure

#### Implementation

```typescript
// apps/backend/src/services/KillSwitchService.ts

enum KillSwitchType {
  GLOBAL = 'GLOBAL', // Disable all OAuth
  PLATFORM = 'PLATFORM', // Disable specific platform
  WORKSPACE = 'WORKSPACE', // Disable specific workspace
  USER = 'USER', // Disable specific user
}

interface KillSwitch {
  type: KillSwitchType;
  target?: string; // platform, workspaceId, or userId
  reason: string;
  activatedBy: string;
  activatedAt: Date;
  expiresAt?: Date;
}

class KillSwitchService {
  private switches: Map<string, KillSwitch> = new Map();

  /**
   * Activate kill switch
   */
  async activate(killSwitch: Omit<KillSwitch, 'activatedAt'>): Promise<void> {
    const key = this.getKey(killSwitch.type, killSwitch.target);
    
    const fullSwitch: KillSwitch = {
      ...killSwitch,
      activatedAt: new Date(),
    };

    // Store in memory
    this.switches.set(key, fullSwitch);

    // Store in Redis (for multi-instance sync)
    const redis = getRedisClient();
    await redis.set(
      `killswitch:${key}`,
      JSON.stringify(fullSwitch),
      'EX',
      killSwitch.expiresAt 
        ? Math.floor((killSwitch.expiresAt.getTime() - Date.now()) / 1000)
        : 86400 // 24 hours default
    );

    // Log activation
    await securityAuditService.logEvent({
      type: SecurityEventType.KILL_SWITCH_ACTIVATED,
      severity: SecurityEventSeverity.CRITICAL,
      ipAddress: 'system',
      metadata: {
        killSwitch: fullSwitch,
      },
    });

    logger.error('Kill switch activated', { killSwitch: fullSwitch });
  }

  /**
   * Deactivate kill switch
   */
  async deactivate(type: KillSwitchType, target?: string): Promise<void> {
    const key = this.getKey(type, target);
    
    // Remove from memory
    this.switches.delete(key);

    // Remove from Redis
    const redis = getRedisClient();
    await redis.del(`killswitch:${key}`);

    // Log deactivation
    await securityAuditService.logEvent({
      type: SecurityEventType.KILL_SWITCH_DEACTIVATED,
      severity: SecurityEventSeverity.WARNING,
      ipAddress: 'system',
      metadata: {
        type,
        target,
      },
    });

    logger.info('Kill switch deactivated', { type, target });
  }

  /**
   * Check if OAuth is allowed
   */
  async isAllowed(platform: string, workspaceId: string, userId: string): Promise<boolean> {
    // Check global kill switch
    if (await this.isActive(KillSwitchType.GLOBAL)) {
      return false;
    }

    // Check platform kill switch
    if (await this.isActive(KillSwitchType.PLATFORM, platform)) {
      return false;
    }

    // Check workspace kill switch
    if (await this.isActive(KillSwitchType.WORKSPACE, workspaceId)) {
      return false;
    }

    // Check user kill switch
    if (await this.isActive(KillSwitchType.USER, userId)) {
      return false;
    }

    return true;
  }

  /**
   * Check if kill switch is active
   */
  private async isActive(type: KillSwitchType, target?: string): Promise<boolean> {
    const key = this.getKey(type, target);

    // Check memory first
    if (this.switches.has(key)) {
      const killSwitch = this.switches.get(key)!;
      
      // Check expiration
      if (killSwitch.expiresAt && killSwitch.expiresAt < new Date()) {
        await this.deactivate(type, target);
        return false;
      }
      
      return true;
    }

    // Check Redis (for multi-instance sync)
    const redis = getRedisClient();
    const data = await redis.get(`killswitch:${key}`);
    
    if (data) {
      const killSwitch: KillSwitch = JSON.parse(data);
      this.switches.set(key, killSwitch);
      return true;
    }

    return false;
  }

  /**
   * Get all active kill switches
   */
  async getActive(): Promise<KillSwitch[]> {
    const redis = getRedisClient();
    const keys = await redis.keys('killswitch:*');
    
    const switches: KillSwitch[] = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        switches.push(JSON.parse(data));
      }
    }

    return switches;
  }

  private getKey(type: KillSwitchType, target?: string): string {
    return target ? `${type}:${target}` : type;
  }
}

// Middleware to check kill switches
export const killSwitchMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { platform } = req.params;
  const workspaceId = req.workspace?.workspaceId;
  const userId = req.user?.userId;

  const killSwitchService = new KillSwitchService();
  const allowed = await killSwitchService.isAllowed(platform, workspaceId, userId);

  if (!allowed) {
    logger.warn('OAuth blocked by kill switch', {
      platform,
      workspaceId,
      userId,
    });

    return res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'OAuth is temporarily unavailable. Please try again later.',
    });
  }

  next();
};
```

### 6.2 Circuit Breakers

**Purpose**: Prevent cascading failures by failing fast when external services are down

#### Implementation

```typescript
// apps/backend/src/services/CircuitBreakerService.ts
import CircuitBreaker from 'opossum';

class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Create circuit breaker for OAuth provider
   */
  createBreaker(platform: string): CircuitBreaker {
    const options = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50, // Open after 50% failures
      resetTimeout: 30000, // Try again after 30 seconds
      rollingCountTimeout: 60000, // 1 minute window
      rollingCountBuckets: 10,
      name: `oauth-${platform}`,
    };

    const breaker = new CircuitBreaker(
      async (fn: () => Promise<any>) => fn(),
      options
    );

    // Event handlers
    breaker.on('open', () => {
      logger.error('Circuit breaker opened', { platform });
      
      securityAuditService.logEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecurityEventSeverity.ERROR,
        ipAddress: 'system',
        platform,
        metadata: {
          event: 'CIRCUIT_BREAKER_OPEN',
        },
      });
    });

    breaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open', { platform });
    });

    breaker.on('close', () => {
      logger.info('Circuit breaker closed', { platform });
    });

    this.breakers.set(platform, breaker);
    return breaker;
  }

  /**
   * Execute function with circuit breaker
   */
  async execute<T>(platform: string, fn: () => Promise<T>): Promise<T> {
    let breaker = this.breakers.get(platform);
    
    if (!breaker) {
      breaker = this.createBreaker(platform);
    }

    try {
      return await breaker.fire(fn);
    } catch (error) {
      if (breaker.opened) {
        throw new Error(`Circuit breaker open for ${platform}`);
      }
      throw error;
    }
  }

  /**
   * Get breaker stats
   */
  getStats(platform: string): any {
    const breaker = this.breakers.get(platform);
    if (!breaker) return null;

    return breaker.stats;
  }
}

// Usage in OAuth controller
async callback(req: Request, res: Response): Promise<void> {
  const { platform } = req.params;
  const circuitBreaker = new CircuitBreakerService();

  try {
    // Token exchange with circuit breaker
    const tokens = await circuitBreaker.execute(platform, async () => {
      return await provider.exchangeCodeForToken({
        code: code as string,
        state: state as string,
      });
    });

    // Profile fetch with circuit breaker
    const profile = await circuitBreaker.execute(platform, async () => {
      return await provider.getUserProfile(tokens.accessToken);
    });

    // ... rest of callback logic
  } catch (error) {
    if (error.message.includes('Circuit breaker open')) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: `${platform} OAuth is temporarily unavailable`,
      });
    }
    throw error;
  }
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- ✅ V2-only architecture complete
- [ ] Implement HMAC-signed state tokens
- [ ] Implement PKCE for all platforms
- [ ] Add IP hashing utility
- [ ] Set up security audit logging
- [ ] Create MongoDB indexes for security events

**Deliverables**:
- HMAC state validation working
- PKCE working for Twitter, Facebook, Instagram
- Security events logged to MongoDB
- Basic observability in place

### Phase 2: Encryption & Key Management (Week 3-4)

- [ ] Implement envelope encryption
- [ ] Integrate AWS KMS
- [ ] Build key rotation system
- [ ] Create re-encryption script
- [ ] Test key rotation end-to-end

**Deliverables**:
- Multi-layer encryption working
- Key rotation tested
- Re-encryption script ready
- KMS integration complete

### Phase 3: Rate Limiting & DDoS Protection (Week 5-6)

- [ ] Implement multi-layer rate limiting
- [ ] Set up Cloudflare rules
- [ ] Configure nginx rate limiting
- [ ] Add adaptive rate limiting
- [ ] Test rate limiting under load

**Deliverables**:
- 4-layer rate limiting working
- Cloudflare rules deployed
- nginx configured
- Load testing complete

### Phase 4: Invariants & Data Integrity (Week 7-8)

- [ ] Implement publish invariants
- [ ] Add invariant monitoring
- [ ] Create invariant violation alerts
- [ ] Test invariant enforcement
- [ ] Document all invariants

**Deliverables**:
- 5 core invariants enforced
- Monitoring running every 5 minutes
- Alerts configured
- Documentation complete

### Phase 5: Threat Detection & Observability (Week 9-10)

- [ ] Implement threat scoring
- [ ] Add anomaly detection
- [ ] Set up Prometheus metrics
- [ ] Create Grafana dashboards
- [ ] Configure alerting rules

**Deliverables**:
- Threat detection working
- Metrics exported to Prometheus
- Dashboards created
- Alerts configured

### Phase 6: Kill Switches & Circuit Breakers (Week 11-12)

- [ ] Implement kill switch system
- [ ] Add circuit breakers for all platforms
- [ ] Create admin API for kill switches
- [ ] Test kill switch activation
- [ ] Document emergency procedures

**Deliverables**:
- Kill switches working
- Circuit breakers tested
- Admin API complete
- Runbooks created

### Phase 7: Testing & Validation (Week 13-14)

- [ ] Security penetration testing
- [ ] Load testing (1000 concurrent OAuth flows)
- [ ] Chaos engineering tests
- [ ] Compliance audit (SOC 2, ISO 27001)
- [ ] Documentation review

**Deliverables**:
- Penetration test report
- Load test results
- Chaos test results
- Compliance checklist
- Final documentation

### Phase 8: Production Deployment (Week 15-16)

- [ ] Deploy to staging
- [ ] Run full test suite
- [ ] Deploy to production (canary)
- [ ] Monitor for 48 hours
- [ ] Full production rollout

**Deliverables**:
- Staging deployment complete
- Production deployment complete
- Monitoring confirmed
- Post-deployment review

---

## Success Metrics

### Security Metrics
- ✅ Zero state replay attacks
- ✅ Zero token leaks
- ✅ Zero unauthorized access
- ✅ 100% audit coverage
- ✅ < 1% false positive rate for threat detection

### Performance Metrics
- ✅ OAuth flow < 2 seconds (p95)
- ✅ Token encryption < 10ms (p95)
- ✅ State validation < 5ms (p95)
- ✅ 99.99% uptime
- ✅ < 0.1% error rate

### Operational Metrics
- ✅ Key rotation < 5 minutes
- ✅ Kill switch activation < 1 second
- ✅ Circuit breaker recovery < 30 seconds
- ✅ Incident response < 15 minutes
- ✅ Mean time to detect (MTTD) < 5 minutes

---

## Compliance & Certifications

### SOC 2 Type II
- ✅ Security audit logging
- ✅ Access controls
- ✅ Encryption at rest and in transit
- ✅ Incident response procedures
- ✅ Change management

### ISO 27001
- ✅ Information security management system (ISMS)
- ✅ Risk assessment and treatment
- ✅ Security policies and procedures
- ✅ Continuous monitoring
- ✅ Regular audits

### GDPR
- ✅ Data minimization (IP hashing)
- ✅ Right to erasure
- ✅ Data breach notification (< 72 hours)
- ✅ Privacy by design
- ✅ Data protection impact assessment (DPIA)

### CCPA
- ✅ Consumer data rights
- ✅ Data deletion procedures
- ✅ Opt-out mechanisms
- ✅ Data inventory
- ✅ Privacy policy

---

## Emergency Procedures

### Breach Response

**Detection** (< 5 minutes):
1. Automated threat detection alerts
2. Security team notified via PagerDuty
3. Incident commander assigned

**Containment** (< 15 minutes):
1. Activate global kill switch
2. Rotate all encryption keys
3. Invalidate all active sessions
4. Block suspicious IPs

**Eradication** (< 1 hour):
1. Identify root cause
2. Patch vulnerability
3. Re-encrypt all tokens
4. Verify system integrity

**Recovery** (< 2 hours):
1. Deactivate kill switch
2. Monitor for anomalies
3. Gradual traffic ramp-up
4. Verify all systems operational

**Post-Incident** (< 24 hours):
1. Incident report
2. Root cause analysis
3. Lessons learned
4. Process improvements

### Key Rotation Emergency

**Trigger**: Suspected key compromise

**Procedure**:
1. Activate global kill switch (< 1 second)
2. Generate new encryption key (< 1 minute)
3. Re-encrypt all tokens (< 5 minutes)
4. Update key version (< 1 minute)
5. Deactivate kill switch (< 1 second)
6. Monitor for issues (24 hours)

**Total Time**: < 10 minutes

---

## Cost Estimate

### Infrastructure
- AWS KMS: $1/month per key + $0.03 per 10,000 requests
- Cloudflare Pro: $20/month
- Redis (managed): $50/month
- MongoDB Atlas: $100/month
- Sentry: $26/month
- PagerDuty: $21/user/month

**Total**: ~$250/month

### Development
- 16 weeks × 40 hours/week = 640 hours
- At $100/hour = $64,000

**Total Project Cost**: $64,000 + $250/month ongoing

---

## Conclusion

This military-grade hardening plan transforms the V2 OAuth system into a fortress-level secure implementation with:

✅ **Defense-in-depth**: Multiple layers of security
✅ **Zero-trust**: Verify everything, trust nothing
✅ **Observability**: Complete visibility into all operations
✅ **Resilience**: Automatic recovery from failures
✅ **Compliance**: SOC 2, ISO 27001, GDPR, CCPA ready

**Status**: Ready for implementation
**Risk Level**: LOW (with proper testing)
**Timeline**: 16 weeks
**Budget**: $64,000 + $250/month

---

**Next Steps**:
1. Review and approve hardening plan
2. Allocate resources (team, budget, time)
3. Begin Phase 1 implementation
4. Set up project tracking and milestones
5. Schedule weekly security reviews

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-XX
**Author**: Kiro AI Assistant
**Classification**: CONFIDENTIAL
