/**
 * Analytics Service
 * Frontend service for analytics API calls
 */

import { apiClient } from '@/lib/api-client';

export interface HeatmapData {
  dayOfWeek: number;
  hour: number;
  avgEngagement: number;
  postCount: number;
}

export interface TimingSuggestion {
  platform: string;
  dayOfWeek: number;
  hour: number;
  score: number;
  reason: string;
}

export interface BestTimesResponse {
  heatmap: HeatmapData[];
  suggestions: TimingSuggestion[];
}

export interface FollowerGrowthData {
  accountId: string;
  platform: string;
  currentFollowers: number;
  previousFollowers: number;
  growth: number;
  growthPercentage: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface FollowerTrendData {
  date: string;
  followerCount: number;
}

export interface HashtagPerformanceData {
  hashtag: string;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  avgEngagementRate: number;
  bestPost: {
    postId: string;
    engagementRate: number;
    platform: string;
  } | null;
  topPlatform: string;
}

export interface HashtagTrendData {
  week: string;
  postCount: number;
  avgEngagement: number;
}

export interface HashtagSuggestion {
  hashtag: string;
  avgEngagementRate: number;
  postCount: number;
}

class AnalyticsService {
  /**
   * Get optimal posting times heatmap and AI suggestions
   */
  async getBestTimes(platform?: string, workspaceId?: string): Promise<BestTimesResponse> {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (workspaceId) params.append('workspaceId', workspaceId);

    const response = await apiClient.get<{ success: boolean; data: BestTimesResponse }>(
      `/analytics/best-times?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get follower growth for an account
   */
  async getFollowerGrowth(accountId: string, startDate?: Date, endDate?: Date): Promise<FollowerGrowthData | null> {
    const params = new URLSearchParams();
    params.append('accountId', accountId);
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await apiClient.get<{ success: boolean; data: FollowerGrowthData | null }>(
      `/analytics/followers/growth?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get follower trends over time for an account
   */
  async getFollowerTrends(accountId: string, startDate: Date, endDate: Date, interval?: 'day' | 'week' | 'month'): Promise<FollowerTrendData[]> {
    const params = new URLSearchParams();
    params.append('accountId', accountId);
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    if (interval) params.append('interval', interval);

    const response = await apiClient.get<{ success: boolean; data: FollowerTrendData[] }>(
      `/analytics/followers/trends?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get follower growth for all accounts in workspace
   */
  async getWorkspaceFollowerGrowth(startDate?: Date, endDate?: Date): Promise<FollowerGrowthData[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await apiClient.get<{ success: boolean; data: FollowerGrowthData[] }>(
      `/analytics/followers/workspace?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get hashtag performance metrics
   */
  async getHashtagPerformance(startDate?: Date, endDate?: Date, limit?: number): Promise<HashtagPerformanceData[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    if (limit) params.append('limit', limit.toString());

    const response = await apiClient.get<{ success: boolean; data: HashtagPerformanceData[] }>(
      `/analytics/hashtags?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get hashtag trends over time
   */
  async getHashtagTrends(hashtag: string, startDate?: Date, endDate?: Date): Promise<HashtagTrendData[]> {
    const params = new URLSearchParams();
    params.append('hashtag', hashtag);
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await apiClient.get<{ success: boolean; data: HashtagTrendData[] }>(
      `/analytics/hashtags/trends?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get hashtags by platform
   */
  async getHashtagsByPlatform(platform: string, limit?: number): Promise<HashtagPerformanceData[]> {
    const params = new URLSearchParams();
    params.append('platform', platform);
    if (limit) params.append('limit', limit.toString());

    const response = await apiClient.get<{ success: boolean; data: HashtagPerformanceData[] }>(
      `/analytics/hashtags/by-platform?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get hashtag suggestions
   */
  async getHashtagSuggestions(limit?: number): Promise<HashtagSuggestion[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await apiClient.get<{ success: boolean; data: HashtagSuggestion[] }>(
      `/analytics/hashtags/suggestions?${params.toString()}`
    );

    return response.data;
  }
}

export const analyticsService = new AnalyticsService();