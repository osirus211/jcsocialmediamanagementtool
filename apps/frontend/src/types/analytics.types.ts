/**
 * Analytics Types for Frontend
 */

export interface PostAnalytics {
  _id: string;
  workspaceId: string;
  postId: string;
  platform: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
  engagementRate: number;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OverviewMetrics {
  totalImpressions: number;
  totalEngagement: number;
  engagementRate: number;
  totalPosts: number;
  bestPerformingPost: any;
  growth: {
    impressions: number;
    engagement: number;
  };
}

export interface PlatformMetrics {
  platform: string;
  impressions: number;
  engagement: number;
  engagementRate: number;
  posts: number;
}

export interface GrowthMetrics {
  date: string;
  impressions: number;
  engagement: number;
  engagementRate: number;
}

// API Response types
export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
