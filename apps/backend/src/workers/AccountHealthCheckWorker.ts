/**
 * Account Health Check Worker
 * 
 * Background worker to validate connected social accounts
 * 
 * Schedule: Daily
 * Logic:
 * - Find all ACTIVE accounts
 * - Validate token via lightweight API call
 * - Update status based on response:
 *   - 401/403 → REAUTH_REQUIRED
 *   - Permission error → PERMISSION_REVOKED
 *   - Token expiring soon → TOKEN_EXPIRING
 * - Log health check results
 */

import { SocialAccount, SocialPlatform, AccountStatus } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import axios from 'axios';

export class AccountHealthCheckWorker {
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private intervalId: NodeJS.Timeout | null = null;
  private readonly TOKEN_EXPIRING_THRESHOLD_DAYS = 7;

  /**
   * Start the health check worker
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Account health check worker already running');
      return;
    }

    logger.info('Starting account health check worker', {
      interval: this.CHECK_INTERVAL,
      expiringThreshold: this.TOKEN_EXPIRING_THRESHOLD_DAYS,
    });

    // Run immediately on start
    this.runHealthChecks().catch(error => {
      logger.error('Account health check worker initial run failed', {
        error: error.message,
      });
    });

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runHealthChecks().catch(error => {
        logger.error('Account health check worker run failed', {
          error: error.message,
        });
      });
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the health check worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Account health check worker stopped');
    }
  }

  /**
   * Run health checks on all active accounts
   */
  private async runHealthChecks(): Promise<void> {
    const startTime = Date.now();

    try {
      // Find all ACTIVE accounts (workspace-scoped via index)
      const accounts = await SocialAccount.find({
        status: AccountStatus.ACTIVE,
      }).select('+accessToken +workspaceId');

      if (accounts.length === 0) {
        logger.debug('No active accounts to health check');
        return;
      }

      logger.info('Running health checks on active accounts', {
        count: accounts.length,
      });

      let healthyCount = 0;
      let expiringCount = 0;
      let reauthCount = 0;
      let revokedCount = 0;

      for (const account of accounts) {
        try {
          const result = await this.checkAccount(account);
          
          switch (result) {
            case 'healthy':
              healthyCount++;
              break;
            case 'expiring':
              expiringCount++;
              break;
            case 'reauth':
              reauthCount++;
              break;
            case 'revoked':
              revokedCount++;
              break;
          }
        } catch (error: any) {
          logger.error('Failed to health check account', {
            accountId: account._id,
            platform: account.provider,
            error: error.message,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Account health check completed', {
        total: accounts.length,
        healthy: healthyCount,
        expiring: expiringCount,
        reauth: reauthCount,
        revoked: revokedCount,
        duration,
      });
    } catch (error: any) {
      logger.error('Account health check worker error', {
        error: error.message,
      });
    }
  }

  /**
   * Check a single account's health
   */
  private async checkAccount(account: any): Promise<'healthy' | 'expiring' | 'reauth' | 'revoked'> {
    try {
      // Check if token is expiring soon
      if (account.tokenExpiresAt) {
        const daysUntilExpiry = Math.floor(
          (new Date(account.tokenExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        if (daysUntilExpiry <= this.TOKEN_EXPIRING_THRESHOLD_DAYS && daysUntilExpiry > 0) {
          // Mark as expiring
          account.status = AccountStatus.TOKEN_EXPIRING;
          await account.save();

          logger.warn('Account token expiring soon', {
            accountId: account._id,
            platform: account.provider,
            daysUntilExpiry,
          });

          return 'expiring';
        }
      }

      // Validate token via lightweight API call
      const accessToken = account.getDecryptedAccessToken();
      const isValid = await this.validateToken(account.provider, accessToken);

      if (isValid) {
        // Token is valid, ensure status is ACTIVE
        if (account.status !== AccountStatus.ACTIVE) {
          account.status = AccountStatus.ACTIVE;
          await account.save();
        }

        logger.debug('Account health check passed', {
          accountId: account._id,
          platform: account.provider,
        });

        return 'healthy';
      } else {
        // Token validation failed
        return 'reauth';
      }
    } catch (error: any) {
      // Handle specific error codes
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Authentication/authorization failure
        account.status = AccountStatus.REAUTH_REQUIRED;
        await account.save();

        logger.warn('Account requires reauth', {
          accountId: account._id,
          platform: account.provider,
          statusCode: error.response.status,
        });

        return 'reauth';
      }

      if (error.message?.includes('permission') || error.message?.includes('revoked')) {
        // Permission revoked
        account.status = AccountStatus.PERMISSION_REVOKED;
        await account.save();

        logger.warn('Account permission revoked', {
          accountId: account._id,
          platform: account.provider,
          error: error.message,
        });

        return 'revoked';
      }

      // Unknown error, log but don't change status
      logger.error('Account health check error', {
        accountId: account._id,
        platform: account.provider,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Validate token via platform-specific lightweight API call
   */
  private async validateToken(platform: SocialPlatform, accessToken: string): Promise<boolean> {
    try {
      switch (platform) {
        case SocialPlatform.TWITTER:
          // Twitter: Verify credentials
          await axios.get('https://api.twitter.com/2/users/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          return true;

        case SocialPlatform.FACEBOOK:
          // Facebook: Debug token
          await axios.get('https://graph.facebook.com/v21.0/me', {
            params: {
              access_token: accessToken,
              fields: 'id',
            },
          });
          return true;

        case SocialPlatform.LINKEDIN:
          // LinkedIn: Get user info
          await axios.get('https://api.linkedin.com/v2/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          return true;

        default:
          logger.warn('Unknown platform for health check', { platform });
          return false;
      }
    } catch (error: any) {
      // Re-throw to be handled by checkAccount
      throw error;
    }
  }
}

export const accountHealthCheckWorker = new AccountHealthCheckWorker();
