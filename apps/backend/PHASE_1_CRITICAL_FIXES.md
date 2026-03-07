# Phase 1 Critical Fixes - Quick Reference

**Status**: NOT PRODUCTION READY ❌  
**Time to Fix**: 11-21 hours  
**Priority**: P0 CRITICAL

---

## The Problem

The `DistributedTokenRefreshWorker.refreshToken()` method is a **MOCK IMPLEMENTATION**.

**Location**: `apps/backend/src/workers/DistributedTokenRefreshWorker.ts` (lines 297-332)

**Current Code**:
```typescript
private async refreshToken(account: ISocialAccount): Promise<{...}> {
  // TODO: Replace with real provider refresh logic
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    success: true,
    accessToken: `refreshed_${Date.now()}`,  // FAKE TOKEN
    refreshToken: `refreshed_${Date.now()}`,  // FAKE TOKEN
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };
}
```

**Impact**: All token refreshes succeed with fake tokens. Real platform tokens expire, causing account failures.

---

## Fix #1: Wire Platform Services (4-8 hours) - CRITICAL

### Step 1: Import Platform Services

Add to top of `DistributedTokenRefreshWorker.ts`:

```typescript
import { facebookTokenRefreshWorker } from './FacebookTokenRefreshWorker';
import { instagramTokenRefreshService } from '../services/oauth/InstagramTokenRefreshService';
import { TwitterOAuthService } from '../services/oauth/TwitterOAuthService';
import { TikTokOAuthService } from '../services/oauth/TikTokOAuthService';
import { LinkedInOAuthService } from '../services/oauth/LinkedInOAuthService';
import config from '../config';
```

### Step 2: Initialize Services in Constructor

```typescript
private twitterService: TwitterOAuthService;
private tiktokService: TikTokOAuthService;
private linkedinService: LinkedInOAuthService;

constructor() {
  // ... existing code ...
  
  this.twitterService = new TwitterOAuthService(
    config.twitter.clientId,
    config.twitter.clientSecret,
    config.twitter.redirectUri
  );
  
  this.tiktokService = new TikTokOAuthService(
    config.tiktok.clientKey,
    config.tiktok.clientSecret,
    config.tiktok.redirectUri
  );
  
  this.linkedinService = new LinkedInOAuthService(
    config.linkedin.clientId,
    config.linkedin.clientSecret,
    config.linkedin.redirectUri
  );
}
```


### Step 3: Replace Mock refreshToken() Method

```typescript
private async refreshToken(account: ISocialAccount): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}> {
  try {
    const refreshToken = account.getDecryptedRefreshToken();
    
    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
      };
    }

    // Route to platform-specific service
    switch (account.provider) {
      case SocialPlatform.FACEBOOK:
        return await this.refreshFacebookToken(account);
        
      case SocialPlatform.INSTAGRAM:
        return await this.refreshInstagramToken(account);
        
      case SocialPlatform.TWITTER:
        return await this.refreshTwitterToken(account);
        
      case SocialPlatform.TIKTOK:
        return await this.refreshTikTokToken(account);
        
      case SocialPlatform.LINKEDIN:
        return await this.refreshLinkedInToken(account);
        
      default:
        return {
          success: false,
          error: `Unsupported platform: ${account.provider}`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```


### Step 4: Add Platform-Specific Refresh Methods

