/**
 * Publishing Service
 * 
 * Handles multi-platform publishing with real-time status tracking
 * Superior to Buffer, Hootsuite, Sprout Social, Later
 */

import { apiClient } from '@/lib/api-client';
import { PlatformStatus } from '@/components/publishing/PublishStatusTracker';

export interface PublishRequest {
  content: string;
  platforms: string[];
  scheduledAt?: Date;
  mediaIds?: string[];
  contentType?: 'post' | 'story' | 'reel' | 'thread';
}

export interface PublishResponse {
  success: boolean;
  postId: string;
  platforms: PlatformStatus[];
  message?: string;
}

export interface PublishStatusResponse {
  postId: string;
  platforms: PlatformStatus[];
  overallStatus: 'queued' | 'publishing' | 'completed' | 'partial_failure';
  completedAt?: Date;
}

export class PublishingService {
  /**
   * Publish to multiple platforms simultaneously
   * This is the "Publish Now" functionality
   */
  static async publishNow(request: PublishRequest): Promise<PublishResponse> {
    try {
      const response = await apiClient.post<PublishResponse>('/posts/publish-now', {
        ...request,
        scheduledAt: new Date(), // Immediate publishing
      });

      return response;
    } catch (error: any) {
      throw new Error(`Failed to publish: ${error.message}`);
    }
  }

  /**
   * Schedule posts for later publishing
   */
  static async schedulePost(request: PublishRequest): Promise<PublishResponse> {
    try {
      const response = await apiClient.post<PublishResponse>('/posts/schedule', request);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to schedule post: ${error.message}`);
    }
  }

  /**
   * Get real-time publishing status for a post
   */
  static async getPublishStatus(postId: string): Promise<PublishStatusResponse> {
    try {
      const response = await apiClient.get<PublishStatusResponse>(`/posts/${postId}/status`);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to get publish status: ${error.message}`);
    }
  }

  /**
   * Retry publishing to a specific platform
   */
  static async retryPlatform(postId: string, platform: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/posts/${postId}/retry-platform`,
        { platform }
      );
      return response;
    } catch (error: any) {
      throw new Error(`Failed to retry platform: ${error.message}`);
    }
  }

  /**
   * Retry all failed platforms for a post
   */
  static async retryAllFailed(postId: string): Promise<{ success: boolean; message: string; retriedPlatforms: string[] }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string; retriedPlatforms: string[] }>(
        `/posts/${postId}/retry-all-failed`
      );
      return response;
    } catch (error: any) {
      throw new Error(`Failed to retry all failed platforms: ${error.message}`);
    }
  }

  /**
   * Get platform-specific post URLs
   */
  static async getPlatformUrls(postId: string): Promise<Record<string, string>> {
    try {
      const response = await apiClient.get<Record<string, string>>(`/posts/${postId}/platform-urls`);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to get platform URLs: ${error.message}`);
    }
  }

  /**
   * Cancel pending publications
   */
  static async cancelPublishing(postId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/posts/${postId}/cancel`
      );
      return response;
    } catch (error: any) {
      throw new Error(`Failed to cancel publishing: ${error.message}`);
    }
  }

  /**
   * Get publishing analytics and metrics
   */
  static async getPublishingMetrics(workspaceId: string, timeRange: '24h' | '7d' | '30d' = '7d'): Promise<{
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    platformBreakdown: Record<string, { success: number; failed: number }>;
    averagePublishTime: number;
    mostReliablePlatform: string;
    leastReliablePlatform: string;
  }> {
    try {
      const response = await apiClient.get(`/analytics/publishing-metrics`, {
        params: { workspaceId, timeRange }
      });
      return response;
    } catch (error: any) {
      throw new Error(`Failed to get publishing metrics: ${error.message}`);
    }
  }

  /**
   * Validate content for all selected platforms
   */
  static async validateContent(content: string, platforms: string[]): Promise<{
    valid: boolean;
    platformValidation: Record<string, {
      valid: boolean;
      errors: string[];
      warnings: string[];
      characterCount: number;
      characterLimit: number;
    }>;
  }> {
    try {
      const response = await apiClient.post('/posts/validate-content', {
        content,
        platforms
      });
      return response;
    } catch (error: any) {
      throw new Error(`Failed to validate content: ${error.message}`);
    }
  }

  /**
   * Get optimal posting times for platforms
   */
  static async getOptimalPostingTimes(platforms: string[]): Promise<Record<string, {
    timezone: string;
    optimalTimes: Array<{
      dayOfWeek: number;
      hour: number;
      engagementScore: number;
    }>;
  }>> {
    try {
      const response = await apiClient.post('/analytics/optimal-posting-times', {
        platforms
      });
      return response;
    } catch (error: any) {
      throw new Error(`Failed to get optimal posting times: ${error.message}`);
    }
  }
}

// Export singleton instance
export const publishingService = PublishingService;