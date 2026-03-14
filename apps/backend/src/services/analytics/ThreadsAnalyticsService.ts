/**
 * Threads Analytics Service
 * 
 * Provides comprehensive analytics for Threads posts and accounts
 * Supports insights, metrics, and performance tracking
 */

import { ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import axios from 'axios';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

interface ThreadInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
}

interface UserInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followers_count: number;
  follower_demographics?: {
    age: Record<string, number>;
    gender: Record<string, number>;
    country: Record<string, number>;
  };
}

interface InsightsOptions {
  period?: 'day' | 'week' | 'days_28' | 'month' | 'lifetime';
  since?: number; // Unix timestamp
  until?: number; // Unix timestamp
}

export class ThreadsAnalyticsService {
  /**
   * Get insights for a specific thread
   */
  async getThreadInsights(account: ISocialAccount, threadId: string): Promise<ThreadInsights> {
    const accessToken = this.getAccessToken(account);
    
    try {
      const metrics = ['views', 'likes', 'replies', 'reposts', 'quotes'];
      const params = new URLSearchParams({
        metric: metrics.join(','),
        access_token: accessToken
      });

      const response = await axios.get(
        `${THREADS_API_BASE}/${threadId}/insights?${params.toString()}`
      );

      const insights: ThreadInsights = {
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0
      };

      // Parse insights data
      if (response.data.data) {
        for (const insight of response.data.data) {
          if (insight.name in insights) {
            insights[insight.name as keyof ThreadInsights] = insight.values[0]?.value || 0;
          }
        }
      }

      logger.info('[Threads] Thread insights fetched', { 
        threadId, 
        accountId: account._id.toString(),
        insights 
      });

      return insights;
    } catch (error: any) {
      logger.error('[Threads] Failed to fetch thread insights', { 
        threadId,
        error: error.response?.data || error.message 
      });
      throw new Error(`Failed to fetch thread insights: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get user account insights
   */
  async getUserInsights(account: ISocialAccount, options: InsightsOptions = {}): Promise<UserInsights> {
    const accessToken = this.getAccessToken(account);
    const userId = account.providerUserId;
    
    try {
      const metrics = [
        'views', 
        'likes', 
        'replies', 
        'reposts', 
        'quotes', 
        'followers_count',
        'follower_demographics'
      ];
      
      const params = new URLSearchParams({
        metric: metrics.join(','),
        access_token: accessToken
      });

      // Add optional parameters
      if (options.period) {
        params.append('period', options.period);
      }
      if (options.since) {
        params.append('since', options.since.toString());
      }
      if (options.until) {
        params.append('until', options.until.toString());
      }

      const response = await axios.get(
        `${THREADS_API_BASE}/${userId}/threads_insights?${params.toString()}`
      );

      const insights: UserInsights = {
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        followers_count: 0
      };

      // Parse insights data
      if (response.data.data) {
        for (const insight of response.data.data) {
          if (insight.name === 'follower_demographics') {
            insights.follower_demographics = insight.values[0]?.value;
          } else if (insight.name in insights) {
            insights[insight.name as keyof UserInsights] = insight.values[0]?.value || 0;
          }
        }
      }

      logger.info('[Threads] User insights fetched', { 
        userId,
        accountId: account._id.toString(),
        period: options.period,
        insights: { ...insights, follower_demographics: '[REDACTED]' }
      });

      return insights;
    } catch (error: any) {
      logger.error('[Threads] Failed to fetch user insights', { 
        userId,
        error: error.response?.data || error.message 
      });
      throw new Error(`Failed to fetch user insights: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get performance summary for multiple threads
   */
  async getThreadsPerformance(account: ISocialAccount, threadIds: string[]): Promise<Record<string, ThreadInsights>> {
    const results: Record<string, ThreadInsights> = {};
    
    // Fetch insights for each thread (could be optimized with batch requests if API supports it)
    for (const threadId of threadIds) {
      try {
        results[threadId] = await this.getThreadInsights(account, threadId);
      } catch (error: any) {
        logger.warn('[Threads] Failed to fetch insights for thread', { threadId, error: error.message });
        // Continue with other threads even if one fails
        results[threadId] = {
          views: 0,
          likes: 0,
          replies: 0,
          reposts: 0,
          quotes: 0
        };
      }
    }

    return results;
  }

  /**
   * Get top performing threads
   */
  async getTopThreads(account: ISocialAccount, options: InsightsOptions & { limit?: number } = {}): Promise<Array<{ threadId: string; insights: ThreadInsights }>> {
    // This would require fetching user's threads first, then getting insights
    // For now, this is a placeholder - would need to implement thread listing first
    logger.info('[Threads] Top threads analysis requested', { 
      accountId: account._id.toString(),
      options 
    });
    
    // TODO: Implement when Threads API provides thread listing endpoint
    return [];
  }

  /**
   * Calculate engagement rate
   */
  calculateEngagementRate(insights: ThreadInsights): number {
    const { views, likes, replies, reposts, quotes } = insights;
    
    if (views === 0) return 0;
    
    const totalEngagements = likes + replies + reposts + quotes;
    return (totalEngagements / views) * 100;
  }

  /**
   * Get access token from account
   */
  private getAccessToken(account: ISocialAccount): string {
    if (!account.accessToken) {
      throw new Error('No access token available for account');
    }
    return account.accessToken;
  }
}