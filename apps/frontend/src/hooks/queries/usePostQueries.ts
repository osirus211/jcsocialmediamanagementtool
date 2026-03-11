/**
 * Post React Query Hooks
 * 
 * Provides cached queries for post data with proper invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  Post,
  PostFilters,
  PostStatus,
  CreatePostInput,
  UpdatePostInput,
} from '@/types/post.types';

interface PostsResponse {
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
}

interface PostResponse {
  post: Post;
}

interface PostStatsResponse {
  stats: Record<PostStatus, number>;
}

/**
 * Fetch posts with filters and pagination
 * Cached for 2 minutes (posts change frequently)
 */
export function usePosts(filters?: PostFilters, page: number = 1) {
  const queryKey = queryKeys.posts.list({ ...filters, page });

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          filters.status.forEach(s => params.append('status', s));
        } else {
          params.append('status', filters.status);
        }
      }
      if (filters?.socialAccountId) params.append('socialAccountId', filters.socialAccountId);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.search) params.append('search', filters.search);
      
      params.append('page', page.toString());

      const response = await apiClient.get<PostsResponse>(
        `/posts?${params.toString()}`
      );
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch single post by ID
 * Cached for 5 minutes (individual posts change less frequently)
 */
export function usePost(postId: string) {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: async () => {
      const response = await apiClient.get<PostResponse>(`/posts/${postId}`);
      return response.post;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!postId,
  });
}

/**
 * Fetch post statistics
 * Cached for 3 minutes (stats change moderately)
 */
export function usePostStats(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.posts.stats(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get<PostStatsResponse>('/posts/stats');
      return response.stats;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    enabled: !!workspaceId,
  });
}

/**
 * Create post mutation
 * Invalidates post list and stats on success
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const response = await apiClient.post<PostResponse>('/posts', input);
      return response.post;
    },
    onSuccess: (newPost) => {
      // Invalidate post lists (all filter combinations)
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      
      // Invalidate stats for the workspace
      if (newPost.workspaceId) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.posts.stats(newPost.workspaceId) 
        });
      }
    },
  });
}

/**
 * Update post mutation
 * Invalidates post detail and list on success
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, input }: { postId: string; input: UpdatePostInput }) => {
      const response = await apiClient.patch<PostResponse>(
        `/posts/${postId}`,
        input
      );
      return response.post;
    },
    onSuccess: (updatedPost) => {
      // Update the specific post in cache
      queryClient.setQueryData(
        queryKeys.posts.detail(updatedPost._id),
        updatedPost
      );
      
      // Invalidate post lists to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

/**
 * Delete post mutation
 * Invalidates post list and stats on success
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.delete(`/posts/${postId}`);
      return postId;
    },
    onSuccess: (postId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.posts.detail(postId) });
      
      // Invalidate post lists and stats
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      queryClient.invalidateQueries({ queryKey: ['posts', 'stats'] });
    },
  });
}

/**
 * Retry post mutation
 * Invalidates post detail and list on success
 */
export function useRetryPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiClient.post<PostResponse>(
        `/posts/${postId}/retry`,
        {}
      );
      return response.post;
    },
    onSuccess: (updatedPost) => {
      // Update the specific post in cache
      queryClient.setQueryData(
        queryKeys.posts.detail(updatedPost._id),
        updatedPost
      );
      
      // Invalidate post lists to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}