/**
 * Figma Service
 * 
 * Handles Figma REST API integration for importing designs
 */

import axios from 'axios';
import { Workspace } from '../models/Workspace';
import { logger } from '../utils/logger';
import { config } from '../config';

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

export class FigmaService {
  private static readonly BASE_URL = 'https://api.figma.com/v1';
  private static readonly OAUTH_URL = 'https://www.figma.com/oauth';
  private static readonly TOKEN_URL = 'https://www.figma.com/api/oauth/token';

  // Platform-specific dimensions for social media
  private static readonly PLATFORM_SIZES = {
    'instagram-post': { width: 1080, height: 1080 },
    'instagram-story': { width: 1080, height: 1920 },
    'facebook-post': { width: 1200, height: 630 },
    'twitter-post': { width: 1200, height: 675 },
    'linkedin-post': { width: 1200, height: 627 },
  };

  /**
   * Generate Figma OAuth authorization URL
   */
  static getAuthUrl(workspaceId: string): string {
    const params = new URLSearchParams({
      client_id: config.integrations?.figma?.clientId || '',
      redirect_uri: config.integrations?.figma?.redirectUri || '',
      scope: 'files:read',
      state: workspaceId,
      response_type: 'code',
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
        client_id: config.integrations?.figma?.clientId,
        client_secret: config.integrations?.figma?.clientSecret,
        redirect_uri: config.integrations?.figma?.redirectUri,
        code,
        grant_type: 'authorization_code',
      });

      const { access_token, refresh_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get(`${this.BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const { id: userId, handle: displayName } = userResponse.data;

      // Update workspace with connection info
      await Workspace.findByIdAndUpdate(state, {
        'integrations.figma.connected': true,
        'integrations.figma.accessToken': access_token,
        'integrations.figma.refreshToken': refresh_token,
        'integrations.figma.userId': userId,
        'integrations.figma.displayName': displayName,
        'integrations.figma.connectedAt': new Date(),
      });

      logger.info('Figma account connected', {
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
      logger.error('Failed to handle Figma OAuth callback', {
        error: error.message,
        workspaceId: state,
      });
      throw new Error('Failed to connect Figma account');
    }
  }

  /**
   * Get user's files from Figma with search capability
   */
  static async getUserFiles(
    accessToken: string, 
    searchQuery?: string
  ): Promise<{
    files: FigmaFile[];
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/me/files`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let files = response.data.files.map((file: any) => ({
        key: file.key,
        name: file.name,
        thumbnailUrl: file.thumbnail_url || '',
        lastModified: file.last_modified,
      }));

      // Filter by search query if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        files = files.filter((file: FigmaFile) => 
          file.name.toLowerCase().includes(query)
        );
      }

      return { files };
    } catch (error: any) {
      logger.error('Failed to get Figma files', {
        error: error.message,
        searchQuery,
      });
      throw new Error('Failed to fetch files from Figma');
    }
  }

  /**
   * Get pages from a Figma file
   */
  static async getFilePages(
    accessToken: string,
    fileKey: string
  ): Promise<{
    pages: FigmaPage[];
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/files/${fileKey}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          depth: 1, // Only get top-level pages
        },
      });

      const pages = response.data.document.children
        .filter((node: any) => node.type === 'CANVAS')
        .map((page: any) => ({
          id: page.id,
          name: page.name,
          type: page.type,
        }));

      return { pages };
    } catch (error: any) {
      logger.error('Failed to get Figma file pages', {
        error: error.message,
        fileKey,
      });
      throw new Error('Failed to fetch pages from Figma file');
    }
  }

  /**
   * Get frames from a Figma file with enhanced metadata and thumbnails
   */
  static async getFileFrames(
    accessToken: string,
    fileKey: string,
    pageId?: string
  ): Promise<{
    frames: FigmaFrame[];
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/files/${fileKey}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const frames: FigmaFrame[] = [];
      
      // Recursively find all frames in the document
      const findFrames = (node: any, currentPageId?: string, currentPageName?: string) => {
        if (node.type === 'CANVAS') {
          // This is a page, update context
          currentPageId = node.id;
          currentPageName = node.name;
        } else if (node.type === 'FRAME') {
          // Skip if filtering by page and this frame is not on the target page
          if (pageId && currentPageId !== pageId) {
            return;
          }

          frames.push({
            id: node.id,
            name: node.name,
            thumbnailUrl: '', // Will be populated by separate API call
            pageId: currentPageId,
            pageName: currentPageName,
            absoluteBoundingBox: node.absoluteBoundingBox,
          });
        }
        
        if (node.children) {
          node.children.forEach((child: any) => 
            findFrames(child, currentPageId, currentPageName)
          );
        }
      };

      response.data.document.children.forEach((page: any) => findFrames(page));

      // Get thumbnails for frames if we have any
      if (frames.length > 0) {
        try {
          const frameIds = frames.map(f => f.id).join(',');
          const thumbnailResponse = await axios.get(
            `${this.BASE_URL}/images/${fileKey}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              params: {
                ids: frameIds,
                format: 'png',
                scale: 0.5, // Smaller scale for thumbnails
              },
            }
          );

          // Update frames with thumbnail URLs
          frames.forEach(frame => {
            const thumbnailUrl = thumbnailResponse.data.images[frame.id];
            if (thumbnailUrl) {
              frame.thumbnailUrl = thumbnailUrl;
            }
          });
        } catch (thumbnailError) {
          logger.warn('Failed to get frame thumbnails', {
            error: thumbnailError,
            fileKey,
          });
          // Continue without thumbnails
        }
      }

      return { frames };
    } catch (error: any) {
      logger.error('Failed to get Figma file frames', {
        error: error.message,
        fileKey,
        pageId,
      });
      throw new Error('Failed to fetch frames from Figma file');
    }
  }

  /**
   * Export a frame with advanced options
   */
  static async exportFrame(
    accessToken: string,
    fileKey: string,
    nodeId: string,
    options: FigmaExportOptions = { format: 'png', scale: 2 }
  ): Promise<{ url: string }> {
    try {
      const params = new URLSearchParams({
        ids: nodeId,
        format: options.format.toUpperCase(),
        scale: options.scale.toString(),
      });

      // Handle platform-specific sizing
      if (options.platformSize && options.platformSize !== 'custom') {
        const dimensions = this.PLATFORM_SIZES[options.platformSize];
        if (dimensions) {
          // For platform sizes, we'll use a higher scale and let the client resize
          params.set('scale', '2');
        }
      }

      const response = await axios.get(
        `${this.BASE_URL}/images/${fileKey}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const imageUrl = response.data.images[nodeId];
      
      if (!imageUrl) {
        throw new Error('No image URL returned from Figma');
      }

      return { url: imageUrl };
    } catch (error: any) {
      logger.error('Failed to export Figma frame', {
        error: error.message,
        fileKey,
        nodeId,
        options,
      });
      throw new Error('Failed to export frame from Figma');
    }
  }

  /**
   * Get recently accessed files for a workspace
   */
  static async getRecentFiles(
    accessToken: string,
    limit: number = 10
  ): Promise<{
    files: FigmaFile[];
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/me/files`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Sort by last modified and limit
      const files = response.data.files
        .map((file: any) => ({
          key: file.key,
          name: file.name,
          thumbnailUrl: file.thumbnail_url || '',
          lastModified: file.last_modified,
        }))
        .sort((a: FigmaFile, b: FigmaFile) => 
          new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        )
        .slice(0, limit);

      return { files };
    } catch (error: any) {
      logger.error('Failed to get recent Figma files', {
        error: error.message,
        limit,
      });
      throw new Error('Failed to fetch recent files from Figma');
    }
  }

  /**
   * Validate Personal Access Token
   */
  static async validatePersonalAccessToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    displayName?: string;
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/me`, {
        headers: {
          'X-Figma-Token': token,
        },
      });

      return {
        valid: true,
        userId: response.data.id,
        displayName: response.data.handle,
      };
    } catch (error: any) {
      logger.error('Failed to validate Figma personal access token', {
        error: error.message,
      });
      return { valid: false };
    }
  }

  /**
   * Connect using Personal Access Token
   */
  static async connectWithPersonalToken(
    workspaceId: string,
    token: string
  ): Promise<{
    userId: string;
    displayName: string;
  }> {
    try {
      const validation = await this.validatePersonalAccessToken(token);
      
      if (!validation.valid || !validation.userId || !validation.displayName) {
        throw new Error('Invalid personal access token');
      }

      // Update workspace with connection info
      await Workspace.findByIdAndUpdate(workspaceId, {
        'integrations.figma.connected': true,
        'integrations.figma.accessToken': token,
        'integrations.figma.userId': validation.userId,
        'integrations.figma.displayName': validation.displayName,
        'integrations.figma.connectedAt': new Date(),
        'integrations.figma.connectionType': 'personal_token',
      });

      logger.info('Figma account connected with personal token', {
        workspaceId,
        userId: validation.userId,
        displayName: validation.displayName,
      });

      return {
        userId: validation.userId,
        displayName: validation.displayName,
      };
    } catch (error: any) {
      logger.error('Failed to connect Figma with personal token', {
        error: error.message,
        workspaceId,
      });
      throw new Error('Failed to connect with personal access token');
    }
  }

  /**
   * Disconnect Figma integration
   */
  static async disconnectFigma(workspaceId: string): Promise<void> {
    try {
      await Workspace.findByIdAndUpdate(workspaceId, {
        'integrations.figma.connected': false,
        'integrations.figma.accessToken': undefined,
        'integrations.figma.refreshToken': undefined,
        'integrations.figma.userId': undefined,
        'integrations.figma.displayName': undefined,
        'integrations.figma.connectedAt': undefined,
      });

      logger.info('Figma account disconnected', {
        workspaceId,
      });
    } catch (error: any) {
      logger.error('Failed to disconnect Figma account', {
        error: error.message,
        workspaceId,
      });
      throw new Error('Failed to disconnect Figma account');
    }
  }
}