/**
 * Competitor Controller
 * 
 * Handles competitor tracking endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { CompetitorAnalyticsService } from '../services/CompetitorAnalyticsService';
import { logger } from '../utils/logger';

export class CompetitorController {
  /**
   * Add competitor to track
   * POST /api/v1/competitors
   */
  static async addCompetitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;
      const userId = req.user?.userId;

      if (!workspaceId || !userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { platform, handle, displayName } = req.body;

      if (!platform || !handle) {
        res.status(400).json({
          success: false,
          error: 'platform and handle are required',
        });
        return;
      }

      const competitor = await CompetitorAnalyticsService.addCompetitor(
        workspaceId.toString(),
        userId.toString(),
        platform,
        handle,
        displayName
      );

      res.status(201).json({
        success: true,
        data: competitor,
      });
    } catch (error: any) {
      logger.error('Add competitor error:', error);
      next(error);
    }
  }

  /**
   * Get competitors for workspace
   * GET /api/v1/competitors
   */
  static async getCompetitors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { platform, isActive } = req.query;

      const active = isActive === 'false' ? false : true;

      const competitors = await CompetitorAnalyticsService.getCompetitors(
        workspaceId.toString(),
        platform as string,
        active
      );

      res.json({
        success: true,
        data: competitors,
      });
    } catch (error: any) {
      logger.error('Get competitors error:', error);
      next(error);
    }
  }

  /**
   * Remove competitor
   * DELETE /api/v1/competitors/:id
   */
  static async removeCompetitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { id } = req.params;

      await CompetitorAnalyticsService.removeCompetitor(
        id,
        workspaceId.toString()
      );

      res.json({
        success: true,
        message: 'Competitor removed successfully',
      });
    } catch (error: any) {
      logger.error('Remove competitor error:', error);
      next(error);
    }
  }

  /**
   * Get competitor analytics
   * GET /api/v1/competitors/:id/analytics
   */
  static async getCompetitorAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate, limit } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const limitNum = limit ? parseInt(limit as string) : 100;

      const metrics = await CompetitorAnalyticsService.getCompetitorMetrics(
        id,
        start,
        end,
        limitNum
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Get competitor analytics error:', error);
      next(error);
    }
  }

  /**
   * Get competitor growth
   * GET /api/v1/competitors/:id/growth
   */
  static async getCompetitorGrowth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const growth = await CompetitorAnalyticsService.getCompetitorGrowth(
        id,
        start,
        end
      );

      if (!growth) {
        res.status(404).json({
          success: false,
          error: 'No competitor data found for the specified period',
        });
        return;
      }

      res.json({
        success: true,
        data: growth,
      });
    } catch (error: any) {
      logger.error('Get competitor growth error:', error);
      next(error);
    }
  }

  /**
   * Compare competitors
   * POST /api/v1/competitors/compare
   */
  static async compareCompetitors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { competitorIds, startDate, endDate } = req.body;

      if (!competitorIds || !Array.isArray(competitorIds)) {
        res.status(400).json({
          success: false,
          error: 'competitorIds array is required',
        });
        return;
      }

      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      const comparison = await CompetitorAnalyticsService.compareCompetitors(
        workspaceId.toString(),
        competitorIds,
        start,
        end
      );

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      logger.error('Compare competitors error:', error);
      next(error);
    }
  }
}
