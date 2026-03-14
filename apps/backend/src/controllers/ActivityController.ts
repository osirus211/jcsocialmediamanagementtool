/**
 * Activity Controller
 * 
 * Handles team activity feed endpoints
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { workspaceService } from '../services/WorkspaceService';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';
import { logger } from '../utils/logger';
import { rateLimitService } from '../services/RateLimitService';
import { ForbiddenError } from '../utils/errors';
import { MemberRole } from '../models/WorkspaceMember';

export class ActivityController {
  /**
   * Get activity feed for workspace
   * GET /api/v1/activity
   */
  static async getActivityFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspace!.workspaceId);
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items
      const skip = (page - 1) * limit;
      
      // Optional filters
      const action = req.query.action as ActivityAction | undefined;
      const resourceType = req.query.resourceType as string | undefined;
      const userId = req.query.userId ? new mongoose.Types.ObjectId(req.query.userId as string) : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      // Build filters
      const filters: Record<string, unknown> = {};
      if (action) filters.action = action;
      if (resourceType) filters.resourceType = resourceType;
      if (userId) filters.userId = userId;
      if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) (filters.createdAt as Record<string, unknown>).$gte = startDate;
        if (endDate) (filters.createdAt as Record<string, unknown>).$lte = endDate;
      }

      // Get activities with populated user info
      const activities = await workspaceService.getActivityLogs({
        workspaceId,
        limit,
        skip,
        action,
      });

      // Get total count for pagination
      const totalQuery: Record<string, unknown> = { workspaceId };
      if (action) totalQuery.action = action;
      if (resourceType) totalQuery.resourceType = resourceType;
      if (userId) totalQuery.userId = userId;
      if (startDate || endDate) {
        totalQuery.createdAt = {};
        if (startDate) (totalQuery.createdAt as Record<string, unknown>).$gte = startDate;
        if (endDate) (totalQuery.createdAt as Record<string, unknown>).$lte = endDate;
      }
      const { WorkspaceActivityLog } = await import('../models/WorkspaceActivityLog');
      const total = await WorkspaceActivityLog.countDocuments(totalQuery);
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          activities,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      });
    } catch (error: unknown) {
      logger.error('Get activity feed error:', error);
      next(error);
    }
  }

  /**
   * Get activity statistics
   * GET /api/v1/activity/stats
   */
  static async getActivityStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspace!.workspaceId);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { WorkspaceActivityLog } = await import('../models/WorkspaceActivityLog');

      // Get activity counts by type for last 7 days
      const activityStats = await WorkspaceActivityLog.aggregate([
        {
          $match: {
            workspaceId,
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get most active user
      const mostActiveUserStats = await WorkspaceActivityLog.aggregate([
        {
          $match: {
            workspaceId,
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 1,
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            userId: '$_id',
            count: 1,
            name: '$user.name',
            email: '$user.email',
          },
        },
      ]);

      // Transform activity stats to object
      const byType: Record<string, number> = {};
      let totalActions = 0;
      
      activityStats.forEach((stat) => {
        byType[stat._id] = stat.count;
        totalActions += stat.count;
      });

      const mostActiveUser = mostActiveUserStats[0] || null;

      res.json({
        success: true,
        data: {
          totalActions,
          byType,
          mostActiveUser,
          period: '7 days',
        },
      });
    } catch (error: unknown) {
      logger.error('Get activity stats error:', error);
      next(error);
    }
  }

  /**
   * Export activity logs (CSV/JSON) - Admin only with rate limiting
   * GET /api/v1/activity/export
   */
  static async exportActivityLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspace!.workspaceId);
      const userId = req.user!.userId;
      const userRole = req.workspace!.role;

      // Check if user is admin or owner
      if (userRole !== MemberRole.ADMIN && userRole !== MemberRole.OWNER) {
        throw new ForbiddenError('Only admins can export activity logs');
      }

      // Rate limiting: 3 exports per hour per user
      const rateLimitKey = `activity_export:${userId}`;
      const isAllowed = await rateLimitService.checkLimit(rateLimitKey, 3, 3600); // 3 requests per hour
      
      if (!isAllowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Maximum 3 exports per hour.',
        });
        return;
      }

      // Parse query parameters
      const format = (req.query.format as string) || 'csv';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const action = req.query.action as ActivityAction | undefined;
      const filterUserId = req.query.userId ? new mongoose.Types.ObjectId(req.query.userId as string) : undefined;

      // Build filters
      const filters: Record<string, unknown> = { workspaceId };
      if (action) filters.action = action;
      if (filterUserId) filters.userId = filterUserId;
      if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) (filters.createdAt as Record<string, unknown>).$gte = startDate;
        if (endDate) (filters.createdAt as Record<string, unknown>).$lte = endDate;
      }

      const { WorkspaceActivityLog } = await import('../models/WorkspaceActivityLog');

      // Get activities with populated user info (limit to 10,000 for performance)
      const activities = await WorkspaceActivityLog.find(filters)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(10000);

      if (format === 'json') {
        // JSON export
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="activity-export-${Date.now()}.json"`);
        
        res.json({
          success: true,
          data: {
            activities,
            exportedAt: new Date().toISOString(),
            filters: {
              startDate: startDate?.toISOString(),
              endDate: endDate?.toISOString(),
              action,
              userId: filterUserId?.toString(),
            },
            total: activities.length,
          },
        });
      } else {
        // CSV export
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="activity-export-${Date.now()}.csv"`);

        // CSV headers
        const csvHeaders = [
          'Date',
          'Time',
          'User Name',
          'User Email',
          'Action',
          'Resource Type',
          'Resource ID',
          'IP Address',
          'Details'
        ];

        let csvContent = csvHeaders.join(',') + '\n';

        // CSV rows
        activities.forEach((activity) => {
          const date = new Date(activity.createdAt);
          const user = activity.userId as any;
          const details = activity.details ? JSON.stringify(activity.details).replace(/"/g, '""') : '';
          
          const row = [
            date.toISOString().split('T')[0], // Date
            date.toISOString().split('T')[1].split('.')[0], // Time
            user?.name || 'Unknown',
            user?.email || 'Unknown',
            activity.action,
            activity.resourceType || '',
            activity.resourceId?.toString() || '',
            activity.ipAddress || '',
            `"${details}"` // Escape quotes in JSON
          ];

          csvContent += row.join(',') + '\n';
        });

        res.send(csvContent);
      }

      // Log the export activity
      await WorkspaceActivityLog.create({
        workspaceId,
        userId: new mongoose.Types.ObjectId(userId),
        action: ActivityAction.WORKSPACE_UPDATED,
        resourceType: 'ActivityExport',
        details: {
          format,
          recordCount: activities.length,
          filters: {
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
            action,
            userId: filterUserId?.toString(),
          },
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

    } catch (error: unknown) {
      logger.error('Export activity logs error:', error);
      next(error);
    }
  }
}