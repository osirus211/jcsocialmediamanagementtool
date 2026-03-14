/**
 * Media Search Service
 * 
 * Handles advanced search and filtering for media library
 */

import mongoose from 'mongoose';
import { Media, MediaType, MediaStatus } from '../models/Media';
import { logger } from '../utils/logger';

export interface MediaSearchFilters {
  workspaceId: string;
  search?: string;
  type?: 'all' | 'image' | 'video' | 'gif';
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'custom';
  customDateStart?: Date;
  customDateEnd?: Date;
  sizeRange?: 'all' | 'small' | 'medium' | 'large';
  platform?: string;
  folderId?: string;
  tags?: string[];
  sortBy?: 'newest' | 'oldest' | 'name' | 'size' | 'mostUsed';
  page?: number;
  limit?: number;
}

export interface MediaSearchResult {
  media: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: {
    types: Array<{ type: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
    platforms: Array<{ platform: string; count: number }>;
  };
}

export class MediaSearchService {
  /**
   * Search and filter media with advanced options
   */
  static async searchMedia(filters: MediaSearchFilters): Promise<MediaSearchResult> {
    try {
      const {
        workspaceId,
        search,
        type,
        dateRange,
        customDateStart,
        customDateEnd,
        sizeRange,
        platform,
        folderId,
        tags,
        sortBy = 'newest',
        page = 1,
        limit = 20,
      } = filters;

      // Build base filter
      const filter: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: MediaStatus.READY,
      };

      // Text search (filename and tags)
      if (search) {
        filter.$or = [
          { filename: { $regex: search, $options: 'i' } },
          { originalFilename: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
        ];
      }

      // Type filter
      if (type && type !== 'all') {
        if (type === 'gif') {
          filter.mimeType = 'image/gif';
        } else {
          filter.mediaType = type.toUpperCase();
          if (type === 'image') {
            filter.mimeType = { $ne: 'image/gif' };
          }
        }
      }

      // Date range filter
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'custom':
            if (customDateStart || customDateEnd) {
              filter.createdAt = {};
              if (customDateStart) filter.createdAt.$gte = customDateStart;
              if (customDateEnd) {
                const endDate = new Date(customDateEnd);
                endDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDate;
              }
            }
            break;
        }

        if (dateRange !== 'custom' && startDate) {
          filter.createdAt = { $gte: startDate };
        }
      }

      // Size range filter
      if (sizeRange && sizeRange !== 'all') {
        const MB = 1024 * 1024;
        switch (sizeRange) {
          case 'small':
            filter.size = { $lt: MB };
            break;
          case 'medium':
            filter.size = { $gte: MB, $lte: 10 * MB };
            break;
          case 'large':
            filter.size = { $gt: 10 * MB };
            break;
        }
      }

      // Platform filter
      if (platform) {
        filter['platformMediaIds.platform'] = platform;
      }

      // Folder filter
      if (folderId !== undefined) {
        if (folderId === 'unorganized' || folderId === null) {
          filter.folderId = null;
        } else if (folderId !== 'recent') {
          filter.folderId = new mongoose.Types.ObjectId(folderId);
        }
      }

      // Tags filter
      if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
      }

      // Build sort
      let sort: any = {};
      switch (sortBy) {
        case 'newest':
          sort = { createdAt: -1 };
          break;
        case 'oldest':
          sort = { createdAt: 1 };
          break;
        case 'name':
          sort = { filename: 1 };
          break;
        case 'size':
          sort = { size: -1 };
          break;
        case 'mostUsed':
          // TODO: Implement usage tracking
          sort = { createdAt: -1 };
          break;
      }

      // Execute search with pagination
      const skip = (page - 1) * limit;
      const [media, total, facets] = await Promise.all([
        Media.find(filter).sort(sort).skip(skip).limit(limit),
        Media.countDocuments(filter),
        this.getFacets(workspaceId),
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info('Media search completed', {
        workspaceId,
        filters: { search, type, dateRange, sizeRange, platform, folderId, tags, sortBy },
        results: { total, page, totalPages },
      });

      return {
        media: media.map(m => m.toJSON()),
        total,
        page,
        limit,
        totalPages,
        facets,
      };
    } catch (error: any) {
      logger.error('Media search failed', {
        workspaceId: filters.workspaceId,
        error: error.message,
        filters,
      });
      throw new Error(`Media search failed: ${error.message}`);
    }
  }

  /**
   * Get facets for filters (counts by type, tags, platforms)
   */
  private static async getFacets(workspaceId: string) {
    try {
      const [typesFacets, tagsFacets, platformsFacets] = await Promise.all([
        // Types facets
        Media.aggregate([
          { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId), status: MediaStatus.READY } },
          {
            $group: {
              _id: {
                $cond: {
                  if: { $eq: ['$mimeType', 'image/gif'] },
                  then: 'gif',
                  else: { $toLower: '$mediaType' }
                }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ]),

        // Tags facets
        Media.aggregate([
          { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId), status: MediaStatus.READY } },
          { $unwind: '$tags' },
          { $group: { _id: '$tags', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 50 }
        ]),

        // Platforms facets
        Media.aggregate([
          { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId), status: MediaStatus.READY } },
          { $unwind: '$platformMediaIds' },
          { $group: { _id: '$platformMediaIds.platform', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
      ]);

      return {
        types: typesFacets.map(f => ({ type: f._id, count: f.count })),
        tags: tagsFacets.map(f => ({ tag: f._id, count: f.count })),
        platforms: platformsFacets.map(f => ({ platform: f._id, count: f.count })),
      };
    } catch (error: any) {
      logger.error('Failed to get media facets', {
        workspaceId,
        error: error.message,
      });
      return { types: [], tags: [], platforms: [] };
    }
  }

  /**
   * Get recently used media
   */
  static async getRecentlyUsedMedia(workspaceId: string, limit: number = 8) {
    try {
      // TODO: Implement proper usage tracking
      // For now, return recently uploaded media
      const media = await Media.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: MediaStatus.READY,
      })
        .sort({ createdAt: -1 })
        .limit(limit);

      return media.map(m => m.toJSON());
    } catch (error: any) {
      logger.error('Failed to get recently used media', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get recently used media: ${error.message}`);
    }
  }
}