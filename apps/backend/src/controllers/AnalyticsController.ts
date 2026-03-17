/**
 * Analytics Controller
 * Handles analytics and engagement tracking requests
 */

import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { logger } from '../utils/logger';

export class AnalyticsController {
  /**
   * Get overview metrics
   * GET /analytics/overview
   */
  static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const metrics = await AnalyticsService.getOverviewMetrics(workspaceId, start, end);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Get overview error:', error);
      next(error);
    }
  }

  /**
   * Get platform comparison metrics
   * GET /analytics/platform
   */
  static async getPlatformMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const metrics = await AnalyticsService.getPlatformMetrics(workspaceId, start, end);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Get platform metrics error:', error);
      next(error);
    }
  }

  /**
   * Get growth metrics over time
   * GET /analytics/growth
   */
  static async getGrowthMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { startDate, endDate, interval } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const intervalType = (interval as 'day' | 'week' | 'month') || 'day';

      const metrics = await AnalyticsService.getGrowthMetrics(
        workspaceId,
        start,
        end,
        intervalType
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Get growth metrics error:', error);
      next(error);
    }
  }

  /**
   * Get analytics for specific post
   * GET /analytics/post/:postId
   */
  static async getPostAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { postId } = req.params;

      const analytics = await AnalyticsService.getPostAnalytics(workspaceId, postId);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      logger.error('Get post analytics error:', error);
      next(error);
    }
  }

  /**
   * Get top performing posts
   * GET /analytics/posts
   */
  static async getTopPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { startDate, endDate, limit = '10' } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      // Get overview to access best performing posts
      // In a real implementation, this would be a separate optimized query
      const metrics = await AnalyticsService.getOverviewMetrics(workspaceId, start, end);

      res.json({
        success: true,
        data: {
          posts: metrics.bestPerformingPost ? [metrics.bestPerformingPost] : [],
          total: metrics.bestPerformingPost ? 1 : 0,
        },
      });
    } catch (error: any) {
      logger.error('Get top posts error:', error);
      next(error);
    }
  }

  /**
   * Get optimal posting times heatmap and AI suggestions
   * GET /analytics/best-times
   */
  static async getBestTimes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { platform } = req.query;

      // Import services
      const { PostAnalytics } = await import('../models/PostAnalytics');
      const { PostingTimePredictionService } = await import('../ai/services/posting-time-prediction.service');
      const mongoose = await import('mongoose');

      // Build aggregation pipeline for heatmap data
      const matchStage: any = { 
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        engagementRate: { $gt: 0 } // Only posts with engagement data
      };
      
      if (platform) {
        matchStage.platform = platform;
      }

      // Get heatmap data - group by day of week and hour
      const heatmapData = await PostAnalytics.aggregate([
        { $match: matchStage },
        {
          $addFields: {
            dayOfWeek: { $dayOfWeek: '$collectedAt' }, // 1=Sunday, 7=Saturday
            hour: { $hour: '$collectedAt' }
          }
        },
        {
          $group: {
            _id: { dayOfWeek: '$dayOfWeek', hour: '$hour' },
            avgEngagement: { $avg: '$engagementRate' },
            postCount: { $sum: 1 },
            totalImpressions: { $sum: '$impressions' },
            totalEngagement: { $sum: { $add: ['$likes', '$comments', '$shares', '$clicks'] } }
          }
        },
        {
          $project: {
            dayOfWeek: { $subtract: ['$_id.dayOfWeek', 1] }, // Convert to 0=Sunday, 6=Saturday
            hour: '$_id.hour',
            avgEngagement: { $round: ['$avgEngagement', 2] },
            postCount: 1,
            _id: 0
          }
        },
        { $sort: { dayOfWeek: 1, hour: 1 } }
      ]);

      // Get AI suggestions using existing service
      let suggestions = [];
      try {
        const aiResult = await PostingTimePredictionService.predictBestTimes({
          workspaceId,
          platform: platform as string,
          timezone: 'UTC' // Default timezone
        });
        
        suggestions = aiResult.topTimeSlots.map(slot => ({
          platform: platform || 'all',
          dayOfWeek: slot.dayOfWeek,
          hour: slot.hour,
          score: Math.round(slot.score),
          reason: `${slot.avgEngagementRate.toFixed(1)}% avg engagement rate`
        }));
      } catch (aiError) {
        logger.warn('AI suggestions failed, using empty array', { error: aiError });
      }

      res.json({
        success: true,
        data: {
          heatmap: heatmapData,
          suggestions: suggestions.slice(0, 5) // Top 5 suggestions
        }
      });
    } catch (error: any) {
      logger.error('Get best times error:', error);
      next(error);
    }
  }

  /**
   * Generate mock analytics for a post (development/testing)
   * POST /analytics/mock/:postId
   */
  static async generateMockAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { postId } = req.params;
      const { platform } = req.body;

      if (!platform) {
        res.status(400).json({
          success: false,
          message: 'platform is required',
        });
        return;
      }

      const analytics = await AnalyticsService.generateMockAnalytics(
        workspaceId,
        postId,
        platform
      );

      res.json({
        success: true,
        data: analytics,
        message: 'Mock analytics generated',
      });
    } catch (error: any) {
      logger.error('Generate mock analytics error:', error);
      next(error);
    }
  }
}
