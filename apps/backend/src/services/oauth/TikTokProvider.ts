/**
 * TikTok OAuth 2.0 Provider with PKCE Support
 * 
 * Implements TikTok Content Posting API v2 with enhanced security
 * 
 * Documentation: https://developers.tiktok.com/doc/content-posting-api-get-started
 * 
 * Required Scopes:
 * - user.info.basic: Read basic profile information
 * - user.info.profile: Read detailed profile (display name, bio, etc.)
 * - user.info.stats: Read follower/following counts
 * - video.upload: Upload videos to TikTok
 * - video.publish: Publish videos to TikTok
 * - creator.info.basic: Read creator account info
 * 
 * Key Features:
 * - PKCE (Proof Key for Code Exchange) for enhanced security
 * - Support for both video and photo posts
 * - Advanced privacy controls (Public/Friends/Private)
 * - Creator info integration
 * - Comprehensive analytics support
 * - Chunked video upload for large files
 * - Real-time publish status tracking
 * 
 * API Endpoints:
 * - Authorization: https://www.tiktok.com/v2/auth/authorize/
 * - Token: https://open.tiktokapis.com/v2/oauth/token/
 * - User Info: https://open.tiktokapis.com/v2/user/info/
 * - Creator Info: https://open.tiktokapis.com/v2/post/publish/creator_info/query/
 * - Video Init: https://open.tiktokapis.com/v2/post/publish/video/init/
 * - Photo Init: https://open.tiktokapis.com/v2/post/publish/content/init/
 * - Status Check: https://open.tiktokapis.com/v2/post/publish/status/fetch/
 * - Video List: https://open.tiktokapis.com/v2/video/list/
 * - Video Query: https://open.tiktokapis.com/v2/video/query/
 */

import axios from 'axios';
import crypto from 'crypto';
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

// PKCE interfaces
export interface PKCEPair {
  verifier: string;
  challenge: string;
}

// TikTok API interfaces
export interface TikTokCreatorInfo {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

export interface VideoUploadInit {
  uploadUrl: string;
  publishId: string;
}

export interface PhotoUploadInit {
  publishId: string;
}

export interface PublishVideoParams {
  publishId: string;
  caption?: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  videoCoverTimestampMs?: number;
}

export interface PublishPhotoParams {
  publishId: string;
  caption?: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableComment?: boolean;
  photoCoverIndex?: number;
}

export interface PublishResult {
  postId: string;
  postUrl?: string;
  status: 'PROCESSING_UPLOAD' | 'PUBLISH_COMPLETE' | 'FAILED';
}

export interface TikTokVideo {
  id: string;
  title: string;
  create_time: number;
  cover_image_url: string;
  share_url: string;
  video_description: string;
  duration: number;
  height: number;
  width: number;
  embed_html: string;
  embed_link: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  play_url: string;
}

export class TikTokProvider extends OAuthProvider {
  private readonly authUrl = 'https://www.tiktok.com/v2/auth/authorize/';
  private readonly tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
  private readonly userInfoUrl = 'https://open.tiktokapis.com/v2/user/info/';
  private readonly creatorInfoUrl = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
  private readonly videoInitUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
  private readonly photoInitUrl = 'https://open.tiktokapis.com/v2/post/publish/content/init/';
  private readonly statusUrl = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
  private readonly videoListUrl = 'https://open.tiktokapis.com/v2/video/list/';
  private readonly videoQueryUrl = 'https://open.tiktokapis.com/v2/video/query/';
  private readonly errorHandler = new TikTokErrorHandler();

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    // Enhanced scopes for comprehensive TikTok integration
    const scopes = [
      'user.info.basic',
      'user.info.profile', 
      'user.info.stats',
      'video.upload',
      'video.publish',
      'creator.info.basic'
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'tiktok';
  }

  /**
   * Generate PKCE code verifier and challenge pair
   * Uses crypto-secure random generation and SHA256 hashing
   */
  generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    // Generate 128-byte random string, base64url encode to get ~43-128 chars
    const verifier = crypto.randomBytes(96).toString('base64url');
    
    // Create SHA256 hash and base64url encode (no padding)
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    logger.debug('Generated PKCE pair', {
      verifierLength: verifier.length,
      challengeLength: challenge.length,
      provider: 'TikTokProvider',
    });

