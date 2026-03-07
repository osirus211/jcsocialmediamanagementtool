# V1 to V2 OAuth Migration Strategy

**Date**: 2026-02-27  
**Classification**: CRITICAL - Production Migration Plan  
**Status**: DESIGN PHASE  

---

## EXECUTIVE SUMMARY

This document defines the production-safe migration strategy from V1 OAuth (basic security) to V2 OAuth (bank-grade security) for existing social media account connections.

**Critical Constraint**: We have production users with active V1 connections that MUST continue working during and after migration.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 V1 Database Schema

**Collection**: `socialaccounts`

**Current Fields**:
```typescript
{
  _id: ObjectId
  workspaceId: ObjectId (indexed)
  provider: String (twitter|linkedin|facebook|instagram)
  providerUserId: String
  accountName: String
  accessToken: String (encrypted with AES-256-GCM)
  refreshToken: String (encrypted with AES-256-GCM, optional)
  tokenExpiresAt: Date (optional)
  encryptionKeyVersion: Number (default: 1, indexed)
  scopes: Array<String>
  status: String (active|expired|revoked)
  lastRefreshedAt: Date
  metadata: Object
  lastSyncAt: Date
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `{ workspaceId: 1, provider: 1 }`
- `{ workspaceId: 1, status: 1 }`
- `{ status: 1, tokenExpiresAt: 1 }`
- `{ tokenExpiresAt: 1, status: 1 }`
- `{ workspaceId: 1, provider: 1, providerUserId: 1 }` (unique)
- `{ encryptionKeyVersion: 1 }`

### 1.2 V1 Encryption Method

**Algorithm**: AES-256-GCM  
**Key Derivation**: PBKDF2 (100,000 iterations, SHA256)  
**Format**: `version:salt:iv:authTag:encrypted`

**Encryption Flow**:
1. Generate random salt (32 bytes)
2. Generate random IV (16 bytes)
3. Derive key from APP_SECRET + salt using PBKDF2
4. Encrypt with AES-256-GCM
5. Store as: `1:salt:iv:authTag:encrypted`

**Key Characteristics**:
- ✅ Uses AES-256-GCM (authenticated encryption)
- ✅ Has key versioning support
- ✅ Uses PBKDF2 for key derivation
- ❌ Single-layer encryption (not envelope encryption)
- ❌ No separate DEK/KEK
- ❌ No KMS integration
- ❌ Key stored in environment variable

### 1.3 V1 Security Features

**Present**:
- ✅ Token encryption at rest
- ✅ Tokens never in API responses
- ✅ Key versioning
- ✅ Workspace isolation
- ✅ Basic OAuth state parameter

**Missing** (V2 adds):
- ❌ Envelope encryption (DEK + KEK)
- ❌ KMS/HSM integration
- ❌ HMAC-signed state parameters
- ❌ IP address binding
- ❌ Distributed locking
- ❌ MongoDB transactions
- ❌ Duplicate prevention with race conditions
- ❌ Cross-tenant validation
- ❌ Security audit logging
- ❌ PKCE for all platforms


### 1.4 Compatibility Analysis

**Token Storage Compatibility**:

| Aspect | V1 | V2 | Compatible? |
|--------|----|----|-------------|
| Encryption Algorithm | AES-256-GCM | AES-256-GCM | ✅ Yes |
| Storage Format | String | Object (EncryptedToken) | ❌ No |
| Key Management | Environment Variable | KMS/HSM | ❌ No |
| Encryption Layers | Single | Envelope (DEK+KEK) | ❌ No |
| Decryption Method | Direct | Via TokenEncryptionService | ❌ No |

**Critical Finding**: V1 and V2 use **incompatible encryption formats**.

**V1 Format**:
```typescript
accessToken: "1:abc123...:def456...:ghi789...:encrypted_data"
```

**V2 Format**:
```typescript
accessToken: {
  version: 1,
  algorithm: 'aes-256-gcm',
  encryptedData: 'base64_encrypted_token',
  encryptedDEK: 'base64_encrypted_dek',
  iv: 'base64_iv',
  authTag: 'base64_auth_tag',
  keyId: 'kms_key_id'
}
```

**Implication**: Direct migration requires re-encryption OR dual-format support.

---

## 2. MIGRATION STRATEGY OPTIONS

### OPTION A: Hard Cutover (Force Reconnect)

**Description**: Invalidate all V1 tokens and force users to reconnect using V2.

**Implementation**:
1. Deploy V2 code
2. Add migration flag to all V1 accounts: `requiresReconnect: true`
3. Publishing worker rejects V1 tokens
4. Users see "Reconnect Required" banner
5. Users reconnect via V2 flow
6. V1 tokens deleted after 30 days

**Pros**:
- ✅ Clean break - no dual-format support needed
- ✅ Simplest engineering implementation
- ✅ All users on V2 immediately after reconnect
- ✅ No complex migration logic
- ✅ Clear security boundary

**Cons**:
- ❌ Disruptive user experience
- ❌ All scheduled posts fail until reconnect
- ❌ High support burden
- ❌ User trust impact
- ❌ Potential churn risk
- ❌ No graceful degradation

**Security Implications**:
- ✅ Immediate security upgrade for reconnected accounts
- ✅ No legacy encryption code in production
- ⚠️ V1 tokens remain in database (encrypted) until cleanup

**User Experience Impact**:
- ❌ **CRITICAL**: All users must reconnect immediately
- ❌ Scheduled posts fail until reconnect
- ❌ No warning period
- ❌ Abrupt service interruption

**Engineering Complexity**: LOW
- Simple flag check in worker
- No dual-format support
- No background migration

**Rollback Risk**: MEDIUM
- Can revert flag
- V1 tokens still in database
- Can re-enable V1 decryption

**Recommendation**: ❌ **NOT RECOMMENDED** - Too disruptive for production users.

---

### OPTION B: Hybrid Mode (Gradual Migration)

**Description**: Keep V1 tokens working, new connections use V2, gradually migrate users.

**Implementation**:
1. Deploy V2 code with dual-format support
2. Add `connectionVersion` field to schema
3. Publishing worker checks version:
   - V1: Use V1 decryption
   - V2: Use V2 decryption
4. New connections use V2
5. Show "Upgrade Available" banner for V1 users
6. Users can reconnect voluntarily
7. After 90 days, force remaining V1 users to reconnect

**Pros**:
- ✅ Zero disruption - V1 tokens continue working
- ✅ Gradual, voluntary migration
- ✅ Users choose when to upgrade
- ✅ Scheduled posts continue working
- ✅ Low support burden
- ✅ Maintains user trust

**Cons**:
- ⚠️ Dual-format support complexity
- ⚠️ V1 encryption code remains in production
- ⚠️ Mixed security posture (some V1, some V2)
- ⚠️ Longer migration timeline
- ⚠️ Need to maintain both code paths

**Security Implications**:
- ⚠️ V1 accounts remain at V1 security level
- ✅ New accounts get V2 security immediately
- ⚠️ Need to maintain V1 decryption code
- ✅ Clear separation between V1 and V2

**User Experience Impact**:
- ✅ **EXCELLENT**: Zero disruption
- ✅ Voluntary upgrade
- ✅ Clear benefits communicated
- ✅ Scheduled posts unaffected

**Engineering Complexity**: MEDIUM
- Dual-format support in worker
- Version checking logic
- Two decryption code paths
- Migration tracking

**Rollback Risk**: LOW
- Can disable V2 connections
- V1 continues working
- No data loss

**Recommendation**: ✅ **RECOMMENDED** - Best balance of safety and security.

---

### OPTION C: Automatic Background Migration

**Description**: Re-encrypt V1 tokens to V2 format in background without user action.

**Implementation**:
1. Deploy V2 code
2. Create migration worker
3. For each V1 account:
   - Decrypt token with V1 method
   - Re-encrypt with V2 method (envelope encryption)
   - Update schema to V2 format
   - Mark as migrated
4. Publishing worker uses V2 decryption for all

**Pros**:
- ✅ Seamless - no user action required
- ✅ All accounts upgraded automatically
- ✅ Single encryption format in production
- ✅ Fast migration (hours, not months)

**Cons**:
- ❌ **CRITICAL SECURITY RISK**: Requires decrypting all tokens at once
- ❌ Tokens in plaintext during migration
- ❌ High risk if migration fails mid-process
- ❌ Cannot migrate without KMS setup
- ❌ Requires V1 decryption key in migration worker
- ❌ Complex rollback if V2 encryption fails

**Security Implications**:
- ❌ **UNACCEPTABLE**: All tokens decrypted simultaneously
- ❌ Plaintext tokens in memory during migration
- ❌ If migration worker compromised, all tokens exposed
- ❌ No way to audit token access during migration
- ⚠️ Requires secure migration environment

**User Experience Impact**:
- ✅ Transparent - users see no change
- ✅ No reconnection required
- ⚠️ Risk of service disruption if migration fails

**Engineering Complexity**: HIGH
- Complex migration worker
- Atomic migration per account
- Error handling and retry logic
- Progress tracking
- Rollback mechanism

**Rollback Risk**: HIGH
- If V2 encryption fails, tokens may be lost
- Need to keep V1 encrypted backup
- Complex state management

**Recommendation**: ❌ **NOT RECOMMENDED** - Unacceptable security risk.

---

## 3. RECOMMENDED STRATEGY: OPTION B (Hybrid Mode)

### 3.1 Why Option B?

**Primary Reasons**:
1. **Zero User Disruption**: Existing connections continue working
2. **Security**: No mass decryption event
3. **Safety**: Low rollback risk
4. **Trust**: Maintains user confidence
5. **Flexibility**: Users migrate at their own pace

**Trade-off Accepted**: Maintaining dual-format support for 90 days is acceptable given the benefits.

### 3.2 Migration Timeline

**Week 1-2**: Deploy V2 with dual-format support  
**Week 3-4**: Monitor V2 connections, fix issues  
**Week 5-8**: Encourage voluntary migration (banners, emails)  
**Week 9-12**: Increase urgency of migration messaging  
**Week 13**: Force remaining V1 users to reconnect (grace period ended)  
**Week 14**: Remove V1 decryption code

**Total Duration**: 14 weeks (3.5 months)

---

## 4. DATABASE SCHEMA CHANGES

### 4.1 New Fields

```typescript
interface ISocialAccountV2 extends ISocialAccount {
  // NEW: Connection version
  connectionVersion: 'v1' | 'v2';
  