```typescript
/**
 * Refresh Facebook token
 */
private async refreshFacebookToken(account: ISocialAccount): Promise<any> {
  try {
    await facebookTokenRefreshWorker.refreshLongLivedToken(account._id.toString());
    
    // Fetch updated account
    const updated = await SocialAccount.findById(account._id)
      .select('+accessToken +refreshToken');
    
    if (!updated) {
      return { success: false, error: 'Account not found after refresh' };
    }
    
    return {
      success: true,
      accessToken: updated.getDecryptedAccessToken(),
      refreshToken: updated.getDecryptedRefreshToken(),
      expiresAt: updated.tokenExpiresAt,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Refresh Instagram token
 */
private async refreshInstagramToken(account: ISocialAccount): Promise<any> {
  try {
    await instagramTokenRefreshService.refreshToken(account._id.toString());
    
    const updated = await SocialAccount.findById(account._id)
      .select('+accessToken +refreshToken');
    
    if (!updated) {
      return { success: false, error: 'Account not found after refresh' };
    }
    
    return {
      success: true,
      accessToken: updated.getDecryptedAccessToken(),
      refreshToken: updated.getDecryptedRefreshToken(),
      expiresAt: updated.tokenExpiresAt,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Refresh Twitter token
 */
private async refreshTwitterToken(account: ISocialAccount): Promise<any> {
  try {
    await this.twitterService.refreshToken(account._id.toString());
    
    const updated = await SocialAccount.findById(account._id)
      .select('+accessToken +refreshToken');
    
    if (!updated) {
      return { success: false, error: 'Account not found after refresh' };
    }
    
    return {
      success: true,
      accessToken: updated.getDecryptedAccessToken(),
      refreshToken: updated.getDecryptedRefreshToken(),
      expiresAt: updated.tokenExpiresAt,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Refresh TikTok token
 */
private async refreshTikTokToken(account: ISocialAccount): Promise<any> {
  try {
    await this.tiktokService.refreshToken(account._id.toString());
    
    const updated = await SocialAccount.findById(account._id)
      .select('+accessToken +refreshToken');
    
    if (!updated) {
      return { success: false, error: 'Account not found after refresh' };
    }
    
    return {
      success: true,
      accessToken: updated.getDecryptedAccessToken(),
      refreshToken: updated.getDecryptedRefreshToken(),
      expiresAt: updated.tokenExpiresAt,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Refresh LinkedIn token
 */
private async refreshLinkedInToken(account: ISocialAccount): Promise<any> {
  try {
    await this.linkedinService.refreshToken(account._id.toString());
    
    const updated = await SocialAccount.findById(account._id)
      .select('+accessToken +refreshToken');
    
    if (!updated) {
      return { success: false, error: 'Account not found after refresh' };
    }
    
    return {
      success: true,
      accessToken: updated.getDecryptedAccessToken(),
      refreshToken: updated.getDecryptedRefreshToken(),
      expiresAt: updated.tokenExpiresAt,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

**Effort**: 4-8 hours  
**Testing**: Verify with real OAuth tokens for each platform


---

## Fix #2: Implement LinkedIn Token Refresh (2-4 hours) - HIGH

**File**: `apps/backend/src/services/oauth/LinkedInOAuthService.ts`

### Add refreshToken() Method

```typescript
import { DistributedLockService } from '../DistributedLockService';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';

/**
 * Refresh LinkedIn access token
 */
