/**
 * Instagram Token Refresh Service - PRODUCTION
 * 
 * Handles token lifecycle management for Instagram accounts
 * 
 * Features:
 * - Automatic token refresh for expiring tokens
 * - Provider-aware refresh logic (Business vs Basic Display)
 * - Failure tracking and account status management
 * - Expiration guard for API calls
 * - Security: No tokens in logs
 * 
 * Token Lifecycle:
 * - Instagram Business: 60-day tokens, refreshable via Facebook
 * - Instagram Basic Display: 60-day tokens, refreshable via Instagram API
 * - Refresh threshold: 7 days before expiration
 * - Max failures: 5 consecutive failures → account disabled
 */

import { SocialAccount, ISocialAccount, AccountStatus, ProviderType } from '../../models/SocialAccount';
import { InstagramBusinessProvider } from './InstagramBusinessProvider';
import { InstagramBasicDisplayProvider } from './InstagramBasicDisplayProvider';
import { oauthProviderFactory, ProviderType as FactoryProviderType } from './OAuthProviderFactory';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export interface TokenRefreshResult {
  success: boolean;
  account: ISocialAccount;
  error?: string;
}

export class InstagramTokenRefreshService {
  private readonly MAX_REFRESH_FAILURES = 5;
  private readonly DEFAULT_THRESHOLD_DAYS = 7;

  /**
   * Refresh Instagram Business token
   * Uses Facebook's token exchange mechanism
   */
  async refreshBusinessToken(account: ISocialAccount): Promise<TokenRefreshResult> {
    try {
      logger.info('Refreshing Instagram Business token', {
        accountId: account._id,
        username: account.accountName,
      });

      // Get Business provider
      const provider = oauthProviderFactory.getProvider(
        FactoryProviderType.INSTAGRAM_BUSINESS
      ) as InstagramBusinessProvider;

      // Get current token (decrypted)
      const currentToken = account.getDecryptedAccessToken();

      // Refresh token
      const tokens = await provider.refreshAccessTokenLegacy({
        refreshToken: currentToken, // Instagram uses current token for refresh
      });

      // Update account
      account.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
      account.tokenExpiresAt = tokens.expiresAt;
      account.lastRefreshedAt = new Date();
      account.status = AccountStatus.ACTIVE;

      // Reset failure count on success
      if (account.connectionMetadata && account.connectionMetadata.type === 'INSTAGRAM_BUSINESS') {
        account.connectionMetadata.lastRefreshAttempt = new Date();
        account.connectionMetadata.refreshFailureCount = 0;
      }

      await account.save();

      logger.info('Instagram Business token refreshed successfully', {
        accountId: account._id,
        username: account.accountName,
        expiresAt: tokens.expiresAt,
      });

      return {
        success: true,
        account,
      };
    } catch (error: any) {
      logger.error('Instagram Business token refresh failed', {
        accountId: account._id,
        username: account.accountName,
        error: error.message,
      });

      return this.handleRefreshFailure(account, error.message);
    }
  }

  /**
   * Refresh Instagram Basic Display token
   * Uses Instagram's long-lived token refresh mechanism
   */
  async refreshBasicToken(account: ISocialAccount): Promise<TokenRefreshResult> {
    try {
      logger.info('Refreshing Instagram Basic Display token', {
        accountId: account._id,
        username: account.accountName,
      });

      // Get Basic Display provider
      const provider = oauthProviderFactory.getProvider(
        FactoryProviderType.INSTAGRAM_BASIC
      ) as InstagramBasicDisplayProvider;

      // Get current token (decrypted)
      const currentToken = account.getDecryptedAccessToken();

      // Refresh token
      const tokens = await provider.refreshAccessTokenLegacy({
        refreshToken: currentToken, // Instagram uses current token for refresh
      });

      // Update account
      account.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
      account.tokenExpiresAt = tokens.expiresAt;
      account.lastRefreshedAt = new Date();
      account.status = AccountStatus.ACTIVE;

      // Update metadata and reset failure count on success
      if (account.connectionMetadata && account.connectionMetadata.type === 'INSTAGRAM_BASIC') {
        account.connectionMetadata.longLivedTokenExpiresAt = tokens.expiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        account.connectionMetadata.lastRefreshAttempt = new Date();
        account.connectionMetadata.refreshFailureCount = 0;
      }

      await account.save();

      logger.info('Instagram Basic Display token refreshed successfully', {
        accountId: account._id,
        username: account.accountName,
        expiresAt: tokens.expiresAt,
      });

      return {
        success: true,
        account,
      };
    } catch (error: any) {
      logger.error('Instagram Basic Display token refresh failed', {
        accountId: account._id,
        username: account.accountName,
        error: error.message,
      });

      return this.handleRefreshFailure(account, error.message);
    }
  }