  // NEW: For V2 connections only
  accessTokenV2?: EncryptedToken;
  refreshTokenV2?: EncryptedToken;
  
  // NEW: Security metadata
  securityMetadata?: {
    connectedAt: Date;
    connectedBy: ObjectId;
    connectedIP: string; // Hashed
    lastUsedAt?: Date;
    lastUsedIP?: string; // Hashed
    usageCount: number;
    rotationCount: number;
    suspiciousActivityDetected: boolean;
  };
  
  // NEW: Scope validation
  scopeValidation?: {
    validatedAt: Date;
    requiredScopes: string[];
    optionalScopes: string[];
  };
  
  // NEW: Migration tracking
  migrationStatus?: 'pending' | 'migrated' | 'failed';
  migratedAt?: Date;
}

interface EncryptedToken {
  version: number;
  algorithm: 'aes-256-gcm';
  encryptedData: string;
  encryptedDEK: string;
  iv: string;
  authTag: string;
  keyId: string;
}
```

### 4.2 Migration Script

```typescript
// Migration: Add connectionVersion field to existing accounts
db.socialaccounts.updateMany(
  { connectionVersion: { $exists: false } },
  {
    $set: {
      connectionVersion: 'v1',
      migrationStatus: 'pending'
    }
  }
);

// Add indexes
db.socialaccounts.createIndex({ connectionVersion: 1 });
db.socialaccounts.createIndex({ migrationStatus: 1 });
db.socialaccounts.createIndex({ 'securityMetadata.suspiciousActivityDetected': 1 });
```

### 4.3 Schema Update SQL (MongoDB)

```javascript
// File: migrations/add-connection-version.js
module.exports = {
  async up(db) {
    // Add connectionVersion to all existing accounts
    await db.collection('socialaccounts').updateMany(
      {},
      {
        $set: {
          connectionVersion: 'v1',
          migrationStatus: 'pending'
        }
      }
    );
    
    // Create indexes
    await db.collection('socialaccounts').createIndex({ connectionVersion: 1 });
    await db.collection('socialaccounts').createIndex({ migrationStatus: 1 });
    
    console.log('Migration complete: Added connectionVersion field');
  },
  
  async down(db) {
    // Remove fields
    await db.collection('socialaccounts').updateMany(
      {},
      {
        $unset: {
          connectionVersion: '',
          migrationStatus: '',
          accessTokenV2: '',
          refreshTokenV2: '',
          securityMetadata: '',
          scopeValidation: ''
        }
      }
    );
    
    // Drop indexes
    await db.collection('socialaccounts').dropIndex({ connectionVersion: 1 });
    await db.collection('socialaccounts').dropIndex({ migrationStatus: 1 });
    
    console.log('Rollback complete: Removed connectionVersion field');
  }
};
```

---

## 5. TOKEN HANDLING LOGIC

### 5.1 Publishing Worker Logic

```typescript
// File: apps/backend/src/workers/PublishingWorker.ts

