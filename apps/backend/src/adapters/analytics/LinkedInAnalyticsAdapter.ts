/**
 * LinkedIn Analytics Adapter
 * 
 * Collects engagement metrics from LinkedIn API
 */

import axios from 'axios';
import { IAnalyticsAdapter, AnalyticsData, CollectAnalyticsParams } from './IAnalyticsAdapter';
import { logger } from '../../utils/logger';

export class LinkedInAnalyticsAdapter implements IAnalyticsAdapter {
  private readonly baseUrl = 'https://api.linkedin.com/v2';

  /**
   * Collect analytics from LinkedIn
   */
  async collectAnalytics(params: CollectAnalyticsParams): Promise<AnalyticsData> {
    const { platformPostId, accessToken } = params;

    try {
      logger.debug('Collecting LinkedIn analytics', {
        postId: platformPostId,
      });

      // Fetch share statistics
      const response = await axios.get(`${this.baseUrl}/socialActions/${platformPostId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        timeout: 30000,
      });

      const data = response.data;

      // Extract metrics
      const likes = data.likesSummary?.totalLikes || 0;
      const comments = data.commentsSummary?.totalComments || 0;
      const shares = data.sharesSummary?.totalShares || 0;

      // Fetch impressions (requires separate API call)
      let impressions = 0;
      let clicks = 0;

      try {
        const statsResponse = await axios.get(`${this.baseUrl}/organizationalEntityShareStatistics`, {
          params: {
            q: 'organizationalEntity',
            organizationalEntity: platformPostId,
          },
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          timeout: 30000,
        });

        const stats = statsResponse.data.elements?.[0];
        if (stats) {
          impressions = stats.totalShareStatistics?.impressionCount || 0;
          clicks = stats.totalShareStatistics?.clickCount || 0;
        }
      } catch (error: any) {
        logger.warn('Failed to fetch LinkedIn impressions', {
          postId: platformPostId,
          error: error.message,
        });
      }

      const analytics: AnalyticsData = {
        likes,
        comments,
        shares,
        impressions,
        clicks,
        platformData: {
          rawData: data,
        },
      };

      logger.debug('LinkedIn analytics collected', {
        postId: platformPostId,
        analytics,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Failed to collect LinkedIn analytics', {
        postId: platformPostId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`LinkedIn analytics collection failed: ${error.message}`);
    }
  }
}
