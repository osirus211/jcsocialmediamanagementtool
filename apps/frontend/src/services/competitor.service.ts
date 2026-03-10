/**
 * Competitor Service
 * Frontend service for competitor API calls
 */

import { apiClient } from '@/lib/api-client';

export interface CompetitorAccount {
  _id: string;
  workspaceId: string;
  platform: string;
  handle: string;
  displayName?: string;
  profileUrl?: string;
  platformAccountId?: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorMetrics {
  _id: string;
  competitorId: string;
  workspaceId: string;
  platform: string;
  followerCount: number;
  followingCount?: number;
  postCount?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  avgShares?: number;
  collectedAt: string;
  platformData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorGrowthData {
  date: string;
  followerCount: number;
  growth: number;
}

export interface CompetitorComparison {
  competitor: CompetitorAccount;
  metrics: CompetitorMetrics | null;
  growth: {
    followers: number;
    percentage: number;
  };
}

class CompetitorService {
  /**
   * Get competitors for workspace
   */
  async getCompetitors(platform?: string, isActive?: boolean): Promise<CompetitorAccount[]> {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (isActive !== undefined) params.append('isActive', isActive.toString());

    const response = await apiClient.get<{ success: boolean; data: CompetitorAccount[] }>(
      `/competitors?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Add competitor to track
   */
  async addCompetitor(platform: string, handle: string, displayName?: string): Promise<CompetitorAccount> {
    const response = await apiClient.post<{ success: boolean; data: CompetitorAccount }>(
      '/competitors',
      { platform, handle, displayName }
    );

    return response.data;
  }

  /**
   * Remove competitor
   */
  async removeCompetitor(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/competitors/${id}`
    );
  }

  /**
   * Get competitor metrics history
   */
  async getMetrics(
    competitorId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<CompetitorMetrics[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    if (limit) params.append('limit', limit.toString());

    const response = await apiClient.get<{ success: boolean; data: CompetitorMetrics[] }>(
      `/competitors/${competitorId}/analytics?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get latest competitor metrics
   */
  async getLatestMetrics(competitorId: string): Promise<CompetitorMetrics | null> {
    const response = await apiClient.get<{ success: boolean; data: CompetitorMetrics | null }>(
      `/competitors/${competitorId}/metrics/latest`
    );

    return response.data;
  }

  /**
   * Compare multiple competitors
   */
  async compareCompetitors(
    competitorIds: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<CompetitorComparison[]> {
    const body: any = { competitorIds };
    if (startDate) body.startDate = startDate.toISOString();
    if (endDate) body.endDate = endDate.toISOString();

    const response = await apiClient.post<{ success: boolean; data: CompetitorComparison[] }>(
      '/competitors/compare',
      body
    );

    return response.data;
  }

  /**
   * Get competitor growth metrics
   */
  async getGrowth(
    competitorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CompetitorGrowthData[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await apiClient.get<{ success: boolean; data: CompetitorGrowthData[] }>(
      `/competitors/${competitorId}/growth?${params.toString()}`
    );

    return response.data;
  }
}

export const competitorService = new CompetitorService();