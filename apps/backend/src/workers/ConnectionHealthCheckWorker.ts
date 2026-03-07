/**
 * Connection Health Check Worker
 * 
 * Runs every 10 minutes to check health of all social accounts
 * - Checks token expiration
 * - Checks recent API failures
 * - Checks publish error rate
 * - Updates connection status
 * - Triggers auto-recovery if needed
 */

import { SocialAccount } from '../models/SocialAccount';
import { PostPublishAttempt, AttemptStatus } from '../models/PostPublishAttempt';
import { ConnectionHealthService } from '../services/ConnectionHealthService';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { withSpan } from '../config/telemetry';

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

export enum ConnectionHealthState {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  DEGRADED = 'degraded',
  EXPIRED = 'expired',
  REAUTH_REQUIRED = 'reauth_required',
}

export class ConnectionHealthCheckWorker {
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private healthService: ConnectionHealthService;

  constructor() {
    const redis = getRedisClient();
    this.healthService = new ConnectionHealthService(redis);
  }

  /**
   * Start the health check worker
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Connection health check worker already running');
      return;
    }

    logger.info('Starting connection health check worker', {
      interval: CHECK_INTERVAL,
      intervalMinutes: CHECK_INTERVAL / 60000,
    });

    // Run immediately
    this.run();

    // Then run every 10 minutes
    this.intervalId = setInterval(() => {
      this.run();
    }, CHECK_INTERVAL);
  }

  /**
   * Stop the health check worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Connection health check worker stopped');
    }
  }

  /**
   * Run health check iteration
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Health check already running, skipping iteration');
      return;
    }

    this.isRunning = true;

    try {
      await withSpan('connection-health-check', async (span) => {
        // Get all active social accounts
        const accounts = await SocialAccount.find({
          status: { $in: ['active', 'warning', 'degraded'] },
        });

        span.setAttribute('accounts_count', accounts.length);

        logger.info('Running health check', {
          accountsCount: accounts.length,
        });

        let healthy = 0;
        let warning = 0;
        let degraded = 0;
        let expired = 0;
        let reauthRequired = 0;

        for (const account of accounts) {
          try {
            const state = await this.checkAccountHealth(account);

            switch (state) {
              case ConnectionHealthState.HEALTHY:
                healthy++;
                break;
              case ConnectionHealthState.WARNING:
                warning++;
                break;
              case ConnectionHealthState.DEGRADED:
                degraded++;
                break;
              case ConnectionHealthState.EXPIRED:
                expired++;
                break;
              case ConnectionHealthState.REAUTH_REQUIRED:
                reauthRequired++;
                break;
            }
          } catch (error: any) {
            logger.error('Failed to check account health', {
              accountId: account._id.toString(),
              error: error.message,
            });
          }
        }

        span.setAttribute('healthy_count', healthy);
        span.setAttribute('warning_count', warning);
        span.setAttribute('degraded_count', degraded);
        span.setAttribute('expired_count', expired);
        span.setAttribute('reauth_required_count', reauthRequired);

        logger.info('Health check complete', {
          total: accounts.length,
          healthy,
          warning,
          degraded,
          expired,
          reauthRequired,
        });
      });
    } catch (error: any) {
      logger.error('Health check iteration error', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check health of a single account
   */
  private async checkAccountHealth(account: any): Promise<ConnectionHealthState> {
    const accountId = account._id.toString();
    const platform = account.platform;

    // 1. Check token expiration
    const tokenState = await this.checkTokenExpiration(account);
    if (tokenState === ConnectionHealthState.EXPIRED) {
      await this.handleExpiredToken(account);
      return ConnectionHealthState.EXPIRED;
    }

    // 2. Check recent API failures
    const apiFailureRate = await this.checkApiFailures(account);

    // 3. Check publish error rate
    const publishErrorRate = await this.checkPublishErrors(account);

    // 4. Calculate health score
    const healthScore = await this.healthService.calculateHealthScore(platform, accountId);

    // 5. Determine state based on metrics
    let state: ConnectionHealthState;

    if (healthScore.score >= 80 && apiFailureRate < 5 && publishErrorRate < 5) {
      state = ConnectionHealthState.HEALTHY;
    } else if (healthScore.score >= 60 && apiFailureRate < 15 && publishErrorRate < 15) {
      state = ConnectionHealthState.WARNING;
    } else if (healthScore.score >= 40 && apiFailureRate < 30 && publishErrorRate < 30) {
      state = ConnectionHealthState.DEGRADED;
    } else {
      state = ConnectionHealthState.REAUTH_REQUIRED;
    }

    // 6. Update account status
    if (account.status !== state) {
      await this.updateAccountStatus(account, state, {
        healthScore: healthScore.score,
        apiFailureRate,
        publishErrorRate,
      });
    }

    return state;
  }

  /**
   * Check if token is expired or expiring soon
   */
  private async checkTokenExpiration(account: any): Promise<ConnectionHealthState> {
    if (!account.tokenExpiresAt) {
      return ConnectionHealthState.HEALTHY;
    }

    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry <= 0) {
      return ConnectionHealthState.EXPIRED;
    }

