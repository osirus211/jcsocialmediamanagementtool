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
}

export const composerController = new ComposerController();