async function getDecryptedToken(account: ISocialAccount): Promise<string> {
  // Check connection version
  if (account.connectionVersion === 'v2') {
    // V2: Use TokenEncryptionService with envelope encryption
    if (!account.accessTokenV2) {
      throw new Error('V2 account missing accessTokenV2');
    }
    
    const tokenEncryptionService = await import('../services/oauth-v2/TokenEncryptionService');
    return await tokenEncryptionService.decryptToken(account.accessTokenV2);
    
  } else {
    // V1: Use legacy encryption utility
    const { decrypt } = await import('../utils/encryption');
    return decrypt(account.accessToken);
  }
}

async function publishPost(post: IPost, account: ISocialAccount): Promise<void> {
  try {
    // Get decrypted token based on version
    const accessToken = await getDecryptedToken(account);
    
    // Publish using platform provider
    const provider = getPlatformProvider(account.provider);
    await provider.publish(post, accessToken);
    
    // Update security metadata for V2 accounts
    if (account.connectionVersion === 'v2' && account.securityMetadata) {
      account.securityMetadata.lastUsedAt = new Date();
      account.securityMetadata.usageCount++;
      await account.save();
    }
    
  } catch (error) {
    // Handle token expiry
    if (isTokenExpiredError(error)) {
      await handleTokenExpiry(account);
    }
    throw error;
  }
}
```

### 5.2 Token Refresh Logic

```typescript
async function refreshToken(account: ISocialAccount): Promise<void> {
  if (account.connectionVersion === 'v2') {
    // V2: Use V2 refresh flow with envelope encryption
    const tokenEncryptionService = await import('../services/oauth-v2/TokenEncryptionService');
    
    if (!account.refreshTokenV2) {
      throw new Error('V2 account missing refreshTokenV2');
    }
    
    const refreshToken = await tokenEncryptionService.decryptToken(account.refreshTokenV2);
    const newTokens = await oauthProvider.refreshToken(refreshToken);
    
    // Re-encrypt with V2
    account.accessTokenV2 = await tokenEncryptionService.encryptToken(newTokens.accessToken);
    if (newTokens.refreshToken) {
      account.refreshTokenV2 = await tokenEncryptionService.encryptToken(newTokens.refreshToken);
    }
    
    // Update security metadata
    account.securityMetadata!.rotationCount++;
    account.lastRefreshedAt = new Date();
    
  } else {
    // V1: Use legacy refresh flow
    const { decrypt, encrypt } = await import('../utils/encryption');
    
    const refreshToken = decrypt(account.refreshToken!);
    const newTokens = await oauthProvider.refreshToken(refreshToken);
    
    // Re-encrypt with V1
    account.accessToken = encrypt(newTokens.accessToken);
    if (newTokens.refreshToken) {
      account.refreshToken = encrypt(newTokens.refreshToken);
    }
    
    account.lastRefreshedAt = new Date();
  }
  
  await account.save();
}
```

### 5.3 Reconnect Prompt Logic

```typescript
function shouldPromptReconnect(account: ISocialAccount): boolean {
  // Always prompt V1 accounts after grace period
  if (account.connectionVersion === 'v1') {
    const gracePeriodEnd = new Date('2026-06-01'); // 90 days from deployment
    if (new Date() > gracePeriodEnd) {
      return true; // Force reconnect
    }
    return false; // Still in grace period
  }
  
  // V2 accounts: only prompt if token expired
  return account.status === AccountStatus.EXPIRED;
}
```

---

## 6. USER EXPERIENCE PLAN

### 6.1 Communication Timeline

**Week 1 (Deployment)**:
- ✅ No user-facing changes
- ✅ V2 available for new connections
- ✅ V1 connections continue working

**Week 3 (Soft Encouragement)**:
- 📧 Email: "Enhanced Security Available"
- 🎨 Banner: "Upgrade to Enhanced Security" (dismissible)
- 📱 In-app notification (non-blocking)

**Week 8 (Increased Urgency)**:
- 📧 Email: "Security Upgrade Recommended"
- 🎨 Banner: "Upgrade by [date] for enhanced security" (persistent)
- 📱 Push notification

**Week 12 (Final Warning)**:
- 📧 Email: "Action Required: Reconnect by [date]"
- 🎨 Banner: "Reconnect required in 7 days" (blocking)
- 📱 Push notification (daily)

**Week 13 (Force Reconnect)**:
- 🚫 V1 tokens rejected by worker
- 🎨 Modal: "Reconnect Required" (blocking)
- 📧 Email: "Immediate action required"

### 6.2 Banner Design

**Soft Encouragement (Week 3-7)**:
```
┌─────────────────────────────────────────────────────────────┐
│ ℹ️ Enhanced Security Available                          [×] │
│                                                              │
│ We've upgraded our security. Reconnect your accounts to     │
│ benefit from bank-grade encryption and enhanced protection. │
│                                                              │
│ [Learn More]                              [Upgrade Now]     │
└─────────────────────────────────────────────────────────────┘
```

**Increased Urgency (Week 8-11)**:
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Security Upgrade Recommended                             │
│                                                              │
│ Please reconnect your accounts by June 1, 2026 to continue  │
│ using enhanced security features.                           │
│                                                              │
│ Accounts using legacy security: 3                           │
│                                                              │
│ [Reconnect Now]                           [Remind Me Later] │
└─────────────────────────────────────────────────────────────┘
```

