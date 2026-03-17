import { apiClient } from '../lib/api-client';

/**
 * Post Service
 * API calls for post creation and management
 */

export interface CreatePostRequest {
  content: string;
  platforms: string[];
  scheduledFor?: string;
  mediaUrls?: string[];
  isThread?: boolean;
  threadPosts?: string[];
}

export interface CreatePostInput {
  workspaceId?: string;
  socialAccountId: string;
  platform: string;
  content: string;
  mediaUrls?: string[];
  scheduledAt: Date;
}

export interface Post {
  _id: string;
  content: string;
  platforms: string[];
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduledFor?: Date;
  publishedAt?: Date;
  mediaUrls?: string[];
  isThread: boolean;
  threadPosts?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class PostService {
  /**
   * Create multiple posts in bulk
   */
  static async bulkCreatePosts(posts: CreatePostInput[]): Promise<{ created: Post[]; failed: Array<{ post: CreatePostInput; reason: string }> }> {
    const response = await apiClient.post('/posts/bulk', { posts });
    return {
      created: response.data.created || [],
      failed: response.data.failed || [],
    };
  }
}

export const postService = {
  /**
   * Create a new post
   */
  async createPost(data: CreatePostRequest): Promise<Post> {
    return apiClient.post('/posts', data);
  },

  /**
   * Get all posts
   */
  async getPosts(): Promise<Post[]> {
    return apiClient.get('/posts');
  },

  /**
   * Get post by ID
   */
  async getPost(postId: string): Promise<Post> {
    return apiClient.get(`/posts/${postId}`);
  },

  /**
   * Update post
   */
  async updatePost(postId: string, data: Partial<CreatePostRequest>): Promise<Post> {
    return apiClient.put(`/posts/${postId}`, data);
  },

  /**
   * Delete post
   */
  async deletePost(postId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/posts/${postId}`);
  },

  /**
   * Generate AI content
   */
  async generateAIContent(prompt: string): Promise<{ content: string }> {
    return apiClient.post('/ai/generate', { prompt });
  },
};
