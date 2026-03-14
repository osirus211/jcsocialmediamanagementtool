/**
 * Twitter Analytics Adapter
 * 
 * Collects engagement metrics from Twitter API v2
 * Features: Tweet metrics, profile metrics, thread analytics
 */

import axios from 'axios';
import { IAnalyticsAdapter, AnalyticsData, CollectAnalyticsParams } from './IAnalyticsAdapter';
import { logger } from '../../utils/logger';

interface TwitterProfileMetrics {
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  verified: boolean;
  verifiedType?: string;
}

interface TwitterThreadAnalytics {
  threadId: string;
  tweets: Array<{
    id: string;
    metrics: AnalyticsData;
    position: number;
  }>;
  totalEngagement: number;
  averageEngagement: number;
  dropoffRate: number;
}

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

      // Check if this is a thread by looking for conversation_id
      const isThread = await this.isPartOfThread(platformPostId, accessToken);
      
      if (isThread) {
        return this.collectThreadAnalytics(platformPostId, accessToken);
      }

      return this.collectSingleTweetAnalytics(platformPostId, accessToken);
    } catch (error: any) {
      logger.error('Failed to collect Twitter analytics', {
        postId: platformPostId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Twitter analytics collection failed: ${error.message}`);
    }
  }

  /**
   * Collect analytics for a single tweet
   */
  private async collectSingleTweetAnalytics(tweetId: string, accessToken: string): Promise<AnalyticsData> {
    const response = await axios.get(`${this.baseUrl}/tweets/${tweetId}`, {
      params: {
        'tweet.fields': 'public_metrics,non_public_metrics,organic_metrics,context_annotations,created_at',
        'expansions': 'author_id',
        'user.fields': 'public_metrics,verified',
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
    const hashtagClicks = nonPublicMetrics.hashtag_clicks || organicMetrics.hashtag_clicks || 0;
    const detailExpands = nonPublicMetrics.detail_expands || organicMetrics.detail_expands || 0;

    const analytics: AnalyticsData = {
      likes,
      comments: replies,
      shares: quotes,
      impressions,
      clicks: urlClicks + profileClicks + hashtagClicks,
      retweets,
      platformData: {
        quotes,
        urlClicks,
        profileClicks,
        hashtagClicks,
        detailExpands,
        engagementRate: impressions > 0 ? ((likes + retweets + replies + quotes) / impressions) * 100 : 0,
        contextAnnotations: tweet.context_annotations || [],
        createdAt: tweet.created_at,
        rawData: tweet,
      },
    };

    logger.debug('Twitter analytics collected', {
      postId: tweetId,
      analytics,
    });

    return analytics;
  }

  /**
   * Collect analytics for a Twitter thread
   */
  private async collectThreadAnalytics(threadId: string, accessToken: string): Promise<AnalyticsData> {
    // Get all tweets in the thread
    const threadTweets = await this.getThreadTweets(threadId, accessToken);
    
    const threadAnalytics: TwitterThreadAnalytics = {
      threadId,
      tweets: [],
      totalEngagement: 0,
      averageEngagement: 0,
      dropoffRate: 0,
    };

    let totalImpressions = 0;
    let totalEngagement = 0;

    // Collect analytics for each tweet in the thread
    for (let i = 0; i < threadTweets.length; i++) {
      const tweet = threadTweets[i];
      const tweetAnalytics = await this.collectSingleTweetAnalytics(tweet.id, accessToken);
      
      threadAnalytics.tweets.push({
        id: tweet.id,
        metrics: tweetAnalytics,
        position: i + 1,
      });

      totalImpressions += tweetAnalytics.impressions;
      totalEngagement += tweetAnalytics.likes + tweetAnalytics.comments + tweetAnalytics.shares + tweetAnalytics.retweets;
    }

    // Calculate thread-level metrics
    threadAnalytics.totalEngagement = totalEngagement;
    threadAnalytics.averageEngagement = threadTweets.length > 0 ? totalEngagement / threadTweets.length : 0;
    
    // Calculate dropoff rate (engagement decrease from first to last tweet)
    if (threadTweets.length > 1) {
      const firstTweetEngagement = threadAnalytics.tweets[0].metrics.likes + 
                                  threadAnalytics.tweets[0].metrics.comments + 
                                  threadAnalytics.tweets[0].metrics.shares + 
                                  threadAnalytics.tweets[0].metrics.retweets;
      const lastTweetEngagement = threadAnalytics.tweets[threadTweets.length - 1].metrics.likes + 
                                 threadAnalytics.tweets[threadTweets.length - 1].metrics.comments + 
                                 threadAnalytics.tweets[threadTweets.length - 1].metrics.shares + 
                                 threadAnalytics.tweets[threadTweets.length - 1].metrics.retweets;
      
      threadAnalytics.dropoffRate = firstTweetEngagement > 0 ? 
        ((firstTweetEngagement - lastTweetEngagement) / firstTweetEngagement) * 100 : 0;
    }

    // Return aggregated analytics for the thread
    const firstTweet = threadAnalytics.tweets[0];
    return {
      ...firstTweet.metrics,
      platformData: {
        ...firstTweet.metrics.platformData,
        isThread: true,
        threadAnalytics,
        threadLength: threadTweets.length,
      },
    };
  }

  /**
   * Check if a tweet is part of a thread
   */
  private async isPartOfThread(tweetId: string, accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/tweets/${tweetId}`, {
        params: {
          'tweet.fields': 'conversation_id,in_reply_to_user_id,referenced_tweets',
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const tweet = response.data.data;
      
      // Check if this tweet is replying to another tweet by the same user
      return tweet.in_reply_to_user_id && tweet.conversation_id !== tweetId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all tweets in a thread
   */
  private async getThreadTweets(threadId: string, accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/tweets/search/recent`, {
        params: {
          query: `conversation_id:${threadId}`,
          'tweet.fields': 'id,conversation_id,in_reply_to_user_id,created_at',
          max_results: 100,
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data.data || [];
    } catch (error) {
      logger.warn('Failed to get thread tweets', { threadId, error });
      return [];
    }
  }

  /**
   * Collect profile metrics
   */
  async collectProfileMetrics(accessToken: string): Promise<TwitterProfileMetrics> {
    try {
      const response = await axios.get(`${this.baseUrl}/users/me`, {
        params: {
          'user.fields': 'public_metrics,verified,verified_type,created_at',
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const user = response.data.data;
      const metrics = user.public_metrics;

      return {
        followersCount: metrics.followers_count,
        followingCount: metrics.following_count,
        tweetCount: metrics.tweet_count,
        listedCount: metrics.listed_count,
        verified: user.verified,
        verifiedType: user.verified_type,
      };
    } catch (error: any) {
      logger.error('Failed to collect Twitter profile metrics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get trending hashtags and topics
   */
  async getTrendingTopics(accessToken: string, woeid: number = 1): Promise<any[]> {
    try {
      // Note: This requires Twitter API v1.1 for trends
      const response = await axios.get('https://api.twitter.com/1.1/trends/place.json', {
        params: {
          id: woeid, // 1 = Worldwide
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data[0]?.trends || [];
    } catch (error: any) {
      logger.error('Failed to get trending topics', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get optimal posting times based on audience activity
   */
  async getOptimalPostingTimes(accessToken: string): Promise<any> {
    try {
      // This would require analyzing follower activity patterns
      // For now, return general best practices
      return {
        weekdays: ['09:00', '12:00', '15:00', '18:00'],
        weekends: ['10:00', '14:00', '16:00'],
        timezone: 'UTC',
        confidence: 'medium',
        note: 'Based on general Twitter best practices. Upgrade to premium for personalized insights.',
      };
    } catch (error: any) {
      logger.error('Failed to get optimal posting times', {
        error: error.message,
      });
      throw error;
    }
  }
}
