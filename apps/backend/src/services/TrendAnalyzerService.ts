/**
 * Trend Analyzer Service
 * 
 * Calculates trend scores based on mention data
 * Formula: trendScore = postVolumeGrowth × engagementVelocity
 */

import { Mention } from '../models/Mention';
import { TrendMetric, ITrendMetric } from '../models/TrendMetric';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface TrendData {
  keyword: string;
  platform: string;
  postVolume: number;
  postVolumeGrowth: number;
  totalEngagement: number;
  avgEngagement: number;
  engagementVelocity: number;
  trendScore: number;
}

export class TrendAnalyzerService {
  /**
   * Calculate trends for all keywords in workspace
   */
  static async calculateTrends(workspaceId: string): Promise<number> {
    try {
      // Get all unique keywords with mentions in the last 24 hours
      const keywords = await Mention.distinct('keyword', {
        workspaceId,
        collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (keywords.length === 0) {
        logger.debug('No keywords with recent mentions', { workspaceId });
        return 0;
      }

      let trendsCalculated = 0;

      for (const keyword of keywords) {
        try {
          // Get platforms for this keyword
          const platforms = await Mention.distinct('platform', {
            workspaceId,
            keyword,
            collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          });

          for (const platform of platforms) {
            await this.calculateTrendForKeyword(workspaceId, keyword, platform);
            trendsCalculated++;
          }
        } catch (error: any) {
          logger.error('Failed to calculate trend for keyword', {
            keyword,
            error: error.message,
          });
          // Continue with next keyword
        }
      }

      logger.info('Trends calculated', {
        workspaceId,
        keywordsProcessed: keywords.length,
        trendsCalculated,
      });

      return trendsCalculated;
    } catch (error: any) {
      logger.error('Calculate trends error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate trend for a specific keyword and platform
   */
  private static async calculateTrendForKeyword(
    workspaceId: string,
    keyword: string,
    platform: string
  ): Promise<ITrendMetric> {
    try {
      // Define time periods
      const now = new Date();
      const currentPeriodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      const previousPeriodStart = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 24-48 hours ago
      const previousPeriodEnd = currentPeriodStart;

      // Get current period metrics
      const currentMetrics = await this.getPeriodMetrics(
        workspaceId,
        keyword,
        platform,
        currentPeriodStart,
        now
      );

      // Get previous period metrics
      const previousMetrics = await this.getPeriodMetrics(
        workspaceId,
        keyword,
        platform,
        previousPeriodStart,
        previousPeriodEnd
      );

      // Calculate growth
      const postVolumeGrowth = previousMetrics.postVolume > 0
        ? ((currentMetrics.postVolume - previousMetrics.postVolume) / previousMetrics.postVolume) * 100
        : 0;

      const engagementVelocity = previousMetrics.avgEngagement > 0
        ? ((currentMetrics.avgEngagement - previousMetrics.avgEngagement) / previousMetrics.avgEngagement) * 100
        : 0;

      // Calculate trend score
      const trendScore = postVolumeGrowth * engagementVelocity;

      // Store trend metric
      const trendMetric = new TrendMetric({
        workspaceId,
        platform,
        keyword,
        postVolume: currentMetrics.postVolume,
        postVolumeGrowth,
        totalEngagement: currentMetrics.totalEngagement,
        avgEngagement: currentMetrics.avgEngagement,
        engagementVelocity,
        trendScore,
        periodStart: currentPeriodStart,
        periodEnd: now,
        recordedAt: now,
      });

      await trendMetric.save();

      logger.debug('Trend calculated', {
        keyword,
        platform,
        trendScore,
        postVolume: currentMetrics.postVolume,
        postVolumeGrowth,
      });

      return trendMetric;
    } catch (error: any) {
      logger.error('Calculate trend for keyword error:', {
        keyword,
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get metrics for a time period
   */
  private static async getPeriodMetrics(
    workspaceId: string,
    keyword: string,
    platform: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    postVolume: number;
    totalEngagement: number;
    avgEngagement: number;
  }> {
    const metrics = await Mention.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          keyword,
          platform,
          collectedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          postVolume: { $sum: 1 },
          totalEngagement: {
            $sum: {
              $add: [
                '$engagementMetrics.likes',
                '$engagementMetrics.comments',
                '$engagementMetrics.shares',
              ],
            },
          },
        },
      },
    ]);

    if (metrics.length === 0) {
      return {
        postVolume: 0,
        totalEngagement: 0,
        avgEngagement: 0,
      };
    }

    const result = metrics[0];
    return {
      postVolume: result.postVolume,
      totalEngagement: result.totalEngagement,
      avgEngagement: result.postVolume > 0 ? result.totalEngagement / result.postVolume : 0,
    };
  }

  /**
   * Get top trends for workspace
   */
  static async getTopTrends(
    workspaceId: string,
    platform?: string,
    limit: number = 10
  ): Promise<ITrendMetric[]> {
    try {
      const query: any = {
        workspaceId,
        recordedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      };

      if (platform) {
        query.platform = platform;
      }

      // Get latest trend for each keyword
      const trends = await TrendMetric.aggregate([
        { $match: query },
        { $sort: { keyword: 1, platform: 1, recordedAt: -1 } },
        {
          $group: {
            _id: { keyword: '$keyword', platform: '$platform' },
            latest: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latest' } },
        { $sort: { trendScore: -1 } },
        { $limit: limit },
      ]);

      return trends as ITrendMetric[];
    } catch (error: any) {
      logger.error('Get top trends error:', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get trend history for a keyword
   */
  static async getTrendHistory(
    workspaceId: string,
    keyword: string,
    platform: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ITrendMetric[]> {
    try {
      const query: any = {
        workspaceId,
        keyword,
        platform,
      };

      if (startDate || endDate) {
        query.recordedAt = {};
        if (startDate) query.recordedAt.$gte = startDate;
        if (endDate) query.recordedAt.$lte = endDate;
      }

      const trends = await TrendMetric.find(query)
        .sort({ recordedAt: -1 })
        .limit(100)
        .lean();

      return trends as unknown as ITrendMetric[];
    } catch (error: any) {
      logger.error('Get trend history error:', {
        keyword,
        platform,
        error: error.message,
      });
      throw error;
    }
  }
}
