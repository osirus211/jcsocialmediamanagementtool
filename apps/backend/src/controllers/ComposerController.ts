/**
 * Composer Controller
 * 
 * Handles composer-specific post operations
 * 
 * All endpoints are tenant-safe (require workspace context)
 */

import { Request, Response, NextFunction } from 'express';
import { composerService } from '../services/ComposerService';
import { mediaUploadService } from '../services/MediaUploadService';
import { ImageCompressionService, PLATFORM_SPECS } from '../services/ImageCompressionService';
import { mediaStorageService } from '../services/MediaStorageService';
import { Media } from '../models/Media';
import { PublishMode } from '../models/Post';
import { BadRequestError } from '../utils/errors';
import { getPaginationParams } from '../utils/pagination';
import { logAudit } from '../utils/auditLogger';

export class ComposerController {
  /**
   * Create draft post
   * POST /api/composer/drafts
   */
  async createDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, socialAccountIds, mediaIds, platformContent } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      const post = await composerService.instance.createDraft({
        workspaceId,
        content,
        socialAccountIds,
        mediaIds,
        platformContent,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        message: 'Draft created successfully',
        post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update draft post
   * PATCH /api/composer/drafts/:id
   */
  async updateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { content, socialAccountIds, mediaIds, platformContent } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      const post = await composerService.instance.updateDraft(id, workspaceId, {
        content,
        socialAccountIds,
        mediaIds,
        platformContent,
      });

      res.json({
        success: true,
        message: 'Draft updated successfully',
        post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Publish post (NOW, SCHEDULE, or QUEUE)
   * POST /api/composer/posts/:id/publish
   */
  async publishPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { publishMode, scheduledAt, queueSlot } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!publishMode || !Object.values(PublishMode).includes(publishMode)) {
        throw new BadRequestError(
          `Invalid publishMode. Must be one of: ${Object.values(PublishMode).join(', ')}`
        );
      }

      const post = await composerService.instance.publishPost(id, workspaceId, {
        publishMode,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        queueSlot,
      });

      // Audit log: Manual publish (only for NOW mode)
      if (publishMode === PublishMode.NOW) {
        logAudit({
          userId: req.user?.userId,
          workspaceId,
          action: 'post.manual_publish',
          entityType: 'post',
          entityId: id,
          metadata: {
            publishMode,
          },
          req,
        });
      }

      res.json({
        success: true,
        message: `Post ${publishMode === PublishMode.NOW ? 'published' : publishMode === PublishMode.SCHEDULE ? 'scheduled' : 'queued'} successfully`,
        post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Duplicate post
   * POST /api/composer/posts/:id/duplicate
   */
  async duplicatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      const post = await composerService.instance.duplicatePost(id, workspaceId, userId);

      res.status(201).json({
        success: true,
        message: 'Post duplicated successfully',
        post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel scheduled/queued post
   * POST /api/composer/posts/:id/cancel
   */
  async cancelPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      const post = await composerService.instance.cancelPost(id, workspaceId);

      res.json({
        success: true,
        message: 'Post cancelled successfully',
        post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete post
   * DELETE /api/composer/posts/:id
   */
  async deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      await composerService.instance.deletePost(id, workspaceId);

      // Audit log: Post deleted
      logAudit({
        userId: req.user?.userId,
        workspaceId,
        action: 'post.deleted',
        entityType: 'post',
        entityId: id,
        req,
      });

      res.json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload media
   * POST /api/composer/media/upload
   */
  async uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const result = await mediaUploadService.uploadMedia({
        workspaceId,
        file: {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          buffer: req.file.buffer,
        },
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        message: 'Media uploaded successfully',
        media: result.media,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get media library
   * GET /api/composer/media
   */
  async getMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      // Get pagination params using utility
      const { page, limit, skip } = getPaginationParams(req.query);

      const result = await mediaUploadService.getMediaByWorkspace(
        workspaceId,
        page,
        limit,
        skip
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete media
   * DELETE /api/composer/media/:id
   */
  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      await mediaUploadService.deleteMedia(id, workspaceId);

      res.json({
        success: true,
        message: 'Media deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get queue slots
   * GET /api/composer/queue-slots
   */
  async getQueueSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { platform } = req.query;

      if (!workspaceId) {
        throw new BadRequestError('Workspace context required');
      }

      const { queueSlotService } = await import('../services/QueueSlotService');
      const slots = await queueSlotService.getSlots(
        workspaceId,
        platform as string | undefined
      );

      res.json({
        success: true,
        slots: slots.map((s) => s.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Compress media file
   * POST /api/composer/media/:mediaId/compress
   */
  async compressMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mediaId } = req.params;
      const { quality, format, maxWidth, maxHeight, platform, preserveExif, lossless } = req.body;

      // Get media from database
      const media = await Media.findById(mediaId);
      if (!media) {
        res.status(404).json({ error: 'Media not found' });
        return;
      }

      // Only compress images
      if (!media.mimeType?.startsWith('image/')) {
        res.status(400).json({ error: 'Only images can be compressed' });
        return;
      }

      // Get file from storage using presigned URL
      const downloadUrl = await mediaStorageService.generatePresignedDownloadUrl(media.storageKey);
      const response = await fetch(downloadUrl);
      const originalBuffer = Buffer.from(await response.arrayBuffer());

      // Compress image
      const compressionOptions = {
        quality: quality || 85,
        format: format || 'webp',
        maxWidth: maxWidth || 2048,
        maxHeight: maxHeight || 2048,
        preserveExif: preserveExif || false,
        lossless: lossless || false,
        platform: platform && Object.keys(PLATFORM_SPECS).includes(platform) ? platform : undefined,
      };

      const compressedResult = await ImageCompressionService.compressImage(
        originalBuffer,
        compressionOptions
      );

      // Generate new key for compressed file
      const fileExtension = compressedResult.format === 'webp' ? 'webp' : 
                           compressedResult.format === 'jpeg' ? 'jpg' : 
                           compressedResult.format;
      const compressedKey = `${media.storageKey.replace(/\.[^/.]+$/, '')}_compressed.${fileExtension}`;

      // Upload compressed file to storage
      await mediaStorageService.uploadBuffer(
        compressedKey,
        compressedResult.buffer,
        `image/${compressedResult.format}`
      );

      const compressedUrl = mediaStorageService.buildCdnUrl(compressedKey);

      // Generate thumbnails for compressed image
      const thumbnails = await ImageCompressionService.generateThumbnails(
        compressedResult.buffer,
        compressedKey
      );

      // Upload thumbnails
      const thumbnailUrls: Record<string, string> = {};
      for (const [size, thumbnail] of Object.entries(thumbnails)) {
        await mediaStorageService.uploadBuffer(
          thumbnail.key,
          thumbnail.buffer,
          'image/webp'
        );
        thumbnailUrls[size] = mediaStorageService.buildCdnUrl(thumbnail.key);
      }

      // Create new media record for compressed version
      const compressedMedia = new Media({
        filename: `compressed_${media.filename}`,
        originalFilename: media.originalFilename,
        mimeType: `image/${compressedResult.format}`,
        mediaType: 'image',
        size: compressedResult.size,
        width: compressedResult.width,
        height: compressedResult.height,
        storageProvider: 's3',
        storageKey: compressedKey,
        storageUrl: compressedUrl,
        thumbnailUrl: thumbnailUrls.medium,
        thumbnails: thumbnailUrls,
        workspaceId: media.workspaceId,
        userId: media.userId,
        uploadedBy: media.uploadedBy,
        tags: [...(media.tags || []), 'compressed'],
        folderId: media.folderId,
        status: 'ready',
        uploadStatus: 'uploaded',
        processingStatus: 'completed',
      });

      await compressedMedia.save();

      res.json({
        success: true,
        original: {
          id: media._id,
          size: media.size,
          width: media.width,
          height: media.height,
        },
        compressed: {
          id: compressedMedia._id,
          size: compressedResult.size,
          width: compressedResult.width,
          height: compressedResult.height,
          url: compressedUrl,
          compressionRatio: Math.round(((media.size - compressedResult.size) / media.size) * 100),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch compress multiple media files
   * POST /api/composer/media/batch-compress
   */
  async batchCompressMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mediaIds, compressionOptions } = req.body;

      if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
        res.status(400).json({ error: 'Media IDs array is required' });
        return;
      }

      const results = [];

      for (const mediaId of mediaIds) {
        try {
          // Get media from database
          const media = await Media.findById(mediaId);
          if (!media || !media.mimeType?.startsWith('image/')) {
            results.push({
              mediaId,
              success: false,
              error: 'Media not found or not an image',
            });
            continue;
          }

          // Download and compress
          const downloadUrl = await mediaStorageService.generatePresignedDownloadUrl(media.storageKey);
          const response = await fetch(downloadUrl);
          const originalBuffer = Buffer.from(await response.arrayBuffer());

          const compressedResult = await ImageCompressionService.compressImage(
            originalBuffer,
            compressionOptions
          );

          // Upload compressed version
          const fileExtension = compressedResult.format === 'webp' ? 'webp' : 
                               compressedResult.format === 'jpeg' ? 'jpg' : 
                               compressedResult.format;
          const compressedKey = `${media.storageKey.replace(/\.[^/.]+$/, '')}_compressed.${fileExtension}`;
          
          await mediaStorageService.uploadBuffer(
            compressedKey,
            compressedResult.buffer,
            `image/${compressedResult.format}`
          );

          const compressedUrl = mediaStorageService.buildCdnUrl(compressedKey);

          // Generate thumbnails
          const thumbnails = await ImageCompressionService.generateThumbnails(
            compressedResult.buffer,
            compressedKey
          );

          const thumbnailUrls: Record<string, string> = {};
          for (const [size, thumbnail] of Object.entries(thumbnails)) {
            await mediaStorageService.uploadBuffer(
              thumbnail.key,
              thumbnail.buffer,
              'image/webp'
            );
            thumbnailUrls[size] = mediaStorageService.buildCdnUrl(thumbnail.key);
          }

          // Create compressed media record
          const compressedMedia = new Media({
            filename: `compressed_${media.filename}`,
            originalFilename: media.originalFilename,
            mimeType: `image/${compressedResult.format}`,
            mediaType: 'image',
            size: compressedResult.size,
            width: compressedResult.width,
            height: compressedResult.height,
            storageProvider: 's3',
            storageKey: compressedKey,
            storageUrl: compressedUrl,
            thumbnailUrl: thumbnailUrls.medium,
            thumbnails: thumbnailUrls,
            workspaceId: media.workspaceId,
            userId: media.userId,
            uploadedBy: media.uploadedBy,
            tags: [...(media.tags || []), 'compressed'],
            folderId: media.folderId,
            status: 'ready',
            uploadStatus: 'uploaded',
            processingStatus: 'completed',
          });

          await compressedMedia.save();

          results.push({
            mediaId,
            success: true,
            original: {
              size: media.size,
              width: media.width,
              height: media.height,
            },
            compressed: {
              id: compressedMedia._id,
              size: compressedResult.size,
              width: compressedResult.width,
              height: compressedResult.height,
              url: compressedUrl,
              compressionRatio: Math.round(((media.size - compressedResult.size) / media.size) * 100),
            },
          });
        } catch (error) {
          results.push({
            mediaId,
            success: false,
            error: error instanceof Error ? error.message : 'Compression failed',
          });
        }
      }

      res.json({
        success: true,
        results,
        summary: {
          total: mediaIds.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get platform-specific compression recommendations
   * GET /api/composer/compression/recommendations/:platform?
   */
  async getCompressionRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform } = req.params;

      if (platform && !Object.keys(PLATFORM_SPECS).includes(platform)) {
        res.status(400).json({ error: 'Invalid platform' });
        return;
      }

      if (platform) {
        const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
        res.json({
          platform,
          recommendations: {
            maxSize: spec.maxSize,
            recommendedWidth: spec.recommendedWidth,
            recommendedHeight: spec.recommendedHeight,
            quality: spec.quality,
            format: spec.format,
          },
        });
      } else {
        res.json({
          platforms: Object.entries(PLATFORM_SPECS).map(([key, spec]) => ({
            platform: key,
            maxSize: spec.maxSize,
            recommendedWidth: spec.recommendedWidth,
            recommendedHeight: spec.recommendedHeight,
            quality: spec.quality,
            format: spec.format,
          })),
        });
      }
    } catch (error) {
      next(error);
    }
  }
}

export const composerController = new ComposerController();

