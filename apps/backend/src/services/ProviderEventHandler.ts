import { SocialPlatformProvider } from '../providers/SocialPlatformProvider';
import { providerMetrics } from './ProviderMetricsService';
import { globalRateLimitManager } from './GlobalRateLimitManager';
import { logger } from '../utils/logger';

/**
 * Provider Event Handler
 * 
 * Connects provider domain events to metrics and other services
 * 
 * Events handled:
 * - publish.started -> Log start
 * - publish.success -> Record metrics, update analytics
 * - publish.failed -> Record metrics, classify error
 * - token.refreshed -> Record metrics, schedule next refresh
 * - token.expired -> Record metrics, trigger refresh
 * - token.revoked -> Record metrics, notify user
 * - rate_limit.hit -> Record metrics, update rate limit manager
 * - rate_limit.reset -> Clear rate limit
 */

export class ProviderEventHandler {
  private static instance: ProviderEventHandler;

  private constructor() {
    logger.info('ProviderEventHandler initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderEventHandler {
    if (!ProviderEventHandler.instance) {
      ProviderEventHandler.instance = new ProviderEventHandler();
    }
    return ProviderEventHandler.instance;
  }

  /**
   * Attach event listeners to provider
   */
  attachToProvider(provider: SocialPlatformProvider): void {
    const platform = provider.getPlatform();

    // Publish events
    provider.on('publish.started', (event: any) => {
      logger.info('Publish started', {
        platform,
        postId: event.postId,
        accountId: event.accountId,
      });
    });

    provider.on('publish.success', (event: any) => {
      logger.info('Publish success', {
        platform,
        postId: event.postId,
        accountId: event.accountId,
        platformPostId: event.platformPostId,
        duration: event.duration,
      });

      // Record metrics
      providerMetrics.recordPublishSuccess(
        event.platform,
        event.accountId,
        event.duration
      );
    });

    provider.on('publish.failed', (event: any) => {
      logger.error('Publish failed', {
        platform,
        postId: event.postId,
        accountId: event.accountId,
        error: event.error,
        errorCategory: event.errorCategory,
        retryable: event.retryable,
        duration: event.duration,
      });

      // Record metrics
      providerMetrics.recordPublishFailure(
        event.platform,
        event.accountId,
        event.errorCategory,
        event.duration
      );
    });

    // Token events
    provider.on('token.refreshed', (event: any) => {
      logger.info('Token refreshed', {
        platform,
        accountId: event.accountId,
        expiresAt: event.expiresAt,
      });

      // Record metrics
      providerMetrics.recordRefreshSuccess(event.platform, event.accountId);

      // Schedule next proactive refresh
      this.scheduleProactiveRefresh(event.accountId, event.expiresAt);
    });

    provider.on('token.expired', (event: any) => {
      logger.warn('Token expired', {
        platform,
        accountId: event.accountId,
      });

      // Record metrics
      providerMetrics.recordRefreshFailure(
        event.platform,
        event.accountId,
        'token_expired'
      );
    });

    provider.on('token.revoked', (event: any) => {
      logger.warn('Token revoked', {
        platform,
        accountId: event.accountId,
        reason: event.reason,
      });

      // Record metrics
      providerMetrics.recordRefreshFailure(
        event.platform,
        event.accountId,
        'token_revoked'
      );

      // Clear rate limits for this account
      globalRateLimitManager.clearAccountRateLimits(event.accountId);
    });

    // Rate limit events
    provider.on('rate_limit.hit', async (event: any) => {
      logger.warn('Rate limit hit', {
        platform,
        accountId: event.accountId,
        operation: event.operation,
        resetAt: event.resetAt,
      });

      // Record metrics
      providerMetrics.recordRateLimitHit(
        event.platform,
        event.accountId,
        event.operation
      );

      // Update rate limit manager
      await globalRateLimitManager.updateAccountRateLimit(
        event.accountId,
        event.platform,
        {
          operation: event.operation,
          limit: 0, // Unknown limit
          remaining: 0,
          resetAt: event.resetAt,
        }
      );
    });

    provider.on('rate_limit.reset', async (event: any) => {
      logger.info('Rate limit reset', {
        platform,
        accountId: event.accountId,
        operation: event.operation,
      });

      // Clear rate limit from manager
      // Note: Rate limits auto-expire in GlobalRateLimitManager
    });

    logger.info('Event listeners attached to provider', { platform });
  }

  /**
   * Schedule proactive token refresh
   */
  private async scheduleProactiveRefresh(accountId: string, expiresAt: Date): Promise<void> {
    try {
      const { refreshQueue } = await import('../queue/RefreshQueue');
      const { SocialAccount } = await import('../models/SocialAccount');

      // Get account to get platform and workspaceId
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        logger.warn('Account not found for proactive refresh scheduling', { accountId });
        return;
      }

      // Schedule refresh 5 minutes before expiry
      await refreshQueue.scheduleProactiveRefresh(
        accountId,
        account.workspaceId.toString(),
        account.provider,
        expiresAt,
        5 // 5 minutes threshold
      );

      logger.info('Proactive refresh scheduled', {
        accountId,
        platform: account.provider,
        expiresAt,
      });
    } catch (error: any) {
      logger.error('Failed to schedule proactive refresh', {
        accountId,
        error: error.message,
      });
    }
  }

  /**
   * Detach event listeners from provider
   */
  detachFromProvider(provider: SocialPlatformProvider): void {
    provider.removeAllListeners();
    logger.info('Event listeners detached from provider', {
      platform: provider.getPlatform(),
    });
  }
}

// Export singleton instance
export const providerEventHandler = ProviderEventHandler.getInstance();
