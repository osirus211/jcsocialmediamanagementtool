/**
 * Facebook Analytics Adapter
 * 
 * Collects engagement metrics from Facebook Graph API
 */

import axios from 'axios';
import { IAnalyticsAdapter, AnalyticsData, CollectAnalyticsParams } from './IAnalyticsAdapter';
import { logger } from '../../utils/logger';

export class FacebookAnalyticsAdapter implements IAnalyticsAdapter {
  private readonly apiVersion = 'v18.0';
  private readonly baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

  /**
   * Collect analytics from Facebook
   */
  async collectAnalytics(params: CollectAnalyticsParams): Promise<AnalyticsData> {
    const { platformPostId, accessToken } = params;

    try {
      logger.debug('Collecting Facebook analytics', {
        postId: platformPostId,
      });

      // Fetch post insights
      const response = await axios.get(`${this.baseUrl}/${platformPostId}`, {
        params: {
          fields: 'likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_clicks,post_engaged_users)',
          access_token: accessToken,
        },
        timeout: 30000,
      });

      const data = response.data;

      // Extract metrics
      const likes = data.likes?.summary?.total_count || 0;
      const comments = data.comments?.summary?.total_count || 0;
      const shares = data.shares?.count || 0;

      // Extract insights
      let impressions = 0;
      let clicks = 0;
      let engagedUsers = 0;

      if (data.insights?.data) {
        for (const insight of data.insights.data) {
          if (insight.name === 'post_impressions') {
            impressions = insight.values[0]?.value || 0;
          } else if (insight.name === 'post_clicks') {
            clicks = insight.values[0]?.value || 0;
          } else if (insight.name === 'post_engaged_users') {
            engagedUsers = insight.values[0]?.value || 0;
          }
        }
      }

      const analytics: AnalyticsData = {
        likes,
        comments,
        shares,
        impressions,
        clicks,
        platformData: {
          engagedUsers,
          rawData: data,
        },
      };

      logger.debug('Facebook analytics collected', {
        postId: platformPostId,
        analytics,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Failed to collect Facebook analytics', {
        postId: platformPostId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Facebook analytics collection failed: ${error.message}`);
    }
  }
}
