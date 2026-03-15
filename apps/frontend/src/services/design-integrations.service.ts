/**
 * Design Integrations Service
 * 
 * API integration for Canva and Figma design imports
 */

import { apiClient } from '@/lib/api-client';

// Canva Types
export interface CanvaDesign {
  id: string;
  title: string;
  thumbnailUrl: string;
  updatedAt: string;
  urls: {
    editUrl: string;
    viewUrl: string;
  };
}

export interface CanvaExportJob {
  jobId: string;
  status: 'pending' | 'completed' | 'failed';
  url?: string;
}

export interface CanvaCreateDesignResponse {
  id: string;
  title: string;
  urls: {
    editUrl: string;
    viewUrl: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CanvaDesignType {
  type: 'preset' | 'custom';
  name?: string;
  width?: number;
  height?: number;
}

// Figma Types
export interface FigmaFile {
  key: string;
  name: string;
  thumbnailUrl: string;
  lastModified: string;
}

export interface FigmaPage {
  id: string;
  name: string;
  type: string;
}

export interface FigmaFrame {
  id: string;
  name: string;
  thumbnailUrl: string;
  pageId?: string;
  pageName?: string;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FigmaExportOptions {
  format: 'png' | 'jpg' | 'svg' | 'pdf';
  scale: 1 | 2 | 3;
  platformSize?: 'instagram-post' | 'instagram-story' | 'facebook-post' | 'twitter-post' | 'linkedin-post' | 'custom';
  customWidth?: number;
  customHeight?: number;
}

export const designIntegrationsService = {
  // ============================================
  // CANVA METHODS
  // ============================================

  /**
   * Get Canva OAuth authorization URL
   */
  async getCanvaAuthUrl(): Promise<string> {
    const response = await apiClient.get('/design-integrations/canva/auth-url');
    return response.authUrl;
  },

  /**
   * Get user's Canva designs
   */
  async getCanvaDesigns(page?: string, query?: string): Promise<{
    designs: CanvaDesign[];
    nextPage?: string;
  }> {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (query) params.append('query', query);

    const response = await apiClient.get(`/design-integrations/canva/designs?${params.toString()}`);
    return response.data;
  },

  /**
   * Export a Canva design
   */
  async exportCanvaDesign(designId: string, format: 'png' | 'jpg' = 'png'): Promise<CanvaExportJob> {
    const response = await apiClient.post('/design-integrations/canva/export', {
      designId,
      format,
    });
    return response.data;
  },

  /**
   * Get Canva export job status
   */
  async getCanvaExportStatus(jobId: string): Promise<CanvaExportJob> {
    const response = await apiClient.get(`/design-integrations/canva/export/${jobId}`);
    return response.data;
  },

  /**
   * Create a new Canva design
   */
  async createCanvaDesign(
    platform?: string,
    title?: string,
    designType?: CanvaDesignType
  ): Promise<CanvaCreateDesignResponse> {
    const response = await apiClient.post('/design-integrations/canva/create', {
      platform,
      title,
      designType,
    });
    return response.data;
  },

  /**
   * Get platform-specific design dimensions
   */
  getPlatformDimensions(platform: string): { width: number; height: number } {
    const dimensions: Record<string, { width: number; height: number }> = {
      'instagram-post': { width: 1080, height: 1080 },
      'instagram-story': { width: 1080, height: 1920 },
      'facebook-post': { width: 1200, height: 630 },
      'twitter-post': { width: 1200, height: 675 },
      'linkedin-post': { width: 1200, height: 627 },
      'pinterest-pin': { width: 1000, height: 1500 },
      'youtube-thumbnail': { width: 1280, height: 720 },
    };

    return dimensions[platform] || { width: 1080, height: 1080 };
  },

  /**
   * Get available export formats for Figma
   */
  getFigmaExportFormats(): Array<{ value: string; label: string }> {
    return [
      { value: 'png', label: 'PNG' },
      { value: 'jpg', label: 'JPG' },
      { value: 'svg', label: 'SVG' },
      { value: 'pdf', label: 'PDF' },
    ];
  },

  /**
   * Get available export scales
   */
  getExportScales(): Array<{ value: number; label: string }> {
    return [
      { value: 1, label: '1x' },
      { value: 2, label: '2x' },
      { value: 3, label: '3x' },
    ];
  },

  /**
   * Get platform-specific export sizes
   */
  getPlatformSizes(): Array<{ value: string; label: string; dimensions: string }> {
    return [
      { value: 'instagram-post', label: 'Instagram Post', dimensions: '1080×1080' },
      { value: 'instagram-story', label: 'Instagram Story', dimensions: '1080×1920' },
      { value: 'facebook-post', label: 'Facebook Post', dimensions: '1200×630' },
      { value: 'twitter-post', label: 'Twitter Post', dimensions: '1200×675' },
      { value: 'linkedin-post', label: 'LinkedIn Post', dimensions: '1200×627' },
      { value: 'custom', label: 'Custom Size', dimensions: 'Custom' },
    ];
  },

  /**
   * Disconnect Canva integration
   */
  async disconnectCanva(): Promise<void> {
    await apiClient.delete('/design-integrations/canva/disconnect');
  },

  // ============================================
  // FIGMA METHODS
  // ============================================

  /**
   * Get Figma OAuth authorization URL
   */
  async getFigmaAuthUrl(): Promise<string> {
    const response = await apiClient.get('/design-integrations/figma/auth-url');
    return response.authUrl;
  },

  /**
   * Get user's Figma files with optional search
   */
  async getFigmaFiles(searchQuery?: string): Promise<{
    files: FigmaFile[];
  }> {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);

    const response = await apiClient.get(`/design-integrations/figma/files?${params.toString()}`);
    return response.data;
  },

  /**
   * Get recently accessed Figma files
   */
  async getFigmaRecentFiles(limit?: number): Promise<{
    files: FigmaFile[];
  }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await apiClient.get(`/design-integrations/figma/files/recent?${params.toString()}`);
    return response.data;
  },

  /**
   * Get pages from a Figma file
   */
  async getFigmaPages(fileKey: string): Promise<{
    pages: FigmaPage[];
  }> {
    const response = await apiClient.get(`/design-integrations/figma/files/${fileKey}/pages`);
    return response.data;
  },

  /**
   * Get frames from a Figma file with optional page filtering
   */
  async getFigmaFrames(fileKey: string, pageId?: string): Promise<{
    frames: FigmaFrame[];
  }> {
    const params = new URLSearchParams();
    if (pageId) params.append('pageId', pageId);

    const response = await apiClient.get(`/design-integrations/figma/files/${fileKey}/frames?${params.toString()}`);
    return response.data;
  },

  /**
   * Export a Figma frame with advanced options
   */
  async exportFigmaFrame(
    fileKey: string,
    nodeId: string,
    options: FigmaExportOptions = { format: 'png', scale: 2 }
  ): Promise<{ url: string }> {
    const response = await apiClient.post('/design-integrations/figma/export', {
      fileKey,
      nodeId,
      ...options,
    });
    return response.data;
  },

  /**
   * Connect Figma using Personal Access Token
   */
  async connectFigmaWithToken(token: string): Promise<{
    userId: string;
    displayName: string;
  }> {
    const response = await apiClient.post('/design-integrations/figma/connect-token', {
      token,
    });
    return response.data;
  },

  /**
   * Disconnect Figma integration
   */
  async disconnectFigma(): Promise<void> {
    await apiClient.delete('/design-integrations/figma/disconnect');
  },

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Download image from URL and convert to File object
   */
  async downloadImageAsFile(url: string, filename: string): Promise<File> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      console.error('Failed to download image:', error);
      throw new Error('Failed to download image');
    }
  },
};