**Final Warning (Week 12)**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🚨 Action Required: Reconnect by May 25, 2026               │
│                                                              │
│ Your accounts will stop working in 7 days if not            │
│ reconnected. This is required for security compliance.      │
│                                                              │
│ Accounts requiring reconnection: 3                          │
│                                                              │
│ [Reconnect Now]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Force Reconnect (Week 13+)**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🔒 Reconnect Required                                       │
│                                                              │
│ Your social accounts are using legacy security and must be  │
│ reconnected to continue posting.                            │
│                                                              │
│ This takes less than 2 minutes per account.                 │
│                                                              │
│ Accounts to reconnect:                                      │
│ • Twitter (@username)                                       │
│ • LinkedIn (Company Page)                                   │
│                                                              │
│ [Reconnect Accounts]                                        │
│                                                              │
│ Need help? [Contact Support]                                │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Email Templates

**Email 1: Enhanced Security Available (Week 3)**

Subject: Enhanced Security Now Available for Your Social Accounts

Body:
```
Hi [Name],

We've upgraded our security infrastructure to provide bank-grade protection for your social media accounts.

What's New:
✓ Enhanced encryption
✓ Advanced threat detection
✓ Improved token security

To upgrade, simply reconnect your accounts. It takes less than 2 minutes.

[Reconnect Accounts]

Your existing connections will continue working, but we recommend upgrading for the best security.

Questions? Reply to this email or contact support.

Best regards,
The [App Name] Team
```

