/**
 * Draft Version Service
 * 
 * Manages version history for draft posts with automatic snapshots
 */

import mongoose from 'mongoose';
import { DraftVersion, IDraftVersion } from '../models/DraftVersion';
import { Post, PostStatus } from '../models/Post';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface CreateVersionData {
  content: string;
  platformContent?: Array<{
    platform: string;
    text?: string;
    mediaIds?: string[];
    enabled: boolean;
  }>;
  changeDescription?: string;
  changeType?: 'manual' | 'auto' | 'approval' | 'restore';
}

export class DraftVersionService {
  /**
   * Create a new version snapshot
   */
  static async createVersion(
    draftId: string,
    workspaceId: string,
    changedBy: string,
    data: CreateVersionData
  ): Promise<IDraftVersion> {
    try {
      // Verify draft exists
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Get user info
      const user = await User.findById(changedBy);
      if (!user) {
        throw new Error('User not found');
      }

      // Get the next version number
      const lastVersion = await DraftVersion.findOne({
        draftId
      }).sort({ version: -1 });

      const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

      // Generate change description if not provided
      let changeDescription = data.changeDescription;
      if (!changeDescription) {
        changeDescription = this.generateChangeDescription(data, draft);
      }

      // Calculate content metadata
      const metadata = this.calculateMetadata(data.content, data.platformContent);

      // Calculate diff from previous version
      let contentDiff;
      if (lastVersion) {
        contentDiff = this.calculateDiff(lastVersion.content, data.content);
      }

      // Create version
      const version = new DraftVersion({
        draftId: new mongoose.Types.ObjectId(draftId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        version: nextVersion,
        content: data.content,
        platformContent: data.platformContent,
        changedBy: new mongoose.Types.ObjectId(changedBy),
        changedByName: (user as any).name || user.email,
        changedAt: new Date(),
        changeDescription,
        changeType: data.changeType || 'manual',
        contentDiff,
        metadata
      });

      await version.save();

      // Update draft version
      draft.version = nextVersion;
      await draft.save();

      logger.debug('Draft version created', {
        draftId,
        version: nextVersion,
        changedBy,
        changeType: data.changeType
      });

      return version;
    } catch (error) {
      logger.error('Error creating draft version', { draftId, changedBy, error });
      throw error;
    }
  }

  /**
   * Get version history for a draft
   */
  static async getVersionHistory(
    draftId: string,
    workspaceId: string,
    limit = 50,
    offset = 0
  ): Promise<{ versions: IDraftVersion[]; total: number }> {
    try {
      // Verify access to draft
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found or access denied');
      }

      const [versions, total] = await Promise.all([
        DraftVersion.find({ draftId })
          .sort({ version: -1 })
          .limit(limit)
          .skip(offset),
        DraftVersion.countDocuments({ draftId })
      ]);

      return { versions, total };
    } catch (error) {
      logger.error('Error getting version history', { draftId, error });
      throw error;
    }
  }

