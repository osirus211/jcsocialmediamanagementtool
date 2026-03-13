/**
 * Media Upload Service
 * 
 * Handles media file uploads with S3-compatible storage
 */

import { config } from '../config';
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3') as any;
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner') as any;
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Media, MediaType, MediaStatus, IMedia } from '../models/Media';
import { logger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';
import { withSpan } from '../config/telemetry';
import {
  recordMediaUpload,
  recordMediaUploadFailure,
  recordSignedUrlGenerated,
  recordValidationFailure,
  updateStorageUsage,
} from '../config/mediaMetrics';

// Supported file types
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/webm',
];

// Size limits (in bytes)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export interface GenerateUploadUrlInput {
  workspaceId: string;
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GenerateUploadUrlResult {
  mediaId: string;
  uploadUrl: string;
  storageUrl: string;
  expiresIn: number;
}

export interface ConfirmUploadInput {
  mediaId: string;
  workspaceId: string;
  width?: number;
  height?: number;
  duration?: number;
}

export class MediaUploadService {
  private s3Client: any;
  private bucketName: string;
  private region: string;
  private cdnUrl?: string;

  constructor() {
    // Initialize S3 client
    this.region = config.aws.region || 'us-east-1';
    this.bucketName = config.storage.s3.bucketName || 'social-media-scheduler';
    this.cdnUrl = config.storage.cdn.url;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId || '',
        secretAccessKey: config.aws.secretAccessKey || '',
      },
      endpoint: config.storage.s3.endpoint, // For S3-compatible services like MinIO
      forcePathStyle: !!config.storage.s3.endpoint, // Required for MinIO
    });

    logger.info('MediaUploadService initialized', {
      region: this.region,
      bucket: this.bucketName,
      cdnEnabled: !!this.cdnUrl,
    });
  }

  /**
   * Validate file type and size
   */
  private validateFile(mimeType: string, size: number): {
    valid: boolean;
    mediaType?: MediaType;
    error?: string;
  } {
    // Check if image
    if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
      if (size > MAX_IMAGE_SIZE) {
        recordValidationFailure('image_size_exceeded');
        return {
          valid: false,
          error: `Image size exceeds maximum of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        };
      }
      return { valid: true, mediaType: MediaType.IMAGE };
    }

    // Check if video
    if (SUPPORTED_VIDEO_TYPES.includes(mimeType)) {
      if (size > MAX_VIDEO_SIZE) {
        recordValidationFailure('video_size_exceeded');
        return {
          valid: false,
          error: `Video size exceeds maximum of ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
        };
      }
      return { valid: true, mediaType: MediaType.VIDEO };
    }

    // Unsupported type
    recordValidationFailure('unsupported_type');
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}`,
    };
  }

  /**
   * Generate storage key for file
   */
  private generateStorageKey(workspaceId: string, filename: string): string {
    const ext = filename.split('.').pop() || '';
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    return `workspaces/${workspaceId}/media/${timestamp}-${uniqueId}.${ext}`;
  }

  /**
   * Get public URL for storage key
   */
  private getStorageUrl(storageKey: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${storageKey}`;
    }
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${storageKey}`;
  }

  /**
   * Generate signed upload URL
   */
  async generateUploadUrl(input: GenerateUploadUrlInput): Promise<GenerateUploadUrlResult> {
    return await withSpan('generate-upload-url', async (span) => {
      span.setAttribute('workspace_id', input.workspaceId);
      span.setAttribute('mime_type', input.mimeType);
      span.setAttribute('size', input.size);

      const startTime = Date.now();

      try {
        // Validate file
        const validation = this.validateFile(input.mimeType, input.size);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const mediaType = validation.mediaType!;

        // Generate storage key
        const storageKey = this.generateStorageKey(input.workspaceId, input.filename);
        const storageUrl = this.getStorageUrl(storageKey);

        // Create media record
        const media = await Media.create({
          workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
          userId: new mongoose.Types.ObjectId(input.userId),
          filename: storageKey.split('/').pop(),
          originalFilename: input.filename,
          mimeType: input.mimeType,
          mediaType,
          size: input.size,
          storageKey,
          storageUrl,
          status: MediaStatus.PENDING,
        });

        // Generate signed upload URL (valid for 15 minutes)
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
          ContentType: input.mimeType,
          ContentLength: input.size,
        });

        const uploadUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: 900, // 15 minutes
        });

        const duration = Date.now() - startTime;

        // Record metrics
        recordSignedUrlGenerated(mediaType);

        logger.info('Generated signed upload URL', {
          mediaId: media._id.toString(),
          workspaceId: input.workspaceId,
          mediaType,
          size: input.size,
          duration,
        });

        return {
          mediaId: media._id.toString(),
          uploadUrl,
          storageUrl,
          expiresIn: 900,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;

        logger.error('Failed to generate upload URL', {
          error: error.message,
          workspaceId: input.workspaceId,
          mimeType: input.mimeType,
          duration,
        });

        recordMediaUploadFailure('unknown', 'url_generation_failed');

        throw error;
      }
    });
  }

  /**
   * Confirm upload completion
   */
  async confirmUpload(input: ConfirmUploadInput): Promise<IMedia> {
    return await withSpan('confirm-upload', async (span) => {
      span.setAttribute('media_id', input.mediaId);
      span.setAttribute('workspace_id', input.workspaceId);

      const startTime = Date.now();

      try {
        // Find media record
        const media = await Media.findOne({
          _id: input.mediaId,
          workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
        });

        if (!media) {
          throw new Error('Media not found');
        }

        if (media.status !== MediaStatus.PENDING) {
          throw new Error(`Media already ${media.status}`);
        }

        // Update media record
        media.status = MediaStatus.UPLOADED;
        media.uploadedAt = new Date();

        if (input.width) media.width = input.width;
        if (input.height) media.height = input.height;
        if (input.duration) media.duration = input.duration;

        await media.save();

        const duration = Date.now() - startTime;

        // Record metrics
        recordMediaUpload(media.mediaType, 'success', duration, media.size);

        // Update workspace storage usage
        await this.updateWorkspaceStorageUsage(input.workspaceId);

        // Enqueue processing jobs for images
        if (media.mediaType === MediaType.IMAGE || (media.mediaType as string) === 'gif') {
          try {
            const { MediaProcessingQueue } = await import('../queue/MediaProcessingQueue');
            const { ImageCompressionService } = await import('./ImageCompressionService');
            
            const processingQueue = new MediaProcessingQueue();
            
            // Only process if it's an image file
            if (ImageCompressionService.isImage(media.mimeType)) {
              // Enqueue compression job
              await processingQueue.addJob('compress-image', {
                mediaId: media._id.toString(),
                platform: 'storage', // Internal processing
                mediaType: media.mediaType as 'image' | 'video' | 'gif',
                fileUrl: media.storageKey,
                storageKey: media.storageKey,
                workspaceId: input.workspaceId,
              });

              // Enqueue thumbnail generation job
              await processingQueue.addJob('generate-thumbnails', {
                mediaId: media._id.toString(),
                platform: 'storage', // Internal processing
                mediaType: media.mediaType as 'image' | 'video' | 'gif',
                fileUrl: media.storageKey,
                storageKey: media.storageKey,
                workspaceId: input.workspaceId,
              });

              logger.info('Enqueued image processing jobs', {
                mediaId: media._id.toString(),
                jobs: ['compress-image', 'generate-thumbnails'],
              });
            }
          } catch (queueError: any) {
            // Don't fail upload if queue fails
            logger.warn('Failed to enqueue processing jobs', {
              mediaId: media._id.toString(),
              error: queueError.message,
            });
          }
        }

        logger.info('Upload confirmed', {
          mediaId: media._id.toString(),
          workspaceId: input.workspaceId,
          mediaType: media.mediaType,
          size: media.size,
          duration,
        });

        return media;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        logger.error('Failed to confirm upload', {
          error: error.message,
          mediaId: input.mediaId,
          workspaceId: input.workspaceId,
          duration,
        });

        recordMediaUploadFailure('unknown', 'confirmation_failed');

        throw error;
      }
    });
  }

  /**
   * Mark upload as failed
   */
  async markUploadFailed(mediaId: string, workspaceId: string, error: string): Promise<void> {
    try {
      const media = await Media.findOne({
        _id: mediaId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!media) {
        throw new Error('Media not found');
      }

      media.status = MediaStatus.FAILED;
      media.metadata = {
        ...media.metadata,
        error,
        failedAt: new Date(),
      };

      await media.save();

      recordMediaUploadFailure(media.mediaType, 'upload_failed');

      logger.warn('Upload marked as failed', {
        mediaId: media._id.toString(),
        workspaceId,
        error,
      });
    } catch (err: any) {
      logger.error('Failed to mark upload as failed', {
        error: err.message,
        mediaId,
        workspaceId,
      });
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(mediaId: string, workspaceId: string): Promise<IMedia> {
    const media = await Media.findOne({
      _id: mediaId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!media) {
      throw new Error('Media not found');
    }

    return media;
  }

  /**
   * Get media list for workspace
   */
  async getMediaList(
    workspaceId: string,
    options: {
      mediaType?: MediaType;
      status?: MediaStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    media: IMedia[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const filter: any = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    };

    if (options.mediaType) {
      filter.mediaType = options.mediaType;
    }

    if (options.status) {
      filter.status = options.status;
    }

    const [media, total] = await Promise.all([
      Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Media.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      media: media as unknown as IMedia[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get media library with search and filtering
   */
  async getMediaLibrary(options: {
    workspaceId: string;
    search?: string;
    mediaType?: any;
    status?: any;
    page?: number;
    limit?: number;
  }): Promise<{
    media: IMedia[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Delegate to existing getMediaList method
    return this.getMediaList(options.workspaceId, {
      mediaType: options.mediaType,
      status: options.status,
      page: options.page,
      limit: options.limit,
    });
  }

  /**
   * Update workspace storage usage metric
   */
  private async updateWorkspaceStorageUsage(workspaceId: string): Promise<void> {
    try {
      const result = await Media.aggregate([
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            status: MediaStatus.UPLOADED,
          },
        },
        {
          $group: {
            _id: null,
            totalSize: { $sum: '$size' },
          },
        },
      ]);

      const totalSize = result[0]?.totalSize || 0;
      updateStorageUsage(workspaceId, totalSize);
    } catch (error: any) {
      logger.error('Failed to update storage usage metric', {
        error: error.message,
        workspaceId,
      });
    }
  }

  /**
   * Delete media
   */
  async deleteMedia(mediaId: string, workspaceId: string): Promise<void> {
    const media = await Media.findOne({
      _id: mediaId,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!media) {
      throw new Error('Media not found');
    }

    // TODO: Delete from S3 storage
    // const command = new DeleteObjectCommand({
    //   Bucket: this.bucketName,
    //   Key: media.storageKey,
    // });
    // await this.s3Client.send(command);

    await media.deleteOne();

    // Update storage usage
    await this.updateWorkspaceStorageUsage(workspaceId);

    logger.info('Media deleted', {
      mediaId: media._id.toString(),
      workspaceId,
    });
  }

    async uploadMedia(input: {
      workspaceId: string;
      file: {
        originalname: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      };
      createdBy: string;
    }): Promise<{ media: IMedia; url: string; thumbnailUrl?: string }> {
      // Validate file
      const validation = this.validateFile(input.file.mimetype, input.file.size);
      if (!validation.valid) {
        throw new BadRequestError(validation.error!);
      }

      // Generate storage key
      const storageKey = this.generateStorageKey(input.workspaceId, input.file.originalname);

      // Create media record
      const media = new Media({
        workspaceId: input.workspaceId,
        filename: input.file.originalname,
        mimeType: input.file.mimetype,
        size: input.file.size,
        storageKey,
        status: 'completed',
        createdBy: input.createdBy,
      });

      await media.save();

      // Get URL
      const url = this.getStorageUrl(storageKey);

      return {
        media,
        url,
        thumbnailUrl: validation.mediaType === MediaType.IMAGE ? url : undefined,
      };
    }

    async getMediaByWorkspace(
      workspaceId: string,
      page: number,
      limit: number,
      skip: number
    ): Promise<{ media: IMedia[]; total: number; page: number; limit: number; totalPages: number }> {
      const [media, total] = await Promise.all([
        Media.find({ workspaceId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Media.countDocuments({ workspaceId }),
      ]);

      return {
        media: media as unknown as IMedia[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }
}

// Export singleton instance
export const mediaUploadService = new MediaUploadService();

