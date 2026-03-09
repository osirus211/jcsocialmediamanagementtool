import { apiClient } from '@/lib/api-client';

export interface ShortLink {
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  clicks: number;
  platform?: string;
  postId?: string;
  createdAt: string;
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

export interface LinksResponse {
  success: boolean;
  links: ShortLink[];
  total: number;
  page: number;
  totalPages: number;
}

class LinkService {
  async shortenUrl(originalUrl: string, postId?: string, platform?: string): Promise<ShortLink> {
    const response = await apiClient.post<{ success: boolean; data: ShortLink }>(
      '/links/shorten',
      { originalUrl, postId, platform }
    );
    return response.data;
  }

  async getLinks(page: number = 1, limit: number = 20): Promise<LinksResponse> {
    const response = await apiClient.get<LinksResponse>(
      `/links?page=${page}&limit=${limit}`
    );
    return response;
  }

  async getLinkStats(shortCode: string): Promise<LinkStats> {
    const response = await apiClient.get<{ success: boolean; data: LinkStats }>(
      `/links/${shortCode}/stats`
    );
    return response.data;
  }

  async deleteLink(shortCode: string): Promise<void> {
    await apiClient.delete(`/links/${shortCode}`);
  }
}

export const linkService = new LinkService();
