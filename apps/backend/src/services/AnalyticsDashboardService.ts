/**
 * Analytics Dashboard Service
 * 
 * Provides aggregated analytics data for dashboard
 */

import { PostAnalytics } from '../models/PostAnalytics';
import { logger } from '../utils/logger';

export interface TopPost {
  postId: string;
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  engagementRate: number;
  collectedAt: Date;
}

export interface EngagementTrend {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  engagementRate: number;
}

export interface PlatformPerformance {
  platform: string;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  avgEngagementRate: number;
}

export class AnalyticsDashboardService {
  /**
   * Get top performing posts
   */
  async getTopPosts(params: {
    workspaceId: string;
    platform?: string;
    limit?: number;
    sortBy?: 'likes' | 'comments' | 'shares' | 'impressions' | 'engagementRate';
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<TopPost[]> {
    try {
      const {
        workspaceId,
        platform,
        limit = 10,
        sortBy = 'engagementRate',
        dateFrom,
        dateTo,
      } = params;

      const query: any = { workspaceId };

      if (platform) {
        query.platform = platform;
      }

      if (dateFrom || dateTo) {
        query.collectedAt = {};
        if (dateFrom) query.collectedAt.$gte = dateFrom;
        if (dateTo) query.collectedAt.$lte = dateTo;
      }

      // Get latest analytics for each post
      const analytics = await PostAnalytics.aggregate([
        { $match: query },
        { $sort: { postId: 1, collectionAttempt: -1 } },
        {
          $group: {
            _id: '$postId',
            postId: { $first: '$postId' },
            platform: { $first: '$platform' },
            likes: { $first: '$likes' },
            comments: { $first: '$comments' },
            shares: { $first: '$shares' },
            impressions: { $first: '$impressions' },
            engagementRate: { $first: '$engagementRate' },
            collectedAt: { $first: '$collectedAt' },
          },
        },
        { $sort: { [sortBy]: -1 } },
        { $limit: limit },
      ]);

      return analytics.map((a) => ({
        postId: a.postId.toString(),
        platform: a.platform,
        likes: a.likes,
        comments: a.comments,
        shares: a.shares,
        impressions: a.impressions,
        engagementRate: a.engagementRate,
        collectedAt: a.collectedAt,
      }));
    } catch (error: any) {
      logger.error('Failed to get top posts', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get engagement trends over time
   */
  async getEngagementTrends(params: {
    workspaceId: string;
    platform?: string;
    dateFrom: Date;
    dateTo: Date;
    interval?: 'day' | 'week' | 'month';
  }): Promise<EngagementTrend[]> {
    try {
      const { workspaceId, platform, dateFrom, dateTo, interval = 'day' } = params;

      const query: any = {
        workspaceId,
        collectedAt: { $gte: dateFrom, $lte: dateTo },
      };

      if (platform) {
        query.platform = platform;
      }

      // Group by date interval
      const dateFormat = interval === 'day' ? '%Y-%m-%d' : interval === 'week' ? '%Y-W%U' : '%Y-%m';

      const trends = await PostAnalytics.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$collectedAt' } },
            likes: { $sum: '$likes' },
            comments: { $sum: '$comments' },
            shares: { $sum: '$shares' },
            impressions: { $sum: '$impressions' },
            avgEngagementRate: { $avg: '$engagementRate' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return trends.map((t) => ({
        date: t._id,
        likes: t.likes,
        comments: t.comments,
        shares: t.shares,
        impressions: t.impressions,
        engagementRate: t.avgEngagementRate,
      }));
    } catch (error: any) {
      logger.error('Failed to get engagement trends', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get platform performance comparison
   */
  async getPlatformPerformance(params: {
    workspaceId: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<PlatformPerformance[]> {
    try {
      const { workspaceId, dateFrom, dateTo } = params;

      const query: any = { workspaceId };

      if (dateFrom || dateTo) {
        query.collectedAt = {};
        if (dateFrom) query.collectedAt.$gte = dateFrom;
        if (dateTo) query.collectedAt.$lte = dateTo;
      }

      const performance = await PostAnalytics.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$platform',
            totalPosts: { $sum: 1 },
            totalLikes: { $sum: '$likes' },
            totalComments: { $sum: '$comments' },
            totalShares: { $sum: '$shares' },
            totalImpressions: { $sum: '$impressions' },
            avgEngagementRate: { $avg: '$engagementRate' },
          },
        },
        { $sort: { totalImpressions: -1 } },
      ]);

      return performance.map((p) => ({
        platform: p._id,
        totalPosts: p.totalPosts,
        totalLikes: p.totalLikes,
        totalComments: p.totalComments,
        totalShares: p.totalShares,
        totalImpressions: p.totalImpressions,
        avgEngagementRate: p.avgEngagementRate,
      }));
    } catch (error: any) {
      logger.error('Failed to get platform performance', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get analytics summary for workspace
   */
  async getAnalyticsSummary(params: {
    workspaceId: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalImpressions: number;
    avgEngagementRate: number;
    topPlatform: string;
  }> {
    try {
      const { workspaceId, dateFrom, dateTo } = params;

      const query: any = { workspaceId };

      if (dateFrom || dateTo) {
        query.collectedAt = {};
        if (dateFrom) query.collectedAt.$gte = dateFrom;
        if (dateTo) query.collectedAt.$lte = dateTo;
      }

      const summary = await PostAnalytics.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalPosts: { $sum: 1 },
            totalLikes: { $sum: '$likes' },
            totalComments: { $sum: '$comments' },
            totalShares: { $sum: '$shares' },
            totalImpressions: { $sum: '$impressions' },
            avgEngagementRate: { $avg: '$engagementRate' },
          },
        },
      ]);

      // Get top platform
      const platformPerf = await this.getPlatformPerformance({ workspaceId, dateFrom, dateTo });
      const topPlatform = platformPerf[0]?.platform || 'none';

      return {
        totalPosts: summary[0]?.totalPosts || 0,
        totalLikes: summary[0]?.totalLikes || 0,
        totalComments: summary[0]?.totalComments || 0,
        totalShares: summary[0]?.totalShares || 0,
        totalImpressions: summary[0]?.totalImpressions || 0,
        avgEngagementRate: summary[0]?.avgEngagementRate || 0,
        topPlatform,
      };
    } catch (error: any) {
      logger.error('Failed to get analytics summary', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get post analytics history
   */
  async getPostAnalyticsHistory(postId: string): Promise<any[]> {
    try {
      const analytics = await PostAnalytics.find({ postId })
        .sort({ collectionAttempt: 1 })
        .lean();

      return analytics;
    } catch (error: any) {
      logger.error('Failed to get post analytics history', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }
}

export const analyticsDashboardService = new AnalyticsDashboardService();
