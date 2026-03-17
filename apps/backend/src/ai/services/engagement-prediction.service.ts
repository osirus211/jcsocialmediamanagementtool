/**
 * Engagement Prediction Service
 * 
 * Predicts engagement score based on historical analytics data
 * Uses workspace analytics to compute predictions
 */

import { PostAnalytics } from '../../models/PostAnalytics';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export interface EngagementPredictionInput {
  workspaceId: string;
  platform: string;
  caption: string;
  scheduledTime?: Date;
  hasMedia?: boolean;
  mediaType?: 'image' | 'video' | 'carousel';
}

export interface EngagementPredictionOutput {
  predictedScore: number; // 0-100
  confidence: number; // 0-100
  factors: {
    historicalPerformance: number;
    timeOfDay: number;
    contentLength: number;
    hasMedia: number;
  };
  recommendation: string;
}

export class EngagementPredictionService {
  /**
   * Predict engagement for a post
   */
  static async predictEngagement(
    input: EngagementPredictionInput
  ): Promise<EngagementPredictionOutput> {
    try {
      logger.info('Predicting engagement', {
        workspaceId: input.workspaceId,
        platform: input.platform,
      });

      // Get historical analytics for this platform
      const historicalData = await this.getHistoricalData(
        input.workspaceId,
        input.platform
      );

      if (historicalData.length === 0) {
        // No historical data - return baseline prediction
        return this.getBaselinePrediction(input);
      }

      // Calculate prediction factors
      const factors = {
        historicalPerformance: this.calculateHistoricalFactor(historicalData),
        timeOfDay: this.calculateTimeOfDayFactor(input.scheduledTime, historicalData),
        contentLength: this.calculateContentLengthFactor(input.caption, input.platform),
        hasMedia: this.calculateMediaFactor(input.hasMedia, input.mediaType, historicalData),
      };

      // Weighted average of factors
      const predictedScore = Math.round(
        factors.historicalPerformance * 0.4 +
        factors.timeOfDay * 0.25 +
        factors.contentLength * 0.15 +
        factors.hasMedia * 0.2
      );

      // Calculate confidence based on data availability
      const confidence = Math.min(
        100,
        Math.round((historicalData.length / 50) * 100)
      );

      const recommendation = this.generateRecommendation(predictedScore, factors);

      return {
        predictedScore,
        confidence,
        factors,
        recommendation,
      };
    } catch (error: any) {
      logger.error('Engagement prediction error:', error);
      throw new Error(`Failed to predict engagement: ${error.message}`);
    }
  }

  /**
   * Get historical analytics data
   */
  private static async getHistoricalData(
    workspaceId: string,
    platform: string
  ): Promise<any[]> {
    try {
      // Get last 90 days of analytics
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const data = await PostAnalytics.aggregate([
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            platform,
            collectedAt: { $gte: ninetyDaysAgo },
          },
        },
        { $sort: { postId: 1, collectedAt: -1 } },
        {
          $group: {
            _id: '$postId',
            latest: { $first: '$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latest' } },
      ]);

      return data;
    } catch (error: any) {
      logger.error('Get historical data error:', error);
      return [];
    }
  }

  /**
   * Calculate historical performance factor
   */
  private static calculateHistoricalFactor(historicalData: any[]): number {
    if (historicalData.length === 0) return 50;

    const avgEngagementRate = historicalData.reduce((sum, post) => {
      const engagement = post.likes + post.comments + post.shares + post.clicks + post.saves;
      const rate = post.impressions > 0 ? (engagement / post.impressions) * 100 : 0;
      return sum + rate;
    }, 0) / historicalData.length;

    // Normalize to 0-100 scale (assuming 10% engagement rate is excellent)
    return Math.min(100, Math.round(avgEngagementRate * 10));
  }

  /**
   * Calculate time of day factor
   */
  private static calculateTimeOfDayFactor(
    scheduledTime: Date | undefined,
    historicalData: any[]
  ): number {
    if (!scheduledTime || historicalData.length === 0) return 50;

    const hour = scheduledTime.getHours();

    // Group historical posts by hour
    const hourlyPerformance: Record<number, number[]> = {};
    
    historicalData.forEach((post) => {
      const postHour = new Date(post.collectedAt).getHours();
      const engagement = post.likes + post.comments + post.shares + post.clicks + post.saves;
      const rate = post.impressions > 0 ? (engagement / post.impressions) * 100 : 0;
      
      if (!hourlyPerformance[postHour]) {
        hourlyPerformance[postHour] = [];
      }
      hourlyPerformance[postHour].push(rate);
    });

    // Calculate average for this hour
    if (hourlyPerformance[hour]) {
      const avgRate = hourlyPerformance[hour].reduce((a, b) => a + b, 0) / hourlyPerformance[hour].length;
      return Math.min(100, Math.round(avgRate * 10));
    }

    return 50; // Default if no data for this hour
  }

  /**
   * Calculate content length factor
   */
  private static calculateContentLengthFactor(caption: string, platform: string): number {
    const length = caption.length;
    
    // Platform-specific optimal lengths
    const optimalRanges: Record<string, { min: number; max: number }> = {
      twitter: { min: 100, max: 280 },
      linkedin: { min: 150, max: 300 },
      instagram: { min: 125, max: 300 },
      facebook: { min: 100, max: 250 },
    };

    const range = optimalRanges[platform] || { min: 100, max: 300 };

    if (length >= range.min && length <= range.max) {
      return 80; // Optimal length
    } else if (length < range.min) {
      return Math.max(40, 80 - ((range.min - length) / range.min) * 40);
    } else {
      return Math.max(40, 80 - ((length - range.max) / range.max) * 40);
    }
  }

  /**
   * Calculate media factor
   */
  private static calculateMediaFactor(
    hasMedia: boolean | undefined,
    mediaType: string | undefined,
    historicalData: any[]
  ): number {
    if (!hasMedia) return 40; // Posts without media typically perform worse

    // Media type scoring
    const mediaScores: Record<string, number> = {
      video: 90,
      carousel: 85,
      image: 75,
    };

    return mediaScores[mediaType || 'image'] || 75;
  }

  /**
   * Get baseline prediction when no historical data exists
   */
  private static getBaselinePrediction(
    input: EngagementPredictionInput
  ): EngagementPredictionOutput {
    const factors = {
      historicalPerformance: 50,
      timeOfDay: 50,
      contentLength: this.calculateContentLengthFactor(input.caption, input.platform),
      hasMedia: this.calculateMediaFactor(input.hasMedia, input.mediaType, []),
    };

    const predictedScore = Math.round(
      (factors.historicalPerformance + factors.timeOfDay + factors.contentLength + factors.hasMedia) / 4
    );

    return {
      predictedScore,
      confidence: 20, // Low confidence without historical data
      factors,
      recommendation: 'Build more posting history to improve prediction accuracy.',
    };
  }

  /**
   * Generate recommendation based on prediction
   */
  private static generateRecommendation(
    predictedScore: number,
    factors: any
  ): string {
    if (predictedScore >= 75) {
      return 'Excellent! This post is predicted to perform very well.';
    } else if (predictedScore >= 60) {
      return 'Good potential. Consider optimizing timing or adding media.';
    } else if (predictedScore >= 40) {
      return 'Moderate performance expected. Try adjusting content length or posting time.';
    } else {
      return 'Low engagement predicted. Consider revising content, adding media, or changing posting time.';
    }
  }
}
