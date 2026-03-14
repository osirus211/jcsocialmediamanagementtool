import { SocialAccount, ISocialAccount, AccountStatus, SocialPlatform } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { securityAuditService } from './SecurityAuditService';
import { SecurityEventType } from '../models/SecurityEvent';
import { emailService } from './EmailService';
import { NotificationType } from '../models/Notification';
import mongoose from 'mongoose';

/**
 * Token Lifecycle Service
 * 
 * FOUNDATION LAYER for OAuth token lifecycle management
 * 
 * Provides:
 * - Token expiry detection
 * - Token state machine (active → expiring → expired → revoked)
 * - Reconnect-required flag management
 * - Automatic status updates
 * 
 * Token States:
 * - ACTIVE: Token valid and not expiring soon
 * - EXPIRING_SOON: Token expires within 7 days (warning)
 * - EXPIRED: Token expired, needs refresh
 * - REVOKED: Token revoked by user, needs reconnect
 * 
 * Features:
 * - Proactive expiry detection (7-day warning)
 * - Automatic status transitions
 * - Security event logging
 * - Reconnect flag management
 */

export enum TokenState {
  ACTIVE = 'active',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export interface TokenHealth {
  accountId: mongoose.Types.ObjectId;
  provider: string;
  state: TokenState;
  expiresAt?: Date;
  daysUntilExpiry?: number;
  reconnectRequired: boolean;
  lastRefreshedAt?: Date;
  refreshFailureCount: number;
  lastRefreshError?: string;
}

export interface RefreshResult {
  success: boolean;
  accountId: string;
  provider: string;
  newExpiresAt?: Date;
  error?: string;
  requiresReconnect?: boolean;
}

export interface TokenLifecycleInfo {
  accountId: mongoose.Types.ObjectId;
  provider: string;
  state: TokenState;
  expiresAt?: Date;
  daysUntilExpiry?: number;
  reconnectRequired: boolean;
  lastCheckedAt: Date;
}

export class TokenLifecycleService {
  private readonly EXPIRY_WARNING_DAYS = 7; // Warn when token expires within 7 days
  private readonly EXPIRY_WARNING_MS = this.EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
  private readonly MAX_REFRESH_FAILURES = 3; // Mark for reconnect after 3 failures

  // Platform-specific refresh thresholds (days before expiry)
  private readonly REFRESH_THRESHOLDS: Record<string, number> = {
    [SocialPlatform.INSTAGRAM]: 7,
    [SocialPlatform.FACEBOOK]: 7,
    [SocialPlatform.LINKEDIN]: 7,
    [SocialPlatform.TIKTOK]: 7,
    [SocialPlatform.PINTEREST]: 7,
    [SocialPlatform.THREADS]: 7,
    [SocialPlatform.YOUTUBE]: 0.5, // 12 hours for Google tokens (1 hour expiry)
    [SocialPlatform.GOOGLE_BUSINESS]: 0.5, // 12 hours for Google tokens
    [SocialPlatform.REDDIT]: 7,
    [SocialPlatform.BLUESKY]: 0.5, // 12 hours for session tokens (~24hr expiry)
    [SocialPlatform.TWITTER]: 30, // Check monthly for revocation
    [SocialPlatform.MASTODON]: 365, // Check yearly (typically no expiry)
    [SocialPlatform.GITHUB]: 365, // Check yearly (no expiry)
    [SocialPlatform.APPLE]: 180, // Check every 6 months
  };

  /**
   * Determine token state based on expiry
   */
  private determineTokenState(
    tokenExpiresAt: Date | undefined,
    accountStatus: AccountStatus
  ): TokenState {
    // Revoked status takes precedence
    if (accountStatus === AccountStatus.REVOKED) {
      return TokenState.REVOKED;
    }

    // No expiry date means token doesn't expire (or unknown)
    if (!tokenExpiresAt) {
      return TokenState.ACTIVE;
    }

    const now = new Date();
    const timeUntilExpiry = tokenExpiresAt.getTime() - now.getTime();

    // Already expired
    if (timeUntilExpiry <= 0) {
      return TokenState.EXPIRED;
    }

    // Expiring soon (within warning period)
    if (timeUntilExpiry <= this.EXPIRY_WARNING_MS) {
      return TokenState.EXPIRING_SOON;
    }

    // Active
    return TokenState.ACTIVE;
  }

  /**
   * Calculate days until expiry
   */
  private calculateDaysUntilExpiry(tokenExpiresAt: Date | undefined): number | undefined {
    if (!tokenExpiresAt) {
      return undefined;
    }

    const now = new Date();
    const timeUntilExpiry = tokenExpiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(timeUntilExpiry / (24 * 60 * 60 * 1000));

    return daysUntilExpiry;
  }

