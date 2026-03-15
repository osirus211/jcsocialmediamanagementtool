/**
 * MediaTag Controller
 * 
 * Handles media tagging operations
 */

import { Request, Response, NextFunction } from 'express';
import { mediaTagService } from '../services/MediaTagService';
import { logger } from '../utils/logger';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class MediaTagController {
  /**
   * Get tag cloud
   * GET /media/tags/cloud
   */
  async getTagCloud(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { limit = 50 } = req.query;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const tagCloud = await mediaTagService.getTagCloud(
        workspaceId,
        parseInt(limit as string)
      );

      res.status(200).json({
        success: true,
        data: tagCloud,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get most used tags
   * GET /media/tags/popular
   */
  async getMostUsedTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { limit = 20 } = req.query;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const tags = await mediaTagService.getMostUsedTags(
        workspaceId,
        parseInt(limit as string)
      );

      res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search tags
   * GET /media/tags/search
   */
  async searchTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { q, limit = 10 } = req.query;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!q) {
        throw new BadRequestError('Search query (q) is required');
      }

      const tags = await mediaTagService.searchTags(
        workspaceId,
        q as string,
        parseInt(limit as string)
      );

      res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get media by tag
   * GET /media/tags/:tag/media
   */
  async getMediaByTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tag } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();
      const { limit = 50, skip = 0 } = req.query;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const result = await mediaTagService.getMediaByTag(
        workspaceId,
        tag,
        parseInt(limit as string),
        parseInt(skip as string)
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tag statistics
   * GET /media/tags/stats
   */
  async getTagStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const stats = await mediaTagService.getTagStats(workspaceId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add tags to media
   * POST /media/:id/tags
   */
  async addTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { tags } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!Array.isArray(tags)) {
        throw new BadRequestError('Tags must be an array');
      }

      const media = await mediaTagService.addTags(id, workspaceId, tags);

      if (!media) {
        throw new BadRequestError('Media not found');
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
   * Remove tags from media
   * DELETE /media/:id/tags
   */
  async removeTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { tags } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!Array.isArray(tags)) {
        throw new BadRequestError('Tags must be an array');
      }

      const media = await mediaTagService.removeTags(id, workspaceId, tags);

      if (!media) {
        throw new BadRequestError('Media not found');
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
   * Bulk tag media files
   * POST /media/tags/bulk
   */
  async bulkTagMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mediaIds, tags } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!Array.isArray(mediaIds)) {
        throw new BadRequestError('mediaIds must be an array');
      }

      if (!Array.isArray(tags)) {
        throw new BadRequestError('Tags must be an array');
      }

      const updatedCount = await mediaTagService.bulkTagMedia(workspaceId, mediaIds, tags);

      res.status(200).json({
        success: true,
        message: `${updatedCount} media files tagged successfully`,
        data: { updatedCount },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const mediaTagController = new MediaTagController();