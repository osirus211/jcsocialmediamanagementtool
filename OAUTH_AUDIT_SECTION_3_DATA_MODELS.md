# OAuth Audit - Section 3: Data Models & Schema Design

## 3.1 SocialAccount Model

### Schema Design: **GOOD**

**Core Fields**:
- `workspaceId`: Tenant isolation (indexed)
- `provider`: Platform enum (twitter, facebook, linkedin, instagram)
- `providerUserId`: Platform-specific user/page ID
- `accountName`: Display name
- `accessToken`: Encrypted (select: false)
- `refreshToken`: Encrypted, nullable (select: false)
- `tokenExpiresAt`: Nullable (Facebook pages never expire)
- `encryptionKeyVersion`: Key rotation support
- `scopes`: Array of granted permissions
- `status`: Lifecycle state (active, reauth_required, disconnected, etc.)
- `metadata`: Flexible JSON for platform-specific data

### Indexes: **EXCELLENT**

```typescript
// Compound unique index: one account per provider per workspace per user
{ workspaceId: 1, provider: 1, providerUserId: 1 } (unique)

// Query optimization indexes
{ workspaceId: 1, provider: 1 }
{ workspaceId: 1, status: 1 }
{ status: 1, tokenExpiresAt: 1 } // For token refresh jobs
{ tokenExpiresAt: 1, status: 1 } // For auto-refresh worker
```

**Performance**: Optimized for tenant-scoped queries and refresh worker polling

### Security: **EXCELLENT**

**Token Protection**:
1. `select: false` - Never returned by default queries
2. Pre-save hook - Automatic encryption
3. Instance methods - Controlled decryption
4. toJSON transform - Strips tokens from API responses

**Code Evidence**:
```typescript
// Automatic encryption on save
SocialAccountSchema.pre('save', function (next) {
  if (this.isModified('accessToken') && !isEncrypted(this.accessToken)) {
    this.accessToken = encrypt(this.accessToken);
    this.encryptionKeyVersion = getCurrentKeyVersion();
  }
  next();
});

// Controlled decryption
SocialAccountSchema.methods.getDecryptedAccessToken = function (): string {
  return decrypt(this.accessToken);
};
```

### Critical Issues

#### ⚠️ WARNING: No Workspace-Level Quotas
**Gap**: No enforcement of account limits per workspace  
**Risk**: Unlimited account connections per tenant

**Recommendation**: Add quota enforcement
```typescript
// Before creating account
const accountCount = await SocialAccount.countDocuments({
  workspaceId,
  status: { $ne: AccountStatus.DISCONNECTED }
});

const workspace = await Workspace.findById(workspaceId);
const maxAccounts = getMaxAccountsForPlan(workspace.plan);

if (accountCount >= maxAccounts) {
  throw new Error('Account limit reached for your plan');
}
```

#### ⚠️ WARNING: No Soft Delete Support
**Current**: Hard delete removes account permanently  
**Gap**: No audit trail for deleted accounts

**Recommendation**: Add `deletedAt` field for soft deletes

---

## 3.2 Post Model

### Schema Design: **GOOD**

**Core Fields**:
- `workspaceId`: Tenant isolation (indexed)
- `socialAccountId`: Single account (legacy)
- `socialAccountIds`: Multiple accounts (new)
- `content`: Post text (max 10,000 chars)
- `platformContent`: Per-platform customization
- `mediaUrls`: Array of media URLs
- `mediaIds`: References to Media model
- `status`: Lifecycle state (draft, scheduled, publishing, published, failed, cancelled)
- `publishMode`: How to publish (now, schedule, queue)
- `scheduledAt`: UTC timestamp for scheduled posts
- `queueJobId`: BullMQ job ID for cancellation/rescheduling
- `publishedAt`: Actual publish timestamp
- `metadata.platformPostId`: Platform-assigned ID after publish
- `metadata.publishHash`: Idempotency hash for external API calls
- `version`: Optimistic locking counter

### Indexes: **EXCELLENT**

```typescript
// Compound indexes for efficient queries
{ workspaceId: 1, status: 1 }
{ workspaceId: 1, createdAt: -1 }
{ workspaceId: 1, scheduledAt: 1 }
{ status: 1, scheduledAt: 1 } // For scheduler polling
{ socialAccountId: 1, status: 1 }
{ workspaceId: 1, scheduledAt: 1, status: 1 } // Calendar view
```

### Idempotency: **EXCELLENT**

**Multi-Layer Protection**:
1. **Status Check**: Skip if already `PUBLISHED`
2. **Platform Post ID Check**: Skip if `metadata.platformPostId` exists
3. **Atomic Status Update**: Optimistic locking with version check
4. **Publish Hash**: External API idempotency (prevents duplicate platform posts)
5. **Distributed Lock**: Prevents concurrent worker execution