    if (hoursUntilExpiry <= 24) {
      return ConnectionHealthState.WARNING;
    }

    return ConnectionHealthState.HEALTHY;
  }

  /**
   * Check API failure rate in last 24 hours
   */
  private async checkApiFailures(account: any): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalAttempts, failedAttempts] = await Promise.all([
      PostPublishAttempt.countDocuments({
        socialAccountId: account._id,
        createdAt: { $gte: twentyFourHoursAgo },
      }),
      PostPublishAttempt.countDocuments({
        socialAccountId: account._id,
        status: AttemptStatus.FAILED,
        createdAt: { $gte: twentyFourHoursAgo },
      }),
    ]);

    if (totalAttempts === 0) return 0;

    return (failedAttempts / totalAttempts) * 100;
  }

  /**
   * Check publish error rate in last 7 days
   */
  private async checkPublishErrors(account: any): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalAttempts, failedAttempts] = await Promise.all([
      PostPublishAttempt.countDocuments({
        socialAccountId: account._id,
        createdAt: { $gte: sevenDaysAgo },
      }),
      PostPublishAttempt.countDocuments({
        socialAccountId: account._id,
        status: AttemptStatus.FAILED,
        createdAt: { $gte: sevenDaysAgo },
      }),
    ]);

    if (totalAttempts === 0) return 0;

    return (failedAttempts / totalAttempts) * 100;
  }

  /**
   * Handle expired token - trigger auto-recovery
   */
  private async handleExpiredToken(account: any): Promise<void> {
    logger.warn('Token expired, triggering auto-recovery', {
      accountId: account._id.toString(),
      platform: account.platform,
    });

    try {
      // Queue token refresh job using TokenRefreshQueue
      const { tokenRefreshQueue } = await import('../queue/TokenRefreshQueue');
      
      await tokenRefreshQueue.addRefreshJob({
        connectionId: account._id.toString(),
        provider: account.platform,
        expiresAt: account.tokenExpiresAt || new Date(),
        correlationId: `health-check-${Date.now()}`,
      });

      logger.info('Auto-recovery token refresh queued', {
        accountId: account._id.toString(),
      });
    } catch (error: any) {
      logger.error('Auto-recovery failed', {
        accountId: account._id.toString(),
        error: error.message,
      });

      // Mark as reauth required
      await this.updateAccountStatus(account, ConnectionHealthState.REAUTH_REQUIRED, {
        error: 'Token refresh failed',
        errorMessage: error.message,
      });
    }
  }

  /**
   * Update account status
   */
  private async updateAccountStatus(
    account: any,
    state: ConnectionHealthState,
    metadata: any
  ): Promise<void> {
    const previousStatus = account.status;

    account.status = state;
    account.healthMetadata = {
      ...metadata,
      lastChecked: new Date(),
      previousStatus,
    };
    await account.save();

    logger.info('Account status updated', {
      accountId: account._id.toString(),
      platform: account.platform,
      previousStatus,
      newStatus: state,
      metadata,
    });

    // Emit webhook event
    await this.emitWebhookEvent(account, state, previousStatus);
  }

  /**
   * Emit webhook event for status change
   */
  private async emitWebhookEvent(
    account: any,
    newState: ConnectionHealthState,
    previousState: string
  ): Promise<void> {
    try {
      const { webhookService } = await import('../services/WebhookService');

      let eventType: string;

      if (newState === ConnectionHealthState.DEGRADED && previousState !== ConnectionHealthState.DEGRADED) {
        eventType = 'connection.degraded';
      } else if (newState === ConnectionHealthState.HEALTHY && previousState !== ConnectionHealthState.HEALTHY) {
        eventType = 'connection.recovered';
      } else if (newState === ConnectionHealthState.EXPIRED || newState === ConnectionHealthState.REAUTH_REQUIRED) {
        eventType = 'connection.disconnected';
      } else {
        return; // No event for other transitions
      }

      await webhookService.emit({
        event: eventType,
        workspaceId: account.workspaceId.toString(),
        data: {
          accountId: account._id.toString(),
          platform: account.platform,
          status: newState,
          previousStatus: previousState,
          timestamp: new Date(),
        },
      });

      logger.info('Webhook event emitted', {
        event: eventType,
        accountId: account._id.toString(),
      });
    } catch (error: any) {
      logger.error('Failed to emit webhook event', {
        accountId: account._id.toString(),
        error: error.message,
      });
      // Don't throw - webhook failures shouldn't break health checks
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    intervalMinutes: number;
  } {
    return {
      running: !!this.intervalId,
      interval: CHECK_INTERVAL,
      intervalMinutes: CHECK_INTERVAL / 60000,
    };
  }

  /**
   * Force run health check (for testing)
   */
  async forceRun(): Promise<void> {
    await this.run();
  }
}

export const connectionHealthCheckWorker = new ConnectionHealthCheckWorker();
