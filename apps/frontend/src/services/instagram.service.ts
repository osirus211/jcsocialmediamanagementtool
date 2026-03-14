/**
 * Instagram Service
 * 
 * Handles Instagram-specific API calls:
 * - Location search
 * - User search for tagging
 * - Hashtag validation and analysis
 * - Media validation
 * - Account insights
 */

import { apiClient } from '../lib/api-client';

export interface InstagramLocation {
  id: string;
  name: string;
}

export interface InstagramUser {
  id: string;
  username: string;
}

export interface HashtagPerformance {
  hashtag: string;
  reach: number;
  impressions: number;
  engagement: number;
  posts: number;
}

export interface MediaValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HashtagValidation {
  hashtagCount: number;
  maxHashtags: number;
  isValid: boolean;
  warning?: string;
}

export interface AccountInsights {
  followers: number;
  following: number;
  posts: number;
  avgEngagement: number;
  totalReach: number;
  totalImpressions: number;
  demographics?: {
    age: Record<string, number>;
    gender: Record<string, number>;
    location: Record<string, number>;
  };
  optimalPostingTimes?: {
    recommendedTimes: string[];
    hourlyActivity: Record<string, number>;
  };
}

class InstagramService {
  /**
   * Search Instagram locations for tagging
   */
  async searchLocations(accountId: string, query: string): Promise<InstagramLocation[]> {
    try {
      const response = await apiClient.get('/instagram/locations/search', {
        params: { accountId, q: query },
      });
      return response.data.locations;
    } catch (error) {
      console.error('Failed to search Instagram locations:', error);
      return [];
    }
  }

  /**
   * Search Instagram users for tagging
   */
  async searchUsers(accountId: string, query: string): Promise<InstagramUser[]> {
    try {
      const response = await apiClient.get('/instagram/users/search', {
        params: { accountId, q: query },
      });
      return response.data.users;
    } catch (error) {
      console.error('Failed to search Instagram users:', error);
      return [];
    }
  }

  /**
   * Validate media for Instagram posting
   */
  async validateMedia(
    mediaUrls: string[],
    contentType: 'feed' | 'story' | 'reel' | 'carousel',
    aspectRatio?: string
  ): Promise<MediaValidation> {
    try {
      const response = await apiClient.post('/instagram/media/validate', {
        mediaUrls,
        contentType,
        aspectRatio,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to validate Instagram media:', error);
      return {
        isValid: false,
        errors: ['Failed to validate media'],
        warnings: [],
      };
    }
  }

  /**
   * Validate hashtags count and format
   */
  async validateHashtags(content: string): Promise<HashtagValidation> {
    try {
      const response = await apiClient.post('/instagram/hashtags/validate', {
        content,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to validate hashtags:', error);
      return {
        hashtagCount: 0,
        maxHashtags: 30,
        isValid: false,
        warning: 'Failed to validate hashtags',
      };
    }
  }

  /**
   * Analyze hashtag performance
   */
  async analyzeHashtags(
    accountId: string,
    hashtags: string[],
    postId?: string
  ): Promise<HashtagPerformance[]> {
    try {
      const response = await apiClient.post('/instagram/hashtags/analyze', {
        accountId,
        hashtags,
        postId,
      });
      return response.data.performance;
    } catch (error) {
      console.error('Failed to analyze hashtag performance:', error);
      return [];
    }
  }

  /**
   * Get account insights and demographics
   */
  async getAccountInsights(
    accountId: string,
    period: 'day' | 'week' | 'days_28' = 'week'
  ): Promise<AccountInsights | null> {
    try {
      const response = await apiClient.get(`/instagram/accounts/${accountId}/insights`, {
        params: { period },
      });
      return response.data.insights;
    } catch (error) {
      console.error('Failed to get Instagram account insights:', error);
      return null;
    }
  }

  /**
   * Get optimal posting times
   */
  async getOptimalPostingTimes(accountId: string): Promise<{
    recommendedTimes: string[];
    hourlyActivity: Record<string, number>;
  } | null> {
    try {
      const response = await apiClient.get(`/instagram/accounts/${accountId}/optimal-times`);
      return response.data;
    } catch (error) {
      console.error('Failed to get optimal posting times:', error);
      return null;
    }
  }

  /**
   * Count hashtags in content (client-side utility)
   */
  countHashtags(content: string): number {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    const hashtags = content.match(hashtagRegex) || [];
    return hashtags.length;
  }

  /**
   * Extract hashtags from content (client-side utility)
   */
  extractHashtags(content: string): string[] {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return content.match(hashtagRegex) || [];
  }

  /**
   * Validate aspect ratio for content type (client-side utility)
   */
  validateAspectRatio(aspectRatio: string, contentType: 'feed' | 'story' | 'reel'): boolean {
    const supportedRatios = {
      feed: ['1:1', '4:5', '16:9'],
      story: ['9:16'],
      reel: ['9:16'],
    };

    return supportedRatios[contentType].includes(aspectRatio);
  }

  /**
   * Get recommended aspect ratios for content type
   */
  getRecommendedAspectRatios(contentType: 'feed' | 'story' | 'reel'): Array<{
    value: string;
    label: string;
    recommended?: boolean;
  }> {
    const ratios = {
      feed: [
        { value: '1:1', label: 'Square (1:1)', recommended: true },
        { value: '4:5', label: 'Portrait (4:5)' },
        { value: '16:9', label: 'Landscape (16:9)' },
      ],
      story: [
        { value: '9:16', label: 'Story (9:16)', recommended: true },
      ],
      reel: [
        { value: '9:16', label: 'Vertical (9:16)', recommended: true },
      ],
    };

    return ratios[contentType];
  }

  /**
   * Get Instagram posting limits
   */
  getLimits() {
    return {
      maxContentLength: 2200,
      maxMediaCount: 10,
      maxHashtags: 30,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
      carouselMinItems: 2,
      carouselMaxItems: 10,
    };
  }

  /**
   * Format engagement rate for display
   */
  formatEngagementRate(likes: number, comments: number, shares: number, saves: number, reach: number): string {
    if (reach === 0) return '0.0%';
    const engagement = (likes + comments + shares + saves) / reach * 100;
    return `${engagement.toFixed(1)}%`;
  }

  /**
   * Format number for display (K, M notation)
   */
  formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  /**
   * Check if content type supports multiple media
   */
  supportsMultipleMedia(contentType: 'feed' | 'story' | 'reel' | 'carousel'): boolean {
    return contentType === 'carousel';
  }

  /**
   * Check if content type supports video
   */
  supportsVideo(contentType: 'feed' | 'story' | 'reel' | 'carousel'): boolean {
    return ['story', 'reel'].includes(contentType);
  }

  /**
   * Check if content type requires video
   */
  requiresVideo(contentType: 'feed' | 'story' | 'reel' | 'carousel'): boolean {
    return contentType === 'reel';
  }

  /**
   * Get content type display name
   */
  getContentTypeDisplayName(contentType: 'feed' | 'story' | 'reel' | 'carousel'): string {
    const names = {
      feed: 'Feed Post',
      story: 'Story',
      reel: 'Reel',
      carousel: 'Carousel',
    };
    return names[contentType];
  }

  /**
   * Get content type description
   */
  getContentTypeDescription(contentType: 'feed' | 'story' | 'reel' | 'carousel'): string {
    const descriptions = {
      feed: 'Regular post that appears in followers\' feeds',
      story: 'Temporary content that disappears after 24 hours',
      reel: 'Short-form vertical video content',
      carousel: 'Multiple images or videos in a single post',
    };
    return descriptions[contentType];
  }
}

export const instagramService = new InstagramService();