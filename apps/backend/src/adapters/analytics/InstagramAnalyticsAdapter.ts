/**
 * Instagram Analytics Adapter
 * 
 * Collects engagement metrics from Instagram Graph API
 */

import axios from 'axios';
import { IAnalyticsAdapter, AnalyticsData, CollectAnalyticsParams } from './IAnalyticsAdapter';
import { logger } from '../../utils/logger';

export class InstagramAnalyticsAdapter implements IAnalyticsAdapter {
  private readonly apiVersion = 'v18.0';
  private readonly baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

  /**
   * Collect analytics from Instagram
   */
  async collectAnalytics(params: CollectAnalyticsParams): Promise<AnalyticsData> {
    const { platformPostId, accessToken } = params;

    try {
      logger.debug('Collecting Instagram analytics', {
        postId: platformPostId,
      });

      // Fetch media insights
      const response = await axios.get(`${this.baseUrl}/${platformPostId}/insights`, {
        params: {
          metric: 'engagement,impressions,reach,saved,likes,comments,shares',
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
        }
      }

      const analytics: AnalyticsData = {
        likes,
        comments,
        shares,
        impressions,
        clicks: 0, // Instagram doesn't provide click data via API
        saves,
        platformData: {
          reach,
          engagement,
          rawData: insights,
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
}
