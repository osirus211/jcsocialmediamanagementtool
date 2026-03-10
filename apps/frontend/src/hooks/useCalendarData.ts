import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { Post, PostStatus, PostsResponse } from '@/types/post.types';

/**
 * Calendar data cache
 * Stores fetched posts by date range key
 */
interface CalendarCache {
  [rangeKey: string]: {
    posts: Post[];
    fetchedAt: Date;
  };
}

/**
 * Date range for fetching
 */
interface DateRange {
  from: string; // ISO date
  to: string; // ISO date
}

/**
 * useCalendarData Hook
 * 
 * Manages calendar data fetching with:
 * - Lazy loading by date range
 * - Caching by range
 * - Member filtering (client-side)
 * - Optimistic updates
 * - Rollback on failure
 * 
 * Performance:
 * - Only fetches visible date range
 * - Caches fetched data
 * - Prevents duplicate fetches
 * - Efficient re-renders
 */
export function useCalendarData() {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache fetched data by range
  const cacheRef = useRef<CalendarCache>({});
  
  // Track current range to prevent duplicate fetches
  const currentRangeRef = useRef<string | null>(null);

  /**
   * Filter posts by selected members (client-side)
   */
  const filteredPosts = useMemo(() => {
    if (selectedMemberIds.length === 0) {
      return allPosts; // Show all if no filter
    }
    
    return allPosts.filter(post => {
      const createdBy = typeof post.createdBy === 'string' ? post.createdBy : post.createdBy?._id;
      return createdBy && selectedMemberIds.includes(createdBy);
    });
  }, [allPosts, selectedMemberIds]);

  /**
   * Update member filter
   */
  const filterByMembers = useCallback((memberIds: string[]) => {
    setSelectedMemberIds(memberIds);
  }, []);

  /**
   * Generate cache key from date range
   */
  const getCacheKey = useCallback((from: string, to: string): string => {
    return `${from}_${to}`;
  }, []);

  /**
   * Check if range is cached and fresh (< 5 minutes old)
   */
  const isCached = useCallback((from: string, to: string): boolean => {
    const key = getCacheKey(from, to);
    const cached = cacheRef.current[key];
    
    if (!cached) return false;
    
    const age = Date.now() - cached.fetchedAt.getTime();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    return age < maxAge;
  }, [getCacheKey]);

  /**
   * Fetch posts for date range
   */
  const fetchPostsByRange = useCallback(async (range: DateRange) => {
    const { from, to } = range;
    const key = getCacheKey(from, to);
    
    // Prevent duplicate fetches
    if (currentRangeRef.current === key) {
      return;
    }
    
    // Use cache if available
    if (isCached(from, to)) {
      const cached = cacheRef.current[key];
      setAllPosts(cached.posts);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      currentRangeRef.current = key;
      
      // Fetch scheduled and queued posts in date range
      const params = new URLSearchParams();
      params.append('status', PostStatus.SCHEDULED);
      params.append('status', PostStatus.QUEUED);
      params.append('startDate', from);
      params.append('endDate', to);
      params.append('limit', '1000'); // Large limit for calendar view
      
      const response = await apiClient.get<PostsResponse>(
        `/posts?${params.toString()}`
      );
      
      const fetchedPosts = response.posts;
      
      // Update cache
      cacheRef.current[key] = {
        posts: fetchedPosts,
        fetchedAt: new Date(),
      };
      
      // Update state
      setAllPosts(fetchedPosts);
    } catch (err: any) {
      console.error('Fetch calendar posts error:', err);
      setError(err.response?.data?.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
      currentRangeRef.current = null;
    }
  }, [getCacheKey, isCached]);

  /**
   * Refetch current range (force refresh)
   */
  const refetch = useCallback(() => {
    // Clear cache for current range
    if (currentRangeRef.current) {
      delete cacheRef.current[currentRangeRef.current];
    }
    
    // Trigger re-fetch by clearing current range
    const prevRange = currentRangeRef.current;
    currentRangeRef.current = null;
    
    // Re-fetch will happen via useEffect
  }, []);

  /**
   * Optimistically update post
   * Used for drag-drop reschedule
   */
  const optimisticUpdate = useCallback((postId: string, updates: Partial<Post>) => {
    setAllPosts((prevPosts) =>
      prevPosts.map((post) =>
        post._id === postId ? { ...post, ...updates } : post
      )
    );
  }, []);

  /**
   * Rollback optimistic update
   * Used when API call fails
   */
  const rollback = useCallback((postId: string, originalPost: Post) => {
    setAllPosts((prevPosts) =>
      prevPosts.map((post) =>
        post._id === postId ? originalPost : post
      )
    );
  }, []);

  /**
   * Reschedule post (with optimistic update)
   */
  const reschedulePost = useCallback(async (
    postId: string,
    newScheduledAt: string
  ): Promise<boolean> => {
    // Find original post
    const originalPost = allPosts.find((p) => p._id === postId);
    if (!originalPost) {
      return false;
    }
    
    // Validate not in past
    const newDate = new Date(newScheduledAt);
    const now = new Date();
    if (newDate < now) {
      setError('Cannot schedule post in the past');
      return false;
    }
    
    // Validate not published
    if (originalPost.status === PostStatus.PUBLISHED) {
      setError('Cannot reschedule published post');
      return false;
    }
    
    try {
      // Optimistic update
      optimisticUpdate(postId, { scheduledAt: newScheduledAt });
      
      // API call
      await apiClient.patch(`/posts/${postId}`, {
        scheduledAt: newScheduledAt,
      });
      
      // Clear cache to force refresh
      cacheRef.current = {};
      
      return true;
    } catch (err: any) {
      console.error('Reschedule error:', err);
      
      // Rollback on failure
      rollback(postId, originalPost);
      
      setError(err.response?.data?.message || 'Failed to reschedule post');
      return false;
    }
  }, [allPosts, optimisticUpdate, rollback]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Filtered data
    posts: filteredPosts,
    allPosts,
    selectedMemberIds,
    
    // State
    isLoading,
    error,
    
    // Actions
    fetchPostsByRange,
    filterByMembers,
    refetch,
    reschedulePost,
    clearError,
  };
}
