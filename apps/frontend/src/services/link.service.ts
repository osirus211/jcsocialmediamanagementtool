import { apiClient } from '@/lib/api-client';

export interface ShortLinkOptions {
  postId?: string;
  platform?: string;
  expiresAt?: string;
  customDomain?: string;
  title?: string;
  tags?: string[];
  password?: string;
  useBitly?: boolean;
  bitlyAccessToken?: string;
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
  title?: string;
  tags?: string[];
  isActive: boolean;
  useBitly?: boolean;
  bitlyUrl?: string;
  password?: string;
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

export interface BulkShortenResult {
  original: string;
  shortened: string;
  id: string;
  error?: string;
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
   * Bulk shorten URLs
   */
  async bulkShortenUrls(urls: string[], options?: Omit<ShortLinkOptions, 'postId'>): Promise<{
    results: BulkShortenResult[];
    total: number;
    successful: number;
    failed: number;
  }> {
    const response = await apiClient.post('/links/bulk', {
      urls,
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
   * Get link analytics
   */
  async getLinkAnalytics(shortCode: string, dateFrom?: string, dateTo?: string): Promise<any> {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    
    const response = await apiClient.get(`/links/${shortCode}/analytics?${params.toString()}`);
    return response.data;
  }

  /**
   * Get workspace links
   */
  async getLinks(page: number = 1, limit: number = 20, filters?: {
    search?: string;
    platform?: string;
    status?: 'active' | 'inactive' | 'expired';
    dateFrom?: string;
    dateTo?: string;
  }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters?.search) params.append('search', filters.search);
    if (filters?.platform) params.append('platform', filters.platform);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);

    const response = await apiClient.get(`/links?${params.toString()}`);
    return response;
  }

  /**
   * Update a link
   */
  async updateLink(shortCode: string, updates: {
    originalUrl?: string;
    title?: string;
    tags?: string[];
    password?: string;
    expiresAt?: string;
    isActive?: boolean;
  }): Promise<ShortLink> {
    const response = await apiClient.patch(`/links/${shortCode}`, updates);
    return response.data;
  }

  /**
   * Toggle link status
   */
  async toggleLink(shortCode: string): Promise<{ shortCode: string; isActive: boolean }> {
    const response = await apiClient.patch(`/links/${shortCode}/toggle`);
    return response.data;
  }

  /**
   * Delete a link
   */
  async deleteLink(shortCode: string): Promise<void> {
    await apiClient.delete(`/links/${shortCode}`);
  }

  /**
   * Get QR code for link
   */
  async getQRCode(shortCode: string, format: 'png' | 'svg' = 'png', size: number = 256): Promise<{
    qrCode: string;
    shortUrl: string;
    format: string;
  }> {
    const response = await apiClient.get(`/links/${shortCode}/qr-code?format=${format}&size=${size}`);
    return response.data;
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