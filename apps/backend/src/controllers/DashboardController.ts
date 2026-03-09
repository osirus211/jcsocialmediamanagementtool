/**
 * Dashboard Controller
 * 
 * Exposes dashboard endpoints that aggregate data from existing services
 */

import { Request, Response, NextFunction } from 'express';
import { analyticsDashboardService } from '../services/AnalyticsDashboardService';
import { usageService } from '../services/UsageService';
import { WorkspaceActivityLog } from '../models/WorkspaceActivityLog';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class DashboardController {
  /**
   * Get workspace overview dashboard
   * GET /api/v1/dashboard/overview
   * 
   * Aggregates:
   * - Analytics summary
   * - Usage summary
   * - Recent activity (5 items)
   * - Quick stats
   */
  static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      // Get date range (default: last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Fetch data in parallel
      const [analyticsSummary, usageSummary, recentActivity] = await Promise.all([
        // Analytics summary
        analyticsDashboardService.getAnalyticsSummary({
          workspaceId: workspaceId.toString(),
          dateFrom: startDate,
          dateTo: endDate,
        }).catch(err => {
          logger.warn('Failed to get analytics summary', { error: err.message });
          return null;
        }),

        // Usage summary
        usageService.getUsageSummary(workspaceId).catch(err => {
          logger.warn('Failed to get usage summary', { error: err.message });
          return null;
        }),

        // Recent activity (last 5 items)
        WorkspaceActivityLog.find({ workspaceId })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('userId', 'firstName lastName email')
          .lean()
          .catch(err => {
            logger.warn('Failed to get recent activity', { error: err.message });
            return [];
          }),
      ]);

      res.json({
        success: true,
        data: {
          analytics: analyticsSummary,
          usage: usageSummary,
          recentActivity,
          period: {
            startDate,
            endDate,
          },
        },
      });
    } catch (error: any) {
      logger.error('Get overview error:', error);
      next(error);
    }
  }

  /**
   * Get analytics dashboard
   * GET /api/v1/dashboard/analytics
   * 
   * Provides:
   * - Analytics summary
   * - Top performing posts
   * - Platform performance
   * - Engagement trends
   */
  static async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      // Parse query parameters
      const {
        dateFrom,
        dateTo,
        platform,
        interval = 'day',
        topPostsLimit = '10',
      } = req.query;

      // Default date range: last 30 days
      const endDate = dateTo ? new Date(dateTo as string) : new Date();
      const startDate = dateFrom ? new Date(dateFrom as string) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch analytics data in parallel
      const [summary, topPosts, platformPerformance, engagementTrends] = await Promise.all([
        analyticsDashboardService.getAnalyticsSummary({
          workspaceId: workspaceId.toString(),
          dateFrom: startDate,
          dateTo: endDate,
        }),

        analyticsDashboardService.getTopPosts({
          workspaceId: workspaceId.toString(),
          platform: platform as string,
          limit: parseInt(topPostsLimit as string),
          dateFrom: startDate,
          dateTo: endDate,
        }),

        analyticsDashboardService.getPlatformPerformance({
          workspaceId: workspaceId.toString(),
          dateFrom: startDate,
          dateTo: endDate,
        }),

        analyticsDashboardService.getEngagementTrends({
          workspaceId: workspaceId.toString(),
          platform: platform as string,
          dateFrom: startDate,
          dateTo: endDate,
          interval: interval as 'day' | 'week' | 'month',
        }),
      ]);

      res.json({
        success: true,
        data: {
          summary,
          topPosts,
          platformPerformance,
          engagementTrends,
          period: {
            startDate,
            endDate,
            interval,
          },
        },
      });
    } catch (error: any) {
      logger.error('Get analytics dashboard error:', error);
      next(error);
    }
  }

  /**
   * Get usage dashboard
   * GET /api/v1/dashboard/usage
   * 
   * Provides:
   * - Current usage summary
   * - Usage history
   * - Limit status
   * - Usage percentages
   */
  static async getUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      // Parse query parameters
      const { months = '6' } = req.query;
      const historyMonths = parseInt(months as string);

      // Fetch usage data in parallel
      const [usageSummary, usageHistory] = await Promise.all([
        usageService.getUsageSummary(workspaceId),
        usageService.getUsageHistory(workspaceId, historyMonths),
      ]);

      res.json({
        success: true,
        data: {
          current: usageSummary.current,
          plan: usageSummary.plan,
          limits: usageSummary.limits,
          percentages: usageSummary.percentages,
          history: usageHistory,
        },
      });
    } catch (error: any) {
      logger.error('Get usage dashboard error:', error);
      next(error);
    }
  }

  /**
   * Get activity dashboard
   * GET /api/v1/dashboard/activity
   * 
   * Provides:
   * - Activity feed with pagination
   * - Activity filtering by action type
   * - Activity statistics
   */
  static async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      // Parse query parameters
      const {
        page = '1',
        limit = '20',
        action,
        userId,
        dateFrom,
        dateTo,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = { workspaceId };

      if (action) {
        query.action = action;
      }

      if (userId) {
        query.userId = new mongoose.Types.ObjectId(userId as string);
      }

      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
        if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
      }

      // Fetch activity data in parallel
      const [activities, totalCount, activityStats] = await Promise.all([
        // Activity feed
        WorkspaceActivityLog.find(query)
          .sort({ createdAt: -1 })
          .limit(limitNum)
          .skip(skip)
          .populate('userId', 'firstName lastName email')
          .lean(),

        // Total count for pagination
        WorkspaceActivityLog.countDocuments(query),

        // Activity statistics (last 30 days)
        WorkspaceActivityLog.aggregate([
          {
            $match: {
              workspaceId,
              createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          },
          {
            $group: {
              _id: '$action',
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ]),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({
        success: true,
        data: {
          activities,
          statistics: activityStats,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount,
            totalPages,
            hasNextPage,
            hasPrevPage,
          },
        },
      });
    } catch (error: any) {
      logger.error('Get activity dashboard error:', error);
      next(error);
    }
  }
}

