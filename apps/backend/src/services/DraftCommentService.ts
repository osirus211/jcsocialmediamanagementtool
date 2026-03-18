/**
 * Draft Comment Service
 * 
 * Handles CRUD operations for draft comments with real-time notifications
 */

import mongoose from 'mongoose';
import { DraftComment, IDraftComment } from '../models/DraftComment';
import { Post, PostStatus } from '../models/Post';
import { User } from '../models/User';
import { WorkspaceMember } from '../models/WorkspaceMember';
import { getDraftSocket } from './DraftCollaborationSocket';
import { notificationQueue } from '../queue/NotificationQueue';
import { SystemEvent } from '../services/EventService';
import { logger } from '../utils/logger';

export interface CreateDraftCommentData {
  content: string;
  parentId?: string;
  position?: {
    field: string;
    selectionStart: number;
    selectionEnd: number;
    selectedText?: string;
  };
}

export interface UpdateDraftCommentData {
  content: string;
}

export class DraftCommentService {
  /**
   * Get all comments for a draft
   */
  static async getComments(
    draftId: string,
    workspaceId: string,
    userId: string
  ): Promise<IDraftComment[]> {
    try {
      // Verify user has access to this draft
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found or access denied');
      }

      // Get all top-level comments (no parentId) with their replies
      const comments = await DraftComment.find({
        draftId,
        parentId: { $exists: false },
        isDeleted: false
      })
        .populate('replies')
        .sort({ createdAt: 1 });

      return comments;
    } catch (error) {
      logger.error('Error getting draft comments', { draftId, workspaceId, userId, error });
      throw error;
    }
  }

  /**
   * Add a new comment to a draft
   */
  static async addComment(
    draftId: string,
    workspaceId: string,
    authorId: string,
    data: CreateDraftCommentData
  ): Promise<IDraftComment> {
    try {
      // Verify user has access to this draft
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        throw new Error('Draft not found or access denied');
      }

      // Get author info
      const author = await User.findById(authorId);
      if (!author) {
        throw new Error('Author not found');
      }

      // If this is a reply, verify parent comment exists
      if (data.parentId) {
        const parentComment = await DraftComment.findOne({
          _id: data.parentId,
          draftId,
          isDeleted: false
        });

        if (!parentComment) {
          throw new Error('Parent comment not found');
        }
      }

      // Extract mentions from content (@username format)
      const mentions = this.extractMentions(data.content);

      // Create the comment
      const comment = new DraftComment({
        draftId: new mongoose.Types.ObjectId(draftId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        authorId: new mongoose.Types.ObjectId(authorId),
        authorName: (author as any).name || author.email,
        authorAvatar: author.avatar,
        content: data.content,
        mentions,
        parentId: data.parentId ? new mongoose.Types.ObjectId(data.parentId) : undefined,
        position: data.position,
        isResolved: false,
        isDeleted: false
      });

      await comment.save();

      // Populate the comment for return
      await comment.populate('replies');

      // Notify real-time users
      const draftSocket = getDraftSocket();
      if (draftSocket) {
        draftSocket.notifyCommentAdded(draftId, comment);
      }

      // Send mention notifications
      if (mentions && mentions.length > 0) {
        await this.notifyMentionedUsers(mentions, comment._id.toString(), workspaceId, authorId);
      }

      logger.debug('Draft comment added', {
        commentId: comment._id,
        draftId,
        authorId,
        hasParent: !!data.parentId
      });

      return comment;
    } catch (error) {
      logger.error('Error adding draft comment', { draftId, workspaceId, authorId, error });
      throw error;
    }
  }

  /**
   * Edit a comment (only author can edit)
   */
  static async editComment(
    commentId: string,
    authorId: string,
    data: UpdateDraftCommentData
  ): Promise<IDraftComment> {
    try {
      const comment = await DraftComment.findOne({
        _id: commentId,
        authorId,
        isDeleted: false
      });

      if (!comment) {
        throw new Error('Comment not found or unauthorized');
      }

      // Extract mentions from updated content
      const mentions = this.extractMentions(data.content);

      // Update the comment
      comment.content = data.content;
      comment.mentions = mentions;
      comment.editedAt = new Date();

      await comment.save();
      await comment.populate('replies');

      // Notify real-time users
      const draftSocket = getDraftSocket();
      if (draftSocket) {
        draftSocket.notifyCommentAdded(comment.draftId.toString(), comment);
      }

      // Send mention notifications for new mentions
      if (mentions && mentions.length > 0) {
        await this.notifyMentionedUsers(mentions, comment._id.toString(), comment.workspaceId.toString(), authorId);
      }

      logger.debug('Draft comment edited', { commentId, authorId });

      return comment;
    } catch (error) {
      logger.error('Error editing draft comment', { commentId, authorId, error });
      throw error;
    }
  }

  /**
   * Delete a comment (soft delete)
   */
  static async deleteComment(
    commentId: string,
    authorId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const comment = await DraftComment.findOne({
        _id: commentId,
        authorId,
        workspaceId,
        isDeleted: false
      });

      if (!comment) {
        throw new Error('Comment not found or unauthorized');
      }

      // Soft delete the comment
      comment.isDeleted = true;
      await comment.save();

      // Also soft delete all replies
      await DraftComment.updateMany(
        {
          parentId: commentId,
          isDeleted: false
        },
        {
          isDeleted: true
        }
      );

      logger.debug('Draft comment deleted', { commentId, authorId });
    } catch (error) {
      logger.error('Error deleting draft comment', { commentId, authorId, error });
      throw error;
    }
  }

  /**
   * Resolve a comment
   */
  static async resolveComment(
    commentId: string,
    userId: string,
    workspaceId: string
  ): Promise<IDraftComment> {
    try {
      const comment = await DraftComment.findOne({
        _id: commentId,
        workspaceId,
        isDeleted: false
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      comment.isResolved = true;
      comment.resolvedBy = new mongoose.Types.ObjectId(userId);
      comment.resolvedAt = new Date();

      await comment.save();
      await comment.populate('replies');

      logger.debug('Draft comment resolved', { commentId, userId });

      return comment;
    } catch (error) {
      logger.error('Error resolving draft comment', { commentId, userId, error });
      throw error;
    }
  }

  /**
   * Unresolve a comment
   */
  static async unresolveComment(
    commentId: string,
    userId: string,
    workspaceId: string
  ): Promise<IDraftComment> {
    try {
      const comment = await DraftComment.findOne({
        _id: commentId,
        workspaceId,
        isDeleted: false
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      comment.isResolved = false;
      comment.resolvedBy = undefined;
      comment.resolvedAt = undefined;

      await comment.save();
      await comment.populate('replies');

      logger.debug('Draft comment unresolved', { commentId, userId });

      return comment;
    } catch (error) {
      logger.error('Error unresolving draft comment', { commentId, userId, error });
      throw error;
    }
  }

  /**
   * Get comments by position (for inline comments)
   */
  static async getCommentsByPosition(
    draftId: string,
    workspaceId: string,
    field: string,
    selectionStart: number,
    selectionEnd: number
  ): Promise<IDraftComment[]> {
    try {
      const comments = await DraftComment.find({
        draftId,
        workspaceId,
        isDeleted: false,
        'position.field': field,
        'position.selectionStart': { $lte: selectionEnd },
        'position.selectionEnd': { $gte: selectionStart }
      })
        .populate('replies')
        .sort({ createdAt: 1 });

      return comments;
    } catch (error) {
      logger.error('Error getting comments by position', { draftId, field, error });
      throw error;
    }
  }

  /**
   * Extract @mentions from comment content
   */
  private static extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Notify mentioned users via queue
   */
  private static async notifyMentionedUsers(
    mentions: string[],
    commentId: string,
    workspaceId: string,
    authorId: string
  ): Promise<void> {
    try {
      // Resolve mention usernames to user IDs
      const workspaceMembers = await WorkspaceMember.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        isActive: true,
      }).populate('userId', 'firstName lastName email');

      for (const username of mentions) {
        // Find member by matching username against firstName, lastName, or email
        const member = workspaceMembers.find(m => {
          const user = m.userId as any;
          if (!user) return false;
          
          const firstName = user.firstName?.toLowerCase() || '';
          const lastName = user.lastName?.toLowerCase() || '';
          const email = user.email?.toLowerCase() || '';
          const fullName = `${firstName} ${lastName}`.trim();
          
          return firstName === username.toLowerCase() ||
                 lastName === username.toLowerCase() ||
                 fullName === username.toLowerCase() ||
                 email === username.toLowerCase();
        });

        if (member && member.userId._id.toString() !== authorId) {
          await (notificationQueue as any).add('notification', {
            eventType: SystemEvent.MENTION_IN_COMMENT,
            workspaceId,
            userId: member.userId._id.toString(),
            payload: {
              commentId,
              draftId: commentId, // For draft comments, we use commentId as reference
              mentionedBy: authorId,
            },
          });
        }
      }
    } catch (error) {
      logger.error('Error notifying mentioned users in draft comment', {
        mentions,
        commentId,
        workspaceId,
        error,
      });
    }
  }

  /**
   * Get comment statistics for a draft
   */
  static async getCommentStats(draftId: string, workspaceId: string) {
    try {
      const stats = await DraftComment.aggregate([
        {
          $match: {
            draftId: new mongoose.Types.ObjectId(draftId),
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            isDeleted: false
          }
        },
        {
          $group: {
            _id: null,
            totalComments: { $sum: 1 },
            resolvedComments: {
              $sum: { $cond: ['$isResolved', 1, 0] }
            },
            unresolvedComments: {
              $sum: { $cond: ['$isResolved', 0, 1] }
            }
          }
        }
      ]);

      return stats[0] || {
        totalComments: 0,
        resolvedComments: 0,
        unresolvedComments: 0
      };
    } catch (error) {
      logger.error('Error getting comment stats', { draftId, error });
      throw error;
    }
  }
}