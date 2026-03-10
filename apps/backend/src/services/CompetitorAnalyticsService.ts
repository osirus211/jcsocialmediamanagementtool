/**
 * Competitor Analytics Service
 * 
 * Handles competitor tracking and performance analysis
 */

import { CompetitorAccount, ICompetitorAccount } from '../models/CompetitorAccount';
import { CompetitorMetrics, ICompetitorMetrics } from '../models/CompetitorMetrics';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface CompetitorComparisonData {
  competitor: {
    id: string;
    handle: string;
    platform: string;
  };
  metrics: {
    followerCount: number;
    engagementRate: number;
    postCount: number;
    avgLikes: number;
    avgComments: number;
  };
  growth: {
    followers: number;
    followersPercentage: number;
  };
}

export class CompetitorAnalyticsService {
  /**
   * Add competitor to track
   */
  static async addCompetitor(
    workspaceId: string,
    userId: string,
    platform: string,
    handle: string,
    displayName?: string
  ): Promise<ICompetitorAccount> {
    try {
      const competitor = new CompetitorAccount({
        workspaceId,
        platform,
        handle,
        displayName,
        profileUrl: this.buildProfileUrl(platform, handle),
        createdBy: userId,
        isActive: true,
      });

      await competitor.save();

      logger.info('Competitor added', {
        workspaceId,
        platform,
        handle,
      });

      return competitor;
    } catch (error: any) {
      // Handle duplicate competitor
      if (error.code === 11000) {
        throw new Error('Competitor already exists for this workspace');
      }

      logger.error('Add competitor error:', error);
      throw new Error(`Failed to add competitor: ${error.message}`);
    }
  }

