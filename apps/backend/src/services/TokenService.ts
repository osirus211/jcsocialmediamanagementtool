import { SocialAccount, ISocialAccount, AccountStatus } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/encryption';

/**
 * Token Service
 * 
 * Manages OAuth token lifecycle for social accounts
 * 
 * Features:
 * - Automatic token refresh
 * - Token expiration handling
 * - Account status management
 * - Secure token storage
 */

export class TokenService {
  /**
   * Get valid access token for an account
   * Automatically refreshes if expired
   */
  async getValidAccessToken(accountId: string): Promise<string> {
    try {
      // Fetch account with tokens
      const account = await SocialAccount.findById(accountId)
        .select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Social account not found');
      }

      if (account.status !== AccountStatus.ACTIVE) {
        throw new Error(`Account is ${account.status}`);
      }

      // Check if token is expired
      if (account.isTokenExpired()) {
        logger.info('Access token expired, attempting refresh', {
          accountId,
          provider: account.provider,
          expiresAt: account.tokenExpiresAt,
        });

        // Attempt to refresh token
        const refreshed = await this.refreshAccessToken(account);
        if (!refreshed) {
          // Refresh failed, mark account as expired
          await this.markAccountExpired(accountId, 'Token refresh failed');
          throw new Error('Token expired and refresh failed');
        }

        // Return the new token
        return account.getDecryptedAccessToken();
      }

      // Token is still valid
      return account.getDecryptedAccessToken();

    } catch (error: any) {
      logger.error('Failed to get valid access token', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Refresh access token for an account
   * Returns true if successful, false if failed
   */
  async refreshAccessToken(account: ISocialAccount): Promise<boolean> {
    try {
      logger.info('Refreshing access token', {
        accountId: account._id,
        provider: account.provider,
        lastRefreshed: account.lastRefreshedAt,
      });

      // Get refresh token
      const refreshToken = account.getDecryptedRefreshToken();
      if (!refreshToken) {
        logger.warn('No refresh token available', {
          accountId: account._id,
          provider: account.provider,
        });
        return false;
      }

      // PLACEHOLDER: Mock token refresh for now
      // In production, this would call the actual OAuth provider API
      const refreshResult = await this.mockTokenRefresh(account.provider, refreshToken);

      if (!refreshResult.success) {
        logger.error('Token refresh failed', {
          accountId: account._id,
          provider: account.provider,
          error: refreshResult.error,
        });
        return false;
      }

      // Update account with new tokens
      account.accessToken = encrypt(refreshResult.accessToken);
      if (refreshResult.refreshToken) {
        account.refreshToken = encrypt(refreshResult.refreshToken);
      }
      account.tokenExpiresAt = refreshResult.expiresAt;
      account.lastRefreshedAt = new Date();

      await account.save();

      logger.info('Access token refreshed successfully', {
        accountId: account._id,
        provider: account.provider,
        expiresAt: refreshResult.expiresAt,
      });

      return true;

    } catch (error: any) {
      logger.error('Token refresh error', {
        accountId: account._id,
        provider: account.provider,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Mark account as expired
   */
  async markAccountExpired(accountId: string, reason?: string): Promise<void> {
    try {
      await SocialAccount.findByIdAndUpdate(accountId, {
        status: AccountStatus.EXPIRED,
        ...(reason && { 'metadata.expiredReason': reason }),
        'metadata.expiredAt': new Date(),
      });

      logger.warn('Account marked as expired', {
        accountId,
        reason,
      });

    } catch (error: any) {
      logger.error('Failed to mark account as expired', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get accounts that need token refresh
   * Returns accounts expiring within the next 10 minutes
   */
  async getAccountsNeedingRefresh(): Promise<ISocialAccount[]> {
    try {
      const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

      const accounts = await SocialAccount.find({
        status: AccountStatus.ACTIVE,
        tokenExpiresAt: { $lt: tenMinutesFromNow },
      })
        .select('+accessToken +refreshToken')
        .sort({ tokenExpiresAt: 1 });

      return accounts;

    } catch (error: any) {
      logger.error('Failed to get accounts needing refresh', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PLACEHOLDER: Mock token refresh
   * In production, this would call the actual OAuth provider APIs
   */
  private async mockTokenRefresh(provider: string, refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    error?: string;
  }> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock successful refresh 90% of the time
    if (Math.random() < 0.9) {
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      return {
        success: true,
        accessToken: `mock_refreshed_token_${Date.now()}`,
        refreshToken: `mock_refresh_token_${Date.now()}`,
        expiresAt,
      };
    } else {
      // Mock failure
      return {
        success: false,
        error: 'Mock refresh failure - invalid refresh token',
      };
    }
  }

  /**
   * Validate token format (basic check)
   */
  isValidTokenFormat(token: string): boolean {
    return token && token.length > 10 && !token.includes(' ');
  }

  /**
   * Get token expiration info
   */
  getTokenExpirationInfo(account: ISocialAccount): {
    isExpired: boolean;
    expiresAt?: Date;
    expiresInMinutes?: number;
  } {
    if (!account.tokenExpiresAt) {
      return { isExpired: false };
    }

    const now = new Date();
    const isExpired = now >= account.tokenExpiresAt;
    const expiresInMinutes = Math.floor((account.tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60));

    return {
      isExpired,
      expiresAt: account.tokenExpiresAt,
      expiresInMinutes: isExpired ? 0 : expiresInMinutes,
    };
  }
}

export const tokenService = new TokenService();