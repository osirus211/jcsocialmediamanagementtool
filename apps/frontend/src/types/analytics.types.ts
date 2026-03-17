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

export interface BestTimeHeatmap {
  hour: number;
  day: string;
  engagementRate: number;
  postCount: number;
}

export interface CompetitorAnalytics {
  competitorName: string;
  platform: string;
  followerCount: number;
  avgEngagementRate: number;
  avgPostsPerDay: number;
  growthTrend: number;
}

export interface HashtagAnalytics {
  _id?: string;
  hashtag: string;
  platform: string;
  usageCount: number;
  avgEngagementRate: number;
  trendScore: number;
  totalReach?: number;
  impressions?: number;
  isRising?: boolean;
}

export interface LinkClickAnalytics {
  url: string;
  platform: string;
  clicks: number;
  impressions: number;
  clickThroughRate: number;
  postCount: number;
  day?: string;
  hour?: number;
  country?: string;
  device?: string;
  totalClicks?: number;
  uniqueClicks?: number;
  conversionRate?: number;
}

export interface ExportOptions {
  title?: string;
  startDate: Date;
  endDate: Date;
  platforms?: string[];
  format?: 'pdf' | 'csv';
  includeOverview: boolean;
  includePostMetrics: boolean;
  includeEngagementCharts: boolean;
  includeFollowerGrowth: boolean;
  includeHashtagAnalytics: boolean;
  includeBestTimes: boolean;
  includeLinkClicks: boolean;
  includeCompetitors: boolean;
}

export interface DashboardAnalytics {
  overview: OverviewMetrics;
  platforms: PlatformMetrics[];
  growth: GrowthMetrics[];
  hashtags: any[];
  bestTimes: any[];
  linkClicks: any[];
  competitors: any[];
}

// API Response types
export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
