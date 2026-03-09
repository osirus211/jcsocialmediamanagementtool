/**
 * Trend Controller
 * 
 * Handles trend retrieval endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { TrendAnalyzerService } from '../services/TrendAnalyzerService';
import { logger } from '../utils/logger';

export class TrendController {
  /**
   * Get top trends
   * GET /api/v1/trends
   */
  static async getTopTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { platform, limit = '10' } = req.query;

      const trends = await TrendAnalyzerService.getTopTrends(
        workspaceId.toString(),
        platform as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      logger.error('Get top trends error:', error);
      next(error);
    }
  }

  /**
   * Get trends for specific platform
   * GET /api/v1/trends/:platform
   */
  static async getTrendsByPlatform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { platform } = req.params;
      const { limit = '10' } = req.query;

      const trends = await TrendAnalyzerService.getTopTrends(
        workspaceId.toString(),
        platform,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      logger.error('Get trends by platform error:', error);
      next(error);
    }
  }

  /**
   * Get trend history for keyword
   * GET /api/v1/trends/keyword/:keyword
   */
  static async getTrendHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { keyword } = req.params;
      const { platform, startDate, endDate } = req.query;

      if (!platform) {
        res.status(400).json({
          success: false,
          error: 'platform query parameter is required',
        });
        return;
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const history = await TrendAnalyzerService.getTrendHistory(
        workspaceId.toString(),
        keyword,
        platform as string,
        start,
        end
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error('Get trend history error:', error);
      next(error);
    }
  }
}