  /**
   * Remove competitor
   */
  static async removeCompetitor(
    competitorId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const result = await CompetitorAccount.findOneAndUpdate(
        { _id: competitorId, workspaceId },
        { isActive: false },
        { new: true }
      );

      if (!result) {
        throw new Error('Competitor not found');
      }

      logger.info('Competitor removed', {
        competitorId,
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Remove competitor error:', error);
      throw new Error(`Failed to remove competitor: ${error.message}`);
    }
  }

  /**
   * Get competitors for workspace
   */
  static async getCompetitors(
    workspaceId: string,
    platform?: string,
    isActive: boolean = true
  ): Promise<ICompetitorAccount[]> {
    try {
      const query: any = { workspaceId, isActive };

      if (platform) {
        query.platform = platform;
      }

      const competitors = await CompetitorAccount.find(query)
        .sort({ createdAt: -1 })
        .lean();

      return competitors as ICompetitorAccount[];
    } catch (error: any) {
      logger.error('Get competitors error:', error);
      throw new Error(`Failed to get competitors: ${error.message}`);
    }
  }

  /**
   * Record competitor metrics snapshot
   */
  static async recordCompetitorMetrics(
    competitorId: string,
    workspaceId: string,
    platform: string,
    metrics: {
      followerCount: number;
      followingCount?: number;
      postCount?: number;
      engagementRate?: number;
      avgLikes?: number;
      avgComments?: number;
      avgShares?: number;
      platformData?: Record<string, any>;
    }
  ): Promise<ICompetitorMetrics> {
    try {
      const snapshot = new CompetitorMetrics({
        competitorId,
        workspaceId,
        platform,
        ...metrics,
        collectedAt: new Date(),
      });

      await snapshot.save();

      // Update lastCollectedAt on competitor
      await CompetitorAccount.findByIdAndUpdate(competitorId, {
        lastCollectedAt: new Date(),
      });

      logger.info('Competitor metrics recorded', {
        competitorId,
        platform,
        followerCount: metrics.followerCount,
      });

      // Fire webhook event for competitor metrics update
      try {
        const { webhookService, WebhookEventType } = await import('./WebhookService');
        await webhookService.sendWebhook({
          workspaceId,
          event: WebhookEventType.COMPETITOR_UPDATED,
          payload: {
            competitorId,
            platform,
            metrics: {
              followerCount: metrics.followerCount,
              followingCount: metrics.followingCount,
              postCount: metrics.postCount,
              engagementRate: metrics.engagementRate,
              avgLikes: metrics.avgLikes,
              avgComments: metrics.avgComments,
              avgShares: metrics.avgShares,
            },
            collectedAt: snapshot.collectedAt,
          },
        });
      } catch (webhookError: any) {
        logger.warn('Failed to send COMPETITOR_UPDATED webhook (non-blocking)', {
          competitorId,
          error: webhookError.message,
        });
      }

      return snapshot;
    } catch (error: any) {
      logger.error('Record competitor metrics error:', error);
      throw new Error(`Failed to record competitor metrics: ${error.message}`);
    }
  }

  /**
   * Get competitor metrics history
   */
  static async getCompetitorMetrics(
    competitorId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<ICompetitorMetrics[]> {
    try {
      const query: any = { competitorId };

      if (startDate || endDate) {
        query.collectedAt = {};
        if (startDate) query.collectedAt.$gte = startDate;
        if (endDate) query.collectedAt.$lte = endDate;
      }

      const metrics = await CompetitorMetrics.find(query)
        .sort({ collectedAt: -1 })
        .limit(limit)
        .lean();

      return metrics as ICompetitorMetrics[];
    } catch (error: any) {
      logger.error('Get competitor metrics error:', error);
      throw new Error(`Failed to get competitor metrics: ${error.message}`);
    }
  }

  /**
   * Get latest competitor metrics
   */
  static async getLatestCompetitorMetrics(
    competitorId: string
  ): Promise<ICompetitorMetrics | null> {
    try {
      const latest = await CompetitorMetrics.findOne({ competitorId })
        .sort({ collectedAt: -1 })
        .lean();

      return latest as ICompetitorMetrics | null;
    } catch (error: any) {
      logger.error('Get latest competitor metrics error:', error);
      return null;
    }
  }

  /**
   * Compare competitors
   */
  static async compareCompetitors(
    workspaceId: string,
    competitorIds: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<CompetitorComparisonData[]> {
    try {
      const comparisons: CompetitorComparisonData[] = [];

      for (const competitorId of competitorIds) {
        // Get competitor info
        const competitor = await CompetitorAccount.findOne({
          _id: competitorId,
          workspaceId,
        }).lean();

        if (!competitor) {
          continue;
        }

        // Get latest metrics
        const latest = await this.getLatestCompetitorMetrics(competitorId);

        if (!latest) {
          continue;
        }

        // Calculate growth
        const end = endDate || new Date();
        const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [earliest, latestInPeriod] = await Promise.all([
          CompetitorMetrics.findOne({
            competitorId,
            collectedAt: { $gte: start, $lte: end },
          })
            .sort({ collectedAt: 1 })
            .lean(),

          CompetitorMetrics.findOne({
            competitorId,
            collectedAt: { $gte: start, $lte: end },
          })
            .sort({ collectedAt: -1 })
            .lean(),
        ]);

        const followerGrowth = earliest && latestInPeriod
          ? latestInPeriod.followerCount - earliest.followerCount
          : 0;

        const followerGrowthPercentage = earliest && earliest.followerCount > 0
          ? (followerGrowth / earliest.followerCount) * 100
          : 0;

        comparisons.push({
          competitor: {
            id: competitor._id.toString(),
            handle: competitor.handle,
            platform: competitor.platform,
          },
          metrics: {
            followerCount: latest.followerCount,
            engagementRate: latest.engagementRate || 0,
            postCount: latest.postCount || 0,
            avgLikes: latest.avgLikes || 0,
            avgComments: latest.avgComments || 0,
          },
          growth: {
            followers: followerGrowth,
            followersPercentage: Math.round(followerGrowthPercentage * 10) / 10,
          },
        });
      }

      return comparisons;
    } catch (error: any) {
      logger.error('Compare competitors error:', error);
      throw new Error(`Failed to compare competitors: ${error.message}`);
    }
  }

  /**
   * Get competitor growth
   */
  static async getCompetitorGrowth(
    competitorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    followerGrowth: number;
    followerGrowthPercentage: number;
    period: { startDate: Date; endDate: Date };
  } | null> {
    try {
      const end = endDate || new Date();
      const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [earliest, latest] = await Promise.all([
        CompetitorMetrics.findOne({
          competitorId,
          collectedAt: { $gte: start, $lte: end },
        })
          .sort({ collectedAt: 1 })
          .lean(),

        CompetitorMetrics.findOne({
          competitorId,
          collectedAt: { $gte: start, $lte: end },
        })
          .sort({ collectedAt: -1 })
          .lean(),
      ]);

      if (!earliest || !latest) {
        return null;
      }

      const growth = latest.followerCount - earliest.followerCount;
      const growthPercentage = earliest.followerCount > 0
        ? (growth / earliest.followerCount) * 100
        : 0;

      return {
        followerGrowth: growth,
        followerGrowthPercentage: Math.round(growthPercentage * 10) / 10,
        period: { startDate: start, endDate: end },
      };
    } catch (error: any) {
      logger.error('Get competitor growth error:', error);
      return null;
    }
  }

  /**
   * Build profile URL from platform and handle
   */
  private static buildProfileUrl(platform: string, handle: string): string {
    const cleanHandle = handle.replace('@', '');

    switch (platform.toLowerCase()) {
      case 'twitter':
        return `https://twitter.com/${cleanHandle}`;
      case 'instagram':
        return `https://instagram.com/${cleanHandle}`;
      case 'linkedin':
        return `https://linkedin.com/in/${cleanHandle}`;
      case 'facebook':
        return `https://facebook.com/${cleanHandle}`;
      case 'tiktok':
        return `https://tiktok.com/@${cleanHandle}`;
      case 'youtube':
        return `https://youtube.com/@${cleanHandle}`;
      case 'threads':
        return `https://threads.net/@${cleanHandle}`;
      default:
        return '';
    }
  }
}
