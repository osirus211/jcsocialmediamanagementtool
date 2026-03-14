/**
 * Instagram Analytics Adapter
 * 
 * Collects comprehensive engagement metrics from Instagram Graph API
 * Includes demographics, hashtag performance, and optimal posting times
 */

import axios from 'axios';
import { IAnalyticsAdapter, AnalyticsData, CollectAnalyticsParams } from './IAnalyticsAdapter';
import { logger } from '../../utils/logger';

interface InstagramInsight {
  name: string;
  period: string;
  values: Array<{
    value: number | object;
    end_time: string;
  }>;
  title?: string;
  description?: string;
}

interface DemographicData {
  age: Record<string, number>;
  gender: Record<string, number>;
  location: Record<string, number>;
}

interface HashtagPerformance {
  hashtag: string;
  reach: number;
  impressions: number;
  engagement: number;
}

export class InstagramAnalyticsAdapter implements IAnalyticsAdapter {
  private readonly apiVersion = 'v18.0';
  private readonly baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

  /**
   * Collect comprehensive analytics from Instagram
   */
  async collectAnalytics(params: CollectAnalyticsParams): Promise<AnalyticsData> {
    const { platformPostId, accessToken, accountId } = params;

    try {
      logger.debug('Collecting Instagram analytics', {
        postId: platformPostId,
      });

      // Collect post-level metrics
      const postMetrics = await this.collectPostMetrics(platformPostId, accessToken);
      
      // Collect account-level metrics if accountId provided
      let accountMetrics = {};
      if (accountId) {
        accountMetrics = await this.collectAccountMetrics(accountId, accessToken);
      }

      const analytics: AnalyticsData = {
        ...postMetrics,
        platformData: {
          ...postMetrics.platformData,
          ...accountMetrics,
        },
      };

      logger.debug('Instagram analytics collected', {
        postId: platformPostId,
        analytics,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Failed to collect Instagram analytics', {
        postId: platformPostId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Instagram analytics collection failed: ${error.message}`);
    }
  }

  /**
   * Collect post-level metrics
   */
  private async collectPostMetrics(postId: string, accessToken: string): Promise<AnalyticsData> {
    // Fetch media insights
    const response = await axios.get(`${this.baseUrl}/${postId}/insights`, {
      params: {
        metric: 'engagement,impressions,reach,saved,likes,comments,shares,video_views,profile_visits,website_clicks',
        access_token: accessToken,
      },
      timeout: 30000,
    });

    const insights = response.data.data || [];

    // Extract metrics
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let impressions = 0;
    let saves = 0;
    let reach = 0;
    let engagement = 0;
    let videoViews = 0;
    let profileVisits = 0;
    let websiteClicks = 0;

    for (const insight of insights) {
      const value = insight.values[0]?.value || 0;
      
      switch (insight.name) {
        case 'likes':
          likes = value;
          break;
        case 'comments':
          comments = value;
          break;
        case 'shares':
          shares = value;
          break;
        case 'impressions':
          impressions = value;
          break;
        case 'saved':
          saves = value;
          break;
        case 'reach':
          reach = value;
          break;
        case 'engagement':
          engagement = value;
          break;
        case 'video_views':
          videoViews = value;
          break;
        case 'profile_visits':
          profileVisits = value;
          break;
        case 'website_clicks':
          websiteClicks = value;
          break;
      }
    }

    return {
      likes,
      comments,
      shares,
      impressions,
      clicks: websiteClicks,
      saves,
      platformData: {
        reach,
        engagement,
        videoViews,
        profileVisits,
        rawData: insights,
      },
    };
  }

  /**
   * Collect account-level metrics and demographics
   */
  private async collectAccountMetrics(accountId: string, accessToken: string): Promise<object> {
    try {
      // Get account insights
      const accountResponse = await axios.get(`${this.baseUrl}/${accountId}/insights`, {
        params: {
          metric: 'follower_count,profile_views,reach,impressions,website_clicks',
          period: 'day',
          access_token: accessToken,
        },
        timeout: 30000,
      });

      // Get audience demographics
      const demographicsResponse = await axios.get(`${this.baseUrl}/${accountId}/insights`, {
        params: {
          metric: 'audience_gender_age,audience_locale,audience_country',
          period: 'lifetime',
          access_token: accessToken,
        },
        timeout: 30000,
      });

      const accountInsights = accountResponse.data.data || [];
      const demographicInsights = demographicsResponse.data.data || [];

      // Process demographics
      const demographics = this.processDemographics(demographicInsights);

      // Get optimal posting times
      const optimalTimes = await this.getOptimalPostingTimes(accountId, accessToken);

      return {
        accountMetrics: accountInsights,
        demographics,
        optimalPostingTimes: optimalTimes,
      };
    } catch (error: any) {
      logger.warn('Failed to collect account metrics', {
        accountId,
        error: error.message,
      });
      return {};
    }
  }

  /**
   * Process demographic data
   */
  private processDemographics(insights: InstagramInsight[]): DemographicData {
    const demographics: DemographicData = {
      age: {},
      gender: {},
      location: {},
    };

    for (const insight of insights) {
      const value = insight.values[0]?.value;
      
      if (typeof value === 'object' && value !== null) {
        switch (insight.name) {
          case 'audience_gender_age':
            // Process age and gender data
            Object.entries(value).forEach(([key, val]) => {
              if (key.startsWith('M.') || key.startsWith('F.')) {
                const [gender, ageRange] = key.split('.');
                demographics.gender[gender] = (demographics.gender[gender] || 0) + (val as number);
                demographics.age[ageRange] = (demographics.age[ageRange] || 0) + (val as number);
              }
            });
            break;
          case 'audience_locale':
          case 'audience_country':
            Object.entries(value).forEach(([location, count]) => {
              demographics.location[location] = count as number;
            });
            break;
        }
      }
    }

    return demographics;
  }

  /**
   * Get optimal posting times based on audience activity
   */
  private async getOptimalPostingTimes(accountId: string, accessToken: string): Promise<object> {
    try {
      const response = await axios.get(`${this.baseUrl}/${accountId}/insights`, {
        params: {
          metric: 'online_followers',
          period: 'lifetime',
          access_token: accessToken,
        },
        timeout: 30000,
      });

      const onlineFollowers = response.data.data?.[0]?.values?.[0]?.value || {};
      
      // Process online followers data to find optimal times
      const optimalTimes = this.calculateOptimalTimes(onlineFollowers);
      
      return {
        hourlyActivity: onlineFollowers,
        recommendedTimes: optimalTimes,
      };
    } catch (error: any) {
      logger.warn('Failed to get optimal posting times', {
        accountId,
        error: error.message,
      });
      return {};
    }
  }

  /**
   * Calculate optimal posting times from follower activity data
   */
  private calculateOptimalTimes(onlineFollowers: Record<string, number>): string[] {
    if (!onlineFollowers || Object.keys(onlineFollowers).length === 0) {
      return [];
    }

    // Sort hours by follower activity
    const sortedHours = Object.entries(onlineFollowers)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Top 5 hours
      .map(([hour]) => {
        const hourNum = parseInt(hour);
        const period = hourNum >= 12 ? 'PM' : 'AM';
        const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
        return `${displayHour}:00 ${period}`;
      });

    return sortedHours;
  }

  /**
   * Analyze hashtag performance for a post
   */
  async analyzeHashtagPerformance(
    postId: string,
    hashtags: string[],
    accessToken: string
  ): Promise<HashtagPerformance[]> {
    try {
      // Get post metrics
      const postMetrics = await this.collectPostMetrics(postId, accessToken);
      
      // Calculate performance per hashtag (simplified approach)
      const performancePerHashtag = postMetrics.reach / hashtags.length;
      
      return hashtags.map(hashtag => ({
        hashtag,
        reach: Math.round(performancePerHashtag),
        impressions: Math.round(postMetrics.impressions / hashtags.length),
        engagement: Math.round(postMetrics.platformData.engagement / hashtags.length),
      }));
    } catch (error: any) {
      logger.error('Failed to analyze hashtag performance', {
        postId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get Stories metrics (if applicable)
   */
  async collectStoriesMetrics(storyId: string, accessToken: string): Promise<object> {
    try {
      const response = await axios.get(`${this.baseUrl}/${storyId}/insights`, {
        params: {
          metric: 'impressions,reach,taps_forward,taps_back,exits,replies',
          access_token: accessToken,
        },
        timeout: 30000,
      });

      const insights = response.data.data || [];
      const metrics: Record<string, number> = {};

      for (const insight of insights) {
        metrics[insight.name] = insight.values[0]?.value || 0;
      }

      return {
        storyMetrics: metrics,
      };
    } catch (error: any) {
      logger.warn('Failed to collect Stories metrics', {
        storyId,
        error: error.message,
      });
      return {};
    }
  }

  /**
   * Get Reels metrics (if applicable)
   */
  async collectReelsMetrics(reelId: string, accessToken: string): Promise<object> {
    try {
      const response = await axios.get(`${this.baseUrl}/${reelId}/insights`, {
        params: {
          metric: 'plays,reach,likes,comments,saves,shares,total_interactions',
          access_token: accessToken,
        },
        timeout: 30000,
      });

      const insights = response.data.data || [];
      const metrics: Record<string, number> = {};

      for (const insight of insights) {
        metrics[insight.name] = insight.values[0]?.value || 0;
      }

      return {
        reelMetrics: metrics,
      };
    } catch (error: any) {
      logger.warn('Failed to collect Reels metrics', {
        reelId,
        error: error.message,
      });
      return {};
    }
  }
}
