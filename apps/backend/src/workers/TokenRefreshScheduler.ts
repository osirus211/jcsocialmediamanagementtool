/**
 * Token Refresh Scheduler
 * 
 * Scans database for expiring tokens and enqueues refresh jobs
 * Phase 1: Minimal implementation (no dedup, no staggering)
 */

import { SocialAccount, AccountStatus } from '../models/SocialAccount';
import { tokenRefreshQueue } from '../queue/TokenRefreshQueue';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class TokenRefreshScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  private readonly POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly REFRESH_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

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
    this.scan();

    // Schedule periodic scans
    this.intervalId = setInterval(() => {
      this.scan();
    }, this.POLL_INTERVAL);

    logger.info('Token refresh scheduler started', {
      pollInterval: this.POLL_INTERVAL,
      refreshWindow: this.REFRESH_WINDOW,
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
   * Scan database for expiring tokens and enqueue jobs
   */
  private async scan(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Token refresh scan started');

      // Calculate refresh threshold (24 hours from now)
      const refreshThreshold = new Date(Date.now() + this.REFRESH_WINDOW);

      // Query accounts with tokens expiring within window
      const accounts = await SocialAccount.find({
        status: AccountStatus.ACTIVE,
        tokenExpiresAt: {
          $lt: refreshThreshold,
          $ne: null,
        },
      })
        .select('_id provider tokenExpiresAt')
        .sort({ tokenExpiresAt: 1 }) // Soonest expiry first
        .limit(10000); // Process max 10K per scan

      logger.info('Token refresh scan found accounts', {
        count: accounts.length,
        threshold: refreshThreshold,
      });

      // Enqueue refresh jobs with jitter (storm protection)
      let enqueued = 0;
      let failed = 0;

      for (const account of accounts) {
        try {
          const correlationId = crypto.randomBytes(8).toString('hex');

          // Add jitter: random delay ±10 minutes (±600,000 ms)
          const jitterMs = Math.floor(Math.random() * 1200000) - 600000; // -600000 to +600000
          const delay = Math.max(0, jitterMs); // Ensure non-negative

          await tokenRefreshQueue.addRefreshJob({
            connectionId: account._id.toString(),
            provider: account.provider,
            expiresAt: account.tokenExpiresAt!,
            correlationId,
          }, delay);

          enqueued++;

          logger.debug('Token refresh job enqueued with jitter', {
            connectionId: account._id.toString(),
            provider: account.provider,
            jitterMs: delay,
          });
        } catch (error: any) {
          failed++;
          logger.error('Failed to enqueue refresh job', {
            connectionId: account._id.toString(),
            provider: account.provider,
            error: error.message,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Token refresh scan completed', {
        total: accounts.length,
        enqueued,
        failed,
        duration,
      });
    } catch (error: any) {
      logger.error('Token refresh scan failed', {
        error: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Force immediate scan (for testing)
   */
  async forceScan(): Promise<void> {
    await this.scan();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollInterval: this.POLL_INTERVAL,
      refreshWindow: this.REFRESH_WINDOW,
    };
  }
}

export const tokenRefreshScheduler = new TokenRefreshScheduler();
