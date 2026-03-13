/**
 * MediaFolder Service
 * 
 * Business logic for media folder management
 */

import mongoose from 'mongoose';
import { MediaFolder, IMediaFolder } from '../models/MediaFolder';
import { Media } from '../models/Media';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface CreateFolderInput {
  workspaceId: string;
  userId: string;
  name: string;
  parentFolderId?: string;
}

export interface UpdateFolderInput {
  name?: string;
  parentFolderId?: string | null;
}

export class MediaFolderService {
  private static instance: MediaFolderService;

  private constructor() {}

  static getInstance(): MediaFolderService {
    if (!MediaFolderService.instance) {
      MediaFolderService.instance = new MediaFolderService();
    }
    return MediaFolderService.instance;
  }

  /**
   * Create a new folder
   */
  async createFolder(input: CreateFolderInput): Promise<IMediaFolder> {
    try {
      const { workspaceId, userId, name, parentFolderId } = input;

      // Validate parent folder exists if provided
      if (parentFolderId) {
        const parentFolder = await MediaFolder.findOne({
          _id: parentFolderId,
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        });

        if (!parentFolder) {
          throw new BadRequestError('Parent folder not found');
        }

        // Check for circular reference
        await this.validateNoCircularReference(parentFolderId, workspaceId);
      }

      // Check for duplicate name in same parent
      const existingFolder = await MediaFolder.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name,
        parentFolderId: parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null,
      });

      if (existingFolder) {
        throw new BadRequestError('Folder with this name already exists in this location');
      }

      const folder = await MediaFolder.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name,
        parentFolderId: parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null,
        createdBy: new mongoose.Types.ObjectId(userId),
      });

      logger.info('Media folder created', {
        folderId: folder._id.toString(),
        workspaceId,
        name,
        parentFolderId,
      });

      return folder;
    } catch (error: any) {
      logger.error('Failed to create media folder', {
        workspaceId: input.workspaceId,
        name: input.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get folders for workspace
   */
  async getFolders(workspaceId: string, parentFolderId?: string | null): Promise<IMediaFolder[]> {
    try {
      const filter: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (parentFolderId === null || parentFolderId === undefined) {
        // Get root folders
        filter.parentFolderId = null;
      } else {
        // Get subfolders
        filter.parentFolderId = new mongoose.Types.ObjectId(parentFolderId);
      }

      const folders = await MediaFolder.find(filter)
        .sort({ name: 1 })
        .lean();

      return folders as unknown as IMediaFolder[];
    } catch (error: any) {
      logger.error('Failed to get media folders', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get media folders: ${error.message}`);
    }
  }

  /**
   * Get folder by ID
   */
  async getFolderById(folderId: string, workspaceId: string): Promise<IMediaFolder | null> {
    try {
      const folder = await MediaFolder.findOne({
        _id: folderId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      return folder;
    } catch (error: any) {
      logger.error('Failed to get folder by ID', {
        folderId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get folder: ${error.message}`);
    }
  }

  /**
   * Update folder
   */
  async updateFolder(
    folderId: string,
    workspaceId: string,
    updates: UpdateFolderInput
  ): Promise<IMediaFolder> {
    try {
      const folder = await this.getFolderById(folderId, workspaceId);

      if (!folder) {
        throw new NotFoundError('Folder not found');
      }

      // Validate parent folder if changing
      if (updates.parentFolderId !== undefined) {
        if (updates.parentFolderId === null) {
          // Moving to root
          folder.parentFolderId = undefined;
        } else {
          // Validate parent exists
          const parentFolder = await MediaFolder.findOne({
            _id: updates.parentFolderId,
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
          });

          if (!parentFolder) {
            throw new BadRequestError('Parent folder not found');
          }

          // Check for circular reference
          if (updates.parentFolderId === folderId) {
            throw new BadRequestError('Cannot move folder into itself');
          }

          await this.validateNoCircularReference(updates.parentFolderId, workspaceId, folderId);

          folder.parentFolderId = new mongoose.Types.ObjectId(updates.parentFolderId);
        }
      }

      // Update name if provided
      if (updates.name) {
        // Check for duplicate name in same parent
        const existingFolder = await MediaFolder.findOne({
          _id: { $ne: folderId },
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          name: updates.name,
          parentFolderId: folder.parentFolderId || null,
        });

        if (existingFolder) {
          throw new BadRequestError('Folder with this name already exists in this location');
        }

        folder.name = updates.name;
      }

      await folder.save();

      logger.info('Media folder updated', {
        folderId,
        workspaceId,
        updates,
      });

      return folder;
    } catch (error: any) {
      logger.error('Failed to update media folder', {
        folderId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderId: string, workspaceId: string): Promise<void> {
    try {
      const folder = await this.getFolderById(folderId, workspaceId);

      if (!folder) {
        throw new NotFoundError('Folder not found');
      }

      // Check if folder has subfolders
      const subfolderCount = await MediaFolder.countDocuments({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        parentFolderId: new mongoose.Types.ObjectId(folderId),
      });

      if (subfolderCount > 0) {
        throw new BadRequestError('Cannot delete folder with subfolders');
      }

      // Check if folder has media
      const mediaCount = await Media.countDocuments({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        folderId: new mongoose.Types.ObjectId(folderId),
      });

      if (mediaCount > 0) {
        throw new BadRequestError('Cannot delete folder with media assets');
      }

      await MediaFolder.findByIdAndDelete(folderId);

      logger.info('Media folder deleted', {
        folderId,
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Failed to delete media folder', {
        folderId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate no circular reference in folder hierarchy
   */
  private async validateNoCircularReference(
    parentFolderId: string,
    workspaceId: string,
    currentFolderId?: string
  ): Promise<void> {
    const visited = new Set<string>();
    let currentId: string | null = parentFolderId;

    while (currentId) {
      if (currentFolderId && currentId === currentFolderId) {
        throw new BadRequestError('Circular folder reference detected');
      }

      if (visited.has(currentId)) {
        throw new BadRequestError('Circular folder reference detected');
      }

      visited.add(currentId);

      const folder = await MediaFolder.findOne({
        _id: currentId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!folder) {
        break;
      }

      currentId = folder.parentFolderId?.toString() || null;
    }
  }

  /**
   * Get folder path (breadcrumb)
   */
  async getFolderPath(folderId: string, workspaceId: string): Promise<IMediaFolder[]> {
    try {
      const path: IMediaFolder[] = [];
      let currentId: string | null = folderId;

      while (currentId) {
        const folder = await this.getFolderById(currentId, workspaceId);

        if (!folder) {
          break;
        }

        path.unshift(folder);
        currentId = folder.parentFolderId?.toString() || null;
      }

      return path;
    } catch (error: any) {
      logger.error('Failed to get folder path', {
        folderId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get folder path: ${error.message}`);
    }
  }
}

export const mediaFolderService = MediaFolderService.getInstance();