**Email 2: Security Upgrade Recommended (Week 8)**

Subject: Please Upgrade Your Account Security by June 1

Body:
```
Hi [Name],

This is a friendly reminder to upgrade your social account security.

Deadline: June 1, 2026

After this date, accounts using legacy security will need to be reconnected before you can continue posting.

Accounts to upgrade: 3
• Twitter (@username)
• LinkedIn (Company Page)
• Facebook (Page Name)

[Upgrade Now - Takes 2 Minutes]

Why upgrade?
✓ Bank-grade encryption
✓ Enhanced security monitoring
✓ Better protection against unauthorized access

Need help? Our support team is here: [Support Link]

Best regards,
The [App Name] Team
```

**Email 3: Action Required (Week 12)**

Subject: 🚨 Action Required: Reconnect Your Accounts by May 25

Body:
```
Hi [Name],

IMPORTANT: Your social accounts will stop working in 7 days if not reconnected.

Deadline: May 25, 2026 (7 days)

This is required for security compliance and cannot be extended.

Accounts requiring reconnection: 3
• Twitter (@username) - Last used: 2 days ago
• LinkedIn (Company Page) - Last used: 1 day ago
• Facebook (Page Name) - Last used: 3 hours ago

[Reconnect Now - Don't Lose Access]

What happens if I don't reconnect?
• Scheduled posts will fail
• You won't be able to publish
• You'll need to reconnect before using these accounts

This takes less than 2 minutes per account.

Need immediate help? Call us: [Phone] or chat: [Chat Link]

Best regards,
The [App Name] Team
```

