# SocialAccount Schema and Index Definitions

**File:** `apps/backend/src/models/SocialAccount.ts`

## Schema Definition

### Collection Name
`socialaccounts` (MongoDB default pluralization)

### Fields

| Field | Type | Required | Indexed | Encrypted | Default | Notes |
|-------|------|----------|---------|-----------|---------|-------|
| `_id` | ObjectId | Yes | Primary Key | No | Auto | MongoDB default |
| `workspaceId` | ObjectId | Yes | Yes (single) | No | - | References Workspace collection |
| `provider` | String (enum) | Yes | Yes (compound) | No | - | Values: 'twitter', 'linkedin', 'facebook', 'instagram' |
| `providerUserId` | String | Yes | Yes (compound) | No | - | Platform's user ID (e.g., Instagram user ID) |
| `accountName` | String | Yes | No | No | - | Display name |
| `accessToken` | String | Yes | No | **YES (AES-256-GCM)** | - | **select: false** (never selected by default) |
| `refreshToken` | String | No | No | **YES (AES-256-GCM)** | - | **select: false** (never selected by default) |
| `tokenExpiresAt` | Date | No | Yes (compound) | No | - | Token expiration timestamp |
| `encryptionKeyVersion` | Number | No | Yes (single) | No | 1 | For key rotation |
| `scopes` | String[] | No | No | No | [] | OAuth scopes granted |
| `status` | String (enum) | No | Yes (compound) | No | 'active' | See AccountStatus enum below |
| `lastRefreshedAt` | Date | No | No | No | - | Last token refresh timestamp |
| `metadata` | Mixed | No | No | No | {} | Platform-specific data (capabilities, etc.) |
| `lastSyncAt` | Date | No | No | No | - | Last profile sync timestamp |
| `connectionVersion` | String (enum) | No | No | No | undefined | Values: 'v1', 'v2' (optional) |
| `createdAt` | Date | Yes | No | No | Auto | Mongoose timestamps |
| `updatedAt` | Date | Yes | No | No | Auto | Mongoose timestamps |

### Enums

#### SocialPlatform
```typescript
export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
}
```

#### AccountStatus
```typescript
export enum AccountStatus {
  ACTIVE = 'active',
  TOKEN_EXPIRING = 'token_expiring',
  REAUTH_REQUIRED = 'reauth_required',
  DISCONNECTED = 'disconnected',
  PERMISSION_REVOKED = 'permission_revoked',
}
```

## Index Definitions

### Index 1: Single Field Index on `workspaceId`
```typescript
// Defined inline in schema
workspaceId: {
  type: Schema.Types.ObjectId,
  ref: 'Workspace',
  required: true,
  index: true,  // <-- Single field index
}
```
**MongoDB Index:**
```javascript
{ workspaceId: 1 }
```
**Purpose:** Fast lookups by workspace

---

### Index 2: Single Field Index on `encryptionKeyVersion`
```typescript
// Defined inline in schema
encryptionKeyVersion: {
  type: Number,
  default: 1,
  index: true,  // <-- Single field index
}
```
**MongoDB Index:**
```javascript
{ encryptionKeyVersion: 1 }
```
**Purpose:** For key rotation migration queries

---

### Index 3: Single Field Index on `status`
```typescript
// Defined inline in schema
status: {
  type: String,
  enum: Object.values(AccountStatus),
  default: AccountStatus.ACTIVE,
  index: true,  // <-- Single field index
}
```
**MongoDB Index:**
```javascript
{ status: 1 }
```
**Purpose:** Fast lookups by account status

---

### Index 4: Compound Index on `workspaceId` + `provider`
```typescript
SocialAccountSchema.index({ workspaceId: 1, provider: 1 });
```
**MongoDB Index:**
```javascript
{ workspaceId: 1, provider: 1 }
```
**Purpose:** Fast lookups for accounts by workspace and platform (e.g., "all Instagram accounts in workspace X")

---

### Index 5: Compound Index on `workspaceId` + `status`
```typescript
SocialAccountSchema.index({ workspaceId: 1, status: 1 });
```
**MongoDB Index:**
```javascript
{ workspaceId: 1, status: 1 }
```
**Purpose:** Fast lookups for accounts by workspace and status (e.g., "all ACTIVE accounts in workspace X")

