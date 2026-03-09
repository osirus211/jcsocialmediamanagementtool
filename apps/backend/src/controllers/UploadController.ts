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
import { mediaStorageService } from '../services/MediaStorageService';
import { mediaService } from '../services/MediaService';
import { MediaType } from '../models/Media';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import path from 'path';

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
}

export const uploadController = new UploadController();
