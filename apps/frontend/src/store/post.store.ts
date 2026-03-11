import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import {
  Post,
  PostStatus,
  CreatePostInput,
  UpdatePostInput,
  PostFilters,
  PostsResponse,
  PostResponse,
  PostStatsResponse,
} from '@/types/post.types';

interface PostState {
  posts: Post[];
  isLoading: boolean;
  postsLoaded: boolean;
  stats: Record<PostStatus, number>;
  currentPage: number;
  totalPages: number;
  total: number;
}

interface PostActions {
  setPosts: (posts: Post[]) => void;
  setLoading: (loading: boolean) => void;
  setPostsLoaded: (loaded: boolean) => void;
  setStats: (stats: Record<PostStatus, number>) => void;

  fetchPosts: (filters?: PostFilters, page?: number) => Promise<void>;
  fetchPostById: (postId: string) => Promise<Post>;
  fetchStats: () => Promise<void>;
  createPost: (input: CreatePostInput) => Promise<Post>;
  updatePost: (postId: string, input: UpdatePostInput) => Promise<Post>;
  deletePost: (postId: string) => Promise<void>;
  retryPost: (postId: string) => Promise<Post>;
  clearPosts: () => void;
}

interface PostStore extends PostState, PostActions {}

/**
 * Post store
 * Manages social media posts per workspace
 */
export const usePostStore = create<PostStore>((set, get) => ({
  // Initial state
  posts: [],
  isLoading: false,
  postsLoaded: false,
  stats: {
    [PostStatus.DRAFT]: 0,
    [PostStatus.SCHEDULED]: 0,
    [PostStatus.QUEUED]: 0,
    [PostStatus.PUBLISHING]: 0,
    [PostStatus.PUBLISHED]: 0,
    [PostStatus.FAILED]: 0,
    [PostStatus.CANCELLED]: 0,
    [PostStatus.PENDING_APPROVAL]: 0,
    [PostStatus.APPROVED]: 0,
    [PostStatus.REJECTED]: 0,
  },
  currentPage: 1,
  totalPages: 1,
  total: 0,

  // Setters
  setPosts: (posts) => set({ posts }),
  setLoading: (loading) => set({ isLoading: loading }),
  setPostsLoaded: (loaded) => set({ postsLoaded: loaded }),
  setStats: (stats) => set({ stats }),

  /**
   * Fetch posts with filters and pagination
   */
  fetchPosts: async (filters?: PostFilters, page: number = 1) => {
    try {
      set({ isLoading: true });

      const params = new URLSearchParams();
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          filters.status.forEach((s) => params.append('status', s));
        } else {
          params.append('status', filters.status);
        }
      }
      if (filters?.socialAccountId) {
        params.append('socialAccountId', filters.socialAccountId);
      }
      if (filters?.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters?.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }
      params.append('page', page.toString());

      const response = await apiClient.get<PostsResponse>(
        `/posts?${params.toString()}`
      );

      set({
        posts: response.posts,
        currentPage: response.page,
        totalPages: response.totalPages,
        total: response.total,
        postsLoaded: true,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Fetch posts error:', error);
      set({ isLoading: false, postsLoaded: true });
      throw error;
    }
  },

  /**
   * Fetch single post by ID
   */
  fetchPostById: async (postId: string) => {
    try {
      const response = await apiClient.get<PostResponse>(`/posts/${postId}`);
      return response.post;
    } catch (error: any) {
      console.error('Fetch post error:', error);
      throw error;
    }
  },

  /**
   * Fetch post statistics
   */
  fetchStats: async () => {
    try {
      const response = await apiClient.get<PostStatsResponse>('/posts/stats');
      set({ stats: response.stats });
    } catch (error: any) {
      console.error('Fetch stats error:', error);
      throw error;
    }
  },

  /**
   * Create new post
   */
  createPost: async (input: CreatePostInput) => {
    try {
      set({ isLoading: true });

      const response = await apiClient.post<PostResponse>('/posts', input);

      const newPost = response.post;

      // Add to posts list
      set((state) => ({
        posts: [newPost, ...state.posts],
        total: state.total + 1,
        isLoading: false,
      }));

      // Refresh stats
      await get().fetchStats();

      return newPost;
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Create post error:', error);
      throw error;
    }
  },

  /**
   * Update existing post
   */
  updatePost: async (postId: string, input: UpdatePostInput) => {
    try {
      set({ isLoading: true });

      const response = await apiClient.patch<PostResponse>(
        `/posts/${postId}`,
        input
      );

      const updatedPost = response.post;

      // Update in posts list
      set((state) => ({
        posts: state.posts.map((p) => (p._id === postId ? updatedPost : p)),
        isLoading: false,
      }));

      return updatedPost;
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Update post error:', error);
      throw error;
    }
  },

  /**
   * Delete post
   */
  deletePost: async (postId: string) => {
    try {
      set({ isLoading: true });

      await apiClient.delete(`/posts/${postId}`);

      // Remove from posts list
      set((state) => ({
        posts: state.posts.filter((p) => p._id !== postId),
        total: Math.max(0, state.total - 1),
        isLoading: false,
      }));

      // Refresh stats
      await get().fetchStats();
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Delete post error:', error);
      throw error;
    }
  },

  /**
   * Retry failed post
   */
  retryPost: async (postId: string) => {
    try {
      set({ isLoading: true });

      const response = await apiClient.post<PostResponse>(
        `/posts/${postId}/retry`,
        {}
      );

      const updatedPost = response.post;

      // Update in posts list
      set((state) => ({
        posts: state.posts.map((p) => (p._id === postId ? updatedPost : p)),
        isLoading: false,
      }));

      return updatedPost;
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Retry post error:', error);
      throw error;
    }
  },

  /**
   * Clear all posts (on workspace switch)
   */
  clearPosts: () => {
    set({
      posts: [],
      isLoading: false,
      postsLoaded: false,
      stats: {
        [PostStatus.DRAFT]: 0,
        [PostStatus.SCHEDULED]: 0,
        [PostStatus.QUEUED]: 0,
        [PostStatus.PUBLISHING]: 0,
        [PostStatus.PUBLISHED]: 0,
        [PostStatus.FAILED]: 0,
        [PostStatus.CANCELLED]: 0,
        [PostStatus.PENDING_APPROVAL]: 0,
        [PostStatus.APPROVED]: 0,
        [PostStatus.REJECTED]: 0,
      },
      currentPage: 1,
      totalPages: 1,
      total: 0,
    });
  },
}));
