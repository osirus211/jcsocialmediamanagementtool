/**
 * TikTok Analytics Adapter
 * 
 * Collects engagement metrics from TikTok API
 */

import axios from 'axios';
import { IAnalyticsAdapter, AnalyticsData, CollectAnalyticsParams } from './IAnalyticsAdapter';
import { logger } from '../../utils/logger';

export class TikTokAnalyticsAdapter implements IAnalyticsAdapter {
  private readonly baseUrl = 'https://open.tiktokapis.com/v2';

  /**
   * Collect analytics from TikTok
   */
  async collectAnalytics(params: CollectAnalyticsParams): Promise<AnalyticsData> {
    const { platformPostId, accessToken } = params;

    try {
      logger.debug('Collecting TikTok analytics', {
        postId: platformPostId,
      });

      // Fetch video info with metrics
      const response = await axios.post(
        `${this.baseUrl}/video/query/`,
        {
          filters: {
            video_ids: [platformPostId],
          },
          fields: [
            'id',
            'like_count',
            'comment_count',
            'share_count',
            'view_count',
            'duration',
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const video = response.data.data?.videos?.[0];

      if (!video) {
        throw new Error('Video not found');
      }

      // Extract metrics
      const likes = video.like_count || 0;
      const comments = video.comment_count || 0;
      const shares = video.share_count || 0;
      const views = video.view_count || 0;

      const analytics: AnalyticsData = {
        likes,
        comments,
        shares,
        impressions: views, // TikTok uses views as impressions
        clicks: 0, // TikTok doesn't provide click data
        views,
        platformData: {
          duration: video.duration,
          rawData: video,
        },
      };

      logger.debug('TikTok analytics collected', {
        postId: platformPostId,
        analytics,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Failed to collect TikTok analytics', {
        postId: platformPostId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`TikTok analytics collection failed: ${error.message}`);
    }
  }
}
