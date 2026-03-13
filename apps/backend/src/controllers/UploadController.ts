/**
 * Upload Controller
 * 
 * Handles media upload operations
 * 
 * Endpoints:
 * - POST /media/upload-url - Generate presigned upload URL
 * - POST /media/complete - Complete upload and create media record
 * - DELETE /media/:id - Delete media
 */

import { Request, Response, NextFunction } from 'express';
import { mediaStorageService, StorageProvider } from '../services/MediaStorageService';
import { mediaService } from '../services/MediaService';
import { MediaType } from '../models/Media';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { trimVideo, generateThumbnail } from '../utils/ffmpeg';
import path from 'path';
import { promises as fs } from 'fs';

export class UploadController {
  /**
   * Generate presigned upload URL
   * 
   * POST /media/upload-url
   * 
   * Body:
   * - filename: string
   * - mimeType: string
   * - size: number
   */
  async generateUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename, mimeType, size } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      // Validation
      if (!filename || !mimeType || !size) {
        throw new BadRequestError('filename, mimeType, and size are required');
      }

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!userId) {
        throw new UnauthorizedError('User authentication required');
      }

      // Validate file size (max 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (size > maxSize) {
        throw new BadRequestError(`File size exceeds maximum allowed size of ${maxSize} bytes`);
      }

      // Validate MIME type
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
      ];

      if (!allowedMimeTypes.includes(mimeType)) {
        throw new BadRequestError(`MIME type ${mimeType} is not allowed`);
      }

      // Generate presigned upload URL
      const uploadData = await mediaStorageService.generatePresignedUploadUrl(
        workspaceId,
        filename,
        mimeType
      );

      logger.info('Presigned upload URL generated', {
        workspaceId,
        userId,
        filename,
        storageKey: uploadData.storageKey,
      });

      res.status(200).json({
        success: true,
        data: {
          uploadUrl: uploadData.uploadUrl,
          storageKey: uploadData.storageKey,
          storageProvider: uploadData.storageProvider,
          expiresIn: uploadData.expiresIn,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete upload and create media record
   * 
   * POST /media/complete
   * 
   * Body:
   * - storageKey: string
   * - filename: string
   * - originalFilename: string
   * - mimeType: string
   * - size: number
   */
  async completeUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storageKey, filename, originalFilename, mimeType, size } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      // Validation
      if (!storageKey || !filename || !originalFilename || !mimeType || !size) {
        throw new BadRequestError('storageKey, filename, originalFilename, mimeType, and size are required');
      }

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!userId) {
        throw new UnauthorizedError('User authentication required');
      }

      // Determine media type from MIME type
      let mediaType: MediaType;
      if (mimeType.startsWith('image/')) {
        mediaType = MediaType.IMAGE;
      } else if (mimeType.startsWith('video/')) {
        mediaType = MediaType.VIDEO;
      } else {
        throw new BadRequestError('Unsupported media type');
      }

      // Get storage provider from storage service
      const storageConfig = mediaStorageService.getStorageConfig();

      // Create media record
      const media = await mediaService.createMedia({
        workspaceId,
        userId,
        filename,
        originalFilename,
        mimeType,
        mediaType,
        size,
        storageKey,
        storageProvider: storageConfig.provider,
      });

      // Mark upload as completed
      const updatedMedia = await mediaService.markUploadCompleted(media._id.toString());

      logger.info('Upload completed and media record created', {
        mediaId: media._id.toString(),
        workspaceId,
        userId,
        filename,
        uploadStatus: updatedMedia?.uploadStatus,
      });

      res.status(201).json({
        success: true,
        data: updatedMedia?.toJSON() || media.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete media
   * 
   * DELETE /media/:id
   */
  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      // Delete media
      await mediaService.deleteMedia(id, workspaceId);

      logger.info('Media deleted via API', {
        mediaId: id,
        workspaceId,
      });

      res.status(200).json({
        success: true,
        message: 'Media deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get media by ID
   * 
   * GET /media/:id
   */
  async getMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const media = await mediaService.getMediaById(id, workspaceId);

      if (!media) {
        throw new NotFoundError('Media not found');
      }

      res.status(200).json({
        success: true,
        data: media.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List media
   * 
   * GET /media
   * 
   * Query params:
   * - status: MediaStatus (optional)
   * - mediaType: MediaType (optional)
   * - limit: number (optional, default: 50)
   * - skip: number (optional, default: 0)
   * - sortBy: 'createdAt' | 'uploadedAt' | 'size' (optional, default: 'createdAt')
   * - sortOrder: 'asc' | 'desc' (optional, default: 'desc')
   */
  async listMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const {
        status,
        mediaType,
        limit = '50',
        skip = '0',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const result = await mediaService.listMedia({
        workspaceId,
        status: status as any,
        mediaType: mediaType as any,
        limit: parseInt(limit as string, 10),
        skip: parseInt(skip as string, 10),
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      });

      res.status(200).json({
        success: true,
        data: result.media.map(m => m.toJSON()),
        pagination: {
          total: result.total,
          limit: parseInt(limit as string, 10),
          skip: parseInt(skip as string, 10),
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get media statistics
   * 
   * GET /media/stats
   */
  async getMediaStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const stats = await mediaService.getMediaStats(workspaceId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trim video
   * 
   * POST /media/:id/trim
   * 
   * Body:
   * - startTime: number (seconds)
   * - endTime: number (seconds)
   */
  async trimVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startTime, endTime } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!userId) {
        throw new UnauthorizedError('User authentication required');
      }

      if (typeof startTime !== 'number' || typeof endTime !== 'number') {
        throw new BadRequestError('startTime and endTime must be numbers');
      }

      if (startTime >= endTime) {
        throw new BadRequestError('startTime must be less than endTime');
      }

      if (startTime < 0) {
        throw new BadRequestError('startTime cannot be negative');
      }

      // Get original media
      const originalMedia = await mediaService.getMediaById(id, workspaceId);
      if (!originalMedia) {
        throw new NotFoundError('Media not found');
      }

      if (originalMedia.mediaType !== MediaType.VIDEO) {
        throw new BadRequestError('Media must be a video');
      }

      // Download original video
      const downloadUrl = await mediaStorageService.generatePresignedDownloadUrl(
        originalMedia.storageKey
      );
      const response = await fetch(downloadUrl);
      const originalVideoBuffer = Buffer.from(await response.arrayBuffer());

      // Create temporary files
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempInputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
      const tempOutputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

      try {
        // Write original video to temp file
        await fs.writeFile(tempInputPath, originalVideoBuffer);

        // Trim video
        await trimVideo(tempInputPath, tempOutputPath, startTime, endTime);

        // Read trimmed video
        const trimmedVideoBuffer = await fs.readFile(tempOutputPath);

        // Generate new filename
        const originalName = path.parse(originalMedia.originalFilename);
        const newFilename = `${originalName.name}_trimmed_${startTime}s-${endTime}s${originalName.ext}`;

        // Upload trimmed video
        const storageKey = `media/${workspaceId}/${Date.now()}_${newFilename}`;
        await mediaStorageService.uploadBuffer(
          storageKey,
          trimmedVideoBuffer,
          originalMedia.mimeType
        );
        const uploadData = {
          storageKey,
          publicUrl: mediaStorageService.getPublicUrl(storageKey),
          storageProvider: StorageProvider.S3
        };

        // Create new media record
        const newMedia = await mediaService.createMedia({
          workspaceId,
          userId,
          filename: newFilename,
          originalFilename: newFilename,
          mimeType: originalMedia.mimeType,
          mediaType: MediaType.VIDEO,
          size: trimmedVideoBuffer.length,
          storageKey: uploadData.storageKey,
          storageProvider: uploadData.storageProvider,
        });

        // Mark upload as completed
        const completedMedia = await mediaService.markUploadCompleted(newMedia._id.toString());

        logger.info('Video trimmed successfully', {
          originalMediaId: id,
          newMediaId: newMedia._id.toString(),
          startTime,
          endTime,
          workspaceId,
        });

        res.status(201).json({
          success: true,
          data: completedMedia?.toJSON() || newMedia.toJSON(),
        });
      } finally {
        // Clean up temporary files
        try {
          await fs.unlink(tempInputPath);
          await fs.unlink(tempOutputPath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up temporary files', { cleanupError });
        }
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate thumbnail for video
   * 
   * POST /media/:id/thumbnail
   * 
   * Body:
   * - timeOffset: number (seconds, optional, defaults to 1)
   */
  async generateVideoThumbnail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { timeOffset = 1 } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (typeof timeOffset !== 'number' || timeOffset < 0) {
        throw new BadRequestError('timeOffset must be a non-negative number');
      }

      // Get media
      const media = await mediaService.getMediaById(id, workspaceId);
      if (!media) {
        throw new NotFoundError('Media not found');
      }

      if (media.mediaType !== MediaType.VIDEO) {
        throw new BadRequestError('Media must be a video');
      }

      // Download video
      const downloadUrl = await mediaStorageService.generatePresignedDownloadUrl(
        media.storageKey
      );
      const response = await fetch(downloadUrl);
      const videoBuffer = Buffer.from(await response.arrayBuffer());

      // Create temporary files
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempVideoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
      const tempThumbnailPath = path.join(tempDir, `thumb_${Date.now()}.jpg`);

      try {
        // Write video to temp file
        await fs.writeFile(tempVideoPath, videoBuffer);

        // Generate thumbnail
        await generateThumbnail(tempVideoPath, tempThumbnailPath, timeOffset);

        // Read thumbnail
        const thumbnailBuffer = await fs.readFile(tempThumbnailPath);

        // Upload thumbnail
        const thumbnailFilename = `${path.parse(media.originalFilename).name}_thumb.jpg`;
        const storageKey = `media/${workspaceId}/${Date.now()}_${thumbnailFilename}`;
        await mediaStorageService.uploadBuffer(
          storageKey,
          thumbnailBuffer,
          'image/jpeg'
        );
        const uploadData = {
          storageKey,
          publicUrl: mediaStorageService.getPublicUrl(storageKey)
        };

        // Update media with thumbnail URL
        const updatedMedia = await (mediaService as any).updateMedia(id, {
          thumbnailUrl: uploadData.publicUrl,
        });

        logger.info('Video thumbnail generated', {
          mediaId: id,
          timeOffset,
          thumbnailUrl: uploadData.publicUrl,
          workspaceId,
        });

        res.status(200).json({
          success: true,
          data: updatedMedia?.toJSON(),
        });
      } finally {
        // Clean up temporary files
        try {
          await fs.unlink(tempVideoPath);
          await fs.unlink(tempThumbnailPath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up temporary files', { cleanupError });
        }
      }
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
