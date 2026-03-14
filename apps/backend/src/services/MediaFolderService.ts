/**
 * Media Folder Service
 * 
 * Handles media folder operations and organization
 */

import mongoose from 'mongoose';
import { MediaFolder, IMediaFolder } from '../models/MediaFolder';
import { Media } from '../models/Media';
import { logger } from '../utils/logger';

export class MediaFolderService {
  /**
   * Get all folders for a workspace
   */
  static async getFolders(workspaceId: string): Promise<any[]> {
    try {
      const folders = await MediaFolder.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      }).sort({ name: 1 });

      // Add media counts
      const foldersWithCounts = await Promise.all(
        folders.map(async (folder) => {
          const mediaCount = await Media.countDocuments({
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            folderId: folder._id,
          });

          return {
            ...folder.toJSON(),
            mediaCount,
          };
        })
      );

      return foldersWithCounts;
    } catch (error: any) {
      logger.error('Failed to get folders', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get folders: ${error.message}`);
    }
  }

  /**
   * Create a new folder
   */
  static async createFolder(
    workspaceId: string,
    userId: string,
    name: string,
    parentFolderId?: string
  ): Promise<any> {
    try {
      // Check if folder name already exists in workspace
      const existingFolder = await MediaFolder.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name: name.trim(),
        parentFolderId: parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null,
      });

      if (existingFolder) {
        throw new Error('Folder with this name already exists');
      }

      const folder = new MediaFolder({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name: name.trim(),
        parentFolderId: parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null,
        createdBy: new mongoose.Types.ObjectId(userId),
      });

      await folder.save();

      logger.info('Media folder created', {
        workspaceId,
        userId,
        folderId: folder._id,
        name,
        parentFolderId,
      });

      return folder.toJSON();
    } catch (error: any) {
      logger.error('Failed to create folder', {
        workspaceId,
        userId,
        name,
        error: error.message,
      });
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  /**
   * Rename a folder
   */
  static async renameFolder(
    workspaceId: string,
    folderId: string,
    newName: string
  ): Promise<any> {
    try {
      // Check if new name already exists
      const existingFolder = await MediaFolder.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name: newName.trim(),
        _id: { $ne: new mongoose.Types.ObjectId(folderId) },
      });

      if (existingFolder) {
        throw new Error('Folder with this name already exists');
      }

      const folder = await MediaFolder.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(folderId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        { name: newName.trim() },
        { new: true }
      );

      if (!folder) {
        throw new Error('Folder not found');
      }

      logger.info('Media folder renamed', {
        workspaceId,
        folderId,
        newName,
      });

      return folder.toJSON();
    } catch (error: any) {
      logger.error('Failed to rename folder', {
        workspaceId,
        folderId,
        newName,
        error: error.message,
      });
      throw new Error(`Failed to rename folder: ${error.message}`);
    }
  }

  /**
   * Delete a folder (moves all media to root)
   */
  static async deleteFolder(workspaceId: string, folderId: string): Promise<void> {
    try {
      // Move all media in this folder to root (folderId = null)
      await Media.updateMany(
        {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          folderId: new mongoose.Types.ObjectId(folderId),
        },
        { folderId: null }
      );

      // Delete the folder
      const result = await MediaFolder.deleteOne({
        _id: new mongoose.Types.ObjectId(folderId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (result.deletedCount === 0) {
        throw new Error('Folder not found');
      }

      logger.info('Media folder deleted', {
        workspaceId,
        folderId,
      });
    } catch (error: any) {
      logger.error('Failed to delete folder', {
        workspaceId,
        folderId,
        error: error.message,
      });
      throw new Error(`Failed to delete folder: ${error.message}`);
    }
  }

  /**
   * Move media to folder
   */
  static async moveMediaToFolder(
    workspaceId: string,
    mediaIds: string[],
    folderId?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        folderId: folderId ? new mongoose.Types.ObjectId(folderId) : null,
      };

      const result = await Media.updateMany(
        {
          _id: { $in: mediaIds.map(id => new mongoose.Types.ObjectId(id)) },
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        updateData
      );

      logger.info('Media moved to folder', {
        workspaceId,
        mediaIds,
        folderId,
        updatedCount: result.modifiedCount,
      });
    } catch (error: any) {
      logger.error('Failed to move media to folder', {
        workspaceId,
        mediaIds,
        folderId,
        error: error.message,
      });
      throw new Error(`Failed to move media to folder: ${error.message}`);
    }
  }
}