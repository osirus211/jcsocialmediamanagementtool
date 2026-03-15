/**
 * Media Tag Service
 * 
 * Handles media tagging operations and tag management
 */

import mongoose from 'mongoose';
import { Media, IMedia } from '../models/Media';
import { logger } from '../utils/logger';

export interface TagCloudItem {
  tag: string;
  count: number;
  percentage: number;
}

export interface TagStats {
  totalTags: number;
  uniqueTags: number;
  mostUsedTags: TagCloudItem[];
  tagCloud: TagCloudItem[];
}

export class MediaTagService {
  private static instance: MediaTagService;

  private constructor() {}

  static getInstance(): MediaTagService {
    if (!MediaTagService.instance) {
      MediaTagService.instance = new MediaTagService();
    }
    return MediaTagService.instance;
  }

  /**
   * Add tags to media
   * 
   * @param mediaId - Media ID
   * @param workspaceId - Workspace ID
   * @param newTags - Array of tags to add
   * @returns Updated media document
   */
  async addTags(
    mediaId: string,
    workspaceId: string,
    newTags: string[]
  ): Promise<IMedia | null> {
    try {
      // Normalize new tags
      const normalizedNewTags = this.normalizeTags(newTags);

      // Get current media
      const media = await Media.findOne({
        _id: mediaId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!media) {
        logger.warn('Media not found for tag addition', { mediaId, workspaceId });
        return null;
      }

      // Merge with existing tags and remove duplicates
      const existingTags = media.tags || [];
      const mergedTags = [...new Set([...existingTags, ...normalizedNewTags])];

      // Update media
      const updatedMedia = await Media.findByIdAndUpdate(
        mediaId,
        { tags: mergedTags },
        { new: true }
      );

      logger.info('Tags added to media', {
        mediaId,
        workspaceId,
        addedTags: normalizedNewTags,
        totalTags: mergedTags.length,
      });

      return updatedMedia;
    } catch (error: any) {
      logger.error('Failed to add tags to media', {
        mediaId,
        workspaceId,
        newTags,
        error: error.message,
      });
      throw new Error(`Failed to add tags: ${error.message}`);
    }
  }

  /**
   * Remove tags from media
   * 
   * @param mediaId - Media ID
   * @param workspaceId - Workspace ID
   * @param tagsToRemove - Array of tags to remove
   * @returns Updated media document
   */
  async removeTags(
    mediaId: string,
    workspaceId: string,
    tagsToRemove: string[]
  ): Promise<IMedia | null> {
    try {
      // Normalize tags to remove
      const normalizedTagsToRemove = this.normalizeTags(tagsToRemove);

      // Get current media
      const media = await Media.findOne({
        _id: mediaId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!media) {
        logger.warn('Media not found for tag removal', { mediaId, workspaceId });
        return null;
      }

      // Filter out tags to remove
      const existingTags = media.tags || [];
      const filteredTags = existingTags.filter(
        tag => !normalizedTagsToRemove.includes(tag)
      );

      // Update media
      const updatedMedia = await Media.findByIdAndUpdate(
        mediaId,
        { tags: filteredTags },
        { new: true }
      );

      logger.info('Tags removed from media', {
        mediaId,
        workspaceId,
        removedTags: normalizedTagsToRemove,
        remainingTags: filteredTags.length,
      });

      return updatedMedia;
    } catch (error: any) {
      logger.error('Failed to remove tags from media', {
        mediaId,
        workspaceId,
        tagsToRemove,
        error: error.message,
      });
      throw new Error(`Failed to remove tags: ${error.message}`);
    }
  }

  /**
   * Get tag cloud for workspace
   * 
   * @param workspaceId - Workspace ID
   * @param limit - Maximum number of tags to return
   * @returns Tag cloud data
   */
  async getTagCloud(workspaceId: string, limit: number = 50): Promise<TagCloudItem[]> {
    try {
      const pipeline: any[] = [
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            tags: { $exists: true, $ne: [] },
          },
        },
        {
          $unwind: '$tags',
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: limit,
        },
      ];

      const results = await Media.aggregate(pipeline);

      // Calculate total for percentages
      const totalCount = results.reduce((sum, item) => sum + item.count, 0);

      const tagCloud: TagCloudItem[] = results.map(item => ({
        tag: item._id,
        count: item.count,
        percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0,
      }));

      logger.debug('Tag cloud generated', {
        workspaceId,
        tagCount: tagCloud.length,
        totalUsage: totalCount,
      });

      return tagCloud;
    } catch (error: any) {
      logger.error('Failed to get tag cloud', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get tag cloud: ${error.message}`);
    }
  }

  /**
   * Get media by tag
   * 
   * @param workspaceId - Workspace ID
   * @param tag - Tag to filter by
   * @param limit - Maximum number of media items to return
   * @param skip - Number of items to skip
   * @returns Media documents with the specified tag
   */
  async getMediaByTag(
    workspaceId: string,
    tag: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<{
    media: IMedia[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const normalizedTag = this.normalizeTag(tag);

      const filter = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        tags: normalizedTag,
      };

      const [media, total] = await Promise.all([
        Media.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        Media.countDocuments(filter),
      ]);

      const hasMore = skip + media.length < total;

      logger.debug('Media retrieved by tag', {
        workspaceId,
        tag: normalizedTag,
        count: media.length,
        total,
        hasMore,
      });

      return {
        media: media as unknown as IMedia[],
        total,
        hasMore,
      };
    } catch (error: any) {
      logger.error('Failed to get media by tag', {
        workspaceId,
        tag,
        error: error.message,
      });
      throw new Error(`Failed to get media by tag: ${error.message}`);
    }
  }

  /**
   * Get most used tags for workspace
   * 
   * @param workspaceId - Workspace ID
   * @param limit - Maximum number of tags to return
   * @returns Most used tags
   */
  async getMostUsedTags(workspaceId: string, limit: number = 20): Promise<TagCloudItem[]> {
    try {
      return await this.getTagCloud(workspaceId, limit);
    } catch (error: any) {
      logger.error('Failed to get most used tags', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get most used tags: ${error.message}`);
    }
  }

