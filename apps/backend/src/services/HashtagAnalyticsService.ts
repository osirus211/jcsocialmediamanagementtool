/**
 * Hashtag Analytics Service
 * 
 * Handles hashtag performance tracking and analysis
 */

import { Post } from '../models/Post';
import { PostAnalytics } from '../models/PostAnalytics';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface HashtagPerformanceData {
  hashtag: string;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  avgEngagementRate: number;
  bestPost: {
    postId: string;
    engagementRate: number;
    platform: string;
  } | null;
  topPlatform: string;
}

export interface HashtagTrendData {
  week: string;
  postCount: number;
  avgEngagement: number;
}

export interface HashtagSuggestion {
  hashtag: string;
  avgEngagementRate: number;
  postCount: number;
}

export class HashtagAnalyticsService {
  /**
   * Get hashtag performance metrics for workspace
   */
  static async getHashtagPerformance(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 20
  ): Promise<HashtagPerformanceData[]> {
    try {
      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        'metadata.hashtags': { $exists: true, $ne: [] },
      };

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
      }

      const pipeline = [
        { $match: matchStage },
        { $unwind: '$metadata.hashtags' },
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
          $group: {
            _id: '$metadata.hashtags',
            postCount: { $sum: 1 },
            totalLikes: { $sum: { $ifNull: ['$analytics.likes', 0] } },
            totalComments: { $sum: { $ifNull: ['$analytics.comments', 0] } },
            totalShares: { $sum: { $ifNull: ['$analytics.shares', 0] } },
            totalImpressions: { $sum: { $ifNull: ['$analytics.impressions', 0] } },
            engagementRates: { $push: { $ifNull: ['$analytics.engagementRate', 0] } },
            posts: {
              $push: {
                postId: '$_id',
                engagementRate: { $ifNull: ['$analytics.engagementRate', 0] },
                platform: '$platform',
              },
            },
            platforms: { $push: '$platform' },
          },
        },
        {
          $addFields: {
            avgEngagementRate: { $avg: '$engagementRates' },
            bestPost: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: '$posts',
                    sortBy: { engagementRate: -1 },
                  },
                },
                0,
              ],
            },
            topPlatform: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: {
                      $map: {
                        input: {
                          $setUnion: '$platforms',
                        },
                        as: 'platform',
                        in: {
                          platform: '$$platform',
                          count: {
                            $size: {
                              $filter: {
                                input: '$platforms',
                                cond: { $eq: ['$$this', '$$platform'] },
                              },
                            },
                          },
                        },
                      },
                    },
                    sortBy: { count: -1 },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $project: {
            hashtag: '$_id',
            postCount: 1,
            totalLikes: 1,
            totalComments: 1,
            totalShares: 1,
            totalImpressions: 1,
            avgEngagementRate: { $round: ['$avgEngagementRate', 2] },
            bestPost: {
              postId: { $toString: '$bestPost.postId' },
              engagementRate: '$bestPost.engagementRate',
              platform: '$bestPost.platform',
            },
            topPlatform: '$topPlatform.platform',
            _id: 0,
          },
        },
        { $sort: { avgEngagementRate: -1 } },
        { $limit: limit },
      ];

      const results = await Post.aggregate(pipeline as any[]);
      return results;
    } catch (error: any) {
      logger.error('Get hashtag performance error:', { error: error.message, workspaceId });
      throw new Error(`Failed to get hashtag performance: ${error.message}`);
    }
  }

  /**
   * Get hashtag trends over time
   */
  static async getHashtagTrends(
    workspaceId: string,
    hashtag: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<HashtagTrendData[]> {
    try {
      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        'metadata.hashtags': hashtag,
      };

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
      }

      const pipeline = [
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
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-W%U',
                date: '$createdAt',
              },
            },
            postCount: { $sum: 1 },
            engagementRates: { $push: { $ifNull: ['$analytics.engagementRate', 0] } },
          },
        },
        {
          $project: {
            week: '$_id',
            postCount: 1,
            avgEngagement: { $round: [{ $avg: '$engagementRates' }, 2] },
            _id: 0,
          },
        },
        { $sort: { week: 1 } },
      ];

      const results = await Post.aggregate(pipeline as any[]);
      return results;
    } catch (error: any) {
      logger.error('Get hashtag trends error:', { error: error.message, workspaceId, hashtag });
      throw new Error(`Failed to get hashtag trends: ${error.message}`);
    }
  }

  /**
   * Get top hashtags by platform
   */
  static async getTopHashtagsByPlatform(
    workspaceId: string,
    platform: string,
    limit: number = 20
  ): Promise<HashtagPerformanceData[]> {
    try {
      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        platform: platform,
        'metadata.hashtags': { $exists: true, $ne: [] },
      };

      const pipeline = [
        { $match: matchStage },
        { $unwind: '$metadata.hashtags' },
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
          $group: {
            _id: '$metadata.hashtags',
            postCount: { $sum: 1 },
            totalLikes: { $sum: { $ifNull: ['$analytics.likes', 0] } },
            totalComments: { $sum: { $ifNull: ['$analytics.comments', 0] } },
            totalShares: { $sum: { $ifNull: ['$analytics.shares', 0] } },
            totalImpressions: { $sum: { $ifNull: ['$analytics.impressions', 0] } },
            engagementRates: { $push: { $ifNull: ['$analytics.engagementRate', 0] } },
            bestPost: {
              $max: {
                postId: '$_id',
                engagementRate: { $ifNull: ['$analytics.engagementRate', 0] },
                platform: '$platform',
              },
            },
          },
        },
        {
          $project: {
            hashtag: '$_id',
            postCount: 1,
            totalLikes: 1,
            totalComments: 1,
            totalShares: 1,
            totalImpressions: 1,
            avgEngagementRate: { $round: [{ $avg: '$engagementRates' }, 2] },
            bestPost: {
              postId: { $toString: '$bestPost.postId' },
              engagementRate: '$bestPost.engagementRate',
              platform: '$bestPost.platform',
            },
            topPlatform: platform,
            _id: 0,
          },
        },
        { $sort: { avgEngagementRate: -1 } },
        { $limit: limit },
      ];

      const results = await Post.aggregate(pipeline as any[]);
      return results;
    } catch (error: any) {
      logger.error('Get hashtags by platform error:', { error: error.message, workspaceId, platform });
      throw new Error(`Failed to get hashtags by platform: ${error.message}`);
    }
  }

  /**
   * Get hashtag suggestions based on performance
   */
  static async getHashtagSuggestions(
    workspaceId: string,
    limit: number = 10
  ): Promise<HashtagSuggestion[]> {
    try {
      const matchStage: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        'metadata.hashtags': { $exists: true, $ne: [] },
      };

      const pipeline = [
        { $match: matchStage },
        { $unwind: '$metadata.hashtags' },
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
          $group: {
            _id: '$metadata.hashtags',
            postCount: { $sum: 1 },
            engagementRates: { $push: { $ifNull: ['$analytics.engagementRate', 0] } },
          },
        },
        {
          $match: {
            postCount: { $gte: 2 }, // Only suggest hashtags used in at least 2 posts
          },
        },
        {
          $project: {
            hashtag: '$_id',
            postCount: 1,
            avgEngagementRate: { $round: [{ $avg: '$engagementRates' }, 2] },
            _id: 0,
          },
        },
        { $sort: { avgEngagementRate: -1 } },
        { $limit: limit },
      ];

      const results = await Post.aggregate(pipeline as any[]);
      return results;
    } catch (error: any) {
      logger.error('Get hashtag suggestions error:', { error: error.message, workspaceId });
      throw new Error(`Failed to get hashtag suggestions: ${error.message}`);
    }
  }
}