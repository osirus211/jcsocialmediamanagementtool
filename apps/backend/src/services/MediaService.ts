/**
 * Media Service
 * 
 * Business logic for media management
 * 
 * Features:
 * - Create media records
 * - Update processing status
 * - Fetch media metadata
 * - Delete media
 * - List media by workspace
 */

import mongoose from 'mongoose';
import { Media, IMedia, MediaStatus, MediaType, UploadStatus, ProcessingStatus } from '../models/Media';
import { mediaStorageService, StorageProvider } from './MediaStorageService';
import { logger } from '../utils/logger';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';

export interface CreateMediaInput {
  workspaceId: string;
  userId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  size: number;
  storageKey: string;
  storageProvider: StorageProvider;
}

export interface UpdateMediaStatusInput {
  mediaId: string;
  status: MediaStatus;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface ListMediaQuery {
  workspaceId: string;
  status?: MediaStatus;
  mediaType?: MediaType;
  folderId?: string | null; // Phase-2: Filter by folder
  tags?: string[]; // Phase-2: Filter by tags
  limit?: number;
  skip?: number;
  sortBy?: 'createdAt' | 'uploadedAt' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export class MediaService {
  private static instance: MediaService;

  private constructor() {}

  static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  /**
   * Create a new media record
   * 
   * @param input - Media creation input
   * @returns Created media document
   */
  async createMedia(input: CreateMediaInput): Promise<IMedia> {
    try {
      // Build storage URL and CDN URL
      const storageUrl = mediaStorageService.buildStorageUrl(input.storageKey);
      const cdnUrl = mediaStorageService.buildCdnUrl(input.storageKey);

      const media = await Media.create({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        userId: new mongoose.Types.ObjectId(input.userId),
        uploadedBy: new mongoose.Types.ObjectId(input.userId),
        filename: input.filename,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        mediaType: input.mediaType,
        size: input.size,
        storageKey: input.storageKey,
        storageProvider: input.storageProvider,
        storageUrl,
        originalUrl: storageUrl,
        cdnUrl,
        status: MediaStatus.PENDING,
      });

      logger.info('Media record created', {
        mediaId: media._id.toString(),
        workspaceId: input.workspaceId,
        filename: input.filename,
        size: input.size,
      });

      // Audit log (non-blocking)
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        userId: new mongoose.Types.ObjectId(input.userId),
        action: ActivityAction.MEDIA_UPLOADED,
        resourceType: 'Media',
        resourceId: media._id,
        details: { filename: input.originalFilename, size: input.size, mimeType: input.mimeType },
      }).catch(() => {});

      return media;
    } catch (error: any) {
      logger.error('Failed to create media record', {
        workspaceId: input.workspaceId,
        filename: input.filename,
        error: error.message,
      });
      throw new Error(`Failed to create media record: ${error.message}`);
    }
  }

  /**
   * Update media processing status
   * 
   * @param input - Status update input
   * @returns Updated media document
   */
  async updateMediaStatus(input: UpdateMediaStatusInput): Promise<IMedia | null> {
    try {
      const updateData: any = {
        status: input.status,
      };

      if (input.width !== undefined) {
        updateData.width = input.width;
      }

      if (input.height !== undefined) {
        updateData.height = input.height;
      }

      if (input.duration !== undefined) {
        updateData.duration = input.duration;
      }

      if (input.thumbnailUrl) {
        updateData.thumbnailUrl = input.thumbnailUrl;
      }

      if (input.metadata) {
        updateData.metadata = input.metadata;
      }

      // Set uploadedAt when status changes to UPLOADED
      if (input.status === MediaStatus.UPLOADED && !updateData.uploadedAt) {
        updateData.uploadedAt = new Date();
      }

      const media = await Media.findByIdAndUpdate(
        input.mediaId,
        updateData,
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for status update', {
          mediaId: input.mediaId,
        });
        return null;
      }

