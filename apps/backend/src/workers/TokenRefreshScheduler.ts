/**
 * Enhanced Token Refresh Scheduler
 * 
 * Comprehensive token lifecycle management:
 * - Scans for expiring tokens using platform-specific thresholds
 * - Proactive refresh (7 days before expiry for most platforms)
 * - Automatic notifications for failed refreshes
 * - Health monitoring and reporting
 */

import { SocialAccount, AccountStatus } from '../models/SocialAccount';
import { tokenRefreshQueue } from '../queue/TokenRefreshQueue';
import { tokenLifecycleService } from '../services/TokenLifecycleService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class TokenRefreshScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Run every 6 hours for comprehensive token management
  private readonly POLL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly LIFECYCLE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  /**
   * Start scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Token refresh scheduler already running');
      return;
    }

    this.isRunning = true;

    // Run immediately
    this.runComprehensiveCheck();

    // Schedule periodic checks every 6 hours
    this.intervalId = setInterval(() => {
      this.runComprehensiveCheck();
    }, this.POLL_INTERVAL);

    logger.info('Enhanced token refresh scheduler started', {
      pollInterval: this.POLL_INTERVAL,
      lifecycleCheckInterval: this.LIFECYCLE_CHECK_INTERVAL,
    });
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Token refresh scheduler stopped');
  }

  /**
   * Run comprehensive token lifecycle check
   */
  private async runComprehensiveCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting comprehensive token lifecycle check');

      // Step 1: Run general lifecycle check (updates expired statuses)
      const lifecycleResults = await tokenLifecycleService.runLifecycleCheck();
      
      logger.info('Lifecycle check completed', lifecycleResults);

      // Step 2: Get accounts that need proactive refresh
      const expiringAccounts = await tokenLifecycleService.getExpiringAccounts();
      
      logger.info('Found accounts needing proactive refresh', {
        count: expiringAccounts.length,
      });

      // Step 3: Enqueue refresh jobs for expiring accounts
      let enqueued = 0;
      let failed = 0;

      for (const account of expiringAccounts) {
        try {
          const correlationId = crypto.randomBytes(8).toString('hex');

          // Add jitter to prevent thundering herd: ±30 minutes
          const jitterMs = Math.floor(Math.random() * 3600000) - 1800000; // -30min to +30min
          const delay = Math.max(0, jitterMs);

          await tokenRefreshQueue.addRefreshJob({
            connectionId: account._id.toString(),
            provider: account.provider,
            expiresAt: account.tokenExpiresAt!,
            correlationId,
          }, delay);

          enqueued++;

          logger.debug('Proactive refresh job enqueued', {
            connectionId: account._id.toString(),
            provider: account.provider,
            expiresAt: account.tokenExpiresAt,
            jitterMs: delay,
          });
        } catch (error: any) {
          failed++;
          logger.error('Failed to enqueue proactive refresh job', {
            connectionId: account._id.toString(),
            provider: account.provider,
            error: error.message,
          });
        }
      }

      // Step 4: Check for accounts that need immediate attention
      const expiredAccounts = await tokenLifecycleService.findExpiredAccounts();
      
      for (const account of expiredAccounts) {
        // Try to refresh expired tokens (last chance before marking for reconnect)
        try {
          const result = await tokenLifecycleService.refreshToken(account);
          
          if (!result.success && result.requiresReconnect) {
            await tokenLifecycleService.notifyTokenExpiry(account);
          }
        } catch (error: any) {
          logger.error('Failed to refresh expired token', {
            accountId: account._id,
            provider: account.provider,
            error: error.message,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Comprehensive token lifecycle check completed', {
        lifecycleResults,
        expiringAccounts: expiringAccounts.length,
        expiredAccounts: expiredAccounts.length,
        enqueued,
        failed,
        duration,
      });
    } catch (error: any) {
      logger.error('Comprehensive token lifecycle check failed', {
        error: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Force immediate comprehensive check (for testing and manual triggers)
   */
  async forceCheck(): Promise<void> {
    await this.runComprehensiveCheck();
  }

  /**
   * Legacy method for backward compatibility
   */
  async forceScan(): Promise<void> {
    await this.runComprehensiveCheck();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollInterval: this.POLL_INTERVAL,
      lifecycleCheckInterval: this.LIFECYCLE_CHECK_INTERVAL,
      nextCheckIn: this.intervalId ? this.POLL_INTERVAL : null,
    };
  }
}

export const tokenRefreshScheduler = new TokenRefreshScheduler();