async refreshToken(accountId: string): Promise<void> {
  const lockKey = `oauth:linkedin:refresh:lock:${accountId}`;
  const lockService = DistributedLockService.getInstance();
  
  try {
    logger.info('[LinkedIn] Starting token refresh', { accountId });
    
    // Acquire distributed lock
    const lockAcquired = await lockService.acquireLock(lockKey, 300); // 5 min TTL
    
    if (!lockAcquired) {
      logger.warn('[LinkedIn] Failed to acquire lock - another worker processing', {
        accountId,
      });
      throw new Error('Token refresh already in progress');
    }
    
    // Fetch account with tokens
    const account = await SocialAccount.findById(accountId)
      .select('+accessToken +refreshToken');
    
    if (!account) {
      throw new Error('Account not found');
    }
    
    if (account.provider !== SocialPlatform.LINKEDIN) {
      throw new Error('Account is not a LinkedIn account');
    }
    
    const refreshToken = account.getDecryptedRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // Refresh token via LinkedIn API
    const tokens = await this.provider.refreshAccessToken({
      refreshToken,
    });
    
    // Update account
    account.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
    account.refreshToken = tokens.refreshToken || refreshToken; // Update if new one provided
    account.tokenExpiresAt = tokens.expiresAt;
    account.lastRefreshedAt = new Date();
    account.status = AccountStatus.ACTIVE;
    
    await account.save();
    
    logger.info('[LinkedIn] Token refreshed successfully', {
      accountId,
      expiresAt: tokens.expiresAt,
    });
    
    // Log security event
    await securityAuditService.logEvent({
      type: SecurityEventType.TOKEN_REFRESH_SUCCESS,
      workspaceId: account.workspaceId,
      ipAddress: '0.0.0.0', // System-initiated
      resource: accountId,
      success: true,
      metadata: {
        provider: SocialPlatform.LINKEDIN,
        accountId,
      },
    });
    
    // Release lock
    await lockService.releaseLock(lockKey);
    
  } catch (error: any) {
    logger.error('[LinkedIn] Token refresh failed', {
      accountId,
      error: error.message,
    });
    
    // Release lock
    await lockService.releaseLock(lockKey);
    
    // Update account status
    const account = await SocialAccount.findById(accountId);
    if (account) {
      account.status = AccountStatus.REAUTH_REQUIRED;
      await account.save();
      
      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.TOKEN_REFRESH_FAILURE,
        workspaceId: account.workspaceId,
        ipAddress: '0.0.0.0',
        resource: accountId,
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.LINKEDIN,
          accountId,
        },
      });
    }
    
    throw error;
  }
}
```

### Add refreshAccessToken() to LinkedInOAuthProvider

**File**: `apps/backend/src/services/oauth/LinkedInOAuthProvider.ts`

```typescript
async refreshAccessToken(params: {
  refreshToken: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  expiresIn: number;
}> {
  try {
    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: params.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    return {
      accessToken: access_token,
      refreshToken: refresh_token, // LinkedIn may return new refresh token
      expiresAt: new Date(Date.now() + expires_in * 1000),
      expiresIn: expires_in,
    };
  } catch (error: any) {
    logger.error('[LinkedIn] Token refresh failed', {
      error: error.response?.data || error.message,
    });
    throw new Error(`LinkedIn token refresh failed: ${error.message}`);
  }
}
```

**Effort**: 2-4 hours  
**Testing**: Verify with real LinkedIn OAuth token


---

## Fix #3: Add TikTok Distributed Lock (1 hour) - MEDIUM

**File**: `apps/backend/src/services/oauth/TikTokOAuthService.ts`

### Update refreshToken() Method

Replace existing method with:

```typescript
import { DistributedLockService } from '../DistributedLockService';

async refreshToken(accountId: string): Promise<void> {
  const lockKey = `oauth:tiktok:refresh:lock:${accountId}`;
  const lockService = DistributedLockService.getInstance();
  
  try {
    logger.info('Refreshing TikTok token', { accountId });
    
    // Acquire distributed lock
    const lockAcquired = await lockService.acquireLock(lockKey, 300); // 5 min TTL
    
    if (!lockAcquired) {
      logger.warn('Failed to acquire lock - another worker processing', {
        accountId,
      });
      throw new Error('Token refresh already in progress');
    }
    
    // Fetch account with tokens
    const account = await SocialAccount.findById(accountId)
      .select('+accessToken +refreshToken');
    
    if (!account) {
      throw new Error('Account not found');
    }
    
    if (account.provider !== SocialPlatform.TIKTOK) {
      throw new Error('Account is not a TikTok account');
    }
    
    const refreshToken = account.getDecryptedRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // Refresh token
    const tokens = await this.provider.refreshAccessToken({
      refreshToken,
    });
    
    // Update account
    account.accessToken = tokens.accessToken;
    account.refreshToken = tokens.refreshToken;
    account.tokenExpiresAt = tokens.expiresAt;
    account.lastRefreshedAt = new Date();
    account.status = AccountStatus.ACTIVE;
    
    await account.save();
    
    logger.info('TikTok token refreshed', {
      accountId,
      expiresAt: tokens.expiresAt,
    });
    
    // Log security event
    await securityAuditService.logEvent({
      type: SecurityEventType.TOKEN_REFRESH_SUCCESS,
      workspaceId: account.workspaceId,
      ipAddress: '0.0.0.0',
      resource: accountId,
      success: true,
      metadata: {
        provider: SocialPlatform.TIKTOK,
        accountId,
      },
    });
    
    // Release lock
    await lockService.releaseLock(lockKey);
    
  } catch (error: any) {
    logger.error('Failed to refresh TikTok token', {
      accountId,
      error: error.message,
    });
    
    // Release lock
    await lockService.releaseLock(lockKey);
    
    // Update account status
    const account = await SocialAccount.findById(accountId);
    if (account) {
      account.status = AccountStatus.REAUTH_REQUIRED;
      await account.save();
      
      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.TOKEN_REFRESH_FAILURE,
        workspaceId: account.workspaceId,
        ipAddress: '0.0.0.0',
        resource: accountId,
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.TIKTOK,
          accountId,
        },
      });
    }
    
    throw error;
  }
}
```

**Effort**: 1 hour  
**Testing**: Verify lock prevents concurrent refreshes


---

## Fix #4: Integration Testing (4-8 hours) - CRITICAL

### Test Plan

#### Test 1: Facebook Token Refresh
```bash
# Create test account with real Facebook OAuth token
# Wait for token to be near expiration (or manually set tokenExpiresAt)
# Trigger scheduler or manually enqueue job
# Verify:
# - Job succeeds
# - New token stored in database
# - Token works with Facebook API
# - Metrics updated
```

#### Test 2: Instagram Token Refresh
```bash
# Test both Business and Basic Display accounts
# Verify token refresh via Facebook Graph API (Business)
# Verify token refresh via Instagram API (Basic Display)
```

#### Test 3: Twitter Token Refresh
```bash
# Create test account with real Twitter OAuth token
# Verify token refresh via Twitter API v2
# Verify scope validation (offline.access required)
```

#### Test 4: TikTok Token Refresh
```bash
# Create test account with real TikTok OAuth token
# Verify token refresh via TikTok API
# Verify distributed lock prevents concurrent refreshes
```

#### Test 5: LinkedIn Token Refresh
```bash
# Create test account with real LinkedIn OAuth token
# Verify token refresh via LinkedIn API
# Verify distributed lock works
```

#### Test 6: Circuit Breaker
```bash
# Mock platform API to return 500 errors
# Trigger 5 consecutive failures
# Verify circuit opens
# Verify subsequent requests skipped
# Wait 60 seconds
# Verify circuit half-opens
# Verify probe request
```

#### Test 7: Retry Logic
```bash
# Mock platform API to fail twice, succeed on third attempt
# Verify job retries with exponential backoff
# Verify job succeeds on third attempt
```

#### Test 8: DLQ
```bash
# Mock platform API to always fail
# Verify job retries 3 times
# Verify job moves to DLQ
# Verify account marked as REFRESH_FAILED
# Verify DLQ stats updated
```

#### Test 9: Multi-Worker Concurrency
```bash
# Start 3 server instances
# Enqueue 100 refresh jobs
# Verify no duplicate refreshes (distributed locks work)
# Verify all jobs complete
```

#### Test 10: Token Refresh Storm
```bash
# Create 1000 accounts with tokens expiring in 1 hour
# Run scheduler
# Verify jobs spread over 20 minutes (jitter)
# Verify workers process jobs without overwhelming platform APIs
```

### Success Criteria

- ✅ All 10 tests pass
- ✅ No fake tokens generated
- ✅ Real platform tokens refreshed
- ✅ Metrics accurate
- ✅ Logs complete
- ✅ No race conditions
- ✅ Circuit breaker works
- ✅ DLQ handles failures

**Effort**: 4-8 hours  
**Priority**: P0 CRITICAL


---

## Summary

### Total Effort: 11-21 hours

| Fix | Priority | Effort | Status |
|-----|----------|--------|--------|
| Wire platform services | P0 CRITICAL | 4-8 hours | ❌ TODO |
| Implement LinkedIn refresh | P1 HIGH | 2-4 hours | ❌ TODO |
| Add TikTok distributed lock | P2 MEDIUM | 1 hour | ❌ TODO |
| Integration testing | P0 CRITICAL | 4-8 hours | ❌ TODO |

### Deployment Blockers

1. ❌ Mock `refreshToken()` implementation
2. ❌ LinkedIn refresh not implemented
3. ❌ TikTok missing distributed lock
4. ❌ No integration tests

### After These Fixes

✅ Phase 1 will be 100% complete  
✅ Token refresh will work with real platform APIs  
✅ All platforms supported (Facebook, Instagram, Twitter, TikTok, LinkedIn)  
✅ Production ready

---

## Quick Start

1. **Start with Fix #1** - Wire platform services (blocks everything else)
2. **Test with real tokens** - Don't trust mock data
3. **Fix #2 and #3** - LinkedIn and TikTok improvements
4. **Run integration tests** - Verify everything works end-to-end

**Timeline**: 2-3 days with focused effort

---

**Document Created**: 2026-03-05  
**Status**: CRITICAL FIXES REQUIRED  
**Next Review**: After fixes implemented