    return { codeVerifier: verifier, codeChallenge: challenge };
  }

  async getAuthorizationUrl(state?: string, pkceChallenge?: string): Promise<OAuthAuthorizationUrl & { codeVerifier?: string }> {
    try {
      const authState = state || this.generateState();
      let codeVerifier: string | undefined;
      let codeChallenge: string;

      if (pkceChallenge) {
        codeChallenge = pkceChallenge;
      } else {
        const pkce = this.generatePKCE();
        codeVerifier = pkce.codeVerifier;
        codeChallenge = pkce.codeChallenge;
      }

      // TikTok uses client_key instead of client_id
      const params = new URLSearchParams({
        client_key: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: this.scopes.join(','), // TikTok uses comma-separated scopes
        state: authState,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256', // Always use SHA256 for security
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated TikTok OAuth URL with PKCE', {
        state: authState.substring(0, 10) + '...',
        hasPKCE: true,
        scopes: this.scopes,
        provider: 'TikTokProvider',
      });

      return { 
        url, 
        state: authState,
        ...(codeVerifier && { codeVerifier })
      };
    } catch (error: any) {
      logger.error('TikTok OAuth URL generation failed', {
        error: error.message,
        provider: 'TikTokProvider',
      });
      throw new Error(`Failed to generate TikTok OAuth URL: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for access token using PKCE
   */
  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams & { codeVerifier?: string }): Promise<OAuthTokens> {
    try {
      logger.debug('Exchanging code for TikTok token with PKCE', {
        step: 'token-exchange',
        hasPKCE: !!params.codeVerifier,
        provider: 'TikTokProvider',
      });

      const requestBody: any = {
        client_key: this.clientId,
        client_secret: this.clientSecret,
        code: params.code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      };

      // Add PKCE verifier if provided
      if (params.codeVerifier) {
        requestBody.code_verifier = params.codeVerifier;
      }

      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams(requestBody).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data.data || response.data;
      
      if (!data || !data.access_token) {
        throw new Error('No access token received from TikTok API');
      }

      const accessToken = data.access_token;
      const refreshToken = data.refresh_token;
      const expiresIn = data.expires_in || 86400; // Default 24 hours
      const refreshExpiresIn = data.refresh_expires_in || 31536000; // Default 365 days
      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('TikTok token obtained with PKCE', {
        hasRefreshToken: !!refreshToken,
        expiresIn,
        refreshExpiresIn,
        expiresAt: expiresAt.toISOString(),
        scopes: data.scope?.split(',') || this.scopes,
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
          fields: 'open_id,union_id,avatar_url,avatar_url_100,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count',
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
        displayName: user.display_name,
        isVerified: user.is_verified,
        followerCount: user.follower_count,
        provider: 'TikTokProvider',
      });

      return {
        id: user.open_id,
        username: user.display_name, // TikTok doesn't always provide username
        displayName: user.display_name,
        profileUrl: user.profile_deep_link,
        avatarUrl: user.avatar_url_100 || user.avatar_url,
        metadata: {
          platform: 'tiktok',
          unionId: user.union_id,
          bio: user.bio_description,
          isVerified: user.is_verified,
          followerCount: user.follower_count,
          followingCount: user.following_count,
          likesCount: user.likes_count,
          videoCount: user.video_count,
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
   * Get creator account information and capabilities
   */
  async getCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    try {
      logger.debug('Fetching TikTok creator info', {
        step: 'creator-info-fetch',
        provider: 'TikTokProvider',
      });

      const response = await axios.get(this.creatorInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data.data;

      if (!data) {
        throw new Error('No creator data received from TikTok API');
      }

      logger.info('TikTok creator info fetched', {
        username: data.creator_username,
        maxDuration: data.max_video_post_duration_sec,
        privacyOptions: data.privacy_level_options,
        provider: 'TikTokProvider',
      });

      return {
        creator_avatar_url: data.creator_avatar_url,
        creator_username: data.creator_username,
        creator_nickname: data.creator_nickname,
        privacy_level_options: data.privacy_level_options || ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
        comment_disabled: data.comment_disabled || false,
        duet_disabled: data.duet_disabled || false,
        stitch_disabled: data.stitch_disabled || false,
        max_video_post_duration_sec: data.max_video_post_duration_sec || 600, // 10 minutes default
      };
    } catch (error: any) {
      logger.error('TikTok creator info fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to fetch TikTok creator info: ${errorMessage}`);
    }
  }

