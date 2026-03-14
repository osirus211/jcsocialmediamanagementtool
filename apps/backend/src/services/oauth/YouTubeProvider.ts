/**
 * YouTube OAuth Provider - MINIMAL
 * 
 * Implements OAuth 2.0 for YouTube - connection only
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Channel information retrieval
 * - Token refresh
 * 
 * Scope: youtube.readonly (read-only access)
 */

import axios from 'axios';
import {
  OAuthProvider,
  OAuthTokens,
  OAuthUserProfile,
  OAuthAuthorizationUrl,
  OAuthCallbackParams,
  OAuthRefreshParams,
} from './OAuthProvider';
import { logger } from '../../utils/logger';

export class YouTubeProvider extends OAuthProvider {
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly apiBaseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    // Full YouTube scopes for publishing and analytics
    const scopes = [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/youtubepartner'
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'youtube';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    try {
      const state = this.generateState();

      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: this.scopes.join(' '),
        state,
        access_type: 'offline', // Request refresh token
        prompt: 'consent', // Force consent to get refresh token
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated YouTube OAuth URL', {
        state: state.substring(0, 10) + '...',
        provider: 'YouTubeProvider',
      });

      return { url, state };
    } catch (error: any) {
      logger.error('YouTube OAuth URL generation failed', {
        error: error.message,
        provider: 'YouTubeProvider',
      });
      throw new Error(`Failed to generate YouTube OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      logger.debug('Exchanging code for YouTube token', {
        step: 'token-exchange',
        provider: 'YouTubeProvider',
      });

      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          code: params.code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;
      const expiresIn = response.data.expires_in || 3600;

      if (!accessToken) {
        throw new Error('No access token received from YouTube API');
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('YouTube token obtained', {
        hasRefreshToken: !!refreshToken,
        expiresIn,
        expiresAt: expiresAt.toISOString(),
        provider: 'YouTubeProvider',
      });

      return {
        accessToken,
        refreshToken,
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('YouTube token exchange failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'YouTubeProvider',
      });

      const errorMessage =
        error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message;
      throw new Error(`YouTube token exchange failed: ${errorMessage}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      logger.debug('Refreshing YouTube token', {
        step: 'token-refresh',
        provider: 'YouTubeProvider',
      });

      if (!params.refreshToken) {
        throw new Error('Refresh token is required');
      }

      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          refresh_token: params.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const newAccessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;

      if (!newAccessToken) {
        throw new Error('No access token received from YouTube API');
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('YouTube token refreshed', {
        expiresIn,
        expiresAt: expiresAt.toISOString(),
        provider: 'YouTubeProvider',
      });

      return {
        accessToken: newAccessToken,
        refreshToken: params.refreshToken, // Keep existing refresh token
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('YouTube token refresh failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'YouTubeProvider',
      });

      const errorMessage =
        error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message;
      throw new Error(`YouTube token refresh failed: ${errorMessage}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      logger.debug('Fetching YouTube channel info', {
        step: 'profile-fetch',
        provider: 'YouTubeProvider',
      });

      const response = await axios.get(`${this.apiBaseUrl}/channels`, {
        params: {
          part: 'snippet,statistics,brandingSettings',
          mine: 'true',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const channels = response.data.items;

      if (!channels || channels.length === 0) {
        throw new Error('No YouTube channel found for this account');
      }

      const channel = channels[0];
      const snippet = channel.snippet;
      const statistics = channel.statistics || {};
      const branding = channel.brandingSettings || {};

      logger.info('YouTube channel info fetched', {
        channelId: channel.id,
        channelTitle: snippet.title,
        subscriberCount: statistics.subscriberCount,
        videoCount: statistics.videoCount,
        provider: 'YouTubeProvider',
      });

      return {
        id: channel.id,
        username: snippet.customUrl || channel.id,
        displayName: snippet.title,
        profileUrl: `https://youtube.com/channel/${channel.id}`,
        avatarUrl: snippet.thumbnails?.default?.url,
        metadata: {
          platform: 'youtube',
          channelId: channel.id,
          channelTitle: snippet.title,
          channelDescription: snippet.description,
          channelThumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
          subscriberCount: statistics.subscriberCount,
          videoCount: statistics.videoCount,
          viewCount: statistics.viewCount,
          customUrl: snippet.customUrl,
          country: snippet.country,
          defaultLanguage: snippet.defaultLanguage,
          isVerified: branding.channel?.moderateComments === false, // Approximation
        },
      };
    } catch (error: any) {
      logger.error('YouTube channel info fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'YouTubeProvider',
      });

      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        error.message;
      throw new Error(`Failed to fetch YouTube channel info: ${errorMessage}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await axios.post(
        'https://oauth2.googleapis.com/revoke',
        new URLSearchParams({
          token: accessToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info('YouTube token revoked', {
        provider: 'YouTubeProvider',
      });
    } catch (error: any) {
      logger.error('YouTube token revocation failed', {
        error: error.response?.data || error.message,
        provider: 'YouTubeProvider',
      });
    }
  }

  async discoverAccounts(accessToken: string): Promise<any[]> {
    const profile = await this.getUserProfile(accessToken);
    return [profile];
  }

  async validatePermissions(accessToken: string): Promise<any> {
    try {
      await this.getUserProfile(accessToken);
      return { valid: true, missingPermissions: [] };
    } catch {
      return { valid: false, missingPermissions: this.scopes };
    }
  }

  getCapabilities(accountType?: string): any {
    return {
      supportsPublishing: true,
      supportsScheduling: true,
      supportsAnalytics: true,
      maxTextLength: 5000,
      supportedMediaTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/webm'],
      supportedFeatures: [
        'video_upload',
        'shorts_upload',
        'thumbnail_upload',
        'scheduled_publishing',
        'analytics',
        'live_streaming'
      ],
    };
  }
}
