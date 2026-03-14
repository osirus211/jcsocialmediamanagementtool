import { HashtagHistory, IHashtagHistory } from '../models/HashtagHistory';
import mongoose from 'mongoose';

export interface HashtagUsageData {
  hashtag: string;
  usageCount: number;
  lastUsed: Date;
  platform: string;
  frequency: 'high' | 'medium' | 'low';
}

export interface HashtagHistoryStats {
  totalUniqueHashtags: number;
  totalUsages: number;
  mostUsedHashtag: HashtagUsageData | null;
  recentHashtags: HashtagUsageData[];
  topHashtags: HashtagUsageData[];
  platformBreakdown: { [platform: string]: number };
}

export class HashtagHistoryService {
  /**
   * Record hashtag usage
   */
  static async recordHashtagUsage(
    hashtags: string[],
    workspaceId: string,
    userId: string,
    platform: string = 'all'
  ): Promise<void> {
    const bulkOps = hashtags.map(hashtag => {
      const normalizedHashtag = hashtag.toLowerCase().trim();
      const hashtagWithSymbol = normalizedHashtag.startsWith('#') ? normalizedHashtag : `#${normalizedHashtag}`;

      return {
        updateOne: {
          filter: {
            hashtag: hashtagWithSymbol,
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            platform: platform
          },
          update: {
            $inc: { usageCount: 1 },
            $set: { 
              lastUsed: new Date(),
              userId: new mongoose.Types.ObjectId(userId)
            },
            $setOnInsert: {
              hashtag: hashtagWithSymbol,
              workspaceId: new mongoose.Types.ObjectId(workspaceId),
              userId: new mongoose.Types.ObjectId(userId),
              platform: platform
            }
          },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      await HashtagHistory.bulkWrite(bulkOps);
    }
  }

  /**
   * Get recent hashtags for a workspace
   */
  static async getRecentHashtags(
    workspaceId: string,
    platform?: string,
    limit: number = 50
  ): Promise<HashtagUsageData[]> {
    const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
    
    if (platform && platform !== 'all') {
      query.$or = [
        { platform: platform },
        { platform: 'all' }
      ];
    }

    const recentHashtags = await HashtagHistory.find(query)
      .sort({ lastUsed: -1 })
      .limit(limit)
      .lean();

    return recentHashtags.map(h => ({
      hashtag: h.hashtag,
      usageCount: h.usageCount,
      lastUsed: h.lastUsed,
      platform: h.platform,
      frequency: this.getFrequencyLabel(h.usageCount)
    }));
  }

  /**
   * Get most used hashtags for a workspace
   */
  static async getTopHashtags(
    workspaceId: string,
    platform?: string,
    limit: number = 20
  ): Promise<HashtagUsageData[]> {
    const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
    
    if (platform && platform !== 'all') {
      query.$or = [
        { platform: platform },
        { platform: 'all' }
      ];
    }

    const topHashtags = await HashtagHistory.find(query)
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(limit)
      .lean();

    return topHashtags.map(h => ({
      hashtag: h.hashtag,
      usageCount: h.usageCount,
      lastUsed: h.lastUsed,
      platform: h.platform,
      frequency: this.getFrequencyLabel(h.usageCount)
    }));
  }

  /**
   * Get hashtag history statistics
   */
  static async getHashtagStats(workspaceId: string): Promise<HashtagHistoryStats> {
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    // Get total unique hashtags and total usages
    const [totalStats] = await HashtagHistory.aggregate([
      { $match: { workspaceId: workspaceObjectId } },
      {
        $group: {
          _id: null,
          totalUniqueHashtags: { $sum: 1 },
          totalUsages: { $sum: '$usageCount' }
        }
      }
    ]);

    // Get most used hashtag
    const [mostUsed] = await HashtagHistory.find({ workspaceId: workspaceObjectId })
      .sort({ usageCount: -1 })
      .limit(1)
      .lean();

    // Get platform breakdown
    const platformBreakdown = await HashtagHistory.aggregate([
      { $match: { workspaceId: workspaceObjectId } },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent and top hashtags
    const recentHashtags = await this.getRecentHashtags(workspaceId, undefined, 10);
    const topHashtags = await this.getTopHashtags(workspaceId, undefined, 10);

    return {
      totalUniqueHashtags: totalStats?.totalUniqueHashtags || 0,
      totalUsages: totalStats?.totalUsages || 0,
      mostUsedHashtag: mostUsed ? {
        hashtag: mostUsed.hashtag,
        usageCount: mostUsed.usageCount,
        lastUsed: mostUsed.lastUsed,
        platform: mostUsed.platform,
        frequency: this.getFrequencyLabel(mostUsed.usageCount)
      } : null,
      recentHashtags,
      topHashtags,
      platformBreakdown: platformBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as { [platform: string]: number })
    };
  }

  /**
   * Search hashtag history
   */
  static async searchHashtagHistory(
    workspaceId: string,
    searchTerm: string,
    platform?: string,
    limit: number = 20
  ): Promise<HashtagUsageData[]> {
    const query: any = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      hashtag: { $regex: searchTerm, $options: 'i' }
    };
    
    if (platform && platform !== 'all') {
      query.$or = [
        { platform: platform },
        { platform: 'all' }
      ];
    }

    const results = await HashtagHistory.find(query)
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(limit)
      .lean();

    return results.map(h => ({
      hashtag: h.hashtag,
      usageCount: h.usageCount,
      lastUsed: h.lastUsed,
      platform: h.platform,
      frequency: this.getFrequencyLabel(h.usageCount)
    }));
  }

  /**
   * Clear hashtag history for a workspace
   */
  static async clearHashtagHistory(
    workspaceId: string,
    platform?: string
  ): Promise<number> {
    const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
    
    if (platform && platform !== 'all') {
      query.platform = platform;
    }

    const result = await HashtagHistory.deleteMany(query);
    return result.deletedCount || 0;
  }

  /**
   * Remove specific hashtag from history
   */
  static async removeHashtagFromHistory(
    workspaceId: string,
    hashtag: string,
    platform?: string
  ): Promise<boolean> {
    const normalizedHashtag = hashtag.toLowerCase().trim();
    const hashtagWithSymbol = normalizedHashtag.startsWith('#') ? normalizedHashtag : `#${normalizedHashtag}`;

    const query: any = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      hashtag: hashtagWithSymbol
    };

    if (platform && platform !== 'all') {
      query.platform = platform;
    }

    const result = await HashtagHistory.deleteOne(query);
    return result.deletedCount > 0;
  }

  /**
   * Get hashtag usage trends over time
   */
  static async getHashtagTrends(
    workspaceId: string,
    days: number = 30
  ): Promise<{ date: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await HashtagHistory.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          lastUsed: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$lastUsed'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    return trends.map(trend => ({
      date: trend._id,
      count: trend.count
    }));
  }

  /**
   * Get user-specific hashtag history
   */
  static async getUserHashtagHistory(
    userId: string,
    workspaceId: string,
    limit: number = 30
  ): Promise<HashtagUsageData[]> {
    const userHashtags = await HashtagHistory.find({
      userId: new mongoose.Types.ObjectId(userId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    })
    .sort({ lastUsed: -1 })
    .limit(limit)
    .lean();

    return userHashtags.map(h => ({
      hashtag: h.hashtag,
      usageCount: h.usageCount,
      lastUsed: h.lastUsed,
      platform: h.platform,
      frequency: this.getFrequencyLabel(h.usageCount)
    }));
  }

  /**
   * Get frequency label based on usage count
   */
  private static getFrequencyLabel(usageCount: number): 'high' | 'medium' | 'low' {
    if (usageCount >= 10) return 'high';
    if (usageCount >= 3) return 'medium';
    return 'low';
  }

  /**
   * Clean up old hashtag history (keep only recent entries)
   */
  static async cleanupOldHistory(
    workspaceId: string,
    keepRecentDays: number = 365
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepRecentDays);

    const result = await HashtagHistory.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      lastUsed: { $lt: cutoffDate }
    });

    return result.deletedCount || 0;
  }
}