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
   * Get posts with metrics and performance scores
   * GET /analytics/posts
   */
  static async getPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { 
        startDate, 
        endDate, 
        platforms, 
        sortBy = 'engagementRate', 
        sortDir = 'desc', 
        limit 
      } = req.query;

      // Validate date range
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 365) {
          res.status(422).json({
            success: false,
            code: 'INVALID_DATE_RANGE',
            message: 'Date range cannot exceed 365 days',
            details: { maxDays: 365, requestedDays: Math.round(daysDiff) }
          });
          return;
        }
      }

      // Validate sortBy
      const validSortFields = ['engagementRate', 'reach', 'impressions', 'likes', 'comments', 'shares', 'saves', 'performanceScore'];
      if (!validSortFields.includes(sortBy as string)) {
        res.status(422).json({
          success: false,
          code: 'INVALID_SORT_FIELD',
          message: 'Invalid sortBy field',
          details: { validFields: validSortFields }
        });
        return;
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const platformsArray = platforms ? (platforms as string).split(',') : undefined;
      const limitNum = limit ? parseInt(limit as string) : undefined;

      const posts = await AnalyticsService.getPostsWithMetrics(
        workspaceId,
        start,
        end,
        platformsArray,
        sortBy as string,
        sortDir as string,
        limitNum
      );

      res.json({
        success: true,
        data: posts,
      });
    } catch (error: any) {
      logger.error('Get posts error:', error);
      next(error);
    }
  }

  /**
   * Get specific post analytics with history
   * GET /analytics/posts/:postId
   */
  static async getPostById(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { postId } = req.params;

      const { PostAnalytics } = await import('../models/PostAnalytics');
      const { ScheduledPost } = await import('../models/ScheduledPost');
      const mongoose = await import('mongoose');

      // Get post with all analytics history
      const postAnalytics = await PostAnalytics.find({
        postId: new mongoose.Types.ObjectId(postId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      }).sort({ collectedAt: -1 });

      if (!postAnalytics.length) {
        res.status(404).json({
          success: false,
          code: 'POST_NOT_FOUND',
          message: 'Post not found or does not belong to this workspace'
        });
        return;
      }

      // Get post details
      const post = await ScheduledPost.findById(postId);
      if (!post) {
        res.status(404).json({
          success: false,
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        });
        return;
      }

      const latestAnalytics = postAnalytics[0];
      
      // Calculate performance score if not present
      if (!latestAnalytics.performanceScore) {
        latestAnalytics.performanceScore = await AnalyticsService.calculatePerformanceScore(
          workspaceId,
          latestAnalytics,
          latestAnalytics.platform
        );
        
        await PostAnalytics.findByIdAndUpdate(latestAnalytics._id, {
          performanceScore: latestAnalytics.performanceScore
        });
      }

      res.json({
        success: true,
        data: {
          ...latestAnalytics.toObject(),
          post: {
            content: post.content,
            mediaUrls: post.mediaUrls,
            publishedAt: post.publishedAt,
            accountName: post.accountName
          },
          history: postAnalytics.map(analytics => ({
            collectedAt: analytics.collectedAt,
            engagementRate: analytics.engagementRate,
            likes: analytics.likes,
            comments: analytics.comments,
            shares: analytics.shares,
            reach: analytics.reach
          }))
        },
      });
    } catch (error: any) {
      logger.error('Get post by ID error:', error);
      next(error);
    }
  }

  /**
   * Get top performing posts
   * GET /analytics/posts/top
   */
  static async getTopPostsNew(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { 
        startDate, 
        endDate, 
        platforms, 
        limit = '10' 
      } = req.query;

      const limitNum = Math.min(parseInt(limit as string), 50); // Max 50
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const platformsArray = platforms ? (platforms as string).split(',') : undefined;

      const posts = await AnalyticsService.getPostsWithMetrics(
        workspaceId,
        start,
        end,
        platformsArray,
        'engagementRate',
        'desc',
        limitNum
      );

      res.json({
        success: true,
        data: posts,
      });
    } catch (error: any) {
      logger.error('Get top posts error:', error);
      next(error);
    }
  }

  /**
   * Get worst performing posts (score < 40)
   * GET /analytics/posts/worst
   */
  static async getWorstPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { startDate, endDate, platforms } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const platformsArray = platforms ? (platforms as string).split(',') : undefined;

      const allPosts = await AnalyticsService.getPostsWithMetrics(
        workspaceId,
        start,
        end,
        platformsArray,
        'performanceScore',
        'asc'
      );

      // Filter posts with score < 40 and add suggestions
      const worstPosts = allPosts
        .filter(post => post.performanceScore < 40)
        .slice(0, 10) // Limit to 10
        .map(post => ({
          ...post,
          suggestion: AnalyticsService.getSuggestion(post)
        }));

      res.json({
        success: true,
        data: worstPosts,
      });
    } catch (error: any) {
      logger.error('Get worst posts error:', error);
      next(error);
    }
  }

  /**
   * Compare multiple posts side by side
   * GET /analytics/posts/compare
   */
  static async comparePosts(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { postIds } = req.query;

      if (!postIds) {
        res.status(422).json({
          success: false,
          code: 'MISSING_POST_IDS',
          message: 'postIds query parameter is required'
        });
        return;
      }

      const postIdsArray = (postIds as string).split(',');
      
      if (postIdsArray.length < 2 || postIdsArray.length > 4) {
        res.status(422).json({
          success: false,
          code: 'INVALID_POST_COUNT',
          message: 'Must provide between 2 and 4 post IDs',
          details: { provided: postIdsArray.length, min: 2, max: 4 }
        });
        return;
      }

      const { PostAnalytics } = await import('../models/PostAnalytics');
      const { ScheduledPost } = await import('../models/ScheduledPost');
      const mongoose = await import('mongoose');

      const posts = await PostAnalytics.aggregate([
        {
          $match: {
            postId: { $in: postIdsArray.map(id => new mongoose.Types.ObjectId(id)) },
            workspaceId: new mongoose.Types.ObjectId(workspaceId)
          }
        },
        {
          $lookup: {
            from: 'scheduledposts',
            localField: 'postId',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: '$post' },
        {
          $project: {
            postId: 1,
            platform: 1,
            likes: 1,
            comments: 1,
            shares: 1,
            reach: 1,
            impressions: 1,
            saves: 1,
            engagementRate: 1,
            performanceScore: 1,
            publishedAt: '$post.publishedAt',
            content: '$post.content'
          }
        }
      ]);

      // Verify all posts belong to this workspace
      if (posts.length !== postIdsArray.length) {
        res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'One or more posts do not belong to this workspace'
        });
        return;
      }

      // Calculate performance scores if missing
      for (const post of posts) {
        if (!post.performanceScore) {
          post.performanceScore = await AnalyticsService.calculatePerformanceScore(
            workspaceId,
            post,
            post.platform
          );
        }
      }

      res.json({
        success: true,
        data: posts,
      });
    } catch (error: any) {
      logger.error('Compare posts error:', error);
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
