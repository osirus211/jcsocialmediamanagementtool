/**
 * Facebook Analytics Service
 * 
 * Fetches comprehensive analytics from Facebook Graph API v21.0
 * 
 * Features:
 * - Page insights (impressions, reach, engagement)
 * - Post insights (performance metrics)
 * - Audience demographics
 * - Video metrics for Reels
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { ISocialAccount } from '../../models/SocialAccount';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v21.0';

export interface FacebookPageInsights {
  pageId: string;
  period: string;
  startDate: string;
  endDate: string;
  metrics: {
    pageImpressions: number;
    pageReach: number;
    pageEngagedUsers: number;
    pageFanAdds: number;
    pageViewsTotal: number;
    pagePostEngagements: number;
  };
}

export interface FacebookPostInsights {
  postId: string;
  metrics: {
    postImpressions: number;
    postReach: number;
    postEngagedUsers: number;
    postReactionsByType: Record<string, number>;
    postClicks: number;
    postVideoViews?: number;
    postVideoViewTime?: number;
  };
}

export interface FacebookAudienceInsights {
  pageId: string;
  demographics: {
    ageGender: Array<{
      ageRange: string;
      gender: string;
      value: number;
    }>;
    countries: Array<{
      country: string;
      value: number;
    }>;
    cities: Array<{
      city: string;
      value: number;
    }>;
  };
}

export class FacebookAnalyticsService {
  /**
   * Get page insights for a specific time period
   */
  async getPageInsights(
    account: ISocialAccount,
    startDate: Date,
    endDate: Date,
    period: 'day' | 'week' | 'days_28' = 'day'
  ): Promise<FacebookPageInsights> {
    const accessToken = account.accessToken;
    const pageId = account.metadata?.pageId || account.providerUserId;

    const metrics = [
      'page_impressions',
      'page_reach',
      'page_engaged_users',
      'page_fan_adds',
      'page_views_total',
      'page_post_engagements'
    ];

    try {
      const response = await axios.get(`${FACEBOOK_API_BASE}/${pageId}/insights`, {
        params: {
          metric: metrics.join(','),
          period,
          since: Math.floor(startDate.getTime() / 1000),
          until: Math.floor(endDate.getTime() / 1000),
          access_token: accessToken,
        },
      });

      const data = response.data.data;
      const processedMetrics: any = {};

      // Process metrics data
      data.forEach((metric: any) => {
        const metricName = metric.name;
        const values = metric.values || [];
        
        // Sum up values for the period
        const totalValue = values.reduce((sum: number, item: any) => {
          return sum + (item.value || 0);
        }, 0);

        processedMetrics[this.camelCaseMetric(metricName)] = totalValue;
      });

      logger.info('Facebook page insights fetched', {
        pageId,
        period,
        metricsCount: Object.keys(processedMetrics).length,
      });

      return {
        pageId,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        metrics: processedMetrics,
      };
    } catch (error: any) {
      logger.error('Facebook page insights fetch failed', {
        pageId,
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook page insights: ${error.response?.data?.error?.message || error.message}`);
    }
  }
  /**
   * Get post insights for a specific post
   */
  async getPostInsights(
    account: ISocialAccount,
    postId: string
  ): Promise<FacebookPostInsights> {
    const accessToken = account.accessToken;

    const metrics = [
      'post_impressions',
      'post_reach',
      'post_engaged_users',
      'post_reactions_by_type_total',
      'post_clicks',
      'post_video_views',
      'post_video_view_time'
    ];

    try {
      const response = await axios.get(`${FACEBOOK_API_BASE}/${postId}/insights`, {
        params: {
          metric: metrics.join(','),
          access_token: accessToken,
        },
      });

      const data = response.data.data;
      const processedMetrics: any = {};

      // Process metrics data
      data.forEach((metric: any) => {
        const metricName = metric.name;
        const values = metric.values || [];
        
        if (metricName === 'post_reactions_by_type_total') {
          // Special handling for reactions by type
          processedMetrics.postReactionsByType = values[0]?.value || {};
        } else {
          // Regular metrics
          const value = values[0]?.value || 0;
          processedMetrics[this.camelCaseMetric(metricName)] = value;
        }
      });

      logger.info('Facebook post insights fetched', {
        postId,
        metricsCount: Object.keys(processedMetrics).length,
      });

      return {
        postId,
        metrics: processedMetrics,
      };
    } catch (error: any) {
      logger.error('Facebook post insights fetch failed', {
        postId,
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook post insights: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get audience demographics for a page
   */
  async getAudienceInsights(
    account: ISocialAccount,
    startDate: Date,
    endDate: Date
  ): Promise<FacebookAudienceInsights> {
    const accessToken = account.accessToken;
    const pageId = account.metadata?.pageId || account.providerUserId;

    try {
      // Get age and gender breakdown
      const ageGenderResponse = await axios.get(`${FACEBOOK_API_BASE}/${pageId}/insights`, {
        params: {
          metric: 'page_fans_by_age_gender',
          period: 'lifetime',
          access_token: accessToken,
        },
      });

      // Get country breakdown
      const countryResponse = await axios.get(`${FACEBOOK_API_BASE}/${pageId}/insights`, {
        params: {
          metric: 'page_fans_country',
          period: 'lifetime',
          access_token: accessToken,
        },
      });

      // Get city breakdown
      const cityResponse = await axios.get(`${FACEBOOK_API_BASE}/${pageId}/insights`, {
        params: {
          metric: 'page_fans_city',
          period: 'lifetime',
          access_token: accessToken,
        },
      });

      // Process age/gender data
      const ageGenderData = ageGenderResponse.data.data[0]?.values[0]?.value || {};
      const ageGender = Object.entries(ageGenderData).map(([key, value]) => {
        const [gender, ageRange] = key.split('.');
        return {
          ageRange,
          gender,
          value: value as number,
        };
      });

      // Process country data
      const countryData = countryResponse.data.data[0]?.values[0]?.value || {};
      const countries = Object.entries(countryData)
        .map(([country, value]) => ({
          country,
          value: value as number,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10 countries

      // Process city data
      const cityData = cityResponse.data.data[0]?.values[0]?.value || {};
      const cities = Object.entries(cityData)
        .map(([city, value]) => ({
          city,
          value: value as number,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10 cities

      logger.info('Facebook audience insights fetched', {
        pageId,
        ageGenderCount: ageGender.length,
        countriesCount: countries.length,
        citiesCount: cities.length,
      });

      return {
        pageId,
        demographics: {
          ageGender,
          countries,
          cities,
        },
      };
    } catch (error: any) {
      logger.error('Facebook audience insights fetch failed', {
        pageId,
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook audience insights: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get video metrics for Reels and video posts
   */
  async getVideoMetrics(
    account: ISocialAccount,
    videoId: string
  ): Promise<any> {
    const accessToken = account.accessToken;

    const metrics = [
      'post_video_views',
      'post_video_view_time',
      'post_video_views_organic',
      'post_video_views_paid',
      'post_video_complete_views_30s'
    ];

    try {
      const response = await axios.get(`${FACEBOOK_API_BASE}/${videoId}/insights`, {
        params: {
          metric: metrics.join(','),
          access_token: accessToken,
        },
      });

      const data = response.data.data;
      const processedMetrics: any = {};

      data.forEach((metric: any) => {
        const metricName = metric.name;
        const values = metric.values || [];
        const value = values[0]?.value || 0;
        processedMetrics[this.camelCaseMetric(metricName)] = value;
      });

      logger.info('Facebook video metrics fetched', {
        videoId,
        metricsCount: Object.keys(processedMetrics).length,
      });

      return {
        videoId,
        metrics: processedMetrics,
      };
    } catch (error: any) {
      logger.error('Facebook video metrics fetch failed', {
        videoId,
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook video metrics: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Convert snake_case metric names to camelCase
   */
  private camelCaseMetric(metricName: string): string {
    return metricName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * Get comprehensive analytics summary
   */
  async getAnalyticsSummary(
    account: ISocialAccount,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const [pageInsights, audienceInsights] = await Promise.all([
        this.getPageInsights(account, startDate, endDate),
        this.getAudienceInsights(account, startDate, endDate),
      ]);

      return {
        page: pageInsights,
        audience: audienceInsights,
        generatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Facebook analytics summary fetch failed', {
        accountId: account._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }
}