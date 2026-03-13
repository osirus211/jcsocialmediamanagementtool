/**
 * Post ROI Service
 * 
 * Handles post-level ROI and click-through attribution
 */

import { Post } from '../models/Post';
import { PostAnalytics } from '../models/PostAnalytics';
import { ShortLink } from '../models/ShortLink';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface PostPerformanceSummary {
  post: {
    _id: string;
    content: string;
    platform: string;
    publishedAt: Date;
    status: string;
  };
  analytics: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    clicks: number;
    engagementRate: number;
    clickThroughRate: number;
    linkClicks: number;
    adSpend?: number;
    estimatedRevenue?: number;
    roi?: number;
    costPerClick?: number;
  } | null;
}

export interface TopPerformingPost {
  postId: string;
  content: string;
  platform: string;
  publishedAt: Date;
  impressions: number;
  engagementRate: number;
  clickThroughRate: number;
  linkClicks: number;
  roi?: number;
  adSpend?: number;
  estimatedRevenue?: number;
}

export class PostROIService {
  /**
   * Link post to short links created around publish time
   */
  static async linkPostToShortLinks(postId: string, workspaceId: string): Promise<void> {
    try {
      // Get the post to find its publish time
      const post = await Post.findOne({
        _id: postId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!post || !post.publishedAt) {
        logger.warn('Post not found or not published', { postId, workspaceId });
        return;
      }

      // Find short links created within ±1 hour of post publish time
      const publishTime = new Date(post.publishedAt);
      const startTime = new Date(publishTime.getTime() - 60 * 60 * 1000); // 1 hour before
      const endTime = new Date(publishTime.getTime() + 60 * 60 * 1000); // 1 hour after

      const shortLinks = await ShortLink.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        createdAt: { $gte: startTime, $lte: endTime },
      });

      // Sum up all clicks from these short links
      const totalLinkClicks = shortLinks.reduce((sum, link) => sum + (link.clicks || 0), 0);

      // Update PostAnalytics with link clicks
      await PostAnalytics.findOneAndUpdate(
        { postId: new mongoose.Types.ObjectId(postId) },
        { $set: { linkClicks: totalLinkClicks } },
        { upsert: false }
      );

      logger.info('Post linked to short links', {
        postId,
        shortLinksFound: shortLinks.length,
        totalLinkClicks,
      });
    } catch (error: any) {
      logger.error('Failed to link post to short links', {
        error: error.message,
        postId,
        workspaceId,
      });
      throw new Error(`Failed to link post to short links: ${error.message}`);
    }
  }

  /**
   * Update ROI data for a post
   */
  static async updateROI(
    postId: string,
    adSpend?: number,
    estimatedRevenue?: number
  ): Promise<void> {
    try {
      const updateData: any = {};
      
      if (adSpend !== undefined) {
        updateData.adSpend = adSpend;
      }
      
      if (estimatedRevenue !== undefined) {
        updateData.estimatedRevenue = estimatedRevenue;
      }

      const analytics = await PostAnalytics.findOneAndUpdate(
        { postId: new mongoose.Types.ObjectId(postId) },
        { $set: updateData },
        { new: true, upsert: false }
      );

      if (!analytics) {
        throw new Error('Post analytics not found');
      }

      // The pre-save hook will calculate ROI and costPerClick
      await analytics.save();

      logger.info('Post ROI updated', { postId, adSpend, estimatedRevenue });
    } catch (error: any) {
      logger.error('Failed to update post ROI', {
        error: error.message,
        postId,
        adSpend,
        estimatedRevenue,
      });
      throw new Error(`Failed to update post ROI: ${error.message}`);
    }
  }

  /**
   * Get comprehensive post performance summary
   */
  static async getPostPerformanceSummary(
    postId: string,
    workspaceId: string
  ): Promise<PostPerformanceSummary> {
    try {
      // Get post data
      const post = await Post.findOne({
        _id: postId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      }).select('_id content platform publishedAt status');

      if (!post) {
        throw new Error('Post not found');
      }

      // Get analytics data
      const analytics = await PostAnalytics.findOne({
        postId: new mongoose.Types.ObjectId(postId),
      });

      const result: PostPerformanceSummary = {
        post: {
          _id: post._id.toString(),
          content: post.content,
          platform: (post as any).platform || (post.platformContent && post.platformContent.length > 0 ? post.platformContent[0].platform : 'unknown'),
          publishedAt: post.publishedAt || new Date(),
          status: post.status,
        },
        analytics: analytics ? {
          likes: analytics.likes,
          comments: analytics.comments,
          shares: analytics.shares,
          impressions: analytics.impressions,
          clicks: analytics.clicks,
          engagementRate: analytics.engagementRate,
          clickThroughRate: analytics.clickThroughRate || 0,
          linkClicks: analytics.linkClicks,
          adSpend: analytics.adSpend,
          estimatedRevenue: analytics.estimatedRevenue,
          roi: analytics.roi,
          costPerClick: analytics.costPerClick,
        } : null,
      };

      return result;
    } catch (error: any) {
      logger.error('Failed to get post performance summary', {
        error: error.message,
        postId,
        workspaceId,
      });
      throw new Error(`Failed to get post performance summary: ${error.message}`);
    }
  }

  /**
   * Get top performing posts
   */
  static async getTopPerformingPosts(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
    sortBy: 'engagement' | 'ctr' | 'roi' = 'engagement',
    limit: number = 20
  ): Promise<TopPerformingPost[]> {
    try {
      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: 'published',
      };

      if (startDate || endDate) {
        matchStage.publishedAt = {};
        if (startDate) matchStage.publishedAt.$gte = startDate;
        if (endDate) matchStage.publishedAt.$lte = endDate;
      }

      // Determine sort field
      let sortField = 'analytics.engagementRate';
      if (sortBy === 'ctr') {
        sortField = 'analytics.clickThroughRate';
      } else if (sortBy === 'roi') {
        sortField = 'analytics.roi';
      }

      const pipeline: any[] = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'postanalytics',
            localField: '_id',
            foreignField: 'postId',
            as: 'analytics',
          },
        },
        { $unwind: { path: '$analytics', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            'analytics.impressions': { $gt: 0 }, // Only posts with analytics data
          },
        },
        {
          $project: {
            postId: { $toString: '$_id' },
            content: 1,
            platform: { $ifNull: [{ $arrayElemAt: ['$platformContent.platform', 0] }, 'unknown'] },
            publishedAt: 1,
            impressions: '$analytics.impressions',
            engagementRate: '$analytics.engagementRate',
            clickThroughRate: { $ifNull: ['$analytics.clickThroughRate', 0] },
            linkClicks: { $ifNull: ['$analytics.linkClicks', 0] },
            roi: '$analytics.roi',
            adSpend: '$analytics.adSpend',
            estimatedRevenue: '$analytics.estimatedRevenue',
          },
        },
        { $sort: { [sortField]: -1 } },
        { $limit: limit },
      ];

      const results = await Post.aggregate(pipeline);
      return results;
    } catch (error: any) {
      logger.error('Failed to get top performing posts', {
        error: error.message,
        workspaceId,
        sortBy,
      });
      throw new Error(`Failed to get top performing posts: ${error.message}`);
    }
  }
}