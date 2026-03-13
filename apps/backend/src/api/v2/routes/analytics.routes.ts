/**
 * Public API v2 - Analytics Routes
 * 
 * External API for analytics data with API key authentication
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireScope } from '../../../middleware/apiKeyScope';
import { AnalyticsService } from '../../../services/AnalyticsService';
import { FollowerAnalyticsService } from '../../../services/FollowerAnalyticsService';
import { logger } from '../../../utils/logger';
import { SocialPlatform } from '../../../models/ScheduledPost';

const router = Router();
const analyticsService = new AnalyticsService();
const followerAnalyticsService = new FollowerAnalyticsService();

// Validation schemas
const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  platform: z.nativeEnum(SocialPlatform).optional(),
});

const PostAnalyticsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  platform: z.nativeEnum(SocialPlatform).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /v2/analytics/posts - Post performance metrics
 */
router.get('/posts', requireScope('analytics:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const query = PostAnalyticsSchema.parse(req.query);
    
    const fromDate = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const toDate = query.to ? new Date(query.to) : new Date();
    
    const analytics = await (analyticsService as any).getPostPerformanceMetrics({
      workspaceId,
      platform: query.platform,
      fromDate,
      toDate,
      limit: query.limit,
    });
    
    res.json({
      data: analytics,
      meta: {
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        platform: query.platform || 'all',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v2/analytics/followers - Follower growth data
 */
router.get('/followers', requireScope('analytics:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const query = DateRangeSchema.parse(req.query);
    
    const fromDate = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const toDate = query.to ? new Date(query.to) : new Date();
    
    const followerData = await (followerAnalyticsService as any).getFollowerGrowth({
      workspaceId,
      platform: query.platform,
      fromDate,
      toDate,
    });
    
    res.json({
      data: followerData,
      meta: {
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        platform: query.platform || 'all',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v2/analytics/engagement - Engagement trends
 */
router.get('/engagement', requireScope('analytics:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const query = DateRangeSchema.parse(req.query);
    
    const fromDate = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const toDate = query.to ? new Date(query.to) : new Date();
    
    const engagementData = await (analyticsService as any).getEngagementTrends({
      workspaceId,
      platform: query.platform,
      fromDate,
      toDate,
    });
    
    res.json({
      data: engagementData,
      meta: {
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        platform: query.platform || 'all',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;