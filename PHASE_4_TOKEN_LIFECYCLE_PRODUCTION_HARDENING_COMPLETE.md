# Phase 4: Token Lifecycle & Production Hardening - COMPLETE

## Overview

Phase 4 implements comprehensive token lifecycle management and production hardening for Instagram accounts (both Business and Basic Display). This phase ensures tokens are properly managed, refreshed, and secured throughout their lifecycle.

## Implementation Summary

### 1. Token Refresh Service

**File**: `apps/backend/src/services/oauth/InstagramTokenRefreshService.ts`

**Features**:
- Provider-aware token refresh (Business vs Basic Display)
- Automatic refresh for expiring tokens (7-day threshold)
- Failure tracking and account status management
- Max 5 consecutive failures before account disabled
- No tokens in logs

**Methods**:
- `refreshBusinessToken(account)` - Refresh Instagram Business token via Facebook
- `refreshBasicToken(account)` - Refresh Instagram Basic Display token
- `refreshIfExpiringSoon(account, thresholdDays)` - Conditional refresh based on expiration
- `isTokenExpired(account, thresholdDays)` - Check if token is expired
- `getDaysUntilExpiration(account)` - Get days until token expires

**Failure Handling**:
- Increments `connectionMetadata.refreshFailureCount` on each failure
- Sets `connectionMetadata.lastRefreshAttempt` timestamp
- Updates status to `TOKEN_EXPIRING` after first failure
- Updates status to `REAUTH_REQUIRED` after 5 consecutive failures
- Resets failure count to 0 on successful refresh

### 2. Expiration Guard Utility

**File**: `apps/backend/src/utils/expirationGuard.ts`

**Features**:
- Pre-call token expiration validation
- Clear error messages for expired tokens
- Account usability checks
- Token expiration warnings

**Functions**:
- `assertTokenNotExpired(account)` - Throws `TokenExpiredError` if token expired
- `assertTokenNotExpiringSoon(account, thresholdDays)` - Throws `TokenExpiringSoonError` if expiring soon
- `isAccountUsable(account)` - Returns true if account can be used for API calls
- `getDaysUntilExpiration(account)` - Returns days until token expires
- `validateTokenExpiration(expiresAt, context)` - Validates token expiration and warns if < 50 days

**Error Classes**:
- `TokenExpiredError` - Thrown when token is expired
- `TokenExpiringSoonError` - Thrown when token is expiring within threshold

### 3. Token Encryption Validation

**Existing Implementation**: `apps/backend/src/models/SocialAccount.ts`

**Verified Features**:
- Tokens encrypted at rest using AES-256-GCM
- Pre-save hook encrypts tokens before database storage
- Encryption key versioning support
- Tokens never selected by default (`select: false`)
- Tokens excluded from JSON output
- Decryption methods: `getDecryptedAccessToken()`, `getDecryptedRefreshToken()`

**Security**:
- All access tokens encrypted before storage
- Refresh tokens encrypted before storage
- Tokens never appear in logs or error messages
- Tokens excluded from API responses
- Encryption key version tracked per account

### 4. Updated InstagramOAuthService

**File**: `apps/backend/src/services/oauth/InstagramOAuthService.ts`

**Changes**:
- Added `validateTokenExpiration()` import
- Validates token expiration after exchange (warns if < 50 days)
- Properly initializes `connectionMetadata` with failure tracking fields:
  - `lastRefreshAttempt: undefined`
  - `refreshFailureCount: 0`
- Stores `tokenExpiresAt` for both Business and Basic Display
- Stores `longLivedTokenExpiresAt` in metadata for Basic Display

### 5. Comprehensive Unit Tests

**Test Files**:
1. `apps/backend/src/services/oauth/__tests__/InstagramTokenRefreshService.test.ts` (36 tests)
   - Business token refresh success/failure
   - Basic Display token refresh success/failure
   - Conditional refresh based on expiration threshold
   - Failure count increment and account disabling
   - Token expiration checks
   - Days until expiration calculation

2. `apps/backend/src/utils/__tests__/expirationGuard.test.ts` (24 tests)
   - Token expiration assertions
   - Token expiring soon assertions
   - Account usability checks
   - Days until expiration calculation
   - Token expiration validation

3. `apps/backend/src/models/__tests__/SocialAccount.encryption.test.ts` (15 tests)
   - Token encryption at rest
   - Token decryption
   - Encryption key versioning
   - Token exclusion from JSON
   - No tokens in logs or error messages

**Total Tests**: 75 unit tests covering all token lifecycle functionality

## Security Features

### Token Security
- ✅ All tokens encrypted at rest using AES-256-GCM
- ✅ Tokens never appear in logs
- ✅ Tokens never appear in error messages
- ✅ Tokens excluded from API responses
- ✅ Tokens excluded from JSON serialization
- ✅ Encryption key versioning for safe rotation

### Token Lifecycle
- ✅ Token expiration tracking
- ✅ Automatic refresh for expiring tokens
- ✅ Failure tracking and retry limits
- ✅ Account status management based on refresh failures
- ✅ Pre-call expiration validation

