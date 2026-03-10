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
}

export const analyticsService = new AnalyticsService();