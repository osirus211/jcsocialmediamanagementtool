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
   * Get comments for a post with nested replies and pagination
   */
  static async getComments(
    postId: string, 
    workspaceId: string, 
    requesterId?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ comments: PopulatedComment[]; total: number; page: number; limit: number }> {
    try {
      const skip = (page - 1) * limit;

      // Get total count
      const total = await PostComment.countDocuments({
        postId: new Types.ObjectId(postId),
        workspaceId: new Types.ObjectId(workspaceId),
        parentId: null, // Only count top-level comments for pagination
        $or: [
          { isDeleted: false },
          { authorId: new Types.ObjectId(requesterId), isDeleted: true }
        ]
      });

      // Get paginated top-level comments
      const topLevelComments = await PostComment.find({
        postId: new Types.ObjectId(postId),
        workspaceId: new Types.ObjectId(workspaceId),
        parentId: null,
        $or: [
          { isDeleted: false },
          { authorId: new Types.ObjectId(requesterId), isDeleted: true }
        ]
      })
      .populate('authorId', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

      // Get all replies for the paginated top-level comments
      const topLevelIds = topLevelComments.map(c => c._id);
      const replies = await PostComment.find({
        postId: new Types.ObjectId(postId),
        workspaceId: new Types.ObjectId(workspaceId),
        parentId: { $in: topLevelIds },
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
      const result: PopulatedComment[] = [];

      // First pass: create all comments
      const allComments = [...topLevelComments, ...replies];
      for (const comment of allComments) {
        const populatedComment: PopulatedComment = {
          ...comment,
          authorId: {
            _id: comment.authorId._id.toString(),
            firstName: (comment.authorId as any).firstName,
            lastName: (comment.authorId as any).lastName,
            avatar: (comment.authorId as any).avatar,
          },
          replies: [],
        } as unknown as PopulatedComment;
        commentMap.set(comment._id.toString(), populatedComment);
      }

      // Second pass: build hierarchy
      for (const comment of allComments) {
        const populatedComment = commentMap.get(comment._id.toString())!;
        
        if (comment.parentId) {
          const parent = commentMap.get(comment.parentId.toString());
          if (parent) {
            parent.replies!.push(populatedComment);
          }
        } else {
          result.push(populatedComment);
        }
      }

      return {
        comments: result,
        total,
        page,
        limit
      };
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
      // Get author info
      const author = await User.findById(authorId).select('firstName lastName avatar');
      if (!author) {
        throw new Error('Author not found');
      }

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
        authorName: `${author.firstName} ${author.lastName}`,
        authorAvatar: author.avatar,
        content,
        mentions: mentionUserIds,
        parentId: parentId ? new Types.ObjectId(parentId) : undefined,
        reactions: [],
        attachments: [],
      });

      await comment.save();

      // Send mention notifications
      for (const mentionedUserId of mentionUserIds) {
        if (mentionedUserId.toString() !== authorId) {
          await (notificationQueue as any).add('notification', {
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
      await (notificationQueue as any).add('notification', {
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

  /**
   * Add reaction to a comment
   */
  static async addReaction(
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<IPostComment> {
    try {
      const comment = await PostComment.findOne({
        _id: new Types.ObjectId(commentId),
        isDeleted: false,
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      // Remove existing reaction from this user if any
      comment.reactions = comment.reactions.filter(
        reaction => reaction.userId.toString() !== userId
      );

      // Add new reaction
      comment.reactions.push({
        userId: new Types.ObjectId(userId),
        emoji,
        createdAt: new Date(),
      });

      await comment.save();
      return comment;
    } catch (error: any) {
      logger.error('Error adding reaction', {
        commentId,
        userId,
        emoji,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove reaction from a comment
   */
  static async removeReaction(
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<IPostComment> {
    try {
      const comment = await PostComment.findOne({
        _id: new Types.ObjectId(commentId),
        isDeleted: false,
      });

      if (!comment) {
        throw new Error('Comment not found');
      }

      // Remove the specific reaction
      comment.reactions = comment.reactions.filter(
        reaction => !(reaction.userId.toString() === userId && reaction.emoji === emoji)
      );

      await comment.save();
      return comment;
    } catch (error: any) {
      logger.error('Error removing reaction', {
        commentId,
        userId,
        emoji,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all mentions for a user in a workspace
   */
  static async getMentions(
    userId: string,
    workspaceId: string,
    limit = 50,
    offset = 0
  ): Promise<PopulatedComment[]> {
    try {
      const comments = await PostComment.find({
        workspaceId: new Types.ObjectId(workspaceId),
        mentions: new Types.ObjectId(userId),
        isDeleted: false,
      })
      .populate('authorId', 'firstName lastName avatar')
      .populate('postId', 'title content')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

      return comments.map(comment => {
        const authorId = comment.authorId as any;
        return {
          ...comment,
          authorId: {
            _id: authorId._id.toString(),
            firstName: authorId.firstName,
            lastName: authorId.lastName,
            avatar: authorId.avatar,
          },
        } as unknown as PopulatedComment;
      });
    } catch (error: any) {
      logger.error('Error getting mentions', {
        userId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Extract mentions from content
   */
  static extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex) || [];
    return matches.map(match => match.substring(1));
  }

  /**
   * Notify mentioned users
   */
  static async notifyMentionedUsers(
    mentions: Types.ObjectId[],
    commentId: string,
    authorId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      for (const mentionedUserId of mentions) {
        if (mentionedUserId.toString() !== authorId) {
          await (notificationQueue as any).add('notification', {
            eventType: SystemEvent.MENTION_IN_COMMENT,
            workspaceId,
            userId: mentionedUserId.toString(),
            payload: {
              commentId,
              authorId,
            },
          });
        }
      }
    } catch (error: any) {
      logger.error('Error notifying mentioned users', {
        mentions,
        commentId,
        authorId,
        workspaceId,
        error: error.message,
      });
    }
  }
}