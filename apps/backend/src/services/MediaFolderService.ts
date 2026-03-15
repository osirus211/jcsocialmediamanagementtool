/**
 * Media Folder Service
 * 
 * Handles media folder operations and organization
 */

import mongoose from 'mongoose';
import { MediaFolder, IMediaFolder } from '../models/MediaFolder';
import { Media } from '../models/Media';
import { logger } from '../utils/logger';

export interface FolderTreeNode {
  id: string;
  name: string;
  color: string;
  icon: string;
  mediaCount: number;
  parentFolderId: string | null;
  children: FolderTreeNode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFolderInput {
  name: string;
  parentFolderId?: string;
  color?: string;
  icon?: string;
}

export interface UpdateFolderInput {
  name?: string;
  color?: string;
  icon?: string;
  parentFolderId?: string;
}

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
    input: CreateFolderInput
  ): Promise<any> {
    try {
      const { name, parentFolderId, color, icon } = input;

      // Check if folder name already exists in workspace at the same level
      const existingFolder = await MediaFolder.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name: name.trim(),
        parentFolderId: parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null,
      });

      if (existingFolder) {
        throw new Error('Folder with this name already exists at this level');
      }

      const folder = new MediaFolder({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name: name.trim(),
        parentFolderId: parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null,
        color: color || '#3B82F6',
        icon: icon || 'folder',
        createdBy: new mongoose.Types.ObjectId(userId),
      });

      await folder.save();

      logger.info('Media folder created', {
        workspaceId,
        userId,
        folderId: folder._id,
        name,
        parentFolderId,
        color,
        icon,
      });

      return folder.toJSON();
    } catch (error: any) {
      logger.error('Failed to create folder', {
        workspaceId,
        userId,
        input,
        error: error.message,
      });
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  /**
   * Update a folder
   */
  static async updateFolder(
    workspaceId: string,
    folderId: string,
    input: UpdateFolderInput
  ): Promise<any> {
    try {
      const { name, color, icon, parentFolderId } = input;
      const updateData: any = {};

      if (name !== undefined) {
        // Check if new name already exists at the same level
        const existingFolder = await MediaFolder.findOne({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          name: name.trim(),
          parentFolderId: parentFolderId !== undefined 
            ? (parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null)
            : undefined,
          _id: { $ne: new mongoose.Types.ObjectId(folderId) },
        });

        if (existingFolder) {
          throw new Error('Folder with this name already exists at this level');
        }

        updateData.name = name.trim();
      }

      if (color !== undefined) {
        updateData.color = color;
      }

      if (icon !== undefined) {
        updateData.icon = icon;
      }

      if (parentFolderId !== undefined) {
        updateData.parentFolderId = parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null;
      }

      const folder = await MediaFolder.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(folderId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        updateData,
        { new: true }
      );

      if (!folder) {
        throw new Error('Folder not found');
      }

      logger.info('Media folder updated', {
        workspaceId,
        folderId,
        updateData,
      });

      return folder.toJSON();
    } catch (error: any) {
      logger.error('Failed to update folder', {
        workspaceId,
        folderId,
        input,
        error: error.message,
      });
      throw new Error(`Failed to update folder: ${error.message}`);
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

  /**
   * Get folder tree with nested structure
   */
  static async getFolderTree(workspaceId: string): Promise<FolderTreeNode[]> {
    try {
      // Get all folders for the workspace
      const folders = await MediaFolder.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      }).sort({ name: 1 });

      // Get media counts for all folders
      const folderMediaCounts = await Promise.all(
        folders.map(async (folder) => {
          const mediaCount = await Media.countDocuments({
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            folderId: folder._id,
          });
          return { folderId: folder._id.toString(), mediaCount };
        })
      );

      const mediaCountMap = folderMediaCounts.reduce((acc, item) => {
        acc[item.folderId] = item.mediaCount;
        return acc;
      }, {} as Record<string, number>);

      // Convert to tree nodes
      const folderMap = new Map<string, FolderTreeNode>();
      const rootFolders: FolderTreeNode[] = [];

      // Create all nodes first
      folders.forEach(folder => {
        const node: FolderTreeNode = {
          id: folder._id.toString(),
          name: folder.name,
          color: folder.color || '#3B82F6',
          icon: folder.icon || 'folder',
          mediaCount: mediaCountMap[folder._id.toString()] || 0,
          parentFolderId: folder.parentFolderId?.toString() || null,
          children: [],
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
        };
        folderMap.set(node.id, node);
      });

      // Build tree structure
      folderMap.forEach(node => {
        if (node.parentFolderId) {
          const parent = folderMap.get(node.parentFolderId);
          if (parent) {
            parent.children.push(node);
          } else {
            // Parent not found, treat as root
            rootFolders.push(node);
          }
        } else {
          rootFolders.push(node);
        }
      });

      // Sort children recursively
      const sortChildren = (nodes: FolderTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach(node => sortChildren(node.children));
      };

      sortChildren(rootFolders);

      logger.debug('Folder tree generated', {
        workspaceId,
        totalFolders: folders.length,
        rootFolders: rootFolders.length,
      });

      return rootFolders;
    } catch (error: any) {
      logger.error('Failed to get folder tree', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get folder tree: ${error.message}`);
    }
  }

  /**
   * Get media by folder
   */
  static async getMediaByFolder(
    workspaceId: string,
    folderId: string | null,
    limit: number = 50,
    skip: number = 0
  ): Promise<{
    media: any[];
    total: number;
    hasMore: boolean;
    folder?: any;
  }> {
    try {
      const filter: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (folderId === null) {
        // Root level media (no folder)
        filter.folderId = null;
      } else {
        filter.folderId = new mongoose.Types.ObjectId(folderId);
      }

      const [media, total, folder] = await Promise.all([
        Media.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        Media.countDocuments(filter),
        folderId ? MediaFolder.findOne({
          _id: new mongoose.Types.ObjectId(folderId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        }) : null,
      ]);

      const hasMore = skip + media.length < total;

      logger.debug('Media retrieved by folder', {
        workspaceId,
        folderId,
        count: media.length,
        total,
        hasMore,
      });

      return {
        media,
        total,
        hasMore,
        folder: folder?.toJSON(),
      };
    } catch (error: any) {
      logger.error('Failed to get media by folder', {
        workspaceId,
        folderId,
        error: error.message,
      });
      throw new Error(`Failed to get media by folder: ${error.message}`);
    }
  }

  /**
   * Get folder statistics
   */
  static async getFolderStats(workspaceId: string): Promise<{
    totalFolders: number;
    totalMediaInFolders: number;
    totalMediaInRoot: number;
    averageMediaPerFolder: number;
  }> {
    try {
      const [totalFolders, totalMediaInFolders, totalMediaInRoot] = await Promise.all([
        MediaFolder.countDocuments({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        }),
        Media.countDocuments({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          folderId: { $ne: null },
        }),
        Media.countDocuments({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          folderId: null,
        }),
      ]);

      const averageMediaPerFolder = totalFolders > 0 ? Math.round(totalMediaInFolders / totalFolders) : 0;

      return {
        totalFolders,
        totalMediaInFolders,
        totalMediaInRoot,
        averageMediaPerFolder,
      };
    } catch (error: any) {
      logger.error('Failed to get folder statistics', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get folder statistics: ${error.message}`);
    }
  }
}