  /**
   * Initialize video upload and get upload URL
   * Supports both direct upload and URL-based upload
   */
  async initVideoUpload(
    accessToken: string, 
    videoInfo: {
      source: 'FILE_UPLOAD' | 'PULL_FROM_URL';
      videoSize?: number;
      chunkSize?: number;
      totalChunkCount?: number;
      videoUrl?: string;
    },
    postInfo: {
      title?: string;
      privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
      disableComment?: boolean;
      disableDuet?: boolean;
      disableStitch?: boolean;
      videoCoverTimestampMs?: number;
    }
  ): Promise<VideoUploadInit> {
    try {
      logger.debug('Initializing TikTok video upload', {
        step: 'video-init',
        source: videoInfo.source,
        videoSize: videoInfo.videoSize,
        provider: 'TikTokProvider',
      });

      const requestBody: any = {
        post_info: {
          title: postInfo.title || '',
          privacy_level: postInfo.privacyLevel || 'PUBLIC_TO_EVERYONE',
          disable_comment: postInfo.disableComment || false,
          disable_duet: postInfo.disableDuet || false,
          disable_stitch: postInfo.disableStitch || false,
          video_cover_timestamp_ms: postInfo.videoCoverTimestampMs || 1000,
        },
        source_info: {
          source: videoInfo.source,
        },
      };

      if (videoInfo.source === 'FILE_UPLOAD') {
        requestBody.source_info.video_size = videoInfo.videoSize || 0;
        requestBody.source_info.chunk_size = videoInfo.chunkSize || 10 * 1024 * 1024; // 10MB chunks
        requestBody.source_info.total_chunk_count = videoInfo.totalChunkCount || 1;
      } else if (videoInfo.source === 'PULL_FROM_URL') {
        requestBody.source_info.video_url = videoInfo.videoUrl;
      }

      const response = await axios.post(
        this.videoInitUrl,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data;

      if (!data || !data.publish_id) {
        throw new Error('Invalid response from TikTok video init API');
      }

      logger.info('TikTok video upload initialized', {
        publishId: data.publish_id,
        uploadUrl: data.upload_url ? 'provided' : 'not_provided',
        source: videoInfo.source,
        provider: 'TikTokProvider',
      });

      return {
        uploadUrl: data.upload_url || '',
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
   * Initialize photo upload for TikTok Photo Mode
   */
  async initPhotoUpload(
    accessToken: string,
    photoInfo: {
      source: 'PULL_FROM_URL';
      photoImages: string[];
      photoCoverIndex?: number;
    },
    postInfo: {
      title?: string;
      privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
      disableComment?: boolean;
    }
  ): Promise<PhotoUploadInit> {
    try {
      logger.debug('Initializing TikTok photo upload', {
        step: 'photo-init',
        imageCount: photoInfo.photoImages.length,
        provider: 'TikTokProvider',
      });

      const requestBody = {
        post_info: {
          title: postInfo.title || '',
          privacy_level: postInfo.privacyLevel || 'PUBLIC_TO_EVERYONE',
          disable_comment: postInfo.disableComment || false,
        },
        source_info: {
          source: photoInfo.source,
          photo_cover_index: photoInfo.photoCoverIndex || 0,
          photo_images: photoInfo.photoImages,
        },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      };

      const response = await axios.post(
        this.photoInitUrl,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data;

      if (!data || !data.publish_id) {
        throw new Error('Invalid response from TikTok photo init API');
      }

      logger.info('TikTok photo upload initialized', {
        publishId: data.publish_id,
        imageCount: photoInfo.photoImages.length,
        provider: 'TikTokProvider',
      });

      return {
        publishId: data.publish_id,
      };
    } catch (error: any) {
      logger.error('TikTok photo init failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to initialize TikTok photo upload: ${errorMessage}`);
    }
  }

  /**
   * Upload video chunks to TikTok
   */
  async uploadVideoChunks(uploadUrl: string, videoBuffer: Buffer, chunkSize: number = 10 * 1024 * 1024): Promise<void> {
    try {
      const totalSize = videoBuffer.length;
      const totalChunks = Math.ceil(totalSize / chunkSize);

      logger.debug('Starting chunked video upload', {
        totalSize,
        chunkSize,
        totalChunks,
        provider: 'TikTokProvider',
      });

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const chunk = videoBuffer.slice(start, end);

        const response = await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
            'Content-Type': 'video/mp4',
          },
        });

        logger.debug(`Uploaded chunk ${i + 1}/${totalChunks}`, {
          chunkIndex: i,
          start,
          end: end - 1,
          totalSize,
          statusCode: response.status,
          provider: 'TikTokProvider',
        });
      }

      logger.info('Video chunks uploaded successfully', {
        totalChunks,
        totalSize,
        provider: 'TikTokProvider',
      });
    } catch (error: any) {
      logger.error('Video chunk upload failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to upload video chunks: ${errorMessage}`);
    }
  }

  /**
   * Check publish status
   */
  async checkPublishStatus(accessToken: string, publishId: string): Promise<PublishResult> {
    try {
      logger.debug('Checking TikTok publish status', {
        publishId,
        provider: 'TikTokProvider',
      });

      const response = await axios.post(
        this.statusUrl,
        { publish_id: publishId },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data;

      if (!data) {
        throw new Error('Invalid response from TikTok status API');
      }

      logger.info('TikTok publish status checked', {
        publishId,
        status: data.status,
        provider: 'TikTokProvider',
      });

      return {
        postId: publishId,
        postUrl: data.share_url,
        status: data.status,
      };
    } catch (error: any) {
      logger.error('TikTok status check failed', {
        publishId,
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to check TikTok publish status: ${errorMessage}`);
    }
  }

  /**
   * Poll publish status until completion
   */
  async pollUntilComplete(
    accessToken: string, 
    publishId: string, 
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<PublishResult> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.checkPublishStatus(accessToken, publishId);
      
      if (result.status === 'PUBLISH_COMPLETE' || result.status === 'FAILED') {
        logger.info('TikTok publish polling completed', {
          publishId,
          status: result.status,
          attempts: attempt,
          provider: 'TikTokProvider',
        });
        return result;
      }

      logger.debug(`TikTok publish still processing (attempt ${attempt}/${maxAttempts})`, {
        publishId,
        status: result.status,
        provider: 'TikTokProvider',
      });

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error(`TikTok publish polling timed out after ${maxAttempts} attempts`);
  }

  /**
   * Get list of user's videos with analytics
   */
  async getVideoList(
    accessToken: string,
    fields: string[] = ['id', 'title', 'create_time', 'cover_image_url', 'share_url', 'like_count', 'comment_count', 'share_count', 'view_count'],
    cursor?: string,
    maxCount: number = 20
  ): Promise<{ videos: TikTokVideo[]; cursor?: string; hasMore: boolean }> {
    try {
      logger.debug('Fetching TikTok video list', {
        fields,
        maxCount,
        hasCursor: !!cursor,
        provider: 'TikTokProvider',
      });

      const params: any = {
        fields: fields.join(','),
        max_count: maxCount,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const response = await axios.get(this.videoListUrl, {
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data.data;

      if (!data) {
        throw new Error('Invalid response from TikTok video list API');
      }

      logger.info('TikTok video list fetched', {
        videoCount: data.videos?.length || 0,
        hasMore: data.has_more,
        provider: 'TikTokProvider',
      });

      return {
        videos: data.videos || [],
        cursor: data.cursor,
        hasMore: data.has_more || false,
      };
    } catch (error: any) {
      logger.error('TikTok video list fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'TikTokProvider',
      });

      const errorMessage = this.extractErrorMessage(error);
      throw new Error(`Failed to fetch TikTok video list: ${errorMessage}`);
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
      publishPost: false, // TikTok is video/photo only
      publishVideo: true,
      publishImage: true, // TikTok Photo Mode support
      publishCarousel: true, // TikTok supports multiple photos
      analytics: true,
      stories: false, // TikTok doesn't have stories
      reels: false, // TikTok videos are similar to reels but not called that
      scheduling: true,
      maxVideoSize: 10 * 1024 * 1024 * 1024, // 10GB
      supportedFormats: ['mp4', 'mov', 'webm', 'jpg', 'jpeg', 'png', 'webp'],
    };
  }
}