---

## 7. ROLLBACK STRATEGY

### 7.1 Rollback Scenarios

**Scenario 1: V2 OAuth Flow Has Critical Bug**

**Symptoms**:
- V2 connections failing
- Users unable to connect new accounts
- High error rate in V2 controller

**Rollback Action**:
```bash
# 1. Disable V2 OAuth
echo "OAUTH_V2_ENABLED=false" >> apps/backend/.env

# 2. Restart backend
pm2 restart backend

# 3. Hide V2 UI
echo "VITE_OAUTH_V2_ENABLED=false" >> apps/frontend/.env

# 4. Rebuild and redeploy frontend
npm run build
# Deploy static assets
```

**Impact**:
- ✅ V1 connections unaffected
- ✅ Existing V2 connections continue working (dual-format support)
- ⚠️ New connections use V1 temporarily
- ✅ No data loss

**Recovery Time**: < 5 minutes

---

**Scenario 2: V2 Token Decryption Fails**

**Symptoms**:
- Publishing worker failing for V2 accounts
- "Decryption failed" errors
- Posts not publishing

**Rollback Action**:
```typescript
// Emergency patch: Force V2 accounts to reconnect
db.socialaccounts.updateMany(
  { connectionVersion: 'v2' },
  {
    $set: {
      status: 'expired',
      migrationStatus: 'failed'
    }
  }
);
```

