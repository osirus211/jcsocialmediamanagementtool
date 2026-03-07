import { SocialAccount, ISocialAccount, AccountStatus } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { securityAuditService } from './SecurityAuditService';
import { SecurityEventType } from '../models/SecurityEvent';
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
}

export const tokenLifecycleService = new TokenLifecycleService();