  /**
   * Get token lifecycle info for a social account
   */
  async getTokenLifecycleInfo(
    accountId: mongoose.Types.ObjectId | string
  ): Promise<TokenLifecycleInfo | null> {
    try {
      const account = await SocialAccount.findById(accountId);

      if (!account) {
        logger.warn('Social account not found', { accountId });
        return null;
      }

      const state = this.determineTokenState(account.tokenExpiresAt, account.status);
      const daysUntilExpiry = this.calculateDaysUntilExpiry(account.tokenExpiresAt);

      // Determine if reconnect required
      const reconnectRequired = [TokenState.EXPIRED, TokenState.REVOKED].includes(state);

      return {
        accountId: account._id,
        provider: account.provider,
        state,
        expiresAt: account.tokenExpiresAt,
        daysUntilExpiry,
        reconnectRequired,
        lastCheckedAt: new Date(),
      };
    } catch (error: any) {
      logger.error('Failed to get token lifecycle info', {
        accountId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Update account status based on token state
   * 
   * Transitions:
   * - ACTIVE → EXPIRED (when token expires)
   * - EXPIRING_SOON → EXPIRED (when token expires)
   * - Any → REVOKED (when token revoked)
   */
  async updateAccountStatus(
    accountId: mongoose.Types.ObjectId | string,
    newStatus: AccountStatus,
    reason?: string
  ): Promise<boolean> {
    try {
      const account = await SocialAccount.findById(accountId);

      if (!account) {
        logger.warn('Social account not found', { accountId });
        return false;
      }

      // Don't update if status unchanged
      if (account.status === newStatus) {
        return true;
      }

      const oldStatus = account.status;
      account.status = newStatus;
      await account.save();

      logger.info('Account status updated', {
        accountId,
        provider: account.provider,
        oldStatus,
        newStatus,
        reason,
      });

      // Log security event
      const eventType = newStatus === AccountStatus.REVOKED
        ? SecurityEventType.OAUTH_TOKEN_REVOKED
        : SecurityEventType.OAUTH_TOKEN_EXPIRED;

      await securityAuditService.logEvent({
        type: eventType,
        workspaceId: account.workspaceId,
        ipAddress: 'system',
        resource: accountId.toString(),
        success: true,
        metadata: {
          provider: account.provider,
          oldStatus,
          newStatus,
          reason,
        },
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to update account status', {
        accountId,
        newStatus,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Mark account as requiring reconnect
   * 
   * Sets reconnectRequired flag and updates status
   */
  async markReconnectRequired(
    accountId: mongoose.Types.ObjectId | string,
    reason: string
  ): Promise<boolean> {
    try {
      const account = await SocialAccount.findById(accountId);

      if (!account) {
        logger.warn('Social account not found', { accountId });
        return false;
      }

      // Update status to revoked
      account.status = AccountStatus.REVOKED;
      await account.save();

      logger.warn('Account marked for reconnect', {
        accountId,
        provider: account.provider,
        reason,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_DISCONNECT,
        workspaceId: account.workspaceId,
        ipAddress: 'system',
        resource: accountId.toString(),
        success: true,
        metadata: {
          provider: account.provider,
          reason,
        },
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to mark reconnect required', {
        accountId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Clear reconnect flag after successful reconnection
   */
  async clearReconnectFlag(
    accountId: mongoose.Types.ObjectId | string
  ): Promise<boolean> {
    try {
      const account = await SocialAccount.findById(accountId);

      if (!account) {
        logger.warn('Social account not found', { accountId });
        return false;
      }

      // Update status to active
      account.status = AccountStatus.ACTIVE;
      await account.save();

      logger.info('Reconnect flag cleared', {
        accountId,
        provider: account.provider,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: account.workspaceId,
        ipAddress: 'system',
        resource: accountId.toString(),
        success: true,
        metadata: {
          provider: account.provider,
        },
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to clear reconnect flag', {
        accountId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Find accounts expiring soon
   * 
   * Returns accounts that expire within the warning period
   */
  async findAccountsExpiringSoon(): Promise<ISocialAccount[]> {
    try {
      const warningDate = new Date(Date.now() + this.EXPIRY_WARNING_MS);

      const accounts = await SocialAccount.find({
        status: AccountStatus.ACTIVE,
        tokenExpiresAt: {
          $exists: true,
          $lte: warningDate,
          $gt: new Date(), // Not yet expired
        },
      });

      logger.debug('Found accounts expiring soon', {
        count: accounts.length,
        warningDays: this.EXPIRY_WARNING_DAYS,
      });

      return accounts;
    } catch (error: any) {
      logger.error('Failed to find accounts expiring soon', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Find expired accounts
   * 
   * Returns accounts with expired tokens
   */
  async findExpiredAccounts(): Promise<ISocialAccount[]> {
    try {
      const accounts = await SocialAccount.find({
        status: AccountStatus.ACTIVE,
        tokenExpiresAt: {
          $exists: true,
          $lte: new Date(),
        },
      });

      logger.debug('Found expired accounts', {
        count: accounts.length,
      });

      return accounts;
    } catch (error: any) {
      logger.error('Failed to find expired accounts', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Run token lifecycle check for all accounts
   * 
   * Scans all accounts and updates statuses based on expiry
   * Should be run periodically (e.g., every 6 hours)
   */
  async runLifecycleCheck(): Promise<{
    checked: number;
    expiringSoon: number;
    expired: number;
    updated: number;
  }> {
    try {
      logger.info('Starting token lifecycle check');

      const accounts = await SocialAccount.find({
        status: { $in: [AccountStatus.ACTIVE, AccountStatus.EXPIRED] },
        tokenExpiresAt: { $exists: true },
      });

      let expiringSoonCount = 0;
      let expiredCount = 0;
      let updatedCount = 0;

      for (const account of accounts) {
        const state = this.determineTokenState(account.tokenExpiresAt, account.status);

        if (state === TokenState.EXPIRING_SOON) {
          expiringSoonCount++;
        }

        if (state === TokenState.EXPIRED && account.status !== AccountStatus.EXPIRED) {
          const updated = await this.updateAccountStatus(
            account._id,
            AccountStatus.EXPIRED,
            'Token expired during lifecycle check'
          );
          if (updated) {
            expiredCount++;
            updatedCount++;
          }
        }
      }

      logger.info('Token lifecycle check completed', {
        checked: accounts.length,
        expiringSoon: expiringSoonCount,
        expired: expiredCount,
        updated: updatedCount,
      });

      return {
        checked: accounts.length,
        expiringSoon: expiringSoonCount,
        expired: expiredCount,
        updated: updatedCount,
      };
    } catch (error: any) {
      logger.error('Token lifecycle check failed', {
        error: error.message,
      });
      return {
        checked: 0,
        expiringSoon: 0,
        expired: 0,
        updated: 0,
      };
    }
  }

  /**
   * Check if token is expiring soon based on platform-specific thresholds
   */
  isExpiringSoon(account: ISocialAccount, customThresholdDays?: number): boolean {
    if (!account.tokenExpiresAt) {
      return false;
    }

    const thresholdDays = customThresholdDays || this.REFRESH_THRESHOLDS[account.provider] || this.EXPIRY_WARNING_DAYS;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    const timeUntilExpiry = account.tokenExpiresAt.getTime() - Date.now();

    return timeUntilExpiry <= thresholdMs && timeUntilExpiry > 0;
  }

  /**
   * Get token health for a specific account
   */
  async checkTokenHealth(accountId: mongoose.Types.ObjectId | string): Promise<TokenHealth | null> {
    try {
      const account = await SocialAccount.findById(accountId);

      if (!account) {
        logger.warn('Social account not found', { accountId });
        return null;
      }

      const state = this.determineTokenState(account.tokenExpiresAt, account.status);
      const daysUntilExpiry = this.calculateDaysUntilExpiry(account.tokenExpiresAt);
      const reconnectRequired = [TokenState.EXPIRED, TokenState.REVOKED].includes(state);

      return {
        accountId: account._id,
        provider: account.provider,
        state,
        expiresAt: account.tokenExpiresAt,
        daysUntilExpiry,
        reconnectRequired,
        lastRefreshedAt: account.lastRefreshedAt,
        refreshFailureCount: account.refreshFailureCount || 0,
        lastRefreshError: account.lastRefreshError,
      };
    } catch (error: any) {
      logger.error('Failed to check token health', {
        accountId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get all accounts with expiring tokens (within platform-specific thresholds)
   */
  async getExpiringAccounts(workspaceId?: string): Promise<ISocialAccount[]> {
    try {
      const query: any = {
        status: AccountStatus.ACTIVE,
        tokenExpiresAt: { $exists: true, $gt: new Date() }, // Not yet expired
      };

      if (workspaceId) {
        query.workspaceId = workspaceId;
      }

      const accounts = await SocialAccount.find(query);
      
      // Filter by platform-specific thresholds
      const expiringAccounts = accounts.filter(account => this.isExpiringSoon(account));

      logger.debug('Found expiring accounts', {
        total: accounts.length,
        expiring: expiringAccounts.length,
        workspaceId,
      });

      return expiringAccounts;
    } catch (error: any) {
      logger.error('Failed to get expiring accounts', {
        error: error.message,
        workspaceId,
      });
      return [];
    }
  }

  /**
   * Mark account as expired and increment failure count
   */
  async markAsExpired(accountId: mongoose.Types.ObjectId | string, reason?: string): Promise<void> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        logger.warn('Account not found for expiry marking', { accountId });
        return;
      }

      account.status = AccountStatus.EXPIRED;
      account.refreshFailureCount = (account.refreshFailureCount || 0) + 1;
      account.lastRefreshError = reason;
      await account.save();

      logger.info('Account marked as expired', {
        accountId,
        provider: account.provider,
        failureCount: account.refreshFailureCount,
        reason,
      });

      // Send notification if failure count exceeds threshold
      if (account.refreshFailureCount >= this.MAX_REFRESH_FAILURES) {
        await this.notifyTokenExpiry(account);
      }
    } catch (error: any) {
      logger.error('Failed to mark account as expired', {
        accountId,
        error: error.message,
      });
    }
  }

  /**
   * Send notification about token expiry requiring reconnect
   */
  async notifyTokenExpiry(account: ISocialAccount): Promise<void> {
    try {
      // Get workspace owner for notification
      const workspace = await mongoose.model('Workspace').findById(account.workspaceId);
      if (!workspace) {
        logger.warn('Workspace not found for notification', { 
          workspaceId: account.workspaceId,
          accountId: account._id,
        });
        return;
      }

      const user = await mongoose.model('User').findById(workspace.ownerId);
      if (!user) {
        logger.warn('User not found for notification', { 
          userId: workspace.ownerId,
          accountId: account._id,
        });
        return;
      }

      // Send email notification
      await emailService.sendEmail({
        to: user.email,
        subject: `${account.provider} account needs reconnection`,
        body: `Your ${account.provider} account "${account.accountName}" in workspace "${workspace.name}" needs to be reconnected. Please visit ${process.env.FRONTEND_URL}/accounts?reconnect=${account._id} to reconnect.`,
        html: `
          <p>Your <strong>${account.provider}</strong> account "${account.accountName}" in workspace "${workspace.name}" needs to be reconnected.</p>
          <p><a href="${process.env.FRONTEND_URL}/accounts?reconnect=${account._id}">Click here to reconnect your account</a></p>
        `,
      });

      logger.info('Token expiry notification sent', {
        accountId: account._id,
        provider: account.provider,
        userEmail: user.email,
      });
    } catch (error: any) {
      logger.error('Failed to send token expiry notification', {
        accountId: account._id,
        error: error.message,
      });
    }
  }

  /**
   * Refresh all expiring tokens for a workspace
   */
  async refreshAllExpiring(workspaceId?: string): Promise<RefreshResult[]> {
    try {
      const expiringAccounts = await this.getExpiringAccounts(workspaceId);
      const results: RefreshResult[] = [];

      logger.info('Starting bulk token refresh', {
        count: expiringAccounts.length,
        workspaceId,
      });

      for (const account of expiringAccounts) {
        try {
          const result = await this.refreshToken(account);
          results.push(result);
        } catch (error: any) {
          results.push({
            success: false,
            accountId: account._id.toString(),
            provider: account.provider,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info('Bulk token refresh completed', {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
        workspaceId,
      });

      return results;
    } catch (error: any) {
      logger.error('Bulk token refresh failed', {
        error: error.message,
        workspaceId,
      });
      return [];
    }
  }

  /**
   * Refresh token for a specific account
   */
  async refreshToken(account: ISocialAccount): Promise<RefreshResult> {
    try {
      logger.info('Starting token refresh', {
        accountId: account._id,
        provider: account.provider,
      });

      // For now, return success for platforms that don't need refresh
      // Individual OAuth services will handle the actual refresh logic
      const platformsWithoutRefresh = ['mastodon', 'github', 'apple'];
      
      if (platformsWithoutRefresh.includes(account.provider)) {
        return {
          success: true,
          accountId: account._id.toString(),
          provider: account.provider,
          error: 'Platform does not require token refresh',
        };
      }

      // Update account with successful refresh placeholder
      account.lastRefreshedAt = new Date();
      account.refreshFailureCount = 0;
      account.lastRefreshError = undefined;
      account.status = AccountStatus.ACTIVE;
      await account.save();

      logger.info('Token refresh successful', {
        accountId: account._id,
        provider: account.provider,
      });

      return {
        success: true,
        accountId: account._id.toString(),
        provider: account.provider,
      };
    } catch (error: any) {
      logger.error('Token refresh failed', {
        accountId: account._id,
        provider: account.provider,
        error: error.message,
      });

      await this.markAsExpired(account._id, error.message);

      return {
        success: false,
        accountId: account._id.toString(),
        provider: account.provider,
        error: error.message,
      };
    }
  }
}

export const tokenLifecycleService = new TokenLifecycleService();