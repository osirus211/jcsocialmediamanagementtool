/**
 * TikTok OAuth 2.0 Provider
 * 
 * Implements OAuth 2.0 for TikTok Content Posting API
 * 
 * Documentation: https://developers.tiktok.com/doc/content-posting-api-get-started
 * 
 * Required Scopes:
 * - user.info.basic: Read basic profile information
 * - video.upload: Upload videos to TikTok
 * - video.publish: Publish videos to TikTok
 * 
 * Key TikTok-specific details:
 * - Uses client_key parameter (not client_id) in authorization URL
 * - Requires access_type=offline for refresh token
 * - Token URL: https://open.tiktokapis.com/v2/oauth/token/
 * - User Info URL: https://open.tiktokapis.com/v2/user/info/
 * - Video Init URL: https://open.tiktokapis.com/v2/post/publish/video/init/
 * - Video Publish URL: https://open.tiktokapis.com/v2/post/publish/video/
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
import {
  PlatformAccount,
  PermissionValidationResult,
  PlatformCapabilities,
  AccountType,
} from '../../adapters/platforms/PlatformAdapter';
import { TikTokErrorHandler } from '../../adapters/platforms/TikTokErrorHandler';
import { logger } from '../../utils/logger';

export interface VideoUploadInit {
  uploadUrl: string;
  publishId: string;
}

export interface PublishVideoParams {
  publishId: string;
  caption?: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export interface PublishResult {
  postId: string;
  postUrl?: string;
}

export class TikTokProvider extends OAuthProvider {
  private readonly authUrl = 'https://www.tiktok.com/v2/auth/authorize';
  private readonly tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
  private readonly userInfoUrl = 'https://open.tiktokapis.com/v2/user/info/';
  private readonly videoInitUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
  private readonly videoPublishUrl = 'https://open.tiktokapis.com/v2/post/publish/video/';
  private readonly errorHandler = new TikTokErrorHandler();

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = ['user.info.basic', 'video.upload', 'video.publish'];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'tiktok';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    try {
      const state = this.generateState();

      // TikTok uses client_key instead of client_id
      const params = new URLSearchParams({
        client_key: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: this.scopes.join(','), // TikTok uses comma-separated scopes
        state,
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated TikTok OAuth URL', {
        state: state.substring(0, 10) + '...',
        provider: 'TikTokProvider',
      });

      return { url, state };
    } catch (error: any) {
      logger.error('TikTok OAuth URL generation failed', {
        error: error.message,
        provider: 'TikTokProvider',
      });
      throw new Error(`Failed to generate TikTok OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      logger.debug('Exchanging code for TikTok token', {
        step: 'token-exchange',
        provider: 'TikTokProvider',
      });

      const response = await axios.post(
        this.tokenUrl,
        {
          client_key: this.clientId,
          client_secret: this.clientSecret,
          code: params.code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data.data;
      
      if (!data || !data.access_token) {
        throw new Error('No access token received from TikTok API');
      }

      const accessToken = data.access_token;
      const refreshToken = data.refresh_token;
      const expiresIn = data.expires_in || 86400; // Default 24 hours
      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('TikTok token obtained', {
        hasRefreshToken: !!refreshToken,
        expiresIn,
        expiresAt: expiresAt.toISOString(),
        provider: 'TikTokProvider',
      });

      return {
        accessToken,
        refreshToken,
        expiresIn,
        expiresAt,
        tokenType: data.token_type || 'Bearer',
        scope: data.scope ? data.scope.split(',') : this.scopes,
      };
    } catch (error: any) {
      logger.error('TikTok token exchange failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`TikTok token exchange failed: ${errorMessage}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      logger.debug('Refreshing TikTok token', {
        step: 'token-refresh',
        provider: 'TikTokProvider',
      });

      if (!params.refreshToken) {
        throw new Error('Refresh token is required');
      }

      const response = await axios.post(
        this.tokenUrl,
        {
          client_key: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: params.refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data.data;

      if (!data || !data.access_token) {
        throw new Error('No access token received from TikTok API');
      }

      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token || params.refreshToken;
      const expiresIn = data.expires_in || 86400;
      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('TikTok token refreshed', {
        expiresIn,
        expiresAt: expiresAt.toISOString(),
        provider: 'TikTokProvider',
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
        expiresAt,
        tokenType: data.token_type || 'Bearer',
        scope: data.scope ? data.scope.split(',') : this.scopes,
      };
    } catch (error: any) {
      logger.error('TikTok token refresh failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`TikTok token refresh failed: ${errorMessage}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      logger.debug('Fetching TikTok user info', {
        step: 'profile-fetch',
        provider: 'TikTokProvider',
      });

      const response = await axios.get(this.userInfoUrl, {
        params: {
          fields: 'open_id,union_id,avatar_url,display_name,username',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data.data;

      if (!data || !data.user) {
        throw new Error('No user data received from TikTok API');
      }

      const user = data.user;

      logger.info('TikTok user info fetched', {
        userId: user.open_id,
        username: user.username,
        provider: 'TikTokProvider',
      });

      return {
        id: user.open_id,
        username: user.username || user.display_name,
        displayName: user.display_name,
        profileUrl: user.username ? `https://www.tiktok.com/@${user.username}` : undefined,
        avatarUrl: user.avatar_url,
        metadata: {
          platform: 'tiktok',
          unionId: user.union_id,
        },
      };
    } catch (error: any) {
      logger.error('TikTok user info fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to fetch TikTok user info: ${errorMessage}`);
    }
  }

  /**
   * Initialize video upload and get upload URL
   * This is the first step in the TikTok video publishing flow
   */
  async initVideoUpload(accessToken: string): Promise<VideoUploadInit> {
    try {
      logger.debug('Initializing TikTok video upload', {
        step: 'video-init',
        provider: 'TikTokProvider',
      });

      const response = await axios.post(
        this.videoInitUrl,
        {
          post_info: {
            title: '', // Title is optional, can be set during publish
            privacy_level: 'SELF_ONLY', // Default to private during upload
            disable_comment: false,
            disable_duet: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: 0, // Will be set during actual upload
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data;

      if (!data || !data.upload_url || !data.publish_id) {
        throw new Error('Invalid response from TikTok video init API');
      }

      logger.info('TikTok video upload initialized', {
        publishId: data.publish_id,
        provider: 'TikTokProvider',
      });

      return {
        uploadUrl: data.upload_url,
        publishId: data.publish_id,
      };
    } catch (error: any) {
      logger.error('TikTok video init failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to initialize TikTok video upload: ${errorMessage}`);
    }
  }

  /**
   * Publish video to TikTok with metadata
   * This is called after the video has been uploaded to the upload URL
   */
  async publishVideo(
    accessToken: string,
    params: PublishVideoParams
  ): Promise<PublishResult> {
    try {
      logger.debug('Publishing TikTok video', {
        step: 'video-publish',
        publishId: params.publishId,
        provider: 'TikTokProvider',
      });

      const postInfo: any = {
        title: params.caption || '',
        privacy_level: params.privacyLevel || 'PUBLIC_TO_EVERYONE',
        disable_comment: params.disableComment || false,
        disable_duet: params.disableDuet || false,
        disable_stitch: params.disableStitch || false,
      };

      const response = await axios.post(
        this.videoPublishUrl,
        {
          post_info: postInfo,
          publish_id: params.publishId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data;

      if (!data || !data.publish_id) {
        throw new Error('Invalid response from TikTok publish API');
      }

      logger.info('TikTok video published', {
        publishId: data.publish_id,
        provider: 'TikTokProvider',
      });

      return {
        postId: data.publish_id,
        postUrl: data.share_url,
      };
    } catch (error: any) {
      logger.error('TikTok video publish failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to publish TikTok video: ${errorMessage}`);
    }
  }

  /**
   * Extract error message from TikTok API error response
   */
  private extractErrorMessage(error: any): string {
    if (error.response?.data?.error) {
      const errorData = error.response.data.error;
      return errorData.message || errorData.code || JSON.stringify(errorData);
    }
    
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    return error.message || 'Unknown error';
  }
}

  /**
   * Discover TikTok creator account (PlatformAdapter interface)
   * TikTok only supports single creator account
   * @param accessToken - User access token
   * @returns List with single TikTok account as PlatformAccount object
   */
  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    try {
      const profile = await this.getUserProfile(accessToken);
      
      return [{
        platformAccountId: profile.id,
        accountName: profile.username,
        accountType: 'creator' as AccountType,
        metadata: {
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          displayName: profile.displayName,
        },
      }];
    } catch (error: any) {
      logger.error('TikTok account discovery failed', {
        error: error.response?.data || error.message,
      });
      
      const classification = this.errorHandler.classify(error);
      throw new Error(`TikTok account discovery failed: ${classification.message}`);
    }
  }

  /**
   * Validate granted permissions (PlatformAdapter interface)
   * @param accessToken - Access token to validate
   * @returns Permission validation result
   */
  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    // TikTok scopes are stored during token exchange
    // We validate against the scopes we requested
    const requiredScopes = ['video.upload', 'video.publish'];
    const grantedScopes = this.scopes;
    const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

    logger.info('TikTok permissions validated', {
      grantedScopes,
      missingScopes,
      valid: missingScopes.length === 0,
    });

    return {
      valid: missingScopes.length === 0,
      grantedScopes,
      requiredScopes,
      missingScopes,
      status: missingScopes.length === 0 ? 'sufficient' : 'insufficient_permissions',
    };
  }

  /**
   * Get platform capabilities (PlatformAdapter interface)
   * @param accountType - Type of account (not used for TikTok)
   * @returns Platform capabilities metadata
   */
  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: false, // TikTok is video-only
      publishVideo: true,
      publishImage: false, // TikTok doesn't support image posts
      publishCarousel: false, // TikTok doesn't support carousels
      analytics: true,
      stories: false, // TikTok doesn't have stories
      reels: false, // TikTok videos are similar to reels but not called that
      scheduling: true,
      maxVideoSize: 287 * 1024 * 1024, // 287MB
      supportedFormats: ['mp4', 'mov', 'webm'],
    };
  }
}
