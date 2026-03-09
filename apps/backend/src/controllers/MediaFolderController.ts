/**
 * MediaFolder Controller
 * 
 * Handles media folder operations
 */

import { Request, Response, NextFunction } from 'express';
import { mediaFolderService } from '../services/MediaFolderService';
import { mediaService } from '../services/MediaService';
import { logger } from '../utils/logger';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class MediaFolderController {
  /**
   * Create folder
   * POST /media/folders
   */
  async createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, parentFolderId } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      if (!userId) {
        throw new UnauthorizedError('User authentication required');
      }

      if (!name) {
        throw new BadRequestError('Folder name is required');
      }

      const folder = await mediaFolderService.createFolder({
        workspaceId,
        userId,
        name,
        parentFolderId,
      });

      res.status(201).json({
        success: true,
        data: folder.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get folders
   * GET /media/folders
   */
  async getFolders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { parentFolderId } = req.query;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const folders = await mediaFolderService.getFolders(
        workspaceId,
        parentFolderId === 'null' ? null : (parentFolderId as string)
      );

      res.status(200).json({
        success: true,
        data: folders.map(f => f.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update folder
   * PATCH /media/folders/:id
   */
  async updateFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, parentFolderId } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const folder = await mediaFolderService.updateFolder(id, workspaceId, {
        name,
        parentFolderId,
      });

      res.status(200).json({
        success: true,
        data: folder.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete folder
   * DELETE /media/folders/:id
   */
  async deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      await mediaFolderService.deleteFolder(id, workspaceId);

      res.status(200).json({
        success: true,
        message: 'Folder deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move media to folder
   * PATCH /media/:id/folder
   */
  async moveMediaToFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { folderId } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      // Validate folder exists if provided
      if (folderId) {
        const folder = await mediaFolderService.getFolderById(folderId, workspaceId);
        if (!folder) {
          throw new BadRequestError('Folder not found');
        }
      }

      const media = await mediaService.moveToFolder(id, workspaceId, folderId || null);

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
   * Update media tags
   * PATCH /media/:id/tags
   */
  async updateMediaTags(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const media = await mediaService.updateTags(id, workspaceId, tags);

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
}

export const mediaFolderController = new MediaFolderController();
