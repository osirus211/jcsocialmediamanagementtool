/**
 * Follower Analytics Controller
 * 
 * Handles follower growth and trend endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { FollowerAnalyticsService } from '../services/FollowerAnalyticsService';
import { logger } from '../utils/logger';

export class FollowerAnalyticsController {
  /**
   * Get follower history for an account
   * GET /api/v1/analytics/followers/:accountId
   */
  static async getFollowerHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { startDate, endDate, limit } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const limitNum = limit ? parseInt(limit as string) : 100;

      const history = await FollowerAnalyticsService.getFollowerHistory(
        accountId,
        start,
        end,
        limitNum
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error('Get follower history error:', error);
      next(error);
    }
  }

  /**
   * Get follower growth for an account
   * GET /api/v1/analytics/followers/:accountId/growth
   */
  static async getFollowerGrowth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const growth = await FollowerAnalyticsService.getFollowerGrowth(
        accountId,
        start,
        end
      );

      if (!growth) {
        res.status(404).json({
          success: false,
          error: 'No follower data found for the specified period',
        });
        return;
      }

      res.json({
        success: true,
        data: growth,
      });
    } catch (error: any) {
      logger.error('Get follower growth error:', error);
      next(error);
    }
  }

  /**
   * Get follower trends for an account
   * GET /api/v1/analytics/followers/:accountId/trends
   */
  static async getFollowerTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { startDate, endDate, interval = 'day' } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const trends = await FollowerAnalyticsService.getFollowerTrends(
        accountId,
        start,
        end,
        interval as 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      logger.error('Get follower trends error:', error);
      next(error);
    }
  }

  /**
   * Get follower growth for all accounts in workspace
   * GET /api/v1/analytics/followers/workspace/growth
   */
  static async getWorkspaceFollowerGrowth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const growth = await FollowerAnalyticsService.getWorkspaceFollowerGrowth(
        workspaceId.toString(),
        start,
        end
      );

      res.json({
        success: true,
        data: growth,
      });
    } catch (error: any) {
      logger.error('Get workspace follower growth error:', error);
      next(error);
    }
  }
}
