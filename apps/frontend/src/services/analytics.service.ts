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

export interface PostPerformanceSummary {
  post: {
    _id: string;
    content: string;
    platform: string;
    publishedAt: Date;
    status: string;
  };
  analytics: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    clicks: number;
    engagementRate: number;
    clickThroughRate: number;
    linkClicks: number;
    adSpend?: number;
    estimatedRevenue?: number;
    roi?: number;
    costPerClick?: number;
  } | null;
}

export interface TopPerformingPost {
  postId: string;
  content: string;
  platform: string;
  publishedAt: Date;
  impressions: number;
  engagementRate: number;
  clickThroughRate: number;
  linkClicks: number;
  roi?: number;
  adSpend?: number;
  estimatedRevenue?: number;
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

  /**
   * Get post performance summary
   */
  async getPostPerformance(postId: string): Promise<PostPerformanceSummary> {
    const response = await apiClient.get<{ success: boolean; data: PostPerformanceSummary }>(
      `/analytics/post/${postId}/performance`
    );

    return response.data;
  }

  /**
   * Update post ROI data
   */
  async updatePostROI(postId: string, adSpend?: number, estimatedRevenue?: number): Promise<void> {
    const body: any = {};
    if (adSpend !== undefined) body.adSpend = adSpend;
    if (estimatedRevenue !== undefined) body.estimatedRevenue = estimatedRevenue;

    await apiClient.patch<{ success: boolean; message: string }>(
      `/analytics/post/${postId}/roi`,
      body
    );
  }

