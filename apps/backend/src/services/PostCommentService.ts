import { Types } from 'mongoose';
import { PostComment, IPostComment } from '../models/PostComment';
import { WorkspaceMember } from '../models/WorkspaceMember';
import { User } from '../models/User';
import { notificationQueue } from '../queue/NotificationQueue';
import { SystemEvent } from '../services/EventService';
import { logger } from '../utils/logger';

export interface PopulatedComment extends Omit<IPostComment, 'authorId'> {
  authorId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  replies?: PopulatedComment[];
}

export class PostCommentService {
  /**
   * Get comments for a post with nested replies
   */
  static async getComments(postId: string, workspaceId: string, requesterId?: string): Promise<PopulatedComment[]> {
    try {
      // Get all comments for the post
      const comments = await PostComment.find({
        postId: new Types.ObjectId(postId),
        workspaceId: new Types.ObjectId(workspaceId),
        $or: [
          { isDeleted: false },
          { authorId: new Types.ObjectId(requesterId), isDeleted: true }
        ]
      })
      .populate('authorId', 'firstName lastName avatar')
      .sort({ createdAt: 1 })
      .lean();

      // Build nested structure
      const commentMap = new Map<string, PopulatedComment>();
      const topLevelComments: PopulatedComment[] = [];

      // First pass: create all comments
      for (const comment of comments) {
        const populatedComment: PopulatedComment = {
          ...comment,
          authorId: {
            _id: comment.authorId._id.toString(),
            firstName: comment.authorId.firstName,
            lastName: comment.authorId.lastName,
            avatar: comment.authorId.avatar,
          },
          replies: [],
        };
        commentMap.set(comment._id.toString(), populatedComment);
      }

      // Second pass: build hierarchy
      for (const comment of comments) {
        const populatedComment = commentMap.get(comment._id.toString())!;
        
        if (comment.parentId) {
          const parent = commentMap.get(comment.parentId.toString());
          if (parent) {
            parent.replies!.push(populatedComment);
          }
        } else {
          topLevelComments.push(populatedComment);
        }
      }

      return topLevelComments;
    } catch (error: any) {
      logger.error('Error getting comments', {
        postId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add a new comment
   */
  static async addComment(
    postId: string,
    workspaceId: string,
    authorId: string,
    content: string,
    parentId?: string
  ): Promise<IPostComment> {
    try {
      // Extract mentions from content
      const mentionRegex = /@(\w+)/g;
      const mentionMatches = content.match(mentionRegex) || [];
      const mentionUsernames = mentionMatches.map(match => match.substring(1));

      // Resolve mention usernames to user IDs
      const mentionUserIds: Types.ObjectId[] = [];
      if (mentionUsernames.length > 0) {
        const workspaceMembers = await WorkspaceMember.find({
          workspaceId: new Types.ObjectId(workspaceId),
        }).populate('userId', 'firstName lastName');

        for (const username of mentionUsernames) {
          const member = workspaceMembers.find(m => {
            const user = m.userId as any;
            const fullName = `${user.firstName}${user.lastName}`.toLowerCase();
            const firstName = user.firstName.toLowerCase();
            const lastName = user.lastName.toLowerCase();
            return fullName === username.toLowerCase() || 
                   firstName === username.toLowerCase() || 
                   lastName === username.toLowerCase();
          });

          if (member) {
            const userId = typeof member.userId === 'string' ? member.userId : member.userId._id;
            mentionUserIds.push(new Types.ObjectId(userId));
          }
        }
      }

      // Create comment
      const comment = new PostComment({
        postId: new Types.ObjectId(postId),
        workspaceId: new Types.ObjectId(workspaceId),
        authorId: new Types.ObjectId(authorId),
        content,
        mentions: mentionUserIds,
        parentId: parentId ? new Types.ObjectId(parentId) : undefined,
      });

      await comment.save();

      // Send mention notifications
      for (const mentionedUserId of mentionUserIds) {
        if (mentionedUserId.toString() !== authorId) {
          await notificationQueue.add('notification', {
            eventType: SystemEvent.MENTION_IN_COMMENT,
            workspaceId,
            userId: mentionedUserId.toString(),
            payload: {
              commentId: comment._id.toString(),
              postId,
              authorId,
              content,
            },
          });
        }
      }

      // Send comment notification to post author (if different from comment author)
      await notificationQueue.add('notification', {
        eventType: SystemEvent.COMMENT_ADDED,
        workspaceId,
        userId: authorId, // This will be filtered out in notification service if same as author
        payload: {
          commentId: comment._id.toString(),
          postId,
          authorId,
          content,
        },
      });

      return comment;
    } catch (error: any) {
      logger.error('Error adding comment', {
        postId,
        workspaceId,
        authorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Edit a comment (only author can edit)
   */
  static async editComment(
    commentId: string,
    authorId: string,
    content: string
  ): Promise<IPostComment> {
    try {
      const comment = await PostComment.findOne({
        _id: new Types.ObjectId(commentId),
        authorId: new Types.ObjectId(authorId),
        isDeleted: false,
      });

      if (!comment) {
        throw new Error('Comment not found or unauthorized');
      }

      // Extract new mentions
      const mentionRegex = /@(\w+)/g;
      const mentionMatches = content.match(mentionRegex) || [];
      const mentionUsernames = mentionMatches.map(match => match.substring(1));

      // Resolve mention usernames to user IDs
      const mentionUserIds: Types.ObjectId[] = [];
      if (mentionUsernames.length > 0) {
        const workspaceMembers = await WorkspaceMember.find({
          workspaceId: comment.workspaceId,
        }).populate('userId', 'firstName lastName');

        for (const username of mentionUsernames) {
          const member = workspaceMembers.find(m => {
            const user = m.userId as any;
            const fullName = `${user.firstName}${user.lastName}`.toLowerCase();
            const firstName = user.firstName.toLowerCase();
            const lastName = user.lastName.toLowerCase();
            return fullName === username.toLowerCase() || 
                   firstName === username.toLowerCase() || 
                   lastName === username.toLowerCase();
          });

          if (member) {
            const userId = typeof member.userId === 'string' ? member.userId : member.userId._id;
            mentionUserIds.push(new Types.ObjectId(userId));
          }
        }
      }

      comment.content = content;
      comment.mentions = mentionUserIds;
      comment.editedAt = new Date();

      await comment.save();
      return comment;
    } catch (error: any) {
      logger.error('Error editing comment', {
        commentId,
        authorId,
        error: error.message,
      });
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
      // Check if user is author or admin
      const comment = await PostComment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      const isAuthor = comment.authorId.toString() === authorId;
      
      // Check if user is admin
      let isAdmin = false;
      if (!isAuthor) {
        const member = await WorkspaceMember.findOne({
          workspaceId: new Types.ObjectId(workspaceId),
          userId: new Types.ObjectId(authorId),
        });
        isAdmin = member?.role === 'admin' || member?.role === 'owner';
      }

      if (!isAuthor && !isAdmin) {
        throw new Error('Unauthorized to delete comment');
      }

      comment.isDeleted = true;
      await comment.save();
    } catch (error: any) {
      logger.error('Error deleting comment', {
        commentId,
        authorId,
        workspaceId,
        error: error.message,
      });
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
  ): Promise<IPostComment> {
    try {
      const comment = await PostComment.findOne({
        _id: new Types.ObjectId(commentId),
        workspaceId: new Types.ObjectId(workspaceId),
        isDeleted: false,
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      comment.isResolved = true;
      comment.resolvedBy = new Types.ObjectId(userId);
      comment.resolvedAt = new Date();

      await comment.save();
      return comment;
    } catch (error: any) {
      logger.error('Error resolving comment', {
        commentId,
        userId,
        workspaceId,
        error: error.message,
      });
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
  ): Promise<IPostComment> {
    try {
      const comment = await PostComment.findOne({
        _id: new Types.ObjectId(commentId),
        workspaceId: new Types.ObjectId(workspaceId),
        isDeleted: false,
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      comment.isResolved = false;
      comment.resolvedBy = undefined;
      comment.resolvedAt = undefined;

      await comment.save();
      return comment;
    } catch (error: any) {
      logger.error('Error unresolving comment', {
        commentId,
        userId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get comment count for a post
   */
  static async getCommentCount(postId: string): Promise<number> {
    try {
      return await PostComment.countDocuments({
        postId: new Types.ObjectId(postId),
        isDeleted: false,
      });
    } catch (error: any) {
      logger.error('Error getting comment count', {
        postId,
        error: error.message,
      });
      return 0;
    }
  }
}