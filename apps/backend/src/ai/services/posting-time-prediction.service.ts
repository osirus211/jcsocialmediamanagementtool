/**
 * Posting Time Prediction Service
 * 
 * Recommends best posting times based on historical analytics
 * Analyzes engagement patterns by hour and day of week
 */

import { PostAnalytics } from '../../models/PostAnalytics';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export interface PostingTimePredictionInput {
  workspaceId: string;
  platform: string;
  timezone?: string;
}

export interface TimeSlot {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  score: number; // 0-100
  avgEngagementRate: number;
  sampleSize: number;
}

export interface PostingTimePredictionOutput {
  topTimeSlots: TimeSlot[];
  bestTime: {
    hour: number;
    dayOfWeek: number;
    dayName: string;
    timeFormatted: string;
  };
  confidence: number; // 0-100
  recommendation: string;
}

export class PostingTimePredictionService {
  private static readonly DAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];

  /**
   * Predict best posting times
   */
  static async predictBestTimes(
    input: PostingTimePredictionInput
  ): Promise<PostingTimePredictionOutput> {
    try {
      logger.info('Predicting best posting times', {
        workspaceId: input.workspaceId,
        platform: input.platform,
      });

      // Get historical analytics
      const historicalData = await this.getHistoricalData(
        input.workspaceId,
        input.platform
      );

      if (historicalData.length < 10) {
        // Not enough data - return default recommendations
        return this.getDefaultRecommendations(input.platform);
      }

      // Analyze engagement by time slot
      const timeSlots = this.analyzeTimeSlots(historicalData);

      // Sort by score
      const topTimeSlots = timeSlots
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const bestTime = topTimeSlots[0];
      const confidence = Math.min(100, Math.round((historicalData.length / 50) * 100));

      return {
        topTimeSlots,
        bestTime: {
          hour: bestTime.hour,
          dayOfWeek: bestTime.dayOfWeek,
          dayName: this.DAY_NAMES[bestTime.dayOfWeek],
          timeFormatted: this.formatTime(bestTime.hour),
        },
        confidence,
        recommendation: this.generateRecommendation(bestTime, confidence),
      };
    } catch (error: any) {
      logger.error('Posting time prediction error:', error);
      throw new Error(`Failed to predict posting times: ${error.message}`);
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
   * Analyze engagement by time slots
   */
  private static analyzeTimeSlots(historicalData: any[]): TimeSlot[] {
    const timeSlotMap: Record<string, {
      engagementRates: number[];
      totalEngagement: number;
      totalImpressions: number;
    }> = {};

    // Group by hour and day of week
    historicalData.forEach((post) => {
      const date = new Date(post.collectedAt);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${dayOfWeek}-${hour}`;

      const engagement = post.likes + post.comments + post.shares + post.clicks + post.saves;
      const engagementRate = post.impressions > 0 ? (engagement / post.impressions) * 100 : 0;

      if (!timeSlotMap[key]) {
        timeSlotMap[key] = {
          engagementRates: [],
          totalEngagement: 0,
          totalImpressions: 0,
        };
      }

      timeSlotMap[key].engagementRates.push(engagementRate);
      timeSlotMap[key].totalEngagement += engagement;
      timeSlotMap[key].totalImpressions += post.impressions;
    });

    // Convert to TimeSlot array
    const timeSlots: TimeSlot[] = [];

    Object.entries(timeSlotMap).forEach(([key, data]) => {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      const avgEngagementRate = data.engagementRates.reduce((a, b) => a + b, 0) / data.engagementRates.length;
      
      // Score based on engagement rate (normalize to 0-100)
      const score = Math.min(100, Math.round(avgEngagementRate * 10));

      timeSlots.push({
        hour,
        dayOfWeek,
        score,
        avgEngagementRate,
        sampleSize: data.engagementRates.length,
      });
    });

    return timeSlots;
  }

  /**
   * Get default recommendations when insufficient data
   */
  private static getDefaultRecommendations(platform: string): PostingTimePredictionOutput {
    // Industry best practices by platform
    const defaults: Record<string, { hour: number; dayOfWeek: number }> = {
      twitter: { hour: 12, dayOfWeek: 3 }, // Wednesday noon
      linkedin: { hour: 10, dayOfWeek: 2 }, // Tuesday 10 AM
      instagram: { hour: 11, dayOfWeek: 3 }, // Wednesday 11 AM
      facebook: { hour: 13, dayOfWeek: 4 }, // Thursday 1 PM
    };

    const bestTime = defaults[platform] || { hour: 12, dayOfWeek: 3 };

    return {
      topTimeSlots: [
        {
          hour: bestTime.hour,
          dayOfWeek: bestTime.dayOfWeek,
          score: 70,
          avgEngagementRate: 7.0,
          sampleSize: 0,
        },
      ],
      bestTime: {
        hour: bestTime.hour,
        dayOfWeek: bestTime.dayOfWeek,
        dayName: this.DAY_NAMES[bestTime.dayOfWeek],
        timeFormatted: this.formatTime(bestTime.hour),
      },
      confidence: 30, // Low confidence without data
      recommendation: 'Based on industry best practices. Post more content to get personalized recommendations.',
    };
  }

  /**
   * Format hour to readable time
   */
  private static formatTime(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  /**
   * Generate recommendation text
   */
  private static generateRecommendation(bestTime: TimeSlot, confidence: number): string {
    const dayName = this.DAY_NAMES[bestTime.dayOfWeek];
    const timeFormatted = this.formatTime(bestTime.hour);

    if (confidence >= 70) {
      return `Based on your posting history, ${dayName}s at ${timeFormatted} consistently perform best with ${bestTime.avgEngagementRate.toFixed(1)}% engagement rate.`;
    } else if (confidence >= 40) {
      return `Early data suggests ${dayName}s at ${timeFormatted} may be optimal. Continue posting to improve accuracy.`;
    } else {
      return `Insufficient data for confident prediction. Try posting at ${dayName}s at ${timeFormatted} and track results.`;
    }
  }
}