**Code Evidence**:
```typescript
// Atomic status update with optimistic locking
const atomicUpdate = await Post.findOneAndUpdate(
  {
    _id: postId,
    status: { $in: [PostStatus.SCHEDULED, PostStatus.QUEUED] },
    version: post.version, // Optimistic locking
  },
  {
    $set: { status: PostStatus.PUBLISHING },
    $inc: { version: 1 },
  },
  { new: true }
);
```

### Critical Issues

#### ⚠️ WARNING: No Workspace-Level Rate Limiting
**Gap**: No enforcement of post limits per workspace  
**Risk**: Unlimited posts per tenant

**Recommendation**: Add rate limiting middleware
```typescript
// Before creating post
const recentPosts = await Post.countDocuments({
  workspaceId,
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});

const workspace = await Workspace.findById(workspaceId);
const maxPostsPerDay = getMaxPostsForPlan(workspace.plan);

if (recentPosts >= maxPostsPerDay) {
  throw new Error('Daily post limit reached for your plan');
}
```

#### ⚠️ WARNING: No Cascade Delete
**Current**: Deleting SocialAccount doesn't handle associated posts  
**Gap**: Orphaned posts reference deleted accounts

**Recommendation**: Add pre-delete hook or cascade policy

---

## 3.3 Workspace Model

### Schema Design: **GOOD**

**Core Fields**:
- `name`: Workspace display name
- `slug`: URL-friendly identifier (unique)
- `ownerId`: User who created workspace
- `membersCount`: Cached member count
- `plan`: Subscription tier (free, pro, team, enterprise)
- `settings`: Flexible JSON for workspace config
- `deletedAt`: Soft delete support

### Indexes: **GOOD**

```typescript
{ slug: 1 } (unique)
{ ownerId: 1 }
{ deletedAt: 1 }
{ createdAt: -1 }
{ plan: 1 }
{ _id: 1, deletedAt: 1 } // Compound for tenant queries
```

### Critical Issues

#### ⚠️ WARNING: No Quota Enforcement Fields
**Gap**: No fields for tracking resource usage  
**Missing**:
- `accountsCount`: Current connected accounts
- `postsCount`: Total posts created
- `monthlyPostsCount`: Posts this billing cycle
- `storageUsed`: Media storage in bytes

**Recommendation**: Add usage tracking fields
```typescript
usage: {
  accountsCount: { type: Number, default: 0 },
  postsThisMonth: { type: Number, default: 0 },
  storageBytes: { type: Number, default: 0 },
  lastResetAt: { type: Date, default: Date.now },
}
```

#### ⚠️ WARNING: No Billing Integration
**Gap**: No link to Stripe customer/subscription  
**Missing**:
- `stripeCustomerId`: Stripe customer ID
- `stripeSubscriptionId`: Active subscription ID
- `billingEmail`: Billing contact email
- `subscriptionStatus`: active, past_due, cancelled

**Recommendation**: Add billing fields for SaaS monetization

---

## 3.4 Multi-Tenancy Isolation

### Current Implementation: **GOOD**

**Tenant Scoping**:
- All queries include `workspaceId` filter
- Middleware injects `workspaceId` from JWT
- Indexes optimized for tenant-scoped queries

**Code Evidence**:
```typescript
// Middleware injects workspace context
req.workspace = { workspaceId: decoded.workspaceId };

// All queries scoped to workspace
const accounts = await SocialAccount.find({
  workspaceId: req.workspace.workspaceId,
  status: AccountStatus.ACTIVE
});
```

### Critical Issues

#### 🔴 CRITICAL: No Row-Level Security
**Gap**: Application-level isolation only (no database-level enforcement)  
**Risk**: Bug in query logic could leak data across tenants

**Recommendation**: Add database-level RLS (if using PostgreSQL) or strict query validation

#### ⚠️ WARNING: No Tenant-Level Rate Limiting
**Gap**: No Redis-based rate limiting per workspace  
**Risk**: One tenant can exhaust API quotas for all tenants

**Recommendation**: Implement workspace-scoped rate limiting
```typescript
// Rate limit key per workspace
const rateLimitKey = `ratelimit:${workspaceId}:posts`;
const count = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 86400); // 24 hours

if (count > maxPostsPerDay) {
  throw new Error('Rate limit exceeded');
}
```

---

## 3.5 Recommendations

### IMMEDIATE
1. **Add workspace quota enforcement** (accounts, posts, storage)
2. **Implement tenant-level rate limiting** (Redis-based)
3. **Add cascade delete policies** for orphaned posts

### SHORT-TERM
4. **Add billing integration fields** (Stripe customer/subscription)
5. **Implement soft delete** for SocialAccount model
6. **Add usage tracking** to Workspace model

### LONG-TERM
7. **Database-level RLS** (if migrating to PostgreSQL)
8. **Advanced quota analytics** with usage predictions
9. **Automated cleanup jobs** for orphaned/expired data
