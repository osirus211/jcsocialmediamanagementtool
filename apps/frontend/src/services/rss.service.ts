/**
 * RSS Service
 * Frontend service for RSS feed management
 */

import { apiClient } from '@/lib/api-client';

export interface RSSFeed {
  _id: string;
  workspaceId: string;
  name: string;
  feedUrl: string;
  pollingInterval: number;
  lastFetchedAt?: Date;
  enabled: boolean;
  failureCount: number;
  lastError?: string;
  keywordsInclude: string[];
  keywordsExclude: string[];
  targetPlatforms: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface RSSFeedItem {
  _id: string;
  workspaceId: string;
  feedId: string;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pubDate?: Date;
  author?: string;
  content?: string;
  categories?: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export interface CreateFeedInput {
  name: string;
  url: string;
  pollingInterval?: number;
  enabled?: boolean;
  keywordsInclude?: string[];
  keywordsExclude?: string[];
  targetPlatforms?: string[];
}

export interface UpdateFeedInput {
  name?: string;
  feedUrl?: string;
  pollingInterval?: number;
  enabled?: boolean;
  keywordsInclude?: string[];
  keywordsExclude?: string[];
  targetPlatforms?: string[];
}

export interface ConvertToDraftInput {
  platforms: string[];
  aiEnhance?: boolean;
  tone?: 'professional' | 'casual' | 'friendly' | 'viral' | 'marketing' | 'humorous' | 'inspirational';
}

class RSSService {
  /**
   * Get all RSS feeds
   */
  async getFeeds(): Promise<RSSFeed[]> {
    const response = await apiClient.get('/rss-feeds');
    return response.data.feeds || response.data;
  }

  /**
   * Add new RSS feed
   */
  async addFeed(input: CreateFeedInput): Promise<RSSFeed> {
    const response = await apiClient.post('/rss-feeds', input);
    return response.data.feed || response.data;
  }

  /**
   * Update RSS feed
   */
  async updateFeed(id: string, updates: UpdateFeedInput): Promise<RSSFeed> {
    const response = await apiClient.put(`/rss-feeds/${id}`, updates);
    return response.data.feed || response.data;
  }

  /**
   * Delete RSS feed
   */
  async deleteFeed(id: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/rss-feeds/${id}`);
    return response.data;
  }

  /**
   * Get feed items with pagination
   */
  async getFeedItems(feedId: string, page = 1, limit = 20, status?: 'pending' | 'approved' | 'rejected'): Promise<{
    items: RSSFeedItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const params: any = { page, limit };
    if (status) {
      params.status = status;
    }

    const response = await apiClient.get(`/rss-feeds/${feedId}/items`, { params });
    return {
      items: response.data.items || [],
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || page,
      limit: response.data.pagination?.limit || limit,
      totalPages: response.data.pagination?.totalPages || 0,
    };
  }

  /**
   * Convert RSS item to draft post
   */
  async convertToDraft(itemId: string, input: ConvertToDraftInput): Promise<{
    draft: any;
    message: string;
  }> {
    const response = await apiClient.post(`/rss-feeds/items/${itemId}/convert-to-draft`, input);
    return response.data;
  }

  /**
   * Refresh RSS feed (manual poll)
   */
  async refreshFeed(feedId: string): Promise<{ success: boolean; message: string; newItems?: number }> {
    try {
      const response = await apiClient.post(`/rss-feeds/${feedId}/fetch`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pending articles across workspace
   */
  async getPendingArticles(page = 1, limit = 20): Promise<{
    articles: RSSFeedItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await apiClient.get('/rss/articles', {
      params: { page, limit }
    });
    return {
      articles: response.data.articles || [],
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || page,
      limit: response.data.pagination?.limit || limit,
      totalPages: response.data.pagination?.totalPages || 0,
    };
  }

  /**
   * Approve or reject an article
   */
  async updateArticleStatus(articleId: string, status: 'approved' | 'rejected'): Promise<{
    article: RSSFeedItem;
    draft?: any;
    message: string;
  }> {
    const response = await apiClient.patch(`/rss/articles/${articleId}`, { status });
    return response.data;
  }

  /**
   * Bulk approve or reject articles
   */
  async bulkUpdateArticleStatus(articleIds: string[], status: 'approved' | 'rejected'): Promise<{
    message: string;
    updatedCount: number;
    draftsCreated?: number;
  }> {
    const response = await apiClient.post('/rss/articles/bulk', {
      ids: articleIds,
      status
    });
    return response.data;
  }

  /**
   * Check for duplicate feed URL
   */
  async checkDuplicateFeed(url: string): Promise<{ exists: boolean; feedName?: string }> {
    try {
      const feeds = await this.getFeeds();
      const existingFeed = feeds.find(feed => feed.feedUrl === url);
      return {
        exists: !!existingFeed,
        feedName: existingFeed?.name
      };
    } catch (error) {
      return { exists: false };
    }
  }
}

export const rssService = new RSSService();