  /**
   * Get a specific version
   */
  static async getVersion(
    draftId: string,
    version: number,
    workspaceId: string
  ): Promise<IDraftVersion | null> {
    try {
      // Verify access to draft
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found or access denied');
      }

      const versionDoc = await DraftVersion.findOne({
        draftId,
        version
      });

      return versionDoc;
    } catch (error) {
      logger.error('Error getting version', { draftId, version, error });
      throw error;
    }
  }

  /**
   * Restore draft to a specific version
   */
  static async restoreToVersion(
    draftId: string,
    version: number,
    workspaceId: string,
    restoredBy: string
  ): Promise<IDraftVersion> {
    try {
      // Get the version to restore
      const versionToRestore = await this.getVersion(draftId, version, workspaceId);
      if (!versionToRestore) {
        throw new Error('Version not found');
      }

      // Get current draft
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Update draft content
      draft.content = versionToRestore.content;
      if (versionToRestore.platformContent) {
        draft.platformContent = versionToRestore.platformContent as any;
      }
      await draft.save();

      // Create new version for the restore
      const newVersion = await this.createVersion(
        draftId,
        workspaceId,
        restoredBy,
        {
          content: versionToRestore.content,
          platformContent: versionToRestore.platformContent,
          changeDescription: `Restored to version ${version}`,
          changeType: 'restore'
        }
      );

      logger.debug('Draft restored to version', {
        draftId,
        restoredToVersion: version,
        newVersion: newVersion.version,
        restoredBy
      });

      return newVersion;
    } catch (error) {
      logger.error('Error restoring to version', { draftId, version, error });
      throw error;
    }
  }

  /**
   * Auto-create version on significant changes
   */
  static async autoCreateVersion(
    draftId: string,
    workspaceId: string,
    changedBy: string,
    content: string,
    platformContent?: any[]
  ): Promise<IDraftVersion | null> {
    try {
      // Get last version
      const lastVersion = await DraftVersion.findOne({
        draftId
      }).sort({ version: -1 });

      // Check if we should create a new version
      const shouldCreateVersion = this.shouldCreateAutoVersion(
        lastVersion,
        content,
        platformContent
      );

      if (!shouldCreateVersion) {
        return null;
      }

      return await this.createVersion(draftId, workspaceId, changedBy, {
        content,
        platformContent,
        changeDescription: 'Auto-saved changes',
        changeType: 'auto'
      });
    } catch (error) {
      logger.error('Error auto-creating version', { draftId, error });
      return null; // Don't throw for auto-versions
    }
  }

  /**
   * Generate automatic change description
   */
  private static generateChangeDescription(
    data: CreateVersionData,
    draft: any
  ): string {
    const changes: string[] = [];

    // Check content changes
    if (data.content !== draft.content) {
      const oldLength = draft.content?.length || 0;
      const newLength = data.content.length;
      
      if (newLength > oldLength) {
        changes.push('Added content');
      } else if (newLength < oldLength) {
        changes.push('Removed content');
      } else {
        changes.push('Modified content');
      }
    }

    // Check platform content changes
    if (data.platformContent) {
      const oldPlatforms = draft.platformContent?.length || 0;
      const newPlatforms = data.platformContent.length;
      
      if (newPlatforms > oldPlatforms) {
        changes.push('Added platform content');
      } else if (newPlatforms < oldPlatforms) {
        changes.push('Removed platform content');
      }

      // Check for media changes
      const hasMedia = data.platformContent.some(pc => pc.mediaIds && pc.mediaIds.length > 0);
      if (hasMedia) {
        changes.push('Added media');
      }
    }

    return changes.length > 0 ? changes.join(', ') : 'Updated draft';
  }

  /**
   * Calculate content metadata
   */
  private static calculateMetadata(
    content: string,
    platformContent?: any[]
  ) {
    const hashtags = content.match(/#\w+/g) || [];
    const mentions = content.match(/@\w+/g) || [];
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    
    let mediaCount = 0;
    if (platformContent) {
      mediaCount = platformContent.reduce((count, pc) => {
        return count + (pc.mediaIds?.length || 0);
      }, 0);
    }

    return {
      characterCount: content.length,
      wordCount: words.length,
      hashtags: [...new Set(hashtags)],
      mentions: [...new Set(mentions)],
      mediaCount
    };
  }

  /**
   * Calculate diff between two content versions
   */
  private static calculateDiff(oldContent: string, newContent: string) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const added: string[] = [];
    const removed: string[] = [];
    
    // Simple line-based diff
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (oldLine && !newLine) {
        removed.push(oldLine);
      } else if (!oldLine && newLine) {
        added.push(newLine);
      } else if (oldLine !== newLine) {
        if (oldLine) removed.push(oldLine);
        if (newLine) added.push(newLine);
      }
    }

    return {
      added,
      removed,
      modified: [] // Could implement more sophisticated diff here
    };
  }

  /**
   * Determine if we should create an auto-version
   */
  private static shouldCreateAutoVersion(
    lastVersion: IDraftVersion | null,
    content: string,
    platformContent?: any[]
  ): boolean {
    if (!lastVersion) {
      return true; // First version
    }

    // Check time since last version (create version every 10 minutes)
    const timeSinceLastVersion = new Date().getTime() - lastVersion.changedAt.getTime();
    const tenMinutes = 10 * 60 * 1000;
    
    if (timeSinceLastVersion > tenMinutes) {
      return true;
    }

    // Check significant content changes (>10% change)
    const oldLength = lastVersion.content.length;
    const newLength = content.length;
    const changePercent = Math.abs(newLength - oldLength) / Math.max(oldLength, 1);
    
    if (changePercent > 0.1) {
      return true;
    }

    return false;
  }

  /**
   * Clean up old versions (keep last 100 versions per draft)
   */
  static async cleanupOldVersions(draftId: string): Promise<void> {
    try {
      const versions = await DraftVersion.find({ draftId })
        .sort({ version: -1 })
        .skip(100); // Keep last 100 versions

      if (versions.length > 0) {
        const versionIds = versions.map(v => v._id);
        await DraftVersion.deleteMany({ _id: { $in: versionIds } });
        
        logger.debug('Cleaned up old versions', {
          draftId,
          deletedCount: versions.length
        });
      }
    } catch (error) {
      logger.error('Error cleaning up old versions', { draftId, error });
    }
  }
}