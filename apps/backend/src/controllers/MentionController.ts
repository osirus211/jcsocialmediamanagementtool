/**
 * Mention Controller
 * 
 * Handles mention retrieval endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { Mention } from '../models/Mention';
import { logger } from '../utils/logger';

export class MentionController {
  /**
   * Get mentions
   * GET /api/v1/mentions
   */
  static async getMentions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const {
        keyword,
        platform,
        startDate,
        endDate,
        page = '1',
        limit = '20',
        sortBy = 'collectedAt',
        sortOrder = 'desc',
      } = req.query;

      const query: any = { workspaceId };

      if (keyword) {
        query.keyword = keyword;
      }

      if (platform) {
        query.platform = platform;
      }

      if (startDate || endDate) {
        query.collectedAt = {};
        if (startDate) query.collectedAt.$gte = new Date(startDate as string);
        if (endDate) query.collectedAt.$lte = new Date(endDate as string);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

      const [mentions, totalCount] = await Promise.all([
        Mention.find(query)
          .sort(sortOptions)
          .limit(limitNum)
          .skip(skip)
          .lean(),

        Mention.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.json({
        success: true,
        data: mentions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error: any) {
      logger.error('Get mentions error:', error);
      next(error);
    }
  }

  /**
   * Get mentions for specific keyword
   * GET /api/v1/mentions/:keyword
   */
  static async getMentionsByKeyword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { keyword } = req.params;
      const {
        platform,
        startDate,
        endDate,
        limit = '50',
      } = req.query;

      const query: any = {
        workspaceId,
        keyword,
      };

      if (platform) {
        query.platform = platform;
      }

      if (startDate || endDate) {
        query.collectedAt = {};
        if (startDate) query.collectedAt.$gte = new Date(startDate as string);
        if (endDate) query.collectedAt.$lte = new Date(endDate as string);
      }

      const mentions = await Mention.find(query)
        .sort({ collectedAt: -1 })
        .limit(parseInt(limit as string))
        .lean();

      res.json({
        success: true,
        data: mentions,
      });
    } catch (error: any) {
      logger.error('Get mentions by keyword error:', error);
      next(error);
    }
  }

  /**
   * Get mention statistics
   * GET /api/v1/mentions/stats
   */
  static async getMentionStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { keyword, platform, startDate, endDate } = req.query;

      const matchQuery: any = { workspaceId };

      if (keyword) {
        matchQuery.keyword = keyword;
      }

      if (platform) {
        matchQuery.platform = platform;
      }

      if (startDate || endDate) {
        matchQuery.collectedAt = {};
        if (startDate) matchQuery.collectedAt.$gte = new Date(startDate as string);
        if (endDate) matchQuery.collectedAt.$lte = new Date(endDate as string);
      }

      const stats = await Mention.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalMentions: { $sum: 1 },
            totalLikes: { $sum: '$engagementMetrics.likes' },
            totalComments: { $sum: '$engagementMetrics.comments' },
            totalShares: { $sum: '$engagementMetrics.shares' },
            avgLikes: { $avg: '$engagementMetrics.likes' },
            avgComments: { $avg: '$engagementMetrics.comments' },
            avgShares: { $avg: '$engagementMetrics.shares' },
          },
        },
      ]);

      const result = stats[0] || {
        totalMentions: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        avgLikes: 0,
        avgComments: 0,
        avgShares: 0,
      };

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get mention stats error:', error);
      next(error);
    }
  }
}
