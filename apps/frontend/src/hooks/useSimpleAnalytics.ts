import { useState, useEffect, useCallback } from 'react';
import { usePostStore } from '@/store/post.store';
import { Post, PostStatus } from '@/types/post.types';

/**
 * useSimpleAnalytics Hook
 * 
 * Lightweight analytics based on post data
 * 
 * Features:
 * - Overview stats (total, success rate, failed, scheduled)
 * - Activity trend (posts per day)
 * - Platform distribution
 * - Recent posts
 * 
 * Performance:
 * - Client-side aggregation (no heavy backend queries)
 * - Memoized calculations
 * - Lazy loading
 */

export interface SimpleAnalytics {
  overview: {
    totalPublished: number;
    successRate: number;
    failedCount: number;
    scheduledCount: number;
  };
  activityTrend: Array<{
    date: string;
    count: number;
  }>;
  platformDistribution: Array<{
    platform: string;
    count: number;
    percentage: number;
  }>;
  recentPosts: Post[];
}

export function useSimpleAnalytics(days: number = 30) {
  const { posts, fetchPosts, fetchStats, stats, isLoading } = usePostStore();
  const [analytics, setAnalytics] = useState<SimpleAnalytics | null>(null);
  const [calculating, setCalculating] = useState(false);

  /**
   * Fetch posts for analytics
   */
  const loadData = useCallback(async () => {
    try {
      // Fetch recent posts (last 30-90 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      await fetchPosts({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      await fetchStats();
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  }, [days, fetchPosts, fetchStats]);

  /**
   * Calculate analytics from posts
   */
  const calculateAnalytics = useCallback(() => {
    if (!posts || posts.length === 0) {
      setAnalytics(null);
      return;
    }

    setCalculating(true);

    try {
      // Overview stats
      const publishedPosts = posts.filter((p) => p.status === PostStatus.PUBLISHED);
      const failedPosts = posts.filter((p) => p.status === PostStatus.FAILED);
      const scheduledPosts = posts.filter((p) => p.status === PostStatus.SCHEDULED);
      
      const totalAttempted = publishedPosts.length + failedPosts.length;
      const successRate = totalAttempted > 0 
        ? (publishedPosts.length / totalAttempted) * 100 
        : 0;

      // Activity trend (posts per day)
      const activityMap = new Map<string, number>();
      
      publishedPosts.forEach((post) => {
        if (post.publishedAt) {
          const date = new Date(post.publishedAt).toISOString().split('T')[0];
          activityMap.set(date, (activityMap.get(date) || 0) + 1);
        }
      });

      const activityTrend = Array.from(activityMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-days); // Last N days

      // Platform distribution
      const platformMap = new Map<string, number>();
      
      publishedPosts.forEach((post) => {
        const platform = typeof post.socialAccountId === 'object' 
          ? post.socialAccountId?.platform 
          : 'Unknown';
        
        if (platform) {
          platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
        }
      });

      const totalPlatformPosts = Array.from(platformMap.values()).reduce((a, b) => a + b, 0);
      
      const platformDistribution = Array.from(platformMap.entries())
        .map(([platform, count]) => ({
          platform,
          count,
          percentage: totalPlatformPosts > 0 ? (count / totalPlatformPosts) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Recent posts (last 10)
      const recentPosts = [...posts]
        .sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 10);

      setAnalytics({
        overview: {
          totalPublished: publishedPosts.length,
          successRate: Math.round(successRate),
          failedCount: failedPosts.length,
          scheduledCount: scheduledPosts.length,
        },
        activityTrend,
        platformDistribution,
        recentPosts,
      });
    } finally {
      setCalculating(false);
    }
  }, [posts, days]);

  /**
   * Load data on mount
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Calculate analytics when posts change
   */
  useEffect(() => {
    if (posts && posts.length > 0) {
      calculateAnalytics();
    }
  }, [posts, calculateAnalytics]);

  return {
    analytics,
    stats,
    isLoading: isLoading || calculating,
    refresh: loadData,
  };
}
