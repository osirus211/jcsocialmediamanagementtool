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
