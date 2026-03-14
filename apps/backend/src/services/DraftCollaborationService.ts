/**
 * Draft Collaboration Service
 * 
 * Handles collaborative editing of draft posts using optimistic locking
 * and polling-based synchronization (no WebSockets required)
 */

import mongoose from 'mongoose';
import { Post, PostStatus } from '../models/Post';
import { DraftVersionService } from './DraftVersionService';
import { logger } from '../utils/logger';

const LOCK_DURATION_MS = 60 * 1000; // 60 seconds

export interface LockResult {
  success: boolean;
  lockedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lockedAt?: Date;
  lockExpiresAt?: Date;
}

export interface DraftStatus {
  lockedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lockExpiresAt?: Date;
  lastEditedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lastEditedAt?: Date;
  version: number;
}

export interface AutoSaveResult {
  saved: boolean;
  version: number;
  conflict?: boolean;
}

export class DraftCollaborationService {
  /**
   * Acquire edit lock for a draft post
   */
  static async acquireLock(postId: string, userId: string): Promise<LockResult> {
    try {
      const now = new Date();
      const lockExpiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

      // Find the post and check if it's already locked
      const post = await Post.findById(postId).populate('lockedBy', 'name email');

      if (!post) {
        throw new Error('Post not found');
      }

      // Check if post is currently locked by someone else
      if (post.isEditLocked() && post.lockedBy?.toString() !== userId) {
        logger.debug('Post already locked by another user', {
          postId,
          lockedBy: post.lockedBy,
          lockExpiresAt: post.lockExpiresAt,
        });

        return {
          success: false,
          lockedBy: post.lockedBy as any,
          lockedAt: post.lockedAt,
          lockExpiresAt: post.lockExpiresAt,
        };
      }

      // Acquire or renew lock
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        {
          lockedBy: new mongoose.Types.ObjectId(userId),
          lockedAt: now,
          lockExpiresAt,
        },
        { new: true }
      ).populate('lockedBy', 'name email');

      if (!updatedPost) {
        throw new Error('Failed to acquire lock');
      }

      logger.debug('Lock acquired successfully', {
        postId,
        userId,
        lockExpiresAt,
      });

      return {
        success: true,
        lockedBy: updatedPost.lockedBy as any,
        lockedAt: updatedPost.lockedAt,
        lockExpiresAt: updatedPost.lockExpiresAt,
      };
    } catch (error) {
      logger.error('Error acquiring lock', { postId, userId, error });
      throw error;
    }
  }

  /**
   * Release edit lock for a draft post
   */
  static async releaseLock(postId: string, userId: string): Promise<void> {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        throw new Error('Post not found');
      }

      // Only release if locked by the requesting user
      if (post.lockedBy?.toString() !== userId) {
        logger.warn('Attempted to release lock not owned by user', {
          postId,
          userId,
          lockedBy: post.lockedBy,
        });
        return;
      }

      await Post.findByIdAndUpdate(postId, {
        $unset: {
          lockedBy: 1,
          lockedAt: 1,
          lockExpiresAt: 1,
        },
      });

      logger.debug('Lock released successfully', { postId, userId });
    } catch (error) {
      logger.error('Error releasing lock', { postId, userId, error });
      throw error;
    }
  }

  /**
   * Renew edit lock for a draft post
   */
  static async renewLock(postId: string, userId: string): Promise<{ lockExpiresAt: Date }> {
    try {
      const now = new Date();
      const lockExpiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

      const post = await Post.findById(postId);

      if (!post) {
        throw new Error('Post not found');
      }

      // Only renew if locked by the requesting user
      if (post.lockedBy?.toString() !== userId) {
        throw new Error('Cannot renew lock not owned by user');
      }

      await Post.findByIdAndUpdate(postId, {
        lockExpiresAt,
      });

      logger.debug('Lock renewed successfully', { postId, userId, lockExpiresAt });

      return { lockExpiresAt };
    } catch (error) {
      logger.error('Error renewing lock', { postId, userId, error });
      throw error;
    }
  }

  /**
   * Get draft status including lock and version information
   */
  static async getDraftStatus(postId: string): Promise<DraftStatus> {
    try {
      const post = await Post.findById(postId)
        .populate('lockedBy', 'name email')
        .populate('lastEditedBy', 'name email');

      if (!post) {
        throw new Error('Post not found');
      }

      return {
        lockedBy: post.isEditLocked() ? (post.lockedBy as any) : undefined,
        lockExpiresAt: post.isEditLocked() ? post.lockExpiresAt : undefined,
        lastEditedBy: post.lastEditedBy as any,
        lastEditedAt: post.lastEditedAt,
        version: post.version,
      };
    } catch (error) {
      logger.error('Error getting draft status', { postId, error });
      throw error;
    }
  }

  /**
   * Auto-save draft content with conflict detection
   */
  static async autoSaveDraft(
    postId: string,
    userId: string,
    content: string,
    platformContent?: any[]
  ): Promise<AutoSaveResult> {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        throw new Error('Post not found');
      }

      // Check if user has the lock
      if (post.lockedBy?.toString() !== userId) {
        throw new Error('Cannot save draft without edit lock');
      }

      // Check if lock has expired
      if (!post.isEditLocked()) {
        throw new Error('Edit lock has expired');
      }

      const now = new Date();
      const updateData: any = {
        content,
        lastEditedBy: new mongoose.Types.ObjectId(userId),
        lastEditedAt: now,
        $inc: { version: 1 },
      };

      if (platformContent) {
        updateData.platformContent = platformContent;
      }

      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        updateData,
        { new: true }
      );

      if (!updatedPost) {
        throw new Error('Failed to save draft');
      }

      // Create version history entry
      await DraftVersionService.autoCreateVersion(
        postId,
        updatedPost.workspaceId.toString(),
        userId,
        content,
        platformContent
      );

      logger.debug('Draft auto-saved successfully', {
        postId,
        userId,
        version: updatedPost.version,
      });

      return {
        saved: true,
        version: updatedPost.version,
      };
    } catch (error) {
      logger.error('Error auto-saving draft', { postId, userId, error });
      
      // Check if it's a version conflict
      if (error instanceof Error && error.message.includes('version')) {
        return {
          saved: false,
          version: 0,
          conflict: true,
        };
      }

      throw error;
    }
  }

  /**
   * Clean up expired locks (called by background job)
   */
  static async cleanupExpiredLocks(): Promise<void> {
    try {
      const now = new Date();
      
      const result = await Post.updateMany(
        {
          lockExpiresAt: { $lt: now },
          lockedBy: { $exists: true },
        },
        {
          $unset: {
            lockedBy: 1,
            lockedAt: 1,
            lockExpiresAt: 1,
          },
        }
      );

      if (result.modifiedCount > 0) {
        logger.debug('Cleaned up expired locks', { count: result.modifiedCount });
      }
    } catch (error) {
      logger.error('Error cleaning up expired locks', { error });
    }
  }
}