**Impact**:
- ⚠️ V2 users must reconnect
- ✅ V1 users unaffected
- ⚠️ Scheduled posts for V2 accounts fail until reconnect

**Recovery Time**: Immediate (users reconnect as needed)

---

**Scenario 3: KMS/Encryption Service Down**

**Symptoms**:
- Cannot decrypt V2 tokens
- KMS API errors
- Publishing worker failing

**Rollback Action**:
```typescript
// Temporary: Disable V2 token usage
// File: apps/backend/src/workers/PublishingWorker.ts

async function getDecryptedToken(account: ISocialAccount): Promise<string> {
  if (account.connectionVersion === 'v2') {
    // Emergency: Prompt reconnect instead of failing
    throw new TokenExpiredError('Please reconnect your account');
  }
  
  // V1 continues working
  return decrypt(account.accessToken);
}
```

**Impact**:
- ⚠️ V2 accounts temporarily unavailable
- ✅ V1 accounts unaffected
- ⚠️ V2 users see "Reconnect Required"

**Recovery Time**: Until KMS restored

---

### 7.2 Rollback Decision Matrix

| Issue | Severity | Rollback Action | Impact | Recovery Time |
|-------|----------|-----------------|--------|---------------|
| V2 OAuth flow bug | HIGH | Disable V2 OAuth | New connections use V1 | < 5 min |
| V2 decryption fails | CRITICAL | Force V2 reconnect | V2 users reconnect | Immediate |
| KMS down | CRITICAL | Disable V2 usage | V2 temporarily unavailable | Until KMS restored |
| Dual-format bug | MEDIUM | Fix and deploy | No user impact | < 1 hour |
| Migration script error | LOW | Revert migration | No user impact | < 10 min |

### 7.3 Data Preservation

**V1 Tokens**:
- ✅ Never deleted during migration
- ✅ Remain in `accessToken` field
- ✅ Can be used if V2 fails

**V2 Tokens**:
- ✅ Stored in separate fields (`accessTokenV2`)
- ✅ Don't overwrite V1 tokens
- ✅ Can be deleted without affecting V1

**Rollback Safety**:
```typescript
// V1 tokens always preserved
{
  connectionVersion: 'v2',
  accessToken: 'v1_encrypted_token', // PRESERVED
  accessTokenV2: { /* v2 format */ }, // Can be removed
}
```

---

## 8. IMPLEMENTATION PHASES

### Phase 1: Preparation (Week 1-2)

**Backend**:
- [ ] Add `connectionVersion` field to schema
- [ ] Add `accessTokenV2` / `refreshTokenV2` fields
- [ ] Add `securityMetadata` field
- [ ] Run migration script (add version to existing accounts)
- [ ] Deploy schema changes

**Frontend**:
- [ ] No changes yet

**Testing**:
- [ ] Verify V1 connections still work
- [ ] Verify schema migration successful
- [ ] Verify indexes created

**Rollback**: Revert schema migration

---

### Phase 2: V2 Implementation (Week 3-4)

**Backend**:
- [ ] Implement TokenEncryptionService
- [ ] Implement KMSClient (mock for dev)
- [ ] Implement OAuthControllerV2
- [ ] Add dual-format support to PublishingWorker
- [ ] Deploy V2 code (disabled)

**Frontend**:
- [ ] Implement Connect Flow V2 components
- [ ] Deploy V2 UI (hidden)

**Testing**:
- [ ] Test V2 OAuth flow end-to-end
- [ ] Test dual-format token decryption
- [ ] Test V1 connections still work
- [ ] Load testing

**Rollback**: Disable V2 via feature flag

---

### Phase 3: Soft Launch (Week 5-6)

**Backend**:
- [ ] Enable V2 OAuth (`OAUTH_V2_ENABLED=true`)
- [ ] Monitor error rates
- [ ] Monitor V2 connection success rate

