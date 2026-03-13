/**
 * Analytics Service
 * Handles analytics recording, aggregation, and calculations
 */

import { PostAnalytics, IPostAnalytics } from '../models/PostAnalytics';
import { Post } from '../models/Post';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface AnalyticsSnapshot {
  postId: string;
  platform: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves?: number;
}

export interface OverviewMetrics {
  totalImpressions: number;
  totalEngagement: number;
  engagementRate: number;
  totalPosts: number;
  bestPerformingPost: any;
  followerGrowth: number;
  postsPublished: number;
  growth: {
    impressions: number;
    engagement: number;
  };
}

export interface PlatformMetrics {
  platform: string;
  impressions: number;
  engagement: number;
  engagementRate: number;
  posts: number;
}

export interface GrowthMetrics {
  date: string;
  impressions: number;
  engagement: number;
  engagementRate: number;
}

export class AnalyticsService {
  /**
   * Record analytics snapshot for a post
   */
  static async recordSnapshot(
    workspaceId: string,
    snapshot: AnalyticsSnapshot
  ): Promise<IPostAnalytics> {
    try {
      const analytics = new PostAnalytics({
        workspaceId,
        postId: snapshot.postId,
        platform: snapshot.platform,
        impressions: snapshot.impressions,
        likes: snapshot.likes,
        comments: snapshot.comments,
        shares: snapshot.shares,
        clicks: snapshot.clicks,
        saves: snapshot.saves || 0,
        recordedAt: new Date(),
      });

      await analytics.save();
      
      logger.info('Analytics snapshot recorded', {
        workspaceId,
        postId: snapshot.postId,
        impressions: snapshot.impressions,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Record analytics error:', error);
      throw new Error(`Failed to record analytics: ${error.message}`);
    }
  }

  /**
   * Update metrics for a post (incremental)
   */
  static async updateMetrics(
    workspaceId: string,
    postId: string,
    updates: Partial<AnalyticsSnapshot>
  ): Promise<IPostAnalytics> {
    try {
      // Get latest analytics
      const latest = await PostAnalytics.findOne({ workspaceId, postId })
        .sort({ recordedAt: -1 });

      if (!latest) {
        throw new Error('No analytics found for post');
      }

      // Create new snapshot with updated values
      const newSnapshot: AnalyticsSnapshot = {
        postId,
        platform: latest.platform,
        impressions: updates.impressions ?? latest.impressions,
        likes: updates.likes ?? latest.likes,
        comments: updates.comments ?? latest.comments,
        shares: updates.shares ?? latest.shares,
        clicks: updates.clicks ?? latest.clicks,
        saves: updates.saves ?? latest.saves,
      };

      return await this.recordSnapshot(workspaceId, newSnapshot);
    } catch (error: any) {
      logger.error('Update metrics error:', error);
      throw new Error(`Failed to update metrics: ${error.message}`);
    }
  }

  /**
   * Get overview metrics for workspace
   */
  static async getOverviewMetrics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<OverviewMetrics> {
    try {
      const matchStage: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
      
      if (startDate || endDate) {
        matchStage.recordedAt = {};
        if (startDate) matchStage.recordedAt.$gte = startDate;
        if (endDate) matchStage.recordedAt.$lte = endDate;
      }

      // Get latest analytics for each post
      const latestAnalytics = await PostAnalytics.aggregate([
        { $match: matchStage },
        { $sort: { postId: 1, recordedAt: -1 } },
        {
          $group: {
            _id: '$postId',
            latest: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latest' } },
      ]);

      // Calculate totals
      const totalImpressions = latestAnalytics.reduce((sum, a) => sum + a.impressions, 0);
      const totalEngagement = latestAnalytics.reduce(
        (sum, a) => sum + a.likes + a.comments + a.shares + a.clicks + a.saves,
        0
      );
      const engagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;

      // Find best performing post
      const bestPerforming = latestAnalytics.reduce((best, current) => {
        const currentEngagement = current.likes + current.comments + current.shares + current.clicks + current.saves;
        const bestEngagement = best ? best.likes + best.comments + best.shares + best.clicks + best.saves : 0;
        return currentEngagement > bestEngagement ? current : best;
      }, null as any);

      // Calculate growth (compare with previous period)
      const growth = await this.calculateGrowth(workspaceId, startDate, endDate);

      return {
        totalImpressions,
        totalEngagement,
        engagementRate,
        totalPosts: latestAnalytics.length,
        bestPerformingPost: bestPerforming,
        followerGrowth: 0, // TODO: Implement follower growth calculation
        postsPublished: latestAnalytics.length,
        growth,
      };
    } catch (error: any) {
      logger.error('Get overview metrics error:', error);
      throw new Error(`Failed to get overview metrics: ${error.message}`);
    }
  }

  /**
   * Get platform comparison metrics
   */
  static async getPlatformMetrics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PlatformMetrics[]> {
    try {
      const matchStage: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
      
      if (startDate || endDate) {
        matchStage.recordedAt = {};
        if (startDate) matchStage.recordedAt.$gte = startDate;
        if (endDate) matchStage.recordedAt.$lte = endDate;
      }

      const platformMetrics = await PostAnalytics.aggregate([
        { $match: matchStage },
        { $sort: { postId: 1, recordedAt: -1 } },
        {
          $group: {
            _id: { postId: '$postId', platform: '$platform' },
            latest: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latest' } },
        {
          $group: {
            _id: '$platform',
            impressions: { $sum: '$impressions' },
            likes: { $sum: '$likes' },
            comments: { $sum: '$comments' },
            shares: { $sum: '$shares' },
            clicks: { $sum: '$clicks' },
            saves: { $sum: '$saves' },
            posts: { $sum: 1 },
          },
        },
        {
          $project: {
            platform: '$_id',
            impressions: 1,
            engagement: {
              $add: ['$likes', '$comments', '$shares', '$clicks', '$saves'],
            },
            engagementRate: {
              $cond: [
                { $gt: ['$impressions', 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $add: ['$likes', '$comments', '$shares', '$clicks', '$saves'] },
                        '$impressions',
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            posts: 1,
            _id: 0,
          },
        },
      ]);

      return platformMetrics;
    } catch (error: any) {
      logger.error('Get platform metrics error:', error);
      throw new Error(`Failed to get platform metrics: ${error.message}`);
    }
  }

  /**
   * Get growth metrics over time
   */
  static async getGrowthMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<GrowthMetrics[]> {
    try {
      const groupByFormat = interval === 'day' 
        ? '%Y-%m-%d' 
        : interval === 'week' 
        ? '%Y-W%U' 
        : '%Y-%m';

      const growthMetrics = await PostAnalytics.aggregate([
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            recordedAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $sort: { postId: 1, recordedAt: -1 } },
        {
          $group: {
            _id: { postId: '$postId', date: { $dateToString: { format: groupByFormat, date: '$recordedAt' } } },
            latest: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latest' } },
        {
          $group: {
            _id: { $dateToString: { format: groupByFormat, date: '$recordedAt' } },
            impressions: { $sum: '$impressions' },
            likes: { $sum: '$likes' },
            comments: { $sum: '$comments' },
            shares: { $sum: '$shares' },
            clicks: { $sum: '$clicks' },
            saves: { $sum: '$saves' },
          },
        },
        {
          $project: {
            date: '$_id',
            impressions: 1,
            engagement: {
              $add: ['$likes', '$comments', '$shares', '$clicks', '$saves'],
            },
            engagementRate: {
              $cond: [
                { $gt: ['$impressions', 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $add: ['$likes', '$comments', '$shares', '$clicks', '$saves'] },
                        '$impressions',
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            _id: 0,
          },
        },
        { $sort: { date: 1 } },
      ]);

      return growthMetrics;
    } catch (error: any) {
      logger.error('Get growth metrics error:', error);
      throw new Error(`Failed to get growth metrics: ${error.message}`);
    }
  }

  /**
   * Get analytics for specific post
   */
  static async getPostAnalytics(
    workspaceId: string,
    postId: string
  ): Promise<IPostAnalytics[]> {
    try {
      return await PostAnalytics.find({ workspaceId, postId })
        .sort({ recordedAt: 1 })
        .exec();
    } catch (error: any) {
      logger.error('Get post analytics error:', error);
      throw new Error(`Failed to get post analytics: ${error.message}`);
    }
  }

  /**
   * Calculate growth percentage
   */
  private static async calculateGrowth(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ impressions: number; engagement: number }> {
    try {
      if (!startDate || !endDate) {
        return { impressions: 0, engagement: 0 };
      }

      const periodDuration = endDate.getTime() - startDate.getTime();
      const previousStart = new Date(startDate.getTime() - periodDuration);
      const previousEnd = startDate;

      // Current period metrics
      const currentMetrics = await this.getOverviewMetrics(workspaceId, startDate, endDate);
      
      // Previous period metrics
      const previousMetrics = await this.getOverviewMetrics(workspaceId, previousStart, previousEnd);

      const impressionsGrowth = previousMetrics.totalImpressions > 0
        ? ((currentMetrics.totalImpressions - previousMetrics.totalImpressions) / previousMetrics.totalImpressions) * 100
        : 0;

      const engagementGrowth = previousMetrics.totalEngagement > 0
        ? ((currentMetrics.totalEngagement - previousMetrics.totalEngagement) / previousMetrics.totalEngagement) * 100
        : 0;

      return {
        impressions: Math.round(impressionsGrowth * 10) / 10,
        engagement: Math.round(engagementGrowth * 10) / 10,
      };
    } catch (error: any) {
      logger.error('Calculate growth error:', error);
      return { impressions: 0, engagement: 0 };
    }
  }

  /**
   * Generate mock analytics for a published post
   * Used until real platform APIs are integrated
   */
  static async generateMockAnalytics(
    workspaceId: string,
    postId: string,
    platform: string
  ): Promise<IPostAnalytics> {
    try {
      // Generate realistic mock metrics based on platform
      const baseMetrics = this.getMockMetricsForPlatform(platform);

      const snapshot: AnalyticsSnapshot = {
        postId,
        platform,
        impressions: baseMetrics.impressions,
        likes: baseMetrics.likes,
        comments: baseMetrics.comments,
        shares: baseMetrics.shares,
        clicks: baseMetrics.clicks,
        saves: baseMetrics.saves,
      };

      return await this.recordSnapshot(workspaceId, snapshot);
    } catch (error: any) {
      logger.error('Generate mock analytics error:', error);
      throw new Error(`Failed to generate mock analytics: ${error.message}`);
    }
  }

  /**
   * Get mock metrics based on platform
   */
  private static getMockMetricsForPlatform(platform: string) {
    const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    switch (platform) {
      case 'twitter':
        return {
          impressions: random(100, 5000),
          likes: random(5, 200),
          comments: random(0, 50),
          shares: random(0, 30),
          clicks: random(10, 150),
          saves: random(0, 20),
        };
      case 'linkedin':
        return {
          impressions: random(200, 10000),
          likes: random(10, 500),
          comments: random(2, 100),
          shares: random(1, 50),
          clicks: random(20, 300),
          saves: random(0, 30),
        };
      case 'facebook':
        return {
          impressions: random(150, 8000),
          likes: random(8, 400),
          comments: random(1, 80),
          shares: random(1, 40),
          clicks: random(15, 250),
          saves: random(0, 25),
        };
      case 'instagram':
        return {
          impressions: random(300, 15000),
          likes: random(20, 800),
          comments: random(3, 150),
          shares: random(0, 60),
          clicks: random(25, 400),
          saves: random(5, 100),
        };
      default:
        return {
          impressions: random(100, 5000),
          likes: random(5, 200),
          comments: random(0, 50),
          shares: random(0, 30),
          clicks: random(10, 150),
          saves: random(0, 20),
        };
    }
  }
}
