import { HashtagGroup, IHashtagGroup } from '../models/HashtagGroup';
import mongoose from 'mongoose';

export interface CreateHashtagGroupData {
  name: string;
  hashtags: string[];
  platform: 'instagram' | 'twitter' | 'tiktok' | 'linkedin' | 'facebook' | 'all';
  workspaceId: string;
  createdBy: string;
}

export interface UpdateHashtagGroupData {
  name?: string;
  hashtags?: string[];
  platform?: 'instagram' | 'twitter' | 'tiktok' | 'linkedin' | 'facebook' | 'all';
}

export class HashtagGroupsService {
  /**
   * Get all hashtag groups for a workspace
   */
  static async getHashtagGroups(
    workspaceId: string,
    platform?: string
  ): Promise<any[]> {
    const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
    
    if (platform && platform !== 'all') {
      query.$or = [
        { platform: platform },
        { platform: 'all' }
      ];
    }

    return await HashtagGroup.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get a specific hashtag group by ID
   */
  static async getHashtagGroupById(
    groupId: string,
    workspaceId: string
  ): Promise<any | null> {
    return await HashtagGroup.findOne({
      _id: new mongoose.Types.ObjectId(groupId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    })
    .populate('createdBy', 'name email')
    .lean();
  }

  /**
   * Create a new hashtag group
   */
  static async createHashtagGroup(data: CreateHashtagGroupData): Promise<IHashtagGroup> {
    // Validate and clean hashtags
    const cleanedHashtags = data.hashtags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
      .slice(0, 50); // Limit to 50 hashtags per group

    if (cleanedHashtags.length === 0) {
      throw new Error('At least one hashtag is required');
    }

    // Check for duplicate name in workspace
    const existingGroup = await HashtagGroup.findOne({
      name: data.name,
      workspaceId: new mongoose.Types.ObjectId(data.workspaceId)
    });

    if (existingGroup) {
      throw new Error('A hashtag group with this name already exists');
    }

    const hashtagGroup = new HashtagGroup({
      name: data.name,
      hashtags: cleanedHashtags,
      platform: data.platform,
      workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
      createdBy: new mongoose.Types.ObjectId(data.createdBy)
    });

    return await hashtagGroup.save();
  }

  /**
   * Update an existing hashtag group
   */
  static async updateHashtagGroup(
    groupId: string,
    workspaceId: string,
    data: UpdateHashtagGroupData
  ): Promise<any | null> {
    const updateData: any = {};

    if (data.name) {
      // Check for duplicate name if name is being changed
      const existingGroup = await HashtagGroup.findOne({
        name: data.name,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        _id: { $ne: new mongoose.Types.ObjectId(groupId) }
      });

      if (existingGroup) {
        throw new Error('A hashtag group with this name already exists');
      }
      updateData.name = data.name;
    }

    if (data.hashtags) {
      // Validate and clean hashtags
      const cleanedHashtags = data.hashtags
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .slice(0, 50);

      if (cleanedHashtags.length === 0) {
        throw new Error('At least one hashtag is required');
      }
      updateData.hashtags = cleanedHashtags;
    }

    if (data.platform) {
      updateData.platform = data.platform;
    }

    return await HashtagGroup.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(groupId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('createdBy', 'name email')
    .lean();
  }

  /**
   * Delete a hashtag group
   */
  static async deleteHashtagGroup(
    groupId: string,
    workspaceId: string
  ): Promise<boolean> {
    const result = await HashtagGroup.deleteOne({
      _id: new mongoose.Types.ObjectId(groupId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });

    return result.deletedCount > 0;
  }

  /**
   * Get hashtag groups count for a workspace
   */
  static async getHashtagGroupsCount(workspaceId: string): Promise<number> {
    return await HashtagGroup.countDocuments({
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });
  }

  /**
   * Search hashtag groups by name
   */
  static async searchHashtagGroups(
    workspaceId: string,
    searchTerm: string,
    platform?: string
  ): Promise<any[]> {
    const query: any = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: { $regex: searchTerm, $options: 'i' }
    };

    if (platform && platform !== 'all') {
      query.$or = [
        { platform: platform },
        { platform: 'all' }
      ];
    }

    return await HashtagGroup.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }
}