**Frontend**:
- [ ] Enable V2 UI for new connections
- [ ] Show "Enhanced Security Available" banner (dismissible)

**Testing**:
- [ ] Monitor V2 connections in production
- [ ] Verify V1 connections unaffected
- [ ] Check error logs

**Rollback**: Disable V2 via feature flag

---

### Phase 4: Voluntary Migration (Week 7-12)

**Week 7-8**:
- [ ] Send Email 1: "Enhanced Security Available"
- [ ] Show persistent banner for V1 users
- [ ] Track voluntary migration rate

**Week 9-10**:
- [ ] Send Email 2: "Security Upgrade Recommended"
- [ ] Increase banner urgency
- [ ] Monitor migration progress

**Week 11-12**:
- [ ] Send Email 3: "Action Required"
- [ ] Show blocking banner (7 days warning)
- [ ] Final push for voluntary migration

**Rollback**: Can extend grace period if needed

---

### Phase 5: Force Migration (Week 13)

**Actions**:
- [ ] Set grace period end date
- [ ] Publishing worker rejects V1 tokens
- [ ] Show "Reconnect Required" modal
- [ ] Monitor support tickets
- [ ] Assist users with reconnection

**Rollback**: Extend grace period by 1 week

---

### Phase 6: Cleanup (Week 14)

**Actions**:
- [ ] Verify all accounts migrated or reconnected
- [ ] Remove V1 decryption code
- [ ] Remove dual-format support
- [ ] Archive V1 tokens (optional)
- [ ] Update documentation

**Rollback**: Not applicable (point of no return)

---

## 9. SUCCESS METRICS

### Migration Metrics

- [ ] V2 connection success rate > 95%
- [ ] V1 connection stability maintained at 100%
- [ ] Voluntary migration rate > 70% by Week 12
- [ ] Support ticket increase < 20%
- [ ] Zero data loss incidents
- [ ] Zero security incidents

### Performance Metrics

- [ ] V2 OAuth flow < 2 seconds
- [ ] Token decryption latency < 50ms (both V1 and V2)
- [ ] Publishing worker performance unchanged
- [ ] Database query performance unchanged

### User Experience Metrics

- [ ] User satisfaction score > 4.0/5
- [ ] Churn rate increase < 2%
- [ ] Reconnection completion rate > 90%
- [ ] Average reconnection time < 3 minutes

---

## 10. RISK MITIGATION

### Risk 1: Mass User Confusion

**Mitigation**:
- Clear, non-technical communication
- Video tutorials
- In-app help
- Dedicated support team
- FAQ page

### Risk 2: Support Overload

**Mitigation**:
- Gradual rollout
- Self-service reconnection
- Automated email responses
- Support team training
- Extended support hours during force migration

### Risk 3: V2 Encryption Failure

**Mitigation**:
- Extensive testing before launch
- Gradual rollout
- Keep V1 tokens as backup
- Quick rollback procedure
- 24/7 monitoring

### Risk 4: KMS Dependency

**Mitigation**:
- Mock KMS for development
- KMS health monitoring
- Fallback to V1 if KMS down
- KMS redundancy (multi-region)
- Regular KMS failover testing

---

## CONCLUSION

**Recommended Strategy**: Option B (Hybrid Mode)

**Key Principles**:
1. **Safety First**: V1 tokens continue working
2. **User Choice**: Voluntary migration with clear deadline
3. **Zero Data Loss**: V1 tokens preserved as backup
4. **Clear Communication**: Transparent timeline and benefits
5. **Easy Rollback**: Can disable V2 at any time

**Timeline**: 14 weeks (3.5 months)

**Risk Level**: LOW

**User Impact**: MINIMAL (voluntary until Week 13)

**Engineering Complexity**: MEDIUM (dual-format support)

**Security Benefit**: HIGH (all users on V2 by Week 14)

---

**Document Status**: READY FOR REVIEW  
**Next Steps**: Team review and approval  
**Implementation Start**: Upon approval
