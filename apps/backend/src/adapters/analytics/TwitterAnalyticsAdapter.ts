/**
 * Twitter Analytics Adapter
 * 
 * Collects engagement metrics from Twitter API v2
 */

import axios from 'axios';
import { IAnalyticsAdapter, AnalyticsData, CollectAnalyticsParams } from './IAnalyticsAdapter';
import { logger } from '../../utils/logger';

export class TwitterAnalyticsAdapter implements IAnalyticsAdapter {
  private readonly baseUrl = 'https://api.twitter.com/2';

  /**
   * Collect analytics from Twitter
   */
  async collectAnalytics(params: CollectAnalyticsParams): Promise<AnalyticsData> {
    const { platformPostId, accessToken } = params;

    try {
      logger.debug('Collecting Twitter analytics', {
        postId: platformPostId,
      });

      // Fetch tweet metrics
      const response = await axios.get(`${this.baseUrl}/tweets/${platformPostId}`, {
        params: {
          'tweet.fields': 'public_metrics,non_public_metrics,organic_metrics',
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 30000,
      });

      const tweet = response.data.data;
      const publicMetrics = tweet.public_metrics || {};
      const nonPublicMetrics = tweet.non_public_metrics || {};
      const organicMetrics = tweet.organic_metrics || {};

      // Extract metrics
      const likes = publicMetrics.like_count || 0;
      const retweets = publicMetrics.retweet_count || 0;
      const replies = publicMetrics.reply_count || 0;
      const quotes = publicMetrics.quote_count || 0;
      const impressions = nonPublicMetrics.impression_count || organicMetrics.impression_count || 0;
      const urlClicks = nonPublicMetrics.url_link_clicks || organicMetrics.url_link_clicks || 0;
      const profileClicks = nonPublicMetrics.user_profile_clicks || organicMetrics.user_profile_clicks || 0;

      const analytics: AnalyticsData = {
        likes,
        comments: replies,
        shares: quotes,
        impressions,
        clicks: urlClicks + profileClicks,
        retweets,
        platformData: {
          quotes,
          urlClicks,
          profileClicks,
          rawData: tweet,
        },
      };

      logger.debug('Twitter analytics collected', {
        postId: platformPostId,
        analytics,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Failed to collect Twitter analytics', {
        postId: platformPostId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Twitter analytics collection failed: ${error.message}`);
    }
  }
}
