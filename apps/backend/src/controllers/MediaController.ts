/**
 * Media Controller
 * 
 * REST API endpoints for media upload management
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { mediaUploadService } from '../services/MediaUploadService';
import { logger } from '../utils/logger';
import {
  sendSuccess,
  sendValidationError,
  sendNotFound,
  sendError,
} from '../utils/apiResponse';

export class MediaController {
  /**
   * POST /api/v1/media/upload-url
   * Generate signed upload URL
   */
  async generateUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, filename, mimeType, size } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        return;
      }

      // Generate upload URL
      const result = await mediaUploadService.generateUploadUrl({
        workspaceId,
        userId,
        filename,
        mimeType,
        size,
      });

      logger.info('Upload URL generated via API', {
        mediaId: result.mediaId,
        workspaceId,
        userId,
      });

      sendSuccess(res, result, 200);
    } catch (error: any) {
      logger.error('Failed to generate upload URL', {
        error: error.message,
        body: req.body,
      });

      if (error.message.includes('exceeds maximum') || error.message.includes('Unsupported')) {
        sendError(res, 'VALIDATION_ERROR', error.message, 400);
        return;
      }

      next(error);
    }
  }

  /**
   * POST /api/v1/media/:id/confirm
   * Confirm upload completion
   */
  async confirmUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { id } = req.params;
      const { workspaceId, width, height, duration } = req.body;

      // Confirm upload
      const media = await mediaUploadService.confirmUpload({
        mediaId: id,
        workspaceId,
        width,
        height,
        duration,
      });

      logger.info('Upload confirmed via API', {
        mediaId: media._id.toString(),
        workspaceId,
      });

      sendSuccess(res, media.toJSON(), 200);
    } catch (error: any) {
      if (error.message === 'Media not found') {
        sendNotFound(res, 'Media');
        return;
      }

      if (error.message.startsWith('Media already')) {
        sendError(res, 'INVALID_OPERATION', error.message, 400);
        return;
      }

      logger.error('Failed to confirm upload', {
        error: error.message,
        mediaId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * POST /api/v1/media/:id/failed
   * Mark upload as failed
   */
  async markUploadFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { id } = req.params;
      const { workspaceId, error } = req.body;

      // Mark as failed
      await mediaUploadService.markUploadFailed(id, workspaceId, error);

      logger.info('Upload marked as failed via API', {
        mediaId: id,
        workspaceId,
        error,
      });

      sendSuccess(res, { message: 'Upload marked as failed' }, 200);
    } catch (error: any) {
      logger.error('Failed to mark upload as failed', {
        error: error.message,
        mediaId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/media/:id
   * Get media by ID
   */
  async getMediaById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { id } = req.params;
      const { workspaceId } = req.query;

      // Get media
      const media = await mediaUploadService.getMediaById(id, workspaceId as string);

      sendSuccess(res, media.toJSON(), 200);
    } catch (error: any) {
      if (error.message === 'Media not found') {
        sendNotFound(res, 'Media');
        return;
      }

      logger.error('Failed to get media', {
        error: error.message,
        mediaId: req.params.id,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/media
   * Get media list
   */
  async getMediaList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, mediaType, status, page, limit } = req.query;

      // Get media list
      const result = await mediaUploadService.getMediaList(workspaceId as string, {
        mediaType: mediaType as any,
        status: status as any,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(
        res,
        {
          media: result.media.map((m) => m.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get media list', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/media/library
   * Get media library with search and filters
   */
  async getLibrary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { workspaceId, search, mediaType, status, page, limit } = req.query;

      // Get media library
      const result = await mediaUploadService.getMediaLibrary({
        workspaceId: workspaceId as string,
        search: search as string,
        mediaType: mediaType as any,
        status: status as any,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(
        res,
        {
          media: result.media.map((m) => m.toJSON()),
        },
        200,
        {
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        }
      );
    } catch (error: any) {
      logger.error('Failed to get media library', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }

  /**
   * DELETE /api/v1/media/:id
   * Delete media
   */
  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(
          res,
          errors.array().map((err) => ({
            field: err.type === 'field' ? (err as any).path : undefined,
            message: err.msg,
          }))
        );
        return;
      }

      const { id } = req.params;
      const { workspaceId } = req.query;

      // Delete media
      await mediaUploadService.deleteMedia(id, workspaceId as string);

      logger.info('Media deleted via API', {
        mediaId: id,
        workspaceId,
      });

      sendSuccess(res, { message: 'Media deleted successfully' }, 200);
    } catch (error: any) {
      if (error.message === 'Media not found') {
        sendNotFound(res, 'Media');
        return;
      }

      logger.error('Failed to delete media', {
        error: error.message,
        mediaId: req.params.id,
      });

      next(error);
    }
  }
}

// Export singleton instance
export const mediaController = new MediaController();
