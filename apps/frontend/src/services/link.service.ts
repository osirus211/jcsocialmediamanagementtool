import { apiClient } from '@/lib/api-client';

export interface ShortLinkOptions {
  postId?: string;
  platform?: string;
  expiresAt?: string;
  customDomain?: string;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface ShortLink {
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  clicks: number;
  createdAt: string;
  platform?: string;
  postId?: string;
  expiresAt?: string;
}

export interface LinkStats {
  shortCode: string;
  originalUrl: string;
  clicks: number;
  clickHistory: Array<{
    clickedAt: string;
    userAgent?: string;
    referrer?: string;
  }>;
  createdAt: string;
}

export class LinkService {
  /**
   * Shorten a URL
   */
  async shortenUrl(originalUrl: string, options?: ShortLinkOptions): Promise<ShortLink> {
    const response = await apiClient.post('/links/shorten', {
      originalUrl,
      ...options,
    });
    return response.data;
  }

  /**
   * Get link statistics
   */
  async getLinkStats(shortCode: string): Promise<LinkStats> {
    const response = await apiClient.get(`/links/${shortCode}/stats`);
    return response.data;
  }

  /**
   * Get workspace links
   */
  async getLinks(page: number = 1, limit: number = 20) {
    const response = await apiClient.get(`/links?page=${page}&limit=${limit}`);
    return response;
  }

  /**
   * Delete a link
   */
  async deleteLink(shortCode: string): Promise<void> {
    await apiClient.delete(`/links/${shortCode}`);
  }

  /**
   * Get link preview
   */
  async getLinkPreview(url: string) {
    const response = await apiClient.post('/link-preview', { url });
    return response.data;
  }

  /**
   * Get batch link previews
   */
  async getBatchLinkPreviews(urls: string[]) {
    const response = await apiClient.post('/link-preview/batch', { urls });
    return response.data;
  }

  /**
   * Extract URLs from content
   */
  async extractUrls(content: string) {
    const response = await apiClient.post('/link-preview/extract', { content });
    return response.data.urls;
  }
}

export const linkService = new LinkService();