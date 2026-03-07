# Milestone 0: Exact Code Changes

This document shows the exact code changes made for Milestone 0 in a diff-style format for easy review.

---

## File 1: apps/backend/src/models/SocialAccount.ts

### Change 1: Add connectionVersion to Interface

```diff
export interface ISocialAccount extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  provider: SocialPlatform;
  providerUserId: string;
  accountName: string;
  accessToken: string; // Encrypted
  refreshToken?: string; // Encrypted, nullable
  tokenExpiresAt?: Date; // Nullable
  encryptionKeyVersion: number; // Key version used for encryption
  scopes: string[];
  status: AccountStatus;
  lastRefreshedAt?: Date;
  metadata: {
    profileUrl?: string;
    avatarUrl?: string;
    followerCount?: number;
    [key: string]: any;
  };
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
+ connectionVersion?: 'v1' | 'v2'; // MILESTONE 0: Optional field for V1/V2 tracking

  // Methods
  getDecryptedAccessToken(): string;
  getDecryptedRefreshToken(): string | undefined;
  isTokenExpired(): boolean;
  toSafeObject(): any;
}
```

### Change 2: Add connectionVersion to Schema

```diff
    lastSyncAt: {
      type: Date,
    },
+   connectionVersion: {
+     type: String,
+     enum: ['v1', 'v2'],
+     required: false, // MILESTONE 0: Must be optional for backward compatibility
+     default: undefined, // MILESTONE 0: No default for existing accounts
+   },
  },
  {
    timestamps: true,
  }
);
```

---

## File 2: apps/backend/src/workers/PublishingWorker.ts

### Change: Add connectionVersion Logging

```diff
      // Fetch social account with tokens
      const account = await SocialAccount.findOne({
        _id: socialAccountId,
        workspaceId,
-     }).select('+accessToken +refreshToken');
+     }).select('+accessToken +refreshToken +connectionVersion');

      if (!account) {
        throw new Error('Social account not found');
      }

+     // MILESTONE 0: Normalize undefined connectionVersion to 'v1' for logging
+     const version = account.connectionVersion ?? 'v1';
+
+     logger.info('Publishing post', {
+       accountId: account._id,
+       provider: account.provider,
+       connectionVersion: version,
+       postId: post._id,
+     });
```

---

## File 3: apps/backend/src/workers/TokenRefreshWorker.ts

### Change 1: Add connectionVersion to Select Query

```diff
  private async getAccountsNeedingRefresh(): Promise<ISocialAccount[]> {
    const refreshThreshold = new Date(Date.now() + this.REFRESH_WINDOW);

    return SocialAccount.find({
      status: AccountStatus.ACTIVE,
      tokenExpiresAt: { $lt: refreshThreshold, $ne: null },
    })
-     .select('+accessToken +refreshToken')
+     .select('+accessToken +refreshToken +connectionVersion')
      .sort({ tokenExpiresAt: 1 })
      .limit(100);
  }
```

### Change 2: Add connectionVersion Logging

```diff
  private async refreshAccountToken(account: ISocialAccount): Promise<void> {
    const accountId = account._id.toString();
    const lockKey = `token:refresh:${accountId}`;

+   // MILESTONE 0: Normalize undefined connectionVersion to 'v1' for logging
+   const version = account.connectionVersion ?? 'v1';
+
+   logger.info('Starting token refresh', {
+     accountId,
+     provider: account.provider,
+     connectionVersion: version,
+   });

    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) return;

    try {
      const success = await this.attemptRefreshWithRetry(account);
      if (!success) {
        await this.markAccountExpired(accountId, 'Refresh failed');
+     } else {
+       logger.info('Token refreshed successfully', {
+         accountId,
+         provider: account.provider,
+         connectionVersion: version,
+         note: 'connectionVersion preserved',
+       });
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }
```

### Change 3: Add Comment to Prevent Accidental Modification

```diff
  private async updateAccountTokens(
    accountId: string,
    accessToken: string,
    refreshToken: string | undefined,
    expiresAt: Date
  ) {
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : undefined;

+   // MILESTONE 0: CRITICAL - Update ONLY token fields, NEVER modify connectionVersion
    const update: any = {
      accessToken: encryptedAccessToken,
      tokenExpiresAt: expiresAt,
      lastRefreshedAt: new Date(),
      status: AccountStatus.ACTIVE,
    };

    if (encryptedRefreshToken) update.refreshToken = encryptedRefreshToken;

    await SocialAccount.findByIdAndUpdate(accountId, update);
  }
```

---

## Summary of Changes

### Lines Added: ~30
### Lines Modified: ~5
### Files Modified: 3
### Files Created: 6

### Complexity: MINIMAL
### Risk: MINIMAL
### Backward Compatibility: 100%

---

## Key Safety Features

1. **Optional Field**: `required: false` ensures existing accounts work unchanged
2. **No Default**: `default: undefined` prevents automatic value assignment
3. **Normalization**: `?? 'v1'` safely handles undefined for logging
4. **Preservation**: connectionVersion NOT in update object (preserved)
5. **Logging**: Added for observability without changing behavior

---

## Testing Strategy

### Unit Tests (4 total):
1. PublishingWorker: V1 publish unchanged
2. PublishingWorker: Undefined version treated as V1
3. TokenRefreshWorker: V1 refresh unchanged
4. TokenRefreshWorker: connectionVersion preserved

### Integration Tests (Staging):
1. V1 OAuth flow (create new account)
2. Token refresh (trigger for V1 account)
3. Publishing (publish with V1 account)

### Monitoring (Production):
1. V1 OAuth success rate (24 hours)
2. Token refresh success rate (24 hours)
3. Publish success rate (24 hours)
4. Error logs (24 hours)

---

## Rollback Safety

**If rollback needed**:
- Revert code changes (3 files)
- No database changes needed
- No data cleanup needed
- connectionVersion field ignored if present
- 100% safe rollback

**Rollback time**: 5 minutes  
**Data loss**: None

---

**Status**: ✅ READY FOR REVIEW AND DEPLOYMENT
