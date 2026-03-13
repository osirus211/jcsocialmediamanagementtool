/**
 * Follower Analytics Service
 * 
 * Handles follower growth tracking and analysis
 */

import { FollowerHistory, IFollowerHistory } from '../models/FollowerHistory';
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface FollowerGrowthData {
  accountId: string;
  platform: string;
  currentFollowers: number;
  previousFollowers: number;
  growth: number;
  growthPercentage: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface FollowerTrendData {
  date: string;
  followerCount: number;
}

export class FollowerAnalyticsService {
  /**
   * Record follower count snapshot
   */
  static async recordFollowerSnapshot(
    accountId: string,
    workspaceId: string,
    platform: string,
    followerCount: number
  ): Promise<IFollowerHistory> {
    try {
      const snapshot = new FollowerHistory({
        accountId,
        workspaceId,
        platform,
        followerCount,
        recordedAt: new Date(),
      });

      await snapshot.save();

      logger.info('Follower snapshot recorded', {
        accountId,
        platform,
        followerCount,
      });

      return snapshot;
    } catch (error: any) {
      // Handle duplicate key error (snapshot already exists for this time)
      if (error.code === 11000) {
        logger.debug('Follower snapshot already exists', {
          accountId,
          recordedAt: new Date(),
        });
        throw new Error('Follower snapshot already recorded for this time period');
      }

      logger.error('Record follower snapshot error:', error);
      throw new Error(`Failed to record follower snapshot: ${error.message}`);
    }
  }

  /**
   * Get follower history for an account
   */
  static async getFollowerHistory(
    accountId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<IFollowerHistory[]> {
    try {
      const query: any = { accountId };

      if (startDate || endDate) {
        query.recordedAt = {};
        if (startDate) query.recordedAt.$gte = startDate;
        if (endDate) query.recordedAt.$lte = endDate;
      }

      const history = await FollowerHistory.find(query)
        .sort({ recordedAt: -1 })
        .limit(limit)
        .lean();

      return history as unknown as IFollowerHistory[];
    } catch (error: any) {
      logger.error('Get follower history error:', error);
      throw new Error(`Failed to get follower history: ${error.message}`);
    }
  }

  /**
   * Get follower growth for an account
   */
  static async getFollowerGrowth(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FollowerGrowthData | null> {
    try {
      // Get account info
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Default date range: last 30 days
      const end = endDate || new Date();
      const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get earliest and latest snapshots in the period
      const [earliest, latest] = await Promise.all([
        FollowerHistory.findOne({
          accountId,
          recordedAt: { $gte: start, $lte: end },
        })
          .sort({ recordedAt: 1 })
          .lean(),

        FollowerHistory.findOne({
          accountId,
          recordedAt: { $gte: start, $lte: end },
        })
          .sort({ recordedAt: -1 })
          .lean(),
      ]);

      if (!earliest || !latest) {
        return null;
      }

      const growth = latest.followerCount - earliest.followerCount;
      const growthPercentage = earliest.followerCount > 0
        ? (growth / earliest.followerCount) * 100
        : 0;

      return {
        accountId: accountId.toString(),
        platform: account.provider,
        currentFollowers: latest.followerCount,
        previousFollowers: earliest.followerCount,
        growth,
        growthPercentage: Math.round(growthPercentage * 10) / 10,
        period: {
          startDate: start,
          endDate: end,
        },
      };
    } catch (error: any) {
      logger.error('Get follower growth error:', error);
      throw new Error(`Failed to get follower growth: ${error.message}`);
    }
  }

  /**
   * Get follower trends over time
   */
  static async getFollowerTrends(
    accountId: string,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<FollowerTrendData[]> {
    try {
      const groupByFormat = interval === 'day'
        ? '%Y-%m-%d'
        : interval === 'week'
        ? '%Y-W%U'
        : '%Y-%m';

      const trends = await FollowerHistory.aggregate([
        {
          $match: {
            accountId: new mongoose.Types.ObjectId(accountId),
            recordedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: groupByFormat, date: '$recordedAt' } },
            followerCount: { $last: '$followerCount' }, // Take last snapshot of the period
          },
        },
        {
          $project: {
            date: '$_id',
            followerCount: 1,
            _id: 0,
          },
        },
        { $sort: { date: 1 } },
      ]);

      return trends;
    } catch (error: any) {
      logger.error('Get follower trends error:', error);
      throw new Error(`Failed to get follower trends: ${error.message}`);
    }
  }

  /**
   * Get follower growth for all accounts in workspace
   */
  static async getWorkspaceFollowerGrowth(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FollowerGrowthData[]> {
    try {
      // Get all active accounts in workspace
      const accounts = await SocialAccount.find({
        workspaceId,
        status: 'active',
      }).lean();

      // Get growth for each account
      const growthPromises = accounts.map(account =>
        this.getFollowerGrowth(account._id.toString(), startDate, endDate)
      );

      const growthResults = await Promise.all(growthPromises);

      // Filter out null results
      return growthResults.filter(result => result !== null) as FollowerGrowthData[];
    } catch (error: any) {
      logger.error('Get workspace follower growth error:', error);
      throw new Error(`Failed to get workspace follower growth: ${error.message}`);
    }
  }

  /**
   * Get latest follower count for an account
   */
  static async getLatestFollowerCount(accountId: string): Promise<number | null> {
    try {
      const latest = await FollowerHistory.findOne({ accountId })
        .sort({ recordedAt: -1 })
        .lean();

      return latest ? latest.followerCount : null;
    } catch (error: any) {
      logger.error('Get latest follower count error:', error);
      return null;
    }
  }
}