---

### Index 6: Compound Index on `status` + `tokenExpiresAt`
```typescript
SocialAccountSchema.index({ status: 1, tokenExpiresAt: 1 }); // For token refresh jobs
```
**MongoDB Index:**
```javascript
{ status: 1, tokenExpiresAt: 1 }
```
**Purpose:** Token refresh worker queries (e.g., "all ACTIVE accounts with tokenExpiresAt < 7 days from now")

---

### Index 7: Compound Index on `tokenExpiresAt` + `status`
```typescript
SocialAccountSchema.index({ tokenExpiresAt: 1, status: 1 }); // For auto-refresh worker
```
**MongoDB Index:**
```javascript
{ tokenExpiresAt: 1, status: 1 }
```
**Purpose:** Alternative index for token refresh queries (different query pattern)

---

### Index 8: **UNIQUE** Compound Index on `workspaceId` + `provider` + `providerUserId`
```typescript
// Compound unique index: one account per provider per workspace per user
SocialAccountSchema.index(
  { workspaceId: 1, provider: 1, providerUserId: 1 },
  { unique: true }
);
```
**MongoDB Index:**
```javascript
{
  workspaceId: 1,
  provider: 1,
  providerUserId: 1
}
// Options: { unique: true }
```
**Purpose:** **CRITICAL CONSTRAINT** - Ensures one account per platform per workspace per user
- Prevents duplicate Instagram accounts in same workspace
- Allows same Instagram account in different workspaces (multi-tenant support)
- Throws `E11000 duplicate key error` on violation

**Example:**
- ✅ ALLOWED: Instagram user `12345` in workspace A
- ✅ ALLOWED: Instagram user `12345` in workspace B (different workspace)
- ❌ BLOCKED: Instagram user `12345` in workspace A (duplicate)

---

## Index Summary

| Index # | Type | Fields | Unique | Purpose |
|---------|------|--------|--------|---------|
| 1 | Single | `workspaceId` | No | Workspace lookups |
| 2 | Single | `encryptionKeyVersion` | No | Key rotation |
| 3 | Single | `status` | No | Status filtering |
| 4 | Compound | `workspaceId`, `provider` | No | Workspace + platform queries |
| 5 | Compound | `workspaceId`, `status` | No | Workspace + status queries |
| 6 | Compound | `status`, `tokenExpiresAt` | No | Token refresh worker |
| 7 | Compound | `tokenExpiresAt`, `status` | No | Token refresh worker (alt) |
| 8 | Compound | `workspaceId`, `provider`, `providerUserId` | **YES** | **Duplicate prevention** |

**Total Indexes:** 8 (including implicit `_id` index = 9 total)

---

## Unique Constraint Behavior

### What the Unique Index Enforces

The unique index on `{ workspaceId: 1, provider: 1, providerUserId: 1 }` enforces:

```
UNIQUE(workspaceId, provider, providerUserId)
```

This means:
- **Same Instagram account CANNOT be connected twice in the same workspace**
- **Same Instagram account CAN be connected in different workspaces** (multi-tenant support)

### Example Scenarios

#### Scenario 1: Duplicate in Same Workspace (BLOCKED)
```javascript
// First insert - SUCCESS
{
  workspaceId: ObjectId("workspace_A"),
  provider: "instagram",
  providerUserId: "instagram_user_12345"
}

// Second insert - FAILS with E11000 error
{
  workspaceId: ObjectId("workspace_A"),  // Same workspace
  provider: "instagram",                  // Same platform
  providerUserId: "instagram_user_12345"  // Same user
}
// Error: E11000 duplicate key error collection: socialaccounts index: workspaceId_1_provider_1_providerUserId_1
```

#### Scenario 2: Same User, Different Workspace (ALLOWED)
```javascript
// First insert - SUCCESS
{
  workspaceId: ObjectId("workspace_A"),
  provider: "instagram",
  providerUserId: "instagram_user_12345"
}

// Second insert - SUCCESS (different workspace)
{
  workspaceId: ObjectId("workspace_B"),  // Different workspace
  provider: "instagram",
  providerUserId: "instagram_user_12345"  // Same user
}
```