### Error Handling
- ✅ Clear error messages without exposing tokens
- ✅ Actionable error messages for users
- ✅ Structured logging with context
- ✅ No sensitive data in logs

## Token Lifecycle Flow

### Business Account Token Lifecycle
1. User connects Instagram Business account via Facebook
2. Exchange code for long-lived token (60 days)
3. Validate expiration (warn if < 50 days)
4. Store encrypted token with expiration date
5. Monitor expiration (7-day threshold)
6. Refresh token before expiration
7. On success: Reset failure count, update expiration
8. On failure: Increment failure count, update status
9. After 5 failures: Set status to REAUTH_REQUIRED

### Basic Display Account Token Lifecycle
1. User connects Instagram Personal account
2. Exchange code for short-lived token
3. Exchange short-lived for long-lived token (60 days)
4. Validate expiration (warn if < 50 days)
5. Store encrypted token with expiration date
6. Monitor expiration (7-day threshold)
7. Refresh token before expiration
8. On success: Reset failure count, update expiration
9. On failure: Increment failure count, update status
10. After 5 failures: Set status to REAUTH_REQUIRED

## Database Schema Updates

### ConnectionMetadata Fields
```typescript
type ConnectionMetadata =
  | {
      type: 'INSTAGRAM_BUSINESS';
      pageId: string;
      pageName: string;
      tokenRefreshable: true;
      lastRefreshAttempt?: Date;        // NEW
      refreshFailureCount?: number;     // NEW
    }
  | {
      type: 'INSTAGRAM_BASIC';
      longLivedTokenExpiresAt: Date;
      tokenRefreshable: boolean;
      lastRefreshAttempt?: Date;        // NEW
      refreshFailureCount?: number;     // NEW
    };
```

## NOT Implemented (Future Phases)

The following were explicitly excluded from Phase 4:
- ❌ Background scheduler for automatic token refresh
- ❌ Cron jobs for token refresh
- ❌ Controller modifications for token refresh endpoints
- ❌ UI changes for token status display
- ❌ Metrics tracking for token refresh
- ❌ Audit logging for token refresh events

These will be implemented in future phases as needed.

## Validation Checklist

- ✅ Token encryption verified at rest
- ✅ Token expiration tracking implemented
- ✅ Token refresh service created
- ✅ Expiration guard utility created
- ✅ Failure tracking implemented
- ✅ Account status management implemented
- ✅ No tokens in logs verified
- ✅ No tokens in error messages verified
- ✅ 75 unit tests created and passing
- ✅ InstagramOAuthService updated with validation
- ✅ ConnectionMetadata properly initialized

## Usage Examples

### Refresh Token Before API Call
```typescript
import { instagramTokenRefreshService } from './services/oauth/InstagramTokenRefreshService';
import { assertTokenNotExpired } from './utils/expirationGuard';

// Get account
const account = await SocialAccount.findById(accountId).select('+accessToken');

// Check if token is expired
assertTokenNotExpired(account);

// Refresh if expiring soon (7 days)
const result = await instagramTokenRefreshService.refreshIfExpiringSoon(account);

if (!result.success) {
  throw new Error('Failed to refresh token');
}

// Use refreshed token
const token = account.getDecryptedAccessToken();
```

### Check Account Usability
```typescript
import { isAccountUsable } from './utils/expirationGuard';

const account = await SocialAccount.findById(accountId);

if (!isAccountUsable(account)) {
  throw new Error('Account is not usable. Please reconnect.');
}
```

### Manual Token Refresh
```typescript
import { instagramTokenRefreshService } from './services/oauth/InstagramTokenRefreshService';

const account = await SocialAccount.findById(accountId).select('+accessToken');

// Refresh based on provider type
if (account.providerType === 'INSTAGRAM_BUSINESS') {
  const result = await instagramTokenRefreshService.refreshBusinessToken(account);
} else {
  const result = await instagramTokenRefreshService.refreshBasicToken(account);
}
```

## Next Steps

Phase 4 is complete. The system now has:
1. ✅ Comprehensive token lifecycle management
2. ✅ Production-grade security hardening
3. ✅ Automatic token refresh capability
4. ✅ Failure tracking and account status management
5. ✅ 75 unit tests covering all functionality

**Ready for**: Background scheduler implementation (future phase)

## Files Created/Modified

### Created
- `apps/backend/src/services/oauth/InstagramTokenRefreshService.ts`
- `apps/backend/src/utils/expirationGuard.ts`
- `apps/backend/src/services/oauth/__tests__/InstagramTokenRefreshService.test.ts`
- `apps/backend/src/utils/__tests__/expirationGuard.test.ts`
- `apps/backend/src/models/__tests__/SocialAccount.encryption.test.ts`

### Modified
- `apps/backend/src/services/oauth/InstagramOAuthService.ts`
  - Added token expiration validation
  - Properly initialized connectionMetadata with failure tracking fields

## Completion Date

Phase 4 completed: March 1, 2026
