import { apiClient } from '../lib/api-client';

export interface Reaction {
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Attachment {
  url: string;
  type: 'image' | 'file';
  name?: string;
  size?: number;
}

export interface PostComment {
  _id: string;
  postId: string;
  workspaceId: string;
  authorId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  authorName: string;
  authorAvatar?: string;
  content: string;
  mentions: string[];
  parentId?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  editedAt?: string;
  reactions: Reaction[];
  attachments: Attachment[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies?: PostComment[];
}

export interface AddCommentRequest {
  content: string;
  parentId?: string;
}

export interface EditCommentRequest {
  content: string;
}

class PostCommentsService {
  /**
   * Get all comments for a post
   */
  async getComments(postId: string): Promise<PostComment[]> {
    const response = await apiClient.get(`/posts/${postId}/comments`);
    return response.data;
  }

  /**
   * Add a new comment
   */
  async addComment(postId: string, request: AddCommentRequest): Promise<PostComment> {
    const response = await apiClient.post(`/posts/${postId}/comments`, request);
    return response.data;
  }

  /**
   * Edit a comment
   */
  async editComment(postId: string, commentId: string, request: EditCommentRequest): Promise<PostComment> {
    const response = await apiClient.patch(`/posts/${postId}/comments/${commentId}`, request);
    return response.data;
  }

  /**
   * Delete a comment
   */
  async deleteComment(postId: string, commentId: string): Promise<void> {
    await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
  }

  /**
   * Resolve a comment
   */
  async resolveComment(postId: string, commentId: string): Promise<PostComment> {
    const response = await apiClient.post(`/posts/${postId}/comments/${commentId}/resolve`);
    return response.data;
  }

  /**
   * Unresolve a comment
   */
  async unresolveComment(postId: string, commentId: string): Promise<PostComment> {
    const response = await apiClient.delete(`/posts/${postId}/comments/${commentId}/resolve`);
    return response.data;
  }

  /**
   * Add reaction to a comment
   */
  async addReaction(postId: string, commentId: string, emoji: string): Promise<PostComment> {
    const response = await apiClient.post(`/posts/${postId}/comments/${commentId}/reactions`, { emoji });
    return response.data;
  }

  /**
   * Remove reaction from a comment
   */
  async removeReaction(postId: string, commentId: string, emoji: string): Promise<PostComment> {
    const response = await apiClient.delete(`/posts/${postId}/comments/${commentId}/reactions/${emoji}`);
    return response.data;
  }

  /**
   * Get all mentions for the current user
   */
  async getMentions(limit = 50, offset = 0): Promise<{
    data: PostComment[];
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const response = await apiClient.get(`/mentions?limit=${limit}&offset=${offset}`);
    return response;
  }
}

export const postCommentsService = new PostCommentsService();