/**
 * Analytics Collection Service
 * 
 * Extends analytics collection to include follower counts and competitor metrics
 * Used by AnalyticsCollectorWorker
 */

import { SocialAccount } from '../models/SocialAccount';
import { CompetitorAccount } from '../models/CompetitorAccount';
import { FollowerAnalyticsService } from './FollowerAnalyticsService';
import { CompetitorAnalyticsService } from './CompetitorAnalyticsService';
import { logger } from '../utils/logger';

export class AnalyticsCollectionService {
  /**
   * Collect follower count for a social account
   * Called by AnalyticsCollectorWorker when collecting account metrics
   */
  static async collectFollowerCount(
    accountId: string,
    followerCount: number
  ): Promise<void> {
    try {
      const account = await SocialAccount.findById(accountId);
      
      if (!account) {
        logger.warn('Account not found for follower collection', { accountId });
        return;
      }

      // Record follower snapshot
      await FollowerAnalyticsService.recordFollowerSnapshot(
        accountId,
        account.workspaceId.toString(),
        account.provider,
        followerCount
      );

      // Update current follower count in account metadata
      await SocialAccount.findByIdAndUpdate(accountId, {
        'metadata.followerCount': followerCount,
      });

      logger.debug('Follower count collected', {
        accountId,
        platform: account.provider,
        followerCount,
      });
    } catch (error: any) {
      // Don't throw - follower collection is supplementary
      logger.error('Collect follower count error:', {
        accountId,
        error: error.message,
      });
    }
  }

  /**
   * Collect metrics for all active competitors in a workspace
   * Should be called periodically (e.g., every 6 hours)
   */
  static async collectCompetitorMetrics(workspaceId: string): Promise<void> {
    try {
      // Get all active competitors for workspace
      const competitors = await CompetitorAccount.find({
        workspaceId,
        isActive: true,
      });

      if (competitors.length === 0) {
        logger.debug('No active competitors to collect', { workspaceId });
        return;
      }

      logger.info('Collecting competitor metrics', {
        workspaceId,
        competitorCount: competitors.length,
      });

      // Collect metrics for each competitor
      for (const competitor of competitors) {
        try {
          await this.collectSingleCompetitorMetrics(competitor);
        } catch (error: any) {
          logger.error('Failed to collect competitor metrics', {
            competitorId: competitor._id,
            handle: competitor.handle,
            platform: competitor.platform,
            error: error.message,
          });
          // Continue with next competitor
        }
      }

      logger.info('Competitor metrics collection completed', {
        workspaceId,
        competitorCount: competitors.length,
      });
    } catch (error: any) {
      logger.error('Collect competitor metrics error:', {
        workspaceId,
        error: error.message,
      });
    }
  }

  /**
   * Collect metrics for a single competitor
   */
  private static async collectSingleCompetitorMetrics(
    competitor: any
  ): Promise<void> {
    try {
      // Get platform adapter
      const adapter = await this.getCompetitorAdapter(competitor.platform);

      // Collect public metrics from platform
      const metrics = await adapter.collectPublicMetrics(competitor.handle);

      // Record metrics
      await CompetitorAnalyticsService.recordCompetitorMetrics(
        competitor._id.toString(),
        competitor.workspaceId.toString(),
        competitor.platform,
        metrics
      );

      logger.debug('Competitor metrics collected', {
        competitorId: competitor._id,
        handle: competitor.handle,
        platform: competitor.platform,
        followerCount: metrics.followerCount,
      });
    } catch (error: any) {
      logger.error('Collect single competitor metrics error:', {
        competitorId: competitor._id,
        handle: competitor.handle,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get competitor adapter for platform
   * Note: These adapters need to be implemented to fetch public profile data
   */
  private static async getCompetitorAdapter(platform: string): Promise<any> {
    // For now, return a mock adapter
    // In production, implement actual platform adapters for public data
    return {
      collectPublicMetrics: async (handle: string) => {
        logger.warn('Using mock competitor adapter', { platform, handle });
        
        // Mock data - replace with actual platform API calls
        return {
          followerCount: Math.floor(Math.random() * 10000),
          followingCount: Math.floor(Math.random() * 1000),
          postCount: Math.floor(Math.random() * 500),
          engagementRate: Math.random() * 10,
          avgLikes: Math.floor(Math.random() * 500),
          avgComments: Math.floor(Math.random() * 50),
          avgShares: Math.floor(Math.random() * 20),
        };
      },
    };

    // TODO: Implement actual platform adapters
    // switch (platform.toLowerCase()) {
    //   case 'twitter':
    //     const { TwitterCompetitorAdapter } = await import('../adapters/competitors/TwitterCompetitorAdapter');
    //     return new TwitterCompetitorAdapter();
    //   case 'instagram':
    //     const { InstagramCompetitorAdapter } = await import('../adapters/competitors/InstagramCompetitorAdapter');
    //     return new InstagramCompetitorAdapter();
    //   // ... other platforms
    //   default:
    //     throw new Error(`Unsupported platform: ${platform}`);
    // }
  }

  /**
   * Schedule follower collection for all active accounts in workspace
   */
  static async scheduleFollowerCollection(workspaceId: string): Promise<void> {
    try {
      const accounts = await SocialAccount.find({
        workspaceId,
        status: 'active',
      });

      logger.info('Scheduling follower collection', {
        workspaceId,
        accountCount: accounts.length,
      });

      for (const account of accounts) {
        const followerCount = account.metadata?.followerCount;
        
        if (typeof followerCount === 'number') {
          await this.collectFollowerCount(
            account._id.toString(),
            followerCount
          );
        }
      }
    } catch (error: any) {
      logger.error('Schedule follower collection error:', {
        workspaceId,
        error: error.message,
      });
    }
  }
}