  /**
   * Get top performing posts
   */
  async getTopPerformingPosts(
    sortBy?: 'engagement' | 'ctr' | 'roi',
    limit?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<TopPerformingPost[]> {
    const params = new URLSearchParams();
    if (sortBy) params.append('sortBy', sortBy);
    if (limit) params.append('limit', limit.toString());
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await apiClient.get<{ success: boolean; data: TopPerformingPost[] }>(
      `/analytics/posts/top?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get summary KPI metrics
   */
  async getSummaryMetrics(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<{
    reach: { current: number; previous: number; percentageChange: number };
    engagement: { current: number; previous: number; percentageChange: number };
    followerGrowth: { current: number; previous: number; percentageChange: number };
    postsPublished: { current: number; previous: number; percentageChange: number };
  }> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    if (platforms) {
      platforms.forEach(platform => params.append('platforms', platform));
    }

    const response = await apiClient.get<{ success: boolean; data: any }>(
      `/analytics/summary?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get follower growth data
   */
  async getFollowerGrowthData(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<Array<{ date: string; platform: string; followerCount: number }>> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    if (platforms) {
      platforms.forEach(platform => params.append('platforms', platform));
    }

    const response = await apiClient.get<{ success: boolean; data: Array<{ date: string; platform: string; followerCount: number }> }>(
      `/analytics/follower-growth?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get engagement data
   */
  async getEngagementData(
    startDate: Date,
    endDate: Date,
    platforms?: string[],
    groupBy: 'day' | 'platform' = 'day'
  ): Promise<Array<any>> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    params.append('groupBy', groupBy);
    if (platforms) {
      platforms.forEach(platform => params.append('platforms', platform));
    }

    const response = await apiClient.get<{ success: boolean; data: Array<any> }>(
      `/analytics/engagement?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get top posts data
   */
  async getTopPostsData(
    startDate: Date,
    endDate: Date,
    platforms?: string[],
    sortBy: string = 'engagementRate',
    sortDir: 'asc' | 'desc' = 'desc',
    limit: number = 10
  ): Promise<Array<any>> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    params.append('sortBy', sortBy);
    params.append('sortDir', sortDir);
    params.append('limit', limit.toString());
    if (platforms) {
      platforms.forEach(platform => params.append('platforms', platform));
    }

    const response = await apiClient.get<{ success: boolean; data: Array<any> }>(
      `/analytics/posts/top?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get worst performing posts
   */
  async getWorstPostsData(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<Array<any>> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    if (platforms) {
      platforms.forEach(platform => params.append('platforms', platform));
    }

    const response = await apiClient.get<{ success: boolean; data: Array<any> }>(
      `/analytics/posts/worst?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Compare multiple posts
   */
  async comparePosts(postIds: string[]): Promise<Array<any>> {
    const params = new URLSearchParams();
    params.append('postIds', postIds.join(','));

    const response = await apiClient.get<{ success: boolean; data: Array<any> }>(
      `/analytics/posts/compare?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get post detail with history
   */
  async getPostDetail(postId: string): Promise<any> {
    const response = await apiClient.get<{ success: boolean; data: any }>(
      `/analytics/posts/${postId}`
    );

    return response.data;
  }

  /**
   * Get platform comparison data
   */
  async getPlatformComparisonData(
    startDate: Date,
    endDate: Date
  ): Promise<Array<any>> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());

    const response = await apiClient.get<{ success: boolean; data: Array<any> }>(
      `/analytics/platform-comparison?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Export analytics as PDF
   */
  async exportPDF(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<void> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    if (platforms) {
      platforms.forEach(platform => params.append('platforms', platform));
    }

    const response = await fetch(`/api/v1/analytics/export/pdf?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 
      `analytics-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.pdf`;
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Export analytics as CSV (client-side)
   */
  async exportCSV(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<void> {
    try {
      // Fetch all data needed for CSV export
      const [summary, followerGrowth, engagement, topPosts, platformComparison] = await Promise.all([
        this.getSummaryMetrics(startDate, endDate, platforms),
        this.getFollowerGrowthData(startDate, endDate, platforms),
        this.getEngagementData(startDate, endDate, platforms, 'day'),
        this.getTopPostsData(startDate, endDate, platforms),
        this.getPlatformComparisonData(startDate, endDate)
      ]);

      // Build CSV content
      let csvContent = '';

      // KPI Summary section
      csvContent += 'KPI Summary\n';
      csvContent += 'Metric,Current,Previous,Change %\n';
      csvContent += `Total Reach,${summary.reach.current},${summary.reach.previous},${summary.reach.percentageChange}\n`;
      csvContent += `Total Engagement,${summary.engagement.current},${summary.engagement.previous},${summary.engagement.percentageChange}\n`;
      csvContent += `Follower Growth,${summary.followerGrowth.current},${summary.followerGrowth.previous},${summary.followerGrowth.percentageChange}\n`;
      csvContent += `Posts Published,${summary.postsPublished.current},${summary.postsPublished.previous},${summary.postsPublished.percentageChange}\n`;
      csvContent += '\n';

      // Engagement by day section
      csvContent += 'Engagement by Day\n';
      csvContent += 'Date,Likes,Comments,Shares,Saves,Total\n';
      engagement.forEach(day => {
        csvContent += `${day.date},${day.likes},${day.comments},${day.shares},${day.saves},${day.total}\n`;
      });
      csvContent += '\n';

      // Top posts section
      csvContent += 'Top Posts\n';
      csvContent += 'Platform,Published At,Likes,Comments,Shares,Saves,Reach,Engagement Rate\n';
      topPosts.forEach(post => {
        csvContent += `${post.platform},${post.publishedAt},${post.likes},${post.comments},${post.shares},${post.saves},${post.reach},${post.engagementRate}\n`;
      });
      csvContent += '\n';

      // Platform comparison section
      csvContent += 'Platform Comparison\n';
      csvContent += 'Platform,Followers,Follower Growth,Posts,Reach,Engagement,Engagement Rate,Best Posting Hour\n';
      platformComparison.forEach(platform => {
        csvContent += `${platform.platform},${platform.followers},${platform.followerGrowth},${platform.posts},${platform.reach},${platform.engagement},${platform.engagementRate},${platform.bestPostingHour}\n`;
      });

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      throw error;
    }
  }

  /**
   * Download report file
   */
  async downloadReport(reportType: string, format: string, startDate: string, endDate: string): Promise<void> {
    const params = new URLSearchParams({
      reportType,
      format,
      startDate,
      endDate,
    });

    // Trigger file download
    const url = `/api/v1/reports/download?${params}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${reportType}-${startDate}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const analyticsService = new AnalyticsService();