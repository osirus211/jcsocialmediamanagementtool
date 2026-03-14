/**
 * YouTube Analytics Service
 * Fetches comprehensive analytics from YouTube Analytics API and YouTube Data API v3
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { ISocialAccount } from '../../models/SocialAccount';

export interface YouTubeChannelStats {
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
}

export interface YouTubeVideoAnalytics {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  impressions: number;
  impressionClickThroughRate: number;
  subscribersGained: number;
  subscribersLost: number;
  thumbnailUrl: string;
  duration: string;
}

export interface YouTubeAnalyticsReport {
  channelStats: YouTubeChannelStats;
  topVideos: YouTubeVideoAnalytics[];
  recentVideos: YouTubeVideoAnalytics[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalVideosAnalyzed: number;
}

export interface YouTubeAnalyticsOptions {
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  maxResults?: number;
  metrics?: string[];
  dimensions?: string[];
}

export class YouTubeAnalyticsService {
  private readonly dataApiUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly analyticsApiUrl = 'https://youtubeanalytics.googleapis.com/v2';

  /**
   * Get comprehensive YouTube analytics for a channel
   */
  async getChannelAnalytics(
    account: ISocialAccount,
    options: YouTubeAnalyticsOptions = {}
  ): Promise<YouTubeAnalyticsReport> {
    try {
      const {
        startDate = this.getDateDaysAgo(30),
        endDate = this.getDateDaysAgo(0),
        maxResults = 50,
      } = options;

      logger.info('Fetching YouTube analytics', {
        accountId: account._id,
        startDate,
        endDate,
        maxResults,
      });

      // Fetch channel statistics
      const channelStats = await this.getChannelStats(account.accessToken);

      // Fetch video list
      const videos = await this.getChannelVideos(account.accessToken, maxResults);

      // Fetch analytics for each video
      const videoAnalytics = await Promise.all(
        videos.map(video => this.getVideoAnalytics(account.accessToken, video, startDate, endDate))
      );

      // Sort videos by views for top videos
      const topVideos = [...videoAnalytics]
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Get recent videos (last 10)
      const recentVideos = videoAnalytics
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 10);

      const report: YouTubeAnalyticsReport = {
        channelStats,
        topVideos,
        recentVideos,
        dateRange: { startDate, endDate },
        totalVideosAnalyzed: videoAnalytics.length,
      };

      logger.info('YouTube analytics fetched successfully', {
        accountId: account._id,
        totalVideos: videoAnalytics.length,
        topVideoViews: topVideos[0]?.views || 0,
      });

      return report;
    } catch (error: any) {
      logger.error('Failed to fetch YouTube analytics', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(accessToken: string): Promise<YouTubeChannelStats> {
    try {
      const response = await axios.get(`${this.dataApiUrl}/channels`, {
        params: {
          part: 'statistics',
          mine: 'true',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const channel = response.data.items[0];
      if (!channel) {
        throw new Error('No channel found');
      }

      const stats = channel.statistics;

      return {
        subscriberCount: parseInt(stats.subscriberCount) || 0,
        videoCount: parseInt(stats.videoCount) || 0,
        viewCount: parseInt(stats.viewCount) || 0,
        estimatedMinutesWatched: 0, // Will be filled by analytics API
        averageViewDuration: 0, // Will be filled by analytics API
      };
    } catch (error: any) {
      logger.error('Failed to fetch channel stats', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get channel videos
   */
  async getChannelVideos(accessToken: string, maxResults: number = 50): Promise<any[]> {
    try {
      const response = await axios.get(`${this.dataApiUrl}/search`, {
        params: {
          part: 'snippet',
          forMine: 'true',
          type: 'video',
          order: 'date',
          maxResults,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.items || [];
    } catch (error: any) {
      logger.error('Failed to fetch channel videos', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get detailed analytics for a specific video
   */
  async getVideoAnalytics(
    accessToken: string,
    video: any,
    startDate: string,
    endDate: string
  ): Promise<YouTubeVideoAnalytics> {
    try {
      const videoId = video.id.videoId;
      
      // Get video details
      const videoDetailsResponse = await axios.get(`${this.dataApiUrl}/videos`, {
        params: {
          part: 'statistics,contentDetails,snippet',
          id: videoId,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const videoDetails = videoDetailsResponse.data.items[0];
      if (!videoDetails) {
        throw new Error(`Video details not found for ${videoId}`);
      }

      const statistics = videoDetails.statistics;
      const snippet = videoDetails.snippet;
      const contentDetails = videoDetails.contentDetails;

      // Try to get advanced analytics from YouTube Analytics API
      let advancedMetrics = {
        estimatedMinutesWatched: 0,
        averageViewDuration: 0,
        impressions: 0,
        impressionClickThroughRate: 0,
        subscribersGained: 0,
        subscribersLost: 0,
      };

      try {
        const analyticsResponse = await axios.get(`${this.analyticsApiUrl}/reports`, {
          params: {
            ids: 'channel==MINE',
            startDate,
            endDate,
            metrics: 'estimatedMinutesWatched,averageViewDuration,impressions,impressionClickThroughRate,subscribersGained,subscribersLost',
            filters: `video==${videoId}`,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (analyticsResponse.data.rows && analyticsResponse.data.rows.length > 0) {
          const row = analyticsResponse.data.rows[0];
          advancedMetrics = {
            estimatedMinutesWatched: row[0] || 0,
            averageViewDuration: row[1] || 0,
            impressions: row[2] || 0,
            impressionClickThroughRate: row[3] || 0,
            subscribersGained: row[4] || 0,
            subscribersLost: row[5] || 0,
          };
        }
      } catch (analyticsError) {
        // Analytics API might not be available or video might be too new
        logger.debug('Advanced analytics not available for video', {
          videoId,
          error: (analyticsError as any).message,
        });
      }

      return {
        videoId,
        title: snippet.title,
        publishedAt: snippet.publishedAt,
        views: parseInt(statistics.viewCount) || 0,
        likes: parseInt(statistics.likeCount) || 0,
        dislikes: parseInt(statistics.dislikeCount) || 0,
        comments: parseInt(statistics.commentCount) || 0,
        shares: 0, // Not available in basic API
        thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
        duration: contentDetails.duration,
        ...advancedMetrics,
      };
    } catch (error: any) {
      logger.error('Failed to fetch video analytics', {
        videoId: video.id.videoId,
        error: error.message,
      });
      
      // Return basic data even if analytics fail
      return {
        videoId: video.id.videoId,
        title: video.snippet.title,
        publishedAt: video.snippet.publishedAt,
        views: 0,
        likes: 0,
        dislikes: 0,
        comments: 0,
        shares: 0,
        estimatedMinutesWatched: 0,
        averageViewDuration: 0,
        impressions: 0,
        impressionClickThroughRate: 0,
        subscribersGained: 0,
        subscribersLost: 0,
        thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '',
        duration: 'PT0S',
      };
    }
  }

  /**
   * Get channel analytics summary for dashboard
   */
  async getChannelSummary(
    account: ISocialAccount,
    days: number = 30
  ): Promise<{
    totalViews: number;
    totalSubscribers: number;
    totalVideos: number;
    averageViewsPerVideo: number;
    topPerformingVideo: {
      title: string;
      views: number;
      url: string;
    } | null;
  }> {
    try {
      const analytics = await this.getChannelAnalytics(account, {
        startDate: this.getDateDaysAgo(days),
        endDate: this.getDateDaysAgo(0),
        maxResults: 20,
      });

      const topVideo = analytics.topVideos[0];

      return {
        totalViews: analytics.channelStats.viewCount,
        totalSubscribers: analytics.channelStats.subscriberCount,
        totalVideos: analytics.channelStats.videoCount,
        averageViewsPerVideo: analytics.totalVideosAnalyzed > 0 
          ? Math.round(analytics.topVideos.reduce((sum, video) => sum + video.views, 0) / analytics.totalVideosAnalyzed)
          : 0,
        topPerformingVideo: topVideo ? {
          title: topVideo.title,
          views: topVideo.views,
          url: `https://youtube.com/watch?v=${topVideo.videoId}`,
        } : null,
      };
    } catch (error: any) {
      logger.error('Failed to fetch channel summary', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get date string for X days ago
   */
  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse YouTube duration format (PT4M13S) to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }
}

// Export singleton instance
export const youTubeAnalyticsService = new YouTubeAnalyticsService();