# API Integration Examples

Frontend integration examples for the Posts API.

---

## Base Configuration

```typescript
// api/config.ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
export const API_VERSION = 'v1';
export const API_URL = `${API_BASE_URL}/api/${API_VERSION}`;

// Get auth token from your auth system
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Get workspace ID from your workspace context
export const getWorkspaceId = () => {
  return localStorage.getItem('workspaceId');
};
```

---

## API Client Setup

```typescript
// api/client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_URL, getAuthToken, getWorkspaceId } from './config';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

---

## TypeScript Types

```typescript
// types/post.ts
export enum PostStatus {
  SCHEDULED = 'scheduled',
  QUEUED = 'queued',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export enum SocialPlatform {
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  LINKEDIN = 'linkedin',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
  THREADS = 'threads',
}

export interface Post {
  id: string;
  workspaceId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls: string[];
  scheduledAt: string;
  status: PostStatus;
  queuedAt?: string;
  publishingStartedAt?: string;
  publishedAt?: string;
  failedAt?: string;
  failureReason?: string;
  platformPostId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PublishAttempt {
  id: string;
  postId: string;
  platform: string;
  attemptNumber: number;
  status: 'success' | 'failed' | 'retrying';
  error?: string;
  errorCode?: string;
  platformResponse?: Record<string, any>;
  duration?: number;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    requestId: string;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> {
  posts: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PostStats {
  total: number;
  scheduled: number;
  queued: number;
  publishing: number;
  published: number;
  failed: number;
}
```

---

## Posts API Service

```typescript
// api/posts.ts
import { apiClient } from './client';
import { getWorkspaceId } from './config';
import {
  Post,
  PublishAttempt,
  ApiResponse,
  PaginatedResponse,
  PostStats,
  SocialPlatform,
  PostStatus,
} from '../types/post';

export interface CreatePostInput {
  socialAccountId: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls?: string[];
  scheduledAt: Date | string;
}

export interface UpdatePostInput {
  content?: string;
  mediaUrls?: string[];
  scheduledAt?: Date | string;
}

export interface GetPostsParams {
  status?: PostStatus;
  platform?: SocialPlatform;
  socialAccountId?: string;
  page?: number;
  limit?: number;
}

class PostsApi {
  /**
   * Create a scheduled post
   */
  async createPost(input: CreatePostInput): Promise<Post> {
    const workspaceId = getWorkspaceId();
    
    const response = await apiClient.post<ApiResponse<Post>>('/posts', {
      workspaceId,
      ...input,
      scheduledAt: typeof input.scheduledAt === 'string' 
        ? input.scheduledAt 
        : input.scheduledAt.toISOString(),
    });

    return response.data;
  }

  /**
   * Get posts with pagination and filtering
   */
  async getPosts(params?: GetPostsParams): Promise<PaginatedResponse<Post>> {
    const workspaceId = getWorkspaceId();
    
    const response = await apiClient.get<ApiResponse<{ posts: Post[] }>>('/posts', {
      params: {
        workspaceId,
        ...params,
      },
    });

    return {
      posts: response.data.posts,
      pagination: response.meta?.pagination || {
        total: response.data.posts.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };
  }

  /**
   * Get post by ID with publish attempts
   */
  async getPostById(postId: string): Promise<{ post: Post; attempts: PublishAttempt[] }> {
    const workspaceId = getWorkspaceId();
    
    const response = await apiClient.get<ApiResponse<{ post: Post; attempts: PublishAttempt[] }>>(
      `/posts/${postId}`,
      {
        params: { workspaceId },
      }
    );

    return response.data;
  }

  /**
   * Update scheduled post
   */
  async updatePost(postId: string, input: UpdatePostInput): Promise<Post> {
    const workspaceId = getWorkspaceId();
    
    const data: any = { ...input };
    if (input.scheduledAt) {
      data.scheduledAt = typeof input.scheduledAt === 'string'
        ? input.scheduledAt
        : input.scheduledAt.toISOString();
    }

    const response = await apiClient.patch<ApiResponse<Post>>(
      `/posts/${postId}`,
      data,
      {
        params: { workspaceId },
      }
    );

    return response.data;
  }

  /**
   * Delete scheduled post
   */
  async deletePost(postId: string): Promise<void> {
    const workspaceId = getWorkspaceId();
    
    await apiClient.delete(`/posts/${postId}`, {
      params: { workspaceId },
    });
  }

  /**
   * Retry failed post
   */
  async retryPost(postId: string): Promise<Post> {
    const workspaceId = getWorkspaceId();
    
    const response = await apiClient.post<ApiResponse<Post>>(
      `/posts/${postId}/retry`,
      {},
      {
        params: { workspaceId },
      }
    );

    return response.data;
  }

  /**
   * Get post statistics
   */
  async getPostStats(): Promise<PostStats> {
    const workspaceId = getWorkspaceId();
    
    const response = await apiClient.get<ApiResponse<PostStats>>('/posts/stats', {
      params: { workspaceId },
    });

    return response.data;
  }
}

export const postsApi = new PostsApi();
```

---

## React Hooks Examples

```typescript
// hooks/usePosts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi, CreatePostInput, UpdatePostInput, GetPostsParams } from '../api/posts';
import { toast } from 'react-hot-toast';

/**
 * Get posts with pagination
 */
export function usePosts(params?: GetPostsParams) {
  return useQuery({
    queryKey: ['posts', params],
    queryFn: () => postsApi.getPosts(params),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get post by ID
 */
export function usePost(postId: string) {
  return useQuery({
    queryKey: ['posts', postId],
    queryFn: () => postsApi.getPostById(postId),
    enabled: !!postId,
  });
}

/**
 * Get post statistics
 */
export function usePostStats() {
  return useQuery({
    queryKey: ['posts', 'stats'],
    queryFn: () => postsApi.getPostStats(),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Create post mutation
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => postsApi.createPost(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post scheduled successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create post');
    },
  });
}

/**
 * Update post mutation
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdatePostInput }) =>
      postsApi.updatePost(postId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', variables.postId] });
      toast.success('Post updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update post');
    },
  });
}

/**
 * Delete post mutation
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postsApi.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete post');
    },
  });
}

/**
 * Retry post mutation
 */
export function useRetryPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postsApi.retryPost(postId),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', postId] });
      toast.success('Post retry scheduled');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to retry post');
    },
  });
}
```

---

## React Component Examples

### Create Post Form

```typescript
// components/CreatePostForm.tsx
import { useState } from 'react';
import { useCreatePost } from '../hooks/usePosts';
import { SocialPlatform } from '../types/post';

export function CreatePostForm() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>(SocialPlatform.TWITTER);
  const [scheduledAt, setScheduledAt] = useState('');
  const [socialAccountId, setSocialAccountId] = useState('');

  const createPost = useCreatePost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createPost.mutateAsync({
      socialAccountId,
      platform,
      content,
      scheduledAt: new Date(scheduledAt),
    });

    // Reset form
    setContent('');
    setScheduledAt('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Platform</label>
        <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)}>
          <option value={SocialPlatform.TWITTER}>Twitter</option>
          <option value={SocialPlatform.FACEBOOK}>Facebook</option>
          <option value={SocialPlatform.INSTAGRAM}>Instagram</option>
        </select>
      </div>

      <div>
        <label>Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          required
        />
      </div>

      <div>
        <label>Schedule Time</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? 'Scheduling...' : 'Schedule Post'}
      </button>
    </form>
  );
}
```

### Posts List

```typescript
// components/PostsList.tsx
import { usePosts, useDeletePost, useRetryPost } from '../hooks/usePosts';
import { PostStatus } from '../types/post';