  /**
   * Refresh token if expiring soon
   * Checks expiration threshold and refreshes if needed
   */
  async refreshIfExpiringSoon(
    account: ISocialAccount,
    thresholdDays: number = this.DEFAULT_THRESHOLD_DAYS
  ): Promise<TokenRefreshResult> {
    // Check if token is expiring soon
    if (!account.tokenExpiresAt) {
      logger.warn('Account has no token expiration date', {
        accountId: account._id,
        username: account.accountName,
      });

      return {
        success: false,
        account,
        error: 'No token expiration date',
      };
    }

    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // If token is not expiring soon, skip refresh
    if (daysUntilExpiry > thresholdDays) {
      logger.debug('Token not expiring soon, skipping refresh', {
        accountId: account._id,
        username: account.accountName,
        daysUntilExpiry: Math.floor(daysUntilExpiry),
        threshold: thresholdDays,
      });

      return {
        success: true,
        account,
      };
    }

    logger.info('Token expiring soon, initiating refresh', {
      accountId: account._id,
      username: account.accountName,
      daysUntilExpiry: Math.floor(daysUntilExpiry),
      threshold: thresholdDays,
    });

    // Route to appropriate refresh method based on provider type
    if (account.providerType === ProviderType.INSTAGRAM_BUSINESS) {
      return this.refreshBusinessToken(account);
    } else if (account.providerType === ProviderType.INSTAGRAM_BASIC) {
      return this.refreshBasicToken(account);
    } else {
      logger.error('Unknown provider type for token refresh', {
        accountId: account._id,
        providerType: account.providerType,
      });

      return {
        success: false,
        account,
        error: 'Unknown provider type',
      };
    }
  }

  /**
   * Handle token refresh failure
   * Increments failure count and updates account status
   */
  private async handleRefreshFailure(
    account: ISocialAccount,
    errorMessage: string
  ): Promise<TokenRefreshResult> {
    try {
      // Initialize metadata if not present
      if (!account.connectionMetadata) {
        account.connectionMetadata = {
          type: 'OTHER',
          lastRefreshAttempt: new Date(),
          refreshFailureCount: 1,
        };
      } else {
        // Increment failure count
        const currentCount = account.connectionMetadata.refreshFailureCount || 0;
        account.connectionMetadata.refreshFailureCount = currentCount + 1;
        account.connectionMetadata.lastRefreshAttempt = new Date();
      }

      const failureCount = account.connectionMetadata.refreshFailureCount || 0;

      // Update status based on failure count
      if (failureCount >= this.MAX_REFRESH_FAILURES) {
        account.status = AccountStatus.REAUTH_REQUIRED;
        
        logger.error('Account disabled after max refresh failures', {
          accountId: account._id,
          username: account.accountName,
          failureCount,
          maxFailures: this.MAX_REFRESH_FAILURES,
        });
        
        // BLOCKER #4: Structured logging for token refresh disabled
        logger.error('[Security] TOKEN_REFRESH_DISABLED', {
          event: 'TOKEN_REFRESH_DISABLED',
          accountId: account._id,
          username: account.accountName,
          failureCount,
          maxFailures: this.MAX_REFRESH_FAILURES,
          providerType: account.providerType,
        });
      } else {
        account.status = AccountStatus.TOKEN_EXPIRING;
        
        logger.warn('Token refresh failed, incrementing failure count', {
          accountId: account._id,
          username: account.accountName,
          failureCount,
          maxFailures: this.MAX_REFRESH_FAILURES,
        });
        
        // BLOCKER #4: Structured logging for token refresh failure
        logger.warn('[Security] TOKEN_REFRESH_FAILURE', {
          event: 'TOKEN_REFRESH_FAILURE',
          accountId: account._id,
          username: account.accountName,
          failureCount,
          maxFailures: this.MAX_REFRESH_FAILURES,
          providerType: account.providerType,
          error: errorMessage,
        });
      }

      await account.save();

      return {
        success: false,
        account,
        error: errorMessage,
      };
    } catch (saveError: any) {
      logger.error('Failed to save account after refresh failure', {
        accountId: account._id,
        error: saveError.message,
      });

      return {
        success: false,
        account,
        error: `${errorMessage} (failed to update account)`,
      };
    }
  }

  /**
   * Check if account token is expired
   * Returns true if token is expired or expiring within threshold
   */
  isTokenExpired(account: ISocialAccount, thresholdDays: number = 0): boolean {
    if (!account.tokenExpiresAt) {
      return false; // No expiration date means token doesn't expire
    }

    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    return expiresAt.getTime() - now.getTime() <= thresholdMs;
  }

  /**
   * Get days until token expiration
   */
  getDaysUntilExpiration(account: ISocialAccount): number | null {
    if (!account.tokenExpiresAt) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    return Math.floor(daysUntilExpiry);
  }
}

// Export singleton instance
export const instagramTokenRefreshService = new InstagramTokenRefreshService();
