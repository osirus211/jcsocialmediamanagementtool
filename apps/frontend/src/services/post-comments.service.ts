import { apiClient } from '../lib/api-client';

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
  content: string;
  mentions: string[];
  parentId?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  editedAt?: string;
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
}

export const postCommentsService = new PostCommentsService();