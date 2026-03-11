/**
 * Analytics React Query Hooks
 * 
 * Provides cached queries for analytics data with longer stale times
 * Analytics data changes slowly so we can cache more aggressively
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

interface EngagementAnalyticsResponse {
  totalEngagement: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  period: string;
}

interface FollowerGrowthResponse {
  current: number;
  previous: number;
  growth: number;
  growthRate: number;
  data: Array<{
    date: string;
    followers: number;
  }>;
}

interface HashtagAnalyticsResponse {
  hashtags: Array<{
    tag: string;
    usage: number;
    engagement: number;
    posts: number;
  }>;
}

interface BestTimesResponse {
  bestDays: string[];
  bestHours: number[];
  data: Array<{
    day: string;
    hour: number;
    engagement: number;
    posts: number;
  }>;
}

/**
 * Fetch engagement analytics
 * Cached for 10 minutes (analytics change slowly)
 */
export function useEngagementAnalytics(workspaceId: string, period: string = '30d') {
  return useQuery({
    queryKey: queryKeys.analytics.engagement(workspaceId, period),
    queryFn: async () => {
      const response = await apiClient.get<EngagementAnalyticsResponse>(
        `/analytics/engagement?workspaceId=${workspaceId}&period=${period}`
      );
      return response;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!workspaceId,
  });
}

/**
 * Fetch follower growth analytics
 * Cached for 10 minutes (follower data changes slowly)
 */
export function useFollowerGrowth(workspaceId: string, platform: string = 'all') {
  return useQuery({
    queryKey: queryKeys.analytics.followerGrowth(workspaceId, platform),
    queryFn: async () => {
      const response = await apiClient.get<FollowerGrowthResponse>(
        `/analytics/followers?workspaceId=${workspaceId}&platform=${platform}`
      );
      return response;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!workspaceId,
  });
}

/**
 * Fetch hashtag analytics
 * Cached for 15 minutes (hashtag performance changes very slowly)
 */
export function useHashtagAnalytics(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.hashtags(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get<HashtagAnalyticsResponse>(
        `/analytics/hashtags?workspaceId=${workspaceId}`
      );
      return response.hashtags;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!workspaceId,
  });
}

/**
 * Fetch best posting times
 * Cached for 30 minutes (best times barely change)
 */
export function useBestPostTimes(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.bestTimes(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get<BestTimesResponse>(
        `/analytics/best-times?workspaceId=${workspaceId}`
      );
      return response;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!workspaceId,
  });
}