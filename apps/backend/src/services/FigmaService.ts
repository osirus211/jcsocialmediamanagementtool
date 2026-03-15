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

export interface FigmaFrame {
  id: string;
  name: string;
  thumbnailUrl: string;
}

export class FigmaService {
  private static readonly BASE_URL = 'https://api.figma.com/v1';
  private static readonly OAUTH_URL = 'https://www.figma.com/oauth';
  private static readonly TOKEN_URL = 'https://www.figma.com/api/oauth/token';

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
   * Get user's files from Figma
   */
  static async getUserFiles(accessToken: string): Promise<{
    files: FigmaFile[];
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/me/files`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const files = response.data.files.map((file: any) => ({
        key: file.key,
        name: file.name,
        thumbnailUrl: file.thumbnail_url || '',
        lastModified: file.last_modified,
      }));

      return { files };
    } catch (error: any) {
      logger.error('Failed to get Figma files', {
        error: error.message,
      });
      throw new Error('Failed to fetch files from Figma');
    }
  }

  /**
   * Get frames from a Figma file
   */
  static async getFileFrames(
    accessToken: string,
    fileKey: string
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
      const findFrames = (node: any) => {
        if (node.type === 'FRAME') {
          frames.push({
            id: node.id,
            name: node.name,
            thumbnailUrl: '', // Will be populated by separate API call if needed
          });
        }
        
        if (node.children) {
          node.children.forEach(findFrames);
        }
      };

      response.data.document.children.forEach(findFrames);

      return { frames };
    } catch (error: any) {
      logger.error('Failed to get Figma file frames', {
        error: error.message,
        fileKey,
      });
      throw new Error('Failed to fetch frames from Figma file');
    }
  }

  /**
   * Export a frame as PNG or JPG
   */
  static async exportFrame(
    accessToken: string,
    fileKey: string,
    nodeId: string,
    format: 'png' | 'jpg' = 'png'
  ): Promise<{ url: string }> {
    try {
      const params = new URLSearchParams({
        ids: nodeId,
        format: format.toUpperCase(),
        scale: '2', // 2x resolution for better quality
      });

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
        format,
      });
      throw new Error('Failed to export frame from Figma');
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