/**
 * Canva Service
 * 
 * Handles Canva Connect API integration for importing designs
 */

import axios from 'axios';
import { Workspace } from '../models/Workspace';
import { logger } from '../utils/logger';
import { config } from '../config';

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
  exportUrl?: string;
  jobId: string;
  status: 'pending' | 'completed' | 'failed';
  url?: string;
}

export interface CanvaDesignType {
  type: 'preset' | 'custom';
  name?: string;
  width?: number;
  height?: number;
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

export class CanvaService {
  private static readonly BASE_URL = 'https://api.canva.com/rest/v1';
  private static readonly OAUTH_URL = 'https://www.canva.com/api/oauth/authorize';
  private static readonly TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

  /**
   * Generate Canva OAuth authorization URL
   */
  static getAuthUrl(workspaceId: string): string {
    const params = new URLSearchParams({
      client_id: config.integrations?.canva?.clientId || '',
      redirect_uri: config.integrations?.canva?.redirectUri || '',
      response_type: 'code',
      scope: 'design:read design:content:read design:content:write',
      state: workspaceId,
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  static async handleCallback(code: string, state: string): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
    displayName: string;
  }> {
    try {
      // Exchange code for tokens
      const tokenResponse = await axios.post(this.TOKEN_URL, {
        grant_type: 'authorization_code',
        client_id: config.integrations?.canva?.clientId,
        client_secret: config.integrations?.canva?.clientSecret,
        code,
        redirect_uri: config.integrations?.canva?.redirectUri,
      });

      const { access_token, refresh_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get(`${this.BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const { id: userId, display_name: displayName } = userResponse.data;

      // Update workspace with connection info
      await Workspace.findByIdAndUpdate(state, {
        'integrations.canva.connected': true,
        'integrations.canva.accessToken': access_token,
        'integrations.canva.refreshToken': refresh_token,
        'integrations.canva.userId': userId,
        'integrations.canva.displayName': displayName,
        'integrations.canva.connectedAt': new Date(),
      });

      logger.info('Canva account connected', {
        workspaceId: state,
        userId,
        displayName,
      });

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        userId,
        displayName,
      };
    } catch (error: any) {
      logger.error('Failed to handle Canva OAuth callback', {
        error: error.message,
        workspaceId: state,
      });
      throw new Error('Failed to connect Canva account');
    }
  }

  /**
   * Get user's designs from Canva
   */
  static async getUserDesigns(
    accessToken: string,
    page?: string,
    query?: string
  ): Promise<{
    designs: CanvaDesign[];
    nextPage?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (page) params.append('continuation', page);
      if (query) params.append('query', query);

      const response = await axios.get(`${this.BASE_URL}/designs`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params,
      });

      const designs = response.data.items.map((design: any) => ({
        id: design.id,
        title: design.title,
        thumbnailUrl: design.thumbnail?.url || '',
        updatedAt: design.updated_at,
        urls: {
          editUrl: design.urls?.edit_url || '',
          viewUrl: design.urls?.view_url || '',
        },
      }));

      return {
        designs,
        nextPage: response.data.continuation,
      };
    } catch (error: any) {
      logger.error('Failed to get Canva designs', {
        error: error.message,
      });
      throw new Error('Failed to fetch designs from Canva');
    }
  }

  /**
   * Export a design as PNG or JPG
   */
  static async exportDesign(
    accessToken: string,
    designId: string,
    format: 'png' | 'jpg' = 'png'
  ): Promise<CanvaExportJob> {
    try {
      const response = await axios.post(
        `${this.BASE_URL}/designs/${designId}/export`,
        {
          format: {
            type: format.toUpperCase(),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        jobId: response.data.job.id,
        status: response.data.job.status,
        url: response.data.job.url,
      };
    } catch (error: any) {
      logger.error('Failed to export Canva design', {
        error: error.message,
        designId,
        format,
      });
      throw new Error('Failed to export design from Canva');
    }
  }

  /**
   * Get export job status
   */
  static async getExportStatus(
    accessToken: string,
    jobId: string
  ): Promise<CanvaExportJob> {
    try {
      const response = await axios.get(`${this.BASE_URL}/exports/${jobId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        jobId,
        status: response.data.job.status,
        url: response.data.job.url,
      };
    } catch (error: any) {
      logger.error('Failed to get Canva export status', {
        error: error.message,
        jobId,
      });
      throw new Error('Failed to get export status from Canva');
    }
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const response = await axios.post(this.TOKEN_URL, {
        grant_type: 'refresh_token',
        client_id: config.integrations?.canva?.clientId,
        client_secret: config.integrations?.canva?.clientSecret,
        refresh_token: refreshToken,
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
      };
    } catch (error: any) {
      logger.error('Failed to refresh Canva access token', {
        error: error.message,
      });
      throw new Error('Failed to refresh Canva access token');
    }
  }

  /**
   * Create a new Canva design
   */
  static async createDesign(
    accessToken: string,
    designType: CanvaDesignType,
    title?: string
  ): Promise<CanvaCreateDesignResponse> {
    try {
      const payload: any = {
        design_type: designType,
      };

      if (title) {
        payload.title = title;
      }

      const response = await axios.post(
        `${this.BASE_URL}/designs`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const design = response.data.design;

      return {
        id: design.id,
        title: design.title,
        urls: {
          editUrl: design.urls.edit_url,
          viewUrl: design.urls.view_url,
        },
        createdAt: design.created_at,
        updatedAt: design.updated_at,
      };
    } catch (error: any) {
      logger.error('Failed to create Canva design', {
        error: error.message,
        designType,
        title,
      });
      throw new Error('Failed to create design in Canva');
    }
  }

  /**
   * Get platform-specific design dimensions
   */
  static getPlatformDimensions(platform: string): { width: number; height: number } {
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
  }

  /**
   * Create platform-specific design
   */
  static async createPlatformDesign(
    accessToken: string,
    platform: string,
    title?: string
  ): Promise<CanvaCreateDesignResponse> {
    const dimensions = this.getPlatformDimensions(platform);
    
    const designType: CanvaDesignType = {
      type: 'custom',
      width: dimensions.width,
      height: dimensions.height,
    };

    const designTitle = title || `${platform.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Design`;

    return this.createDesign(accessToken, designType, designTitle);
  }
  static async disconnectCanva(workspaceId: string): Promise<void> {
    try {
      await Workspace.findByIdAndUpdate(workspaceId, {
        'integrations.canva.connected': false,
        'integrations.canva.accessToken': undefined,
        'integrations.canva.refreshToken': undefined,
        'integrations.canva.userId': undefined,
        'integrations.canva.displayName': undefined,
        'integrations.canva.connectedAt': undefined,
      });

      logger.info('Canva account disconnected', {
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Failed to disconnect Canva account', {
        error: error.message,
        workspaceId,
      });
      throw new Error('Failed to disconnect Canva account');
    }
  }
}