  /**
   * Get tag statistics for workspace
   * 
   * @param workspaceId - Workspace ID
   * @returns Tag statistics
   */
  async getTagStats(workspaceId: string): Promise<TagStats> {
    try {
      const [tagCloud, totalTagsResult, uniqueTagsResult] = await Promise.all([
        this.getTagCloud(workspaceId, 100),
        
        // Total tags count (sum of all tag usages)
        Media.aggregate([
          {
            $match: {
              workspaceId: new mongoose.Types.ObjectId(workspaceId),
              tags: { $exists: true, $ne: [] },
            },
          },
          {
            $project: {
              tagCount: { $size: '$tags' },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$tagCount' },
            },
          },
        ] as any[]),

        // Unique tags count
        Media.aggregate([
          {
            $match: {
              workspaceId: new mongoose.Types.ObjectId(workspaceId),
              tags: { $exists: true, $ne: [] },
            },
          },
          {
            $unwind: '$tags',
          },
          {
            $group: {
              _id: '$tags',
            },
          },
          {
            $count: 'uniqueTags',
          },
        ] as any[]),
      ]);

      const totalTags = totalTagsResult[0]?.total || 0;
      const uniqueTags = uniqueTagsResult[0]?.uniqueTags || 0;
      const mostUsedTags = tagCloud.slice(0, 10);

      const stats: TagStats = {
        totalTags,
        uniqueTags,
        mostUsedTags,
        tagCloud,
      };

      logger.debug('Tag statistics generated', {
        workspaceId,
        totalTags,
        uniqueTags,
        cloudSize: tagCloud.length,
      });

      return stats;
    } catch (error: any) {
      logger.error('Failed to get tag statistics', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get tag statistics: ${error.message}`);
    }
  }

  /**
   * Search tags by prefix
   * 
   * @param workspaceId - Workspace ID
   * @param prefix - Tag prefix to search for
   * @param limit - Maximum number of suggestions to return
   * @returns Matching tags with usage counts
   */
  async searchTags(
    workspaceId: string,
    prefix: string,
    limit: number = 10
  ): Promise<TagCloudItem[]> {
    try {
      const normalizedPrefix = this.normalizeTag(prefix);

      const pipeline: any[] = [
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            tags: { $exists: true, $ne: [] },
          },
        },
        {
          $unwind: '$tags',
        },
        {
          $match: {
            tags: { $regex: `^${normalizedPrefix}`, $options: 'i' },
          },
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: limit,
        },
      ];

      const results = await Media.aggregate(pipeline);

      const suggestions: TagCloudItem[] = results.map(item => ({
        tag: item._id,
        count: item.count,
        percentage: 0, // Not calculated for search results
      }));

      logger.debug('Tag search completed', {
        workspaceId,
        prefix: normalizedPrefix,
        resultCount: suggestions.length,
      });

      return suggestions;
    } catch (error: any) {
      logger.error('Failed to search tags', {
        workspaceId,
        prefix,
        error: error.message,
      });
      throw new Error(`Failed to search tags: ${error.message}`);
    }
  }

  /**
   * Bulk tag multiple media files
   * 
   * @param workspaceId - Workspace ID
   * @param mediaIds - Array of media IDs
   * @param tags - Array of tags to add
   * @returns Number of media files updated
   */
  async bulkTagMedia(
    workspaceId: string,
    mediaIds: string[],
    tags: string[]
  ): Promise<number> {
    try {
      const normalizedTags = this.normalizeTags(tags);

      // Get all media files to update
      const mediaFiles = await Media.find({
        _id: { $in: mediaIds.map(id => new mongoose.Types.ObjectId(id)) },
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      let updatedCount = 0;

      // Update each media file individually to merge tags properly
      for (const media of mediaFiles) {
        const existingTags = media.tags || [];
        const mergedTags = [...new Set([...existingTags, ...normalizedTags])];

        await Media.findByIdAndUpdate(
          media._id,
          { tags: mergedTags }
        );

        updatedCount++;
      }

      logger.info('Bulk tag operation completed', {
        workspaceId,
        mediaCount: updatedCount,
        tags: normalizedTags,
      });

      return updatedCount;
    } catch (error: any) {
      logger.error('Failed to bulk tag media', {
        workspaceId,
        mediaIds,
        tags,
        error: error.message,
      });
      throw new Error(`Failed to bulk tag media: ${error.message}`);
    }
  }

  /**
   * Normalize a single tag
   * 
   * @param tag - Tag to normalize
   * @returns Normalized tag
   */
  private normalizeTag(tag: string): string {
    return tag.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Normalize array of tags
   * 
   * @param tags - Tags to normalize
   * @returns Normalized tags with duplicates removed
   */
  private normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map(tag => this.normalizeTag(tag)).filter(tag => tag.length > 0))];
  }
}

// Export singleton instance
export const mediaTagService = MediaTagService.getInstance();