export function PostsList() {
  const { data, isLoading, error } = usePosts({ page: 1, limit: 20 });
  const deletePost = useDeletePost();
  const retryPost = useRetryPost();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading posts</div>;

  return (
    <div>
      <h2>Scheduled Posts ({data?.pagination.total})</h2>
      
      {data?.posts.map((post) => (
        <div key={post.id} className="post-card">
          <div className="post-header">
            <span className="platform">{post.platform}</span>
            <span className={`status status-${post.status}`}>{post.status}</span>
          </div>

          <div className="post-content">{post.content}</div>

          <div className="post-meta">
            <span>Scheduled: {new Date(post.scheduledAt).toLocaleString()}</span>
            {post.publishedAt && (
              <span>Published: {new Date(post.publishedAt).toLocaleString()}</span>
            )}
          </div>

          <div className="post-actions">
            {post.status === PostStatus.SCHEDULED && (
              <button onClick={() => deletePost.mutate(post.id)}>Delete</button>
            )}
            {post.status === PostStatus.FAILED && (
              <>
                <button onClick={() => retryPost.mutate(post.id)}>Retry</button>
                <button onClick={() => deletePost.mutate(post.id)}>Delete</button>
              </>
            )}
          </div>

          {post.failureReason && (
            <div className="post-error">{post.failureReason}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Post Statistics Dashboard

```typescript
// components/PostStatsDashboard.tsx
import { usePostStats } from '../hooks/usePosts';

export function PostStatsDashboard() {
  const { data: stats, isLoading } = usePostStats();

  if (isLoading) return <div>Loading stats...</div>;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <h3>Total Posts</h3>
        <p className="stat-value">{stats?.total}</p>
      </div>

      <div className="stat-card">
        <h3>Scheduled</h3>
        <p className="stat-value">{stats?.scheduled}</p>
      </div>

      <div className="stat-card">
        <h3>Published</h3>
        <p className="stat-value">{stats?.published}</p>
      </div>

      <div className="stat-card">
        <h3>Failed</h3>
        <p className="stat-value">{stats?.failed}</p>
      </div>
    </div>
  );
}
```

---

## Error Handling

```typescript
// utils/errorHandler.ts
import { AxiosError } from 'axios';
import { ApiErrorResponse } from '../types/post';

export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const apiError = error.response?.data as ApiErrorResponse;
    
    if (apiError?.error) {
      return apiError.error.message;
    }
    
    if (error.response?.status === 401) {
      return 'Unauthorized. Please log in again.';
    }
    
    if (error.response?.status === 403) {
      return 'Forbidden. You do not have permission to perform this action.';
    }
    
    if (error.response?.status === 404) {
      return 'Resource not found.';
    }
    
    if (error.response?.status === 429) {
      return 'Too many requests. Please try again later.';
    }
    
    if (error.response?.status >= 500) {
      return 'Server error. Please try again later.';
    }
  }
  
  return 'An unexpected error occurred.';
}
```

---

## Testing Examples

```typescript
// __tests__/postsApi.test.ts
import { postsApi } from '../api/posts';
import { SocialPlatform } from '../types/post';

describe('Posts API', () => {
  it('should create a post', async () => {
    const post = await postsApi.createPost({
      socialAccountId: '123',
      platform: SocialPlatform.TWITTER,
      content: 'Test post',
      scheduledAt: new Date('2026-03-05T10:00:00Z'),
    });

    expect(post.id).toBeDefined();
    expect(post.content).toBe('Test post');
    expect(post.status).toBe('scheduled');
  });

  it('should get posts with pagination', async () => {
    const result = await postsApi.getPosts({ page: 1, limit: 10 });

    expect(result.posts).toBeInstanceOf(Array);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);
  });

  it('should retry a failed post', async () => {
    const post = await postsApi.retryPost('post-id');

    expect(post.status).toBe('scheduled');
    expect(post.failureReason).toBeUndefined();
  });
});
```

---

These examples provide a complete integration guide for frontend developers to consume the Posts API.