#### Scenario 3: Same User, Different Platform (ALLOWED)
```javascript
// First insert - SUCCESS
{
  workspaceId: ObjectId("workspace_A"),
  provider: "instagram",
  providerUserId: "user_12345"
}

// Second insert - SUCCESS (different platform)
{
  workspaceId: ObjectId("workspace_A"),
  provider: "twitter",                    // Different platform
  providerUserId: "user_12345"            // Same user ID (coincidence)
}
```

---

## Race Condition Analysis

### Current UPSERT Implementation (VULNERABLE)

**File:** `apps/backend/src/services/oauth/InstagramOAuthService.ts` (lines 93-127)

```typescript
// Step 3: Check if account already exists (UPSERT)
const existingAccount = await SocialAccount.findOne({
  workspaceId: params.workspaceId,
  provider: SocialPlatform.INSTAGRAM,
  providerUserId: profile.id,
});

if (existingAccount) {
  // Update existing account
  existingAccount.accessToken = tokens.accessToken;
  // ... update fields
  await existingAccount.save();
} else {
  // Create new account
  account = await SocialAccount.create({
    workspaceId: params.workspaceId,
    provider: SocialPlatform.INSTAGRAM,
    providerUserId: profile.id,
    // ... other fields
  });
}
```

### Race Condition Timeline

```
Time    Thread A                          Thread B
----    --------                          --------
T0      findOne() → null                  
T1                                        findOne() → null
T2      create() → SUCCESS                
T3                                        create() → E11000 ERROR
```

**Result:** Thread B throws unhandled `E11000 duplicate key error`

### Why Unique Index Doesn't Prevent the Race

The unique index **DOES** prevent duplicate data in the database, but:
1. It throws an **error** instead of silently succeeding
2. The error is **not handled** in the current code
3. User sees a **500 Internal Server Error** instead of graceful handling

### Correct Implementation (ATOMIC)

```typescript
// Use findOneAndUpdate with upsert:true for atomic operation
const account = await SocialAccount.findOneAndUpdate(
  {
    workspaceId: params.workspaceId,
    provider: SocialPlatform.INSTAGRAM,
    providerUserId: profile.id,
  },
  {
    $set: {
      accessToken: tokens.accessToken,
      tokenExpiresAt: tokens.expiresAt,
      status: AccountStatus.ACTIVE,
      accountName: profile.username,
      scopes: this.REQUIRED_SCOPES,
      'metadata.accountType': profile.metadata?.accountType,
      'metadata.mediaCount': profile.metadata?.mediaCount,
      'metadata.capabilities': {
        publish: true,
        analytics: true,
        messaging: true,
      },
      lastSyncAt: new Date(),
    },
  },
  {
    upsert: true,      // Create if doesn't exist
    new: true,         // Return updated document
    runValidators: true, // Run schema validators
  }
);
```

**Benefits:**
- ✅ Atomic operation (no race condition)
- ✅ No E11000 error (MongoDB handles it internally)
- ✅ Works correctly with concurrent requests
- ✅ Simpler code (no if/else branching)

---

## Validation Verdict

### Unique Index Status: ✅ CORRECTLY DEFINED

The unique index on `{ workspaceId: 1, provider: 1, providerUserId: 1 }` is:
- ✅ Correctly scoped by workspace (multi-tenant safe)
- ✅ Includes provider (allows same user on different platforms)
- ✅ Includes providerUserId (prevents duplicates)
- ✅ Marked as unique constraint

### UPSERT Implementation Status: ❌ VULNERABLE

The current UPSERT implementation is:
- ❌ Not atomic (findOne + create/update)
- ❌ Vulnerable to race conditions
- ❌ Does not handle E11000 errors gracefully
- ❌ Will fail with 500 error on concurrent requests

### Recommendation

**CRITICAL:** Replace non-atomic UPSERT with `findOneAndUpdate({ upsert: true })` to leverage the unique index correctly and prevent race conditions.
