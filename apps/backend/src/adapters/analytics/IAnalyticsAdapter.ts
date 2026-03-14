/**
 * Analytics Adapter Interface
 * 
 * Defines contract for platform-specific analytics collection
 */

export interface AnalyticsData {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clicks: number;
  saves?: number;
  retweets?: number;
  views?: number;
  reach?: number;
  platformData?: Record<string, any>;
}

export interface CollectAnalyticsParams {
  platformPostId: string;
  accessToken: string;
  account: any;
  accountId?: string;
}

export interface IAnalyticsAdapter {
  /**
   * Collect analytics from platform API
   */
  collectAnalytics(params: CollectAnalyticsParams): Promise<AnalyticsData>;
}
