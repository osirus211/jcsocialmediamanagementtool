import mongoose from 'mongoose';
import { Campaign, ICampaign, CampaignStatus } from '../models/Campaign';
import { Post, IPost, PostStatus } from '../models/Post';

/**
 * Campaign Service
 * 
 * Handles campaign management and analytics
 */

export interface CreateCampaignData {
  name: string;
  description?: string;
  color?: string;
  status?: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
  goals?: string;
}

export interface UpdateCampaignData {
  name?: string;
  description?: string;
  color?: string;
  status?: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
  goals?: string;
}

export interface CampaignFilters {
  status?: CampaignStatus;
}

export interface CampaignStats {
  totalPosts: number;
  published: number;
  scheduled: number;
  draft: number;
  platforms: string[];
}

export class CampaignService {
  /**
   * Get all campaigns for a workspace with optional filters
   */
  static async getCampaigns(
    workspaceId: string,
    filters?: CampaignFilters
  ): Promise<ICampaign[]> {
    const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
    
    if (filters?.status) {
      query.status = filters.status;
    }

    return Campaign.find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get a single campaign with post count
   */
  static async getCampaign(id: string, workspaceId: string): Promise<ICampaign | null> {
    return Campaign.findOne({
      _id: new mongoose.Types.ObjectId(id),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    }).exec();
  }

  /**
   * Create a new campaign
   */
  static async createCampaign(
    workspaceId: string,
    userId: string,
    data: CreateCampaignData
  ): Promise<ICampaign> {
    const campaign = new Campaign({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      createdBy: new mongoose.Types.ObjectId(userId),
      ...data,
    });

    return campaign.save();
  }

  /**
   * Update a campaign
   */
  static async updateCampaign(
    id: string,
    workspaceId: string,
    data: UpdateCampaignData
  ): Promise<ICampaign | null> {
    return Campaign.findOneAndUpdate(
      { 
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      },
      data,
      { new: true }
    ).exec();
  }

  /**
   * Delete a campaign and remove it from all posts
   */
  static async deleteCampaign(id: string, workspaceId: string): Promise<void> {
    const campaignId = new mongoose.Types.ObjectId(id);
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    // Remove campaign from all posts
    await Post.updateMany(
      { 
        campaignId,
        workspaceId: workspaceObjectId
      },
      { $unset: { campaignId: 1 } }
    );

    // Delete the campaign
    await Campaign.findOneAndDelete({
      _id: campaignId,
      workspaceId: workspaceObjectId
    });
  }

  /**
   * Get all posts for a campaign
   */
  static async getCampaignPosts(id: string, workspaceId: string): Promise<IPost[]> {
    return Post.find({
      campaignId: new mongoose.Types.ObjectId(id),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    })
    .populate('socialAccountId', 'platform username profilePicture')
    .sort({ createdAt: -1 })
    .exec();
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStats(id: string, workspaceId: string): Promise<CampaignStats> {
    const campaignId = new mongoose.Types.ObjectId(id);
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    const posts = await Post.find({
      campaignId,
      workspaceId: workspaceObjectId
    })
    .populate('socialAccountId', 'platform')
    .exec();

    const stats: CampaignStats = {
      totalPosts: posts.length,
      published: posts.filter(p => p.status === PostStatus.PUBLISHED).length,
      scheduled: posts.filter(p => p.status === PostStatus.SCHEDULED).length,
      draft: posts.filter(p => p.status === PostStatus.DRAFT).length,
      platforms: [...new Set(posts.map(p => (p.socialAccountId as any)?.platform).filter(Boolean))]
    };

    return stats;
  }

  /**
   * Increment post count for a campaign
   */
  static async incrementPostCount(campaignId: string): Promise<void> {
    await Campaign.findByIdAndUpdate(
      new mongoose.Types.ObjectId(campaignId),
      { $inc: { postCount: 1 } }
    );
  }

  /**
   * Decrement post count for a campaign
   */
  static async decrementPostCount(campaignId: string): Promise<void> {
    await Campaign.findByIdAndUpdate(
      new mongoose.Types.ObjectId(campaignId),
      { $inc: { postCount: -1 } }
    );
  }

  /**
   * Recalculate post count for a campaign
   */
  static async recalculatePostCount(campaignId: string): Promise<void> {
    const postCount = await Post.countDocuments({
      campaignId: new mongoose.Types.ObjectId(campaignId)
    });

    await Campaign.findByIdAndUpdate(
      new mongoose.Types.ObjectId(campaignId),
      { postCount }
    );
  }

  /**
   * Recalculate post counts for all campaigns in a workspace
   */
  static async recalculateAllPostCounts(workspaceId: string): Promise<void> {
    const campaigns = await Campaign.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });

    for (const campaign of campaigns) {
      await this.recalculatePostCount(campaign._id.toString());
    }
  }
}