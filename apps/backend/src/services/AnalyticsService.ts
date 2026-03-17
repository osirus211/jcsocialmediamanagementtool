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
        collectedAt: new Date(),
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
        .sort({ collectedAt: -1 });

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
      // Get base metrics for the current period
      const currentMetrics = await this.getBaseMetrics(workspaceId, startDate, endDate);

      // Calculate growth (compare with previous period)
      const growth = await this.calculateGrowth(workspaceId, startDate, endDate);

      return {
        ...currentMetrics,
        growth,
      };
    } catch (error: any) {
      logger.error('Get overview metrics error:', error);
      throw new Error(`Failed to get overview metrics: ${error.message}`);
    }
  }

  /**
   * Get base metrics without growth (to avoid recursion)
   */
  private static async getBaseMetrics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Omit<OverviewMetrics, 'growth'>> {
    const matchStage: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
    
    if (startDate || endDate) {
      matchStage.collectedAt = {};
      if (startDate) matchStage.collectedAt.$gte = startDate;
      if (endDate) matchStage.collectedAt.$lte = endDate;
    }

    // Get latest analytics for each post
    const latestAnalytics = await PostAnalytics.aggregate([
      { $match: matchStage },
      { $sort: { postId: 1, collectedAt: -1 } },
      {
        $group: {
          _id: '$postId',
          latest: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$latest' } },
    ]);

    // Calculate totals
    const totalReach = latestAnalytics.reduce((sum, a) => sum + a.reach, 0);
    const totalEngagement = latestAnalytics.reduce(
      (sum, a) => sum + (a.likes || 0) + (a.comments || 0) + (a.shares || 0) + (a.clicks || 0) + (a.saves || 0),
      0
    );
    const engagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;

    // Find best performing post
    const bestPerforming = latestAnalytics.reduce((best, current) => {
      const currentEngagement = (current.likes || 0) + (current.comments || 0) + (current.shares || 0) + (current.clicks || 0) + (current.saves || 0);
      const bestEngagement = best ? (best.likes || 0) + (best.comments || 0) + (best.shares || 0) + (best.clicks || 0) + (best.saves || 0) : 0;
      return currentEngagement > bestEngagement ? current : best;
    }, null as any);

    return {
      totalImpressions,
      totalEngagement,
      engagementRate,
      totalPosts: latestAnalytics.length,
      bestPerformingPost: bestPerforming,
      followerGrowth: 0,
      postsPublished: latestAnalytics.length,
    };
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
        matchStage.collectedAt = {};
        if (startDate) matchStage.collectedAt.$gte = startDate;
        if (endDate) matchStage.collectedAt.$lte = endDate;
      }

      const platformMetrics = await PostAnalytics.aggregate([
        { $match: matchStage },
        { $sort: { postId: 1, collectedAt: -1 } },
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
            collectedAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $sort: { postId: 1, collectedAt: -1 } },
        {
          $group: {
            _id: { postId: '$postId', date: { $dateToString: { format: groupByFormat, date: '$collectedAt' } } },
            latest: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latest' } },
        {
          $group: {
            _id: { $dateToString: { format: groupByFormat, date: '$collectedAt' } },
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
        .sort({ collectedAt: 1 })
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
      const currentMetrics = await this.getBaseMetrics(workspaceId, startDate, endDate);
      
      // Previous period metrics
      const previousMetrics = await this.getBaseMetrics(workspaceId, previousStart, previousEnd);

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
   * Get summary KPI metrics with previous period comparison
   */
  static async getSummaryMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    platforms?: string[]
  ): Promise<{
    reach: { current: number; previous: number; percentageChange: number };
    engagement: { current: number; previous: number; percentageChange: number };
    followerGrowth: { current: number; previous: number; percentageChange: number };
    postsPublished: { current: number; previous: number; percentageChange: number };
  }> {
    try {
      const buildMatchStage = (start: Date, end: Date) => {
        const match: any = {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          collectedAt: { $gte: start, $lte: end }
        };
        if (platforms && platforms.length > 0) {
          match.platform = { $in: platforms };
        }
        return match;
      };

      // Get current period metrics
      const currentMetrics = await this.getBaseMetrics(workspaceId, startDate, endDate);
      const previousMetrics = await this.getBaseMetrics(workspaceId, previousStartDate, previousEndDate);

      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100 * 10) / 10;
      };

      return {
        reach: {
          current: currentMetrics.totalImpressions,
          previous: previousMetrics.totalImpressions,
          percentageChange: calculateChange(currentMetrics.totalImpressions, previousMetrics.totalImpressions)
        },
        engagement: {
          current: currentMetrics.totalEngagement,
          previous: previousMetrics.totalEngagement,
          percentageChange: calculateChange(currentMetrics.totalEngagement, previousMetrics.totalEngagement)
        },
        followerGrowth: {
          current: 0, // TODO: Implement follower tracking
          previous: 0,
          percentageChange: 0
        },
        postsPublished: {
          current: currentMetrics.postsPublished,
          previous: previousMetrics.postsPublished,
          percentageChange: calculateChange(currentMetrics.postsPublished, previousMetrics.postsPublished)
        }
      };
    } catch (error: any) {
      logger.error('Get summary metrics error:', error);
      throw new Error(`Failed to get summary metrics: ${error.message}`);
    }
  }

  /**
   * Get follower growth data by date and platform
   */
  static async getFollowerGrowthData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<Array<{ date: string; platform: string; followerCount: number }>> {
    try {
      // TODO: Implement actual follower tracking
      // For now, return mock data
      const data: Array<{ date: string; platform: string; followerCount: number }> = [];
      const platformList = platforms || ['twitter', 'facebook', 'instagram', 'linkedin'];
      
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        platformList.forEach(platform => {
          data.push({
            date: currentDate.toISOString().split('T')[0],
            platform,
            followerCount: Math.floor(Math.random() * 1000) + 500
          });
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return data;
    } catch (error: any) {
      logger.error('Get follower growth data error:', error);
      throw new Error(`Failed to get follower growth data: ${error.message}`);
    }
  }

  /**
   * Get engagement data grouped by day or platform
   */
  static async getEngagementData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[],
    groupBy: 'day' | 'platform' = 'day'
  ): Promise<Array<any>> {
    try {
      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        collectedAt: { $gte: startDate, $lte: endDate }
      };

      if (platforms && platforms.length > 0) {
        matchStage.platform = { $in: platforms };
      }

      if (groupBy === 'day') {
        return await PostAnalytics.aggregate([
          { $match: matchStage },
          { $sort: { postId: 1, collectedAt: -1 } },
          {
            $group: {
              _id: { postId: '$postId', date: { $dateToString: { format: '%Y-%m-%d', date: '$collectedAt' } } },
              latest: { $first: '$ROOT' }
            }
          },
          { $replaceRoot: { newRoot: '$latest' } },
          {
            $group: {
              _id: { 
                date: { $dateToString: { format: '%Y-%m-%d', date: '$collectedAt' } },
                platform: '$platform'
              },
              likes: { $sum: '$likes' },
              comments: { $sum: '$comments' },
              shares: { $sum: '$shares' },
              saves: { $sum: '$saves' },
              total: { $sum: { $add: ['$likes', '$comments', '$shares', '$saves'] } }
            }
          },
          {
            $group: {
              _id: '$_id.date',
              platforms: {
                $push: {
                  platform: '$_id.platform',
                  likes: '$likes',
                  comments: '$comments',
                  shares: '$shares',
                  saves: '$saves',
                  total: '$total'
                }
              },
              totalLikes: { $sum: '$likes' },
              totalComments: { $sum: '$comments' },
              totalShares: { $sum: '$shares' },
              totalSaves: { $sum: '$saves' },
              total: { $sum: '$total' }
            }
          },
          {
            $project: {
              date: '$_id',
              platforms: 1,
              likes: '$totalLikes',
              comments: '$totalComments',
              shares: '$totalShares',
              saves: '$totalSaves',
              total: 1,
              _id: 0
            }
          },
          { $sort: { date: 1 } }
        ]);
      } else {
        return await PostAnalytics.aggregate([
          { $match: matchStage },
          { $sort: { postId: 1, collectedAt: -1 } },
          {
            $group: {
              _id: '$postId',
              latest: { $first: '$ROOT' }
            }
          },
          { $replaceRoot: { newRoot: '$latest' } },
          {
            $group: {
              _id: '$platform',
              likes: { $sum: '$likes' },
              comments: { $sum: '$comments' },
              shares: { $sum: '$shares' },
              saves: { $sum: '$saves' },
              total: { $sum: { $add: ['$likes', '$comments', '$shares', '$saves'] } }
            }
          },
          {
            $project: {
              platform: '$_id',
              likes: 1,
              comments: 1,
              shares: 1,
              saves: 1,
              total: 1,
              _id: 0
            }
          },
          { $sort: { total: -1 } }
        ]);
      }
    } catch (error: any) {
      logger.error('Get engagement data error:', error);
      throw new Error(`Failed to get engagement data: ${error.message}`);
    }
  }

  /**
   * Get top performing posts with sorting
   */
  static async getTopPostsData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[],
    sortBy: string = 'engagementRate',
    sortDir: 'asc' | 'desc' = 'desc',
    limit: number = 10
  ): Promise<Array<any>> {
    try {
      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        collectedAt: { $gte: startDate, $lte: endDate }
      };

      if (platforms && platforms.length > 0) {
        matchStage.platform = { $in: platforms };
      }

      const sortStage: any = {};
      sortStage[sortBy] = sortDir === 'desc' ? -1 : 1;

      return await PostAnalytics.aggregate([
        { $match: matchStage },
        { $sort: { postId: 1, collectedAt: -1 } },
        {
          $group: {
            _id: '$postId',
            latest: { $first: '$ROOT' }
          }
        },
        { $replaceRoot: { newRoot: '$latest' } },
        {
          $lookup: {
            from: 'posts',
            localField: 'postId',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: '$post' },
        {
          $addFields: {
            // Use the engagementRate already calculated by the model (uses reach)
            // Don't recalculate here to avoid duplication
            reach: '$impressions' // For backward compatibility, map impressions to reach
          }
        },
        {
          $project: {
            postId: '$postId',
            platform: 1,
            thumbnail: '$post.media.0.url',
            publishedAt: '$post.publishedAt',
            likes: 1,
            comments: 1,
            shares: 1,
            saves: 1,
            reach: 1,
            engagementRate: 1,
            _id: 0
          }
        },
        { $sort: sortStage },
        { $limit: limit }
      ]);
    } catch (error: any) {
      logger.error('Get top posts data error:', error);
      throw new Error(`Failed to get top posts data: ${error.message}`);
    }
  }

  /**
   * Get platform comparison data
   */
  static async getPlatformComparisonData(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<any>> {
    try {
      const matchStage = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        collectedAt: { $gte: startDate, $lte: endDate }
      };

      const results = await PostAnalytics.aggregate([
        { $match: matchStage },
        { $sort: { postId: 1, collectedAt: -1 } },
        {
          $group: {
            _id: '$postId',
            latest: { $first: '$ROOT' }
          }
        },
        { $replaceRoot: { newRoot: '$latest' } },
        {
          $group: {
            _id: '$platform',
            followers: { $first: 1000 }, // TODO: Get actual follower count
            followerGrowth: { $first: 50 }, // TODO: Calculate actual growth
            posts: { $sum: 1 },
            reach: { $sum: '$impressions' },
            engagement: { $sum: { $add: ['$likes', '$comments', '$shares', '$saves'] } },
            totalImpressions: { $sum: '$impressions' },
            bestPostingHour: { $first: 14 } // TODO: Calculate from actual data
          }
        },
        {
          $project: {
            platform: '$_id',
            followers: 1,
            followerGrowth: 1,
            posts: 1,
            reach: 1,
            engagement: 1,
            engagementRate: {
              $cond: [
                { $gt: ['$totalImpressions', 0] },
                {
                  $multiply: [
                    { $divide: ['$engagement', '$totalImpressions'] },
                    100
                  ]
                },
                0
              ]
            },
            bestPostingHour: 1,
            lastSyncedAt: { $literal: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000) }, // Mock: random time within last 2 hours
            _id: 0
          }
        },
        { $sort: { engagement: -1 } }
      ]);

      return results;
    } catch (error: any) {
      logger.error('Get platform comparison data error:', error);
      throw new Error(`Failed to get platform comparison data: ${error.message}`);
    }
  }

  /**
   * Generate PDF report
   */
  /**
   * Calculate performance score for a post (0-100)
   * Formula: weighted sum of normalized metrics vs account averages
   */
  static async calculatePerformanceScore(
    workspaceId: string,
    postAnalytics: any,
    platform: string
  ): Promise<number> {
    try {
      // Get account averages for this platform in the workspace
      const { PostAnalytics } = await import('../models/PostAnalytics');
      const mongoose = await import('mongoose');

      const accountAverages = await PostAnalytics.aggregate([
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            platform,
            reach: { $gt: 0 }, // Only posts with reach data
            collectedAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
          }
        },
        {
          $group: {
            _id: null,
            avgEngagementRate: { $avg: '$engagementRate' },
            avgReach: { $avg: '$reach' },
            avgImpressions: { $avg: '$impressions' },
            avgSaves: { $avg: '$saves' }
          }
        }
      ]);

      if (!accountAverages.length) {
        // No historical data, return neutral score
        return 50;
      }

      const averages = accountAverages[0];
      
      // Weights for performance score calculation
      const weights = {
        engagementRate: 0.40, // 40%
        reach: 0.25,          // 25%
        impressions: 0.20,    // 20%
        saves: 0.15           // 15%
      };

      let score = 0;

      // Normalize and weight each metric
      if (averages.avgEngagementRate > 0) {
        const engagementRatio = Math.min(postAnalytics.engagementRate / averages.avgEngagementRate, 3); // Cap at 3x
        score += engagementRatio * weights.engagementRate * 100;
      }

      if (averages.avgReach > 0) {
        const reachRatio = Math.min(postAnalytics.reach / averages.avgReach, 3);
        score += reachRatio * weights.reach * 100;
      }

      if (averages.avgImpressions > 0) {
        const impressionsRatio = Math.min(postAnalytics.impressions / averages.avgImpressions, 3);
        score += impressionsRatio * weights.impressions * 100;
      }

      if (averages.avgSaves > 0 && postAnalytics.saves > 0) {
        const savesRatio = Math.min(postAnalytics.saves / averages.avgSaves, 3);
        score += savesRatio * weights.saves * 100;
      } else if (averages.avgSaves === 0) {
        // If no historical saves data, give neutral score for this component
        score += weights.saves * 50;
      }

      // Clamp score to 0-100 range
      return Math.max(0, Math.min(100, Math.round(score)));
    } catch (error) {
      logger.error('Error calculating performance score:', error);
      return 50; // Return neutral score on error
    }
  }

  /**
   * Get suggestion for underperforming post
   */
  static getSuggestion(post: any): string {
    const suggestions = [
      'Try posting at a different time',
      'Add more hashtags to increase discoverability',
      'Use an image for higher engagement',
      'Ask a question to encourage comments',
      'Include a call-to-action',
      'Post when your audience is most active'
    ];

    // Simple rule-based suggestions
    if (post.engagementRate < 1) {
      return 'Try posting at a different time';
    }
    if (post.reach < 100) {
      return 'Add more hashtags to increase discoverability';
    }
    if (post.comments === 0) {
      return 'Ask a question to encourage comments';
    }
    if (post.saves === 0 && post.platform === 'instagram') {
      return 'Create more saveable content like tips or tutorials';
    }
    
    // Random suggestion as fallback
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  /**
   * Get posts with all metrics and performance scores
   */
  static async getPostsWithMetrics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
    platforms?: string[],
    sortBy: string = 'engagementRate',
    sortDir: string = 'desc',
    limit?: number
  ): Promise<any[]> {
    try {
      const { PostAnalytics } = await import('../models/PostAnalytics');
      const { ScheduledPost } = await import('../models/ScheduledPost');
      const mongoose = await import('mongoose');

      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (startDate || endDate) {
        matchStage.collectedAt = {};
        if (startDate) matchStage.collectedAt.$gte = startDate;
        if (endDate) matchStage.collectedAt.$lte = endDate;
      }

      if (platforms && platforms.length > 0) {
        matchStage.platform = { $in: platforms };
      }

      const sortDirection = sortDir === 'asc' ? 1 : -1;
      const sortStage: any = {};
      sortStage[sortBy] = sortDirection;

      const pipeline: any[] = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'scheduledposts',
            localField: 'postId',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: '$post' },
        {
          $project: {
            postId: 1,
            platform: 1,
            likes: 1,
            comments: 1,
            shares: 1,
            reach: 1,
            impressions: 1,
            saves: 1,
            engagementRate: 1,
            performanceScore: 1,
            collectedAt: 1,
            publishedAt: '$post.publishedAt',
            content: '$post.content',
            mediaUrls: '$post.mediaUrls'
          }
        },
        { $sort: sortStage }
      ];

      if (limit) {
        pipeline.push({ $limit: limit });
      }

      const posts = await PostAnalytics.aggregate(pipeline);

      // Calculate performance scores for posts that don't have them
      for (const post of posts) {
        if (!post.performanceScore) {
          post.performanceScore = await this.calculatePerformanceScore(
            workspaceId,
            post,
            post.platform
          );
          
          // Update the database with the calculated score
          await PostAnalytics.findByIdAndUpdate(post._id, {
            performanceScore: post.performanceScore
          });
        }
      }

      return posts;
    } catch (error) {
      logger.error('Error getting posts with metrics:', error);
      return [];
    }
  }

  static async generatePDFReport(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<Buffer> {
    try {
      const PDFDocument = require('pdfkit');
      
      // Get all data for the report
      const [summary, followerGrowth, engagement, topPosts, platformComparison] = await Promise.all([
        this.getSummaryMetrics(workspaceId, startDate, endDate, 
          new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())), 
          new Date(startDate), platforms),
        this.getFollowerGrowthData(workspaceId, startDate, endDate, platforms),
        this.getEngagementData(workspaceId, startDate, endDate, platforms, 'platform'),
        this.getTopPostsData(workspaceId, startDate, endDate, platforms, 'engagementRate', 'desc', 10),
        this.getPlatformComparisonData(workspaceId, startDate, endDate)
      ]);

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Cover page
        doc.fontSize(20).text('Analytics Report', { align: 'center' });
        doc.fontSize(12).text(`Workspace: ${workspaceId}`, { align: 'center' });
        doc.text(`${startDate.toISOString().split('T')[0]} – ${endDate.toISOString().split('T')[0]}`, { align: 'center' });
        doc.moveDown(2);

        // KPI Summary
        doc.fontSize(14).text('Summary');
        doc.fontSize(11);
        doc.text(`Reach: ${summary.reach.current.toLocaleString()} (${summary.reach.percentageChange > 0 ? '+' : ''}${summary.reach.percentageChange}% vs prior period)`);
        doc.text(`Engagement: ${summary.engagement.current.toLocaleString()} (${summary.engagement.percentageChange > 0 ? '+' : ''}${summary.engagement.percentageChange}% vs prior period)`);
        doc.text(`Follower Growth: ${summary.followerGrowth.current.toLocaleString()} (${summary.followerGrowth.percentageChange > 0 ? '+' : ''}${summary.followerGrowth.percentageChange}% vs prior period)`);
        doc.text(`Posts Published: ${summary.postsPublished.current.toLocaleString()} (${summary.postsPublished.percentageChange > 0 ? '+' : ''}${summary.postsPublished.percentageChange}% vs prior period)`);
        doc.moveDown();

        // Platform Comparison
        if (platformComparison.length > 0) {
          doc.fontSize(14).text('Platform Comparison');
          doc.fontSize(10);
          platformComparison.forEach(p => {
            doc.text(`${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)} | Followers: ${p.followers.toLocaleString()} | Engagement: ${p.engagement.toLocaleString()} | Rate: ${p.engagementRate.toFixed(1)}%`);
          });
          doc.moveDown();
        }

        // Top Posts
        if (topPosts.length > 0) {
          doc.fontSize(14).text('Top Posts');
          doc.fontSize(10);
          topPosts.slice(0, 10).forEach((p, i) => {
            doc.text(`${i + 1}. ${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)} | ${new Date(p.publishedAt).toLocaleDateString()} | Engagement Rate: ${p.engagementRate.toFixed(1)}%`);
          });
          doc.moveDown();
        }

        // Engagement by Platform
        if (engagement.length > 0) {
          doc.fontSize(14).text('Engagement by Platform');
          doc.fontSize(10);
          engagement.forEach(e => {
            doc.text(`${e.platform.charAt(0).toUpperCase() + e.platform.slice(1)}: ${e.total.toLocaleString()} total (${e.likes} likes, ${e.comments} comments, ${e.shares} shares, ${e.saves} saves)`);
          });
        }

        doc.end();
      });
    } catch (error: any) {
      logger.error('Generate PDF report error:', error);
      throw new Error(`Failed to generate PDF report: ${error.message}`);
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