      logger.info('Media status updated', {
        mediaId: input.mediaId,
        status: input.status,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to update media status', {
        mediaId: input.mediaId,
        error: error.message,
      });
      throw new Error(`Failed to update media status: ${error.message}`);
    }
  }

  /**
   * Get media by ID
   * 
   * @param mediaId - Media ID
   * @param workspaceId - Workspace ID (for authorization)
   * @returns Media document or null
   */
  async getMediaById(mediaId: string, workspaceId: string): Promise<IMedia | null> {
    try {
      const media = await Media.findOne({
        _id: mediaId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to get media by ID', {
        mediaId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get media: ${error.message}`);
    }
  }

  /**
   * List media by workspace
   * 
   * @param query - List query parameters
   * @returns Array of media documents
   */
  async listMedia(query: ListMediaQuery): Promise<{
    media: IMedia[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        workspaceId,
        status,
        mediaType,
        folderId,
        tags,
        limit = 50,
        skip = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      // Build filter
      const filter: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (status) {
        filter.status = status;
      }

      if (mediaType) {
        filter.mediaType = mediaType;
      }

      // Phase-2: Folder filtering
      if (folderId !== undefined) {
        if (folderId === null) {
          // Filter for media without folder (root level)
          filter.folderId = null;
        } else {
          filter.folderId = new mongoose.Types.ObjectId(folderId);
        }
      }

      // Phase-2: Tag filtering
      if (tags && tags.length > 0) {
        filter.tags = { $all: tags };
      }

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const [media, total] = await Promise.all([
        Media.find(filter)
          .sort(sort)
          .limit(limit)
          .skip(skip)
          .lean(),
        Media.countDocuments(filter),
      ]);

      const hasMore = skip + media.length < total;

      logger.debug('Media list retrieved', {
        workspaceId,
        count: media.length,
        total,
        hasMore,
        folderId,
        tags,
      });

      return {
        media: media as unknown as IMedia[],
        total,
        hasMore,
      };
    } catch (error: any) {
      logger.error('Failed to list media', {
        workspaceId: query.workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to list media: ${error.message}`);
    }
  }

  /**
   * Delete media
   * 
   * @param mediaId - Media ID
   * @param workspaceId - Workspace ID (for authorization)
   */
  async deleteMedia(mediaId: string, workspaceId: string): Promise<void> {
    try {
      // Get media document
      const media = await this.getMediaById(mediaId, workspaceId);

      if (!media) {
        throw new Error('Media not found');
      }

      // Delete from storage
      await mediaStorageService.deleteMedia(media.storageKey);

      // Delete from database
      await Media.findByIdAndDelete(mediaId);

      logger.info('Media deleted', {
        mediaId,
        workspaceId,
        storageKey: media.storageKey,
      });

      // Audit log (non-blocking)
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: media.userId,
        action: ActivityAction.MEDIA_DELETED,
        resourceType: 'Media',
        resourceId: media._id,
        details: { filename: media.filename },
      }).catch(() => {});
    } catch (error: any) {
      logger.error('Failed to delete media', {
        mediaId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to delete media: ${error.message}`);
    }
  }

  /**
   * Get media statistics for workspace
   * 
   * @param workspaceId - Workspace ID
   * @returns Media statistics
   */
  async getMediaStats(workspaceId: string): Promise<{
    totalCount: number;
    totalSize: number;
    byType: Record<MediaType, number>;
    byStatus: Record<MediaStatus, number>;
  }> {
    try {
      const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

      const [totalCount, totalSize, byType, byStatus] = await Promise.all([
        // Total count
        Media.countDocuments({ workspaceId: workspaceObjectId }),

        // Total size
        Media.aggregate([
          { $match: { workspaceId: workspaceObjectId } },
          { $group: { _id: null, total: { $sum: '$size' } } },
        ]).then(result => result[0]?.total || 0),

        // By type
        Media.aggregate([
          { $match: { workspaceId: workspaceObjectId } },
          { $group: { _id: '$mediaType', count: { $sum: 1 } } },
        ]).then(result =>
          result.reduce((acc, item) => {
            acc[item._id as MediaType] = item.count;
            return acc;
          }, {} as Record<MediaType, number>)
        ),

        // By status
        Media.aggregate([
          { $match: { workspaceId: workspaceObjectId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]).then(result =>
          result.reduce((acc, item) => {
            acc[item._id as MediaStatus] = item.count;
            return acc;
          }, {} as Record<MediaStatus, number>)
        ),
      ]);

      return {
        totalCount,
        totalSize,
        byType,
        byStatus,
      };
    } catch (error: any) {
      logger.error('Failed to get media stats', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get media stats: ${error.message}`);
    }
  }

  /**
   * Mark upload as completed
   * 
   * @param mediaId - Media ID
   * @returns Updated media document
   */
  async markUploadCompleted(mediaId: string): Promise<IMedia | null> {
    try {
      const media = await Media.findByIdAndUpdate(
        mediaId,
        {
          uploadStatus: UploadStatus.UPLOADED,
          uploadedAt: new Date(),
          status: MediaStatus.UPLOADED, // Update legacy status
        },
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for upload completion', { mediaId });
        return null;
      }

      logger.info('Upload marked as completed', {
        mediaId,
        uploadStatus: media.uploadStatus,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to mark upload as completed', {
        mediaId,
        error: error.message,
      });
      throw new Error(`Failed to mark upload as completed: ${error.message}`);
    }
  }

  /**
   * Mark upload as failed
   * 
   * @param mediaId - Media ID
   * @param errorMessage - Error message
   * @returns Updated media document
   */
  async markUploadFailed(mediaId: string, errorMessage?: string): Promise<IMedia | null> {
    try {
      const media = await Media.findByIdAndUpdate(
        mediaId,
        {
          uploadStatus: UploadStatus.FAILED,
          status: MediaStatus.FAILED, // Update legacy status
          metadata: {
            uploadError: errorMessage,
            uploadFailedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for upload failure', { mediaId });
        return null;
      }

      logger.error('Upload marked as failed', {
        mediaId,
        uploadStatus: media.uploadStatus,
        error: errorMessage,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to mark upload as failed', {
        mediaId,
        error: error.message,
      });
      throw new Error(`Failed to mark upload as failed: ${error.message}`);
    }
  }

  /**
   * Mark processing as started
   * 
   * @param mediaId - Media ID
   * @returns Updated media document
   */
  async markProcessingStarted(mediaId: string): Promise<IMedia | null> {
    try {
      const media = await Media.findByIdAndUpdate(
        mediaId,
        {
          processingStatus: ProcessingStatus.PROCESSING,
          status: MediaStatus.PROCESSING, // Update legacy status
          metadata: {
            processingStartedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for processing start', { mediaId });
        return null;
      }

      logger.info('Processing marked as started', {
        mediaId,
        processingStatus: media.processingStatus,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to mark processing as started', {
        mediaId,
        error: error.message,
      });
      throw new Error(`Failed to mark processing as started: ${error.message}`);
    }
  }

  /**
   * Mark processing as completed
   * 
   * @param mediaId - Media ID
   * @param processingData - Processing results (width, height, duration, thumbnailUrl)
   * @returns Updated media document
   */
  async markProcessingCompleted(
    mediaId: string,
    processingData?: {
      width?: number;
      height?: number;
      duration?: number;
      thumbnailUrl?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<IMedia | null> {
    try {
      const updateData: any = {
        processingStatus: ProcessingStatus.COMPLETED,
        status: MediaStatus.READY, // Update legacy status
      };

      if (processingData) {
        if (processingData.width !== undefined) {
          updateData.width = processingData.width;
        }
        if (processingData.height !== undefined) {
          updateData.height = processingData.height;
        }
        if (processingData.duration !== undefined) {
          updateData.duration = processingData.duration;
        }
        if (processingData.thumbnailUrl) {
          updateData.thumbnailUrl = processingData.thumbnailUrl;
        }
        if (processingData.metadata) {
          updateData.metadata = {
            ...processingData.metadata,
            processingCompletedAt: new Date(),
          };
        } else {
          updateData.metadata = {
            processingCompletedAt: new Date(),
          };
        }
      }

      const media = await Media.findByIdAndUpdate(
        mediaId,
        updateData,
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for processing completion', { mediaId });
        return null;
      }

      logger.info('Processing marked as completed', {
        mediaId,
        processingStatus: media.processingStatus,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to mark processing as completed', {
        mediaId,
        error: error.message,
      });
      throw new Error(`Failed to mark processing as completed: ${error.message}`);
    }
  }

  /**
   * Mark processing as failed
   * 
   * @param mediaId - Media ID
   * @param errorMessage - Error message
   * @returns Updated media document
   */
  async markProcessingFailed(mediaId: string, errorMessage?: string): Promise<IMedia | null> {
    try {
      const media = await Media.findByIdAndUpdate(
        mediaId,
        {
          processingStatus: ProcessingStatus.FAILED,
          status: MediaStatus.FAILED, // Update legacy status
          metadata: {
            processingError: errorMessage,
            processingFailedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for processing failure', { mediaId });
        return null;
      }

      logger.error('Processing marked as failed', {
        mediaId,
        processingStatus: media.processingStatus,
        error: errorMessage,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to mark processing as failed', {
        mediaId,
        error: error.message,
      });
      throw new Error(`Failed to mark processing as failed: ${error.message}`);
    }
  }

  /**
   * Get media ready for publishing
   * 
   * Returns only media where:
   * - uploadStatus = 'uploaded'
   * - processingStatus = 'completed'
   * 
   * @param workspaceId - Workspace ID
   * @param mediaIds - Optional array of media IDs to filter
   * @returns Array of ready media documents
   */
  async getReadyMedia(workspaceId: string, mediaIds?: string[]): Promise<IMedia[]> {
    try {
      const filter: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        uploadStatus: UploadStatus.UPLOADED,
        processingStatus: ProcessingStatus.COMPLETED,
      };

      if (mediaIds && mediaIds.length > 0) {
        filter._id = { $in: mediaIds.map(id => new mongoose.Types.ObjectId(id)) };
      }

      const media = await Media.find(filter).lean();

      logger.debug('Retrieved ready media', {
        workspaceId,
        count: media.length,
        requestedIds: mediaIds?.length || 0,
      });

      return media as unknown as IMedia[];
    } catch (error: any) {
      logger.error('Failed to get ready media', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get ready media: ${error.message}`);
    }
  }

  /**
   * Move media to folder (Phase-2)
   * 
   * @param mediaId - Media ID
   * @param workspaceId - Workspace ID
   * @param folderId - Folder ID (null to move to root)
   * @returns Updated media document
   */
  async moveToFolder(
    mediaId: string,
    workspaceId: string,
    folderId: string | null
  ): Promise<IMedia | null> {
    try {
      const media = await Media.findOneAndUpdate(
        {
          _id: mediaId,
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        {
          folderId: folderId ? new mongoose.Types.ObjectId(folderId) : null,
        },
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for folder move', { mediaId, workspaceId });
        return null;
      }

      logger.info('Media moved to folder', {
        mediaId,
        workspaceId,
        folderId,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to move media to folder', {
        mediaId,
        workspaceId,
        folderId,
        error: error.message,
      });
      throw new Error(`Failed to move media to folder: ${error.message}`);
    }
  }

  /**
   * Update media tags (Phase-2)
   * 
   * @param mediaId - Media ID
   * @param workspaceId - Workspace ID
   * @param tags - Array of tags
   * @returns Updated media document
   */
  /**
   * Save media from URL (for AI-generated images)
   */
  async saveFromUrl(input: {
    url: string;
    filename: string;
    workspaceId: string;
    userId: string;
    source: string;
    metadata?: any;
  }): Promise<IMedia> {
    try {
      // Download the image from URL
      const response = await fetch(input.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';
      
      // Determine media type
      let mediaType = MediaType.IMAGE;
      if (contentType.startsWith('video/')) {
        mediaType = MediaType.VIDEO;
      }
      // Note: AUDIO type not available in current MediaType enum

      // Generate storage key
      const storageKey = `ai-generated/${input.workspaceId}/${Date.now()}-${input.filename}`;

      // Upload to storage
      const { MediaStorageService } = await import('./MediaStorageService');
      const mediaStorageService = MediaStorageService.getInstance();
      
      await mediaStorageService.uploadBuffer(
        storageKey,
        Buffer.from(buffer),
        contentType
      );

      // Create media record
      const media = await this.createMedia({
        workspaceId: input.workspaceId,
        userId: input.userId,
        filename: input.filename,
        originalFilename: input.filename,
        mimeType: contentType,
        mediaType,
        size: buffer.byteLength,
        storageKey,
        storageProvider: StorageProvider.S3, // Assuming S3
      });

      // Update with metadata if provided
      if (input.metadata) {
        await Media.findByIdAndUpdate(media._id, {
          $set: {
            metadata: input.metadata,
            source: input.source,
          }
        });
      }

      // Mark as completed
      await this.markUploadCompleted(media._id.toString());

      logger.info('Media saved from URL', {
        mediaId: media._id.toString(),
        workspaceId: input.workspaceId,
        source: input.source,
        url: input.url.substring(0, 100),
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to save media from URL', {
        workspaceId: input.workspaceId,
        url: input.url.substring(0, 100),
        error: error.message,
      });
      throw new Error(`Failed to save media from URL: ${error.message}`);
    }
  }

  async updateTags(
    mediaId: string,
    workspaceId: string,
    tags: string[]
  ): Promise<IMedia | null> {
    try {
      // Normalize tags (lowercase, trim, remove duplicates)
      const normalizedTags = [...new Set(tags.map(tag => tag.toLowerCase().trim()))];

      const media = await Media.findOneAndUpdate(
        {
          _id: mediaId,
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        {
          tags: normalizedTags,
        },
        { new: true }
      );

      if (!media) {
        logger.warn('Media not found for tag update', { mediaId, workspaceId });
        return null;
      }

      logger.info('Media tags updated', {
        mediaId,
        workspaceId,
        tags: normalizedTags,
      });

      return media;
    } catch (error: any) {
      logger.error('Failed to update media tags', {
        mediaId,
        workspaceId,
        tags,
        error: error.message,
      });
      throw new Error(`Failed to update media tags: ${error.message}`);
    }
  }
}

// Export singleton instance
export const mediaService = MediaService.getInstance();
