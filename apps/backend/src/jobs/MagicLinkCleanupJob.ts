/**
 * Magic Link Cleanup Job
 * 
 * Periodically cleans up expired magic link tokens from the database
 * Runs every hour to maintain database hygiene
 */

import { MagicLinkService } from '../services/MagicLinkService';
import { logger } from '../utils/logger';

export class MagicLinkCleanupJob {
  private static readonly JOB_INTERVAL = 60 * 60 * 1000; // 1 hour
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the cleanup job
   */
  static start(): void {
    if (MagicLinkCleanupJob.intervalId) {
      logger.warn('Magic link cleanup job is already running');
      return;
    }

    // Run immediately on start
    MagicLinkCleanupJob.runCleanup();

    // Schedule recurring cleanup
    MagicLinkCleanupJob.intervalId = setInterval(
      MagicLinkCleanupJob.runCleanup,
      MagicLinkCleanupJob.JOB_INTERVAL
    );

    logger.info('Magic link cleanup job started', {
      intervalMinutes: MagicLinkCleanupJob.JOB_INTERVAL / (60 * 1000)
    });
  }

  /**
   * Stop the cleanup job
   */
  static stop(): void {
    if (MagicLinkCleanupJob.intervalId) {
      clearInterval(MagicLinkCleanupJob.intervalId);
      MagicLinkCleanupJob.intervalId = null;
      logger.info('Magic link cleanup job stopped');
    }
  }

  /**
   * Run the cleanup process
   */
  private static async runCleanup(): Promise<void> {
    try {
      logger.debug('Starting magic link cleanup');
      
      const cleanedCount = await MagicLinkService.cleanupExpiredTokens();
      
      if (cleanedCount > 0) {
        logger.info('Magic link cleanup completed', { cleanedCount });
      } else {
        logger.debug('Magic link cleanup completed - no expired tokens found');
      }
    } catch (error) {
      logger.error('Magic link cleanup job failed', { error });
    }
  }

  /**
   * Run cleanup manually (for testing or manual maintenance)
   */
  static async runManualCleanup(): Promise<number> {
    try {
      logger.info('Running manual magic link cleanup');
      const cleanedCount = await MagicLinkService.cleanupExpiredTokens();
      logger.info('Manual magic link cleanup completed', { cleanedCount });
      return cleanedCount;
    } catch (error) {
      logger.error('Manual magic link cleanup failed', { error });
      throw error;
    }
  }
}