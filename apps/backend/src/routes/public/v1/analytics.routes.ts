/**
 * Public API - Analytics Routes
 * 
 * External endpoints for viewing analytics data via API keys
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireScope } from '../../../middleware/apiKeyScope';
import { PostAnalytics } from '../../../models/PostAnalytics';
import { Post } from '../../../models/Post';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/public/v1/analytics
 * Get aggregated analytics for the workspace
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - platform: filter by platform
 * 
 * Requires: analytics:read scope
 */
router.get('/',
  requireScope('analytics:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.apiKey!.workspaceId;
      
      // Parse date range
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();
      
      const platform = req.query.platform as string;
      
      // Build query
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        fetchedAt: {
          $gte: startDate,
          $lte: endDate,
        },
      };
      
      if (platform) {
        query.platform = platform;
      }
      
      // Fetch analytics
      const analytics = await PostAnalytics.find(query)
        .sort({ fetchedAt: -1 })
        .select('-__v');
      
      // Calculate aggregates
      const totals = analytics.reduce((acc, item) => {
        const data = item as any;
        acc.impressions += data.impressions || 0;
        acc.engagements += data.engagements || 0;
        acc.likes += data.likes || 0;
        acc.comments += data.comments || 0;
        acc.shares += data.shares || 0;
        acc.clicks += data.clicks || 0;
        return acc;
      }, {
        impressions: 0,
        engagements: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
      });
      
      res.json({
        analytics: {
          totals,
          period: {
            startDate,
            endDate,
          },
          postsAnalyzed: analytics.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/public/v1/analytics/posts/:id
 * Get analytics for a specific post
 * 
 * Requires: analytics:read scope
 */
router.get('/posts/:id',
  requireScope('analytics:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workspaceId = req.apiKey!.workspaceId;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid post ID');
      }
      
      // Verify post belongs to workspace
      const post = await Post.findOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });
      
      if (!post) {
        throw new NotFoundError('Post not found');
      }
      
      // Fetch analytics for the post
      const analytics = await PostAnalytics.find({
        postId: new mongoose.Types.ObjectId(id),
      })
        .sort({ fetchedAt: -1 })
        .select('-__v');
      
      res.json({
        postId: id,
        analytics: analytics.map(item => {
          const data = item as any;
          return {
            platform: data.platform,
            impressions: data.impressions,
            engagements: data.engagements,
            likes: data.likes,
            comments: data.comments,
            shares: data.shares,
            clicks: data.clicks,
            fetchedAt: data.fetchedAt,
          };
        }),
        total: analytics.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
