import mongoose from 'mongoose';
import {
  SocialPlatformProvider,
  PlatformCapabilities,
  OAuthInitiateRequest,
  OAuthInitiateResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
  PublishRequest,
  PublishResponse,
  RevokeRequest,
  AccountValidationRequest,
  AccountValidationResponse,
  RateLimitInfo,
} from './SocialPlatformProvider';
import { TwitterOAuthService } from '../services/oauth/TwitterOAuthService';
import { SocialAccount, SocialPlatform } from '../models/SocialAccount';
import { TwitterOAuthProvider } from '../services/oauth/TwitterOAuthProvider';
import { logger } from '../utils/logger';
import axios from 'axios';

/**
 * Twitter Provider
 * 
 * Implements SocialPlatformProvider for Twitter/X
 * 
 * Features:
 * - OAuth 2.0 with PKCE
 * - Token refresh with distributed lock
 * - Publishing with idempotency
 * - Event-driven architecture
 * - Rate limit tracking
 * - Error classification
 */

export class TwitterProvider extends SocialPlatformProvider {
  private oauthService: TwitterOAuthService;
  private oauthProvider: TwitterOAuthProvider;
  private readonly API_BASE = 'https://api.twitter.com/2';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    super(SocialPlatform.TWITTER);
    this.oauthService = new TwitterOAuthService(clientId, clientSecret, redirectUri);
    this.oauthProvider = new TwitterOAuthProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Get platform capabilities
   */
  getCapabilities(): PlatformCapabilities {
    return {
      maxTextLength: 280,
      maxImages: 4,
      maxVideos: 1,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxVideoSize: 512 * 1024 * 1024, // 512MB
      supportsScheduling: false, // Twitter API doesn't support native scheduling
      supportsThreads: true,
      supportsPolls: true,
      supportsHashtags: true,
      supportsMentions: true,
    };
  }

  /**
   * Initiate OAuth flow
   */
  async initiateOAuth(request: OAuthInitiateRequest): Promise<OAuthInitiateResponse> {
    try {
      const { url, state, codeVerifier } = await this.oauthService.initiateOAuth();

      logger.info('Twitter OAuth initiated', {
        workspaceId: request.workspaceId,
        state,
      });

      return {
        authorizationUrl: url,
        state,
        codeVerifier,
      };
    } catch (error: any) {
      logger.error('Twitter OAuth initiation failed', {
        workspaceId: request.workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(request: OAuthCallbackRequest): Promise<OAuthCallbackResponse> {
    const startTime = Date.now();

    try {
      const account = await this.oauthService.connectAccount({
        workspaceId: request.workspaceId,
        userId: request.userId,
        code: request.code,
        state: request.state,
        codeVerifier: request.codeVerifier!,
        ipAddress: request.ipAddress,
      });

      const duration = Date.now() - startTime;

      logger.info('Twitter OAuth callback handled', {
        accountId: account._id,
        username: account.metadata?.username,
        duration,
      });

      // Emit OAuth connected event
      this.emit('oauth.connected', {
        accountId: account._id.toString(),
        platform: this.platform,
        username: account.metadata?.username,
        timestamp: new Date(),
      });

      return {
        accountId: account._id,
        platform: this.platform,
        username: account.metadata?.username || account.accountName,
        profileUrl: account.metadata?.profileUrl,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('Twitter OAuth callback failed', {
        error: error.message,
        duration,
      });

      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(request: TokenRefreshRequest): Promise<TokenRefreshResponse> {
    const startTime = Date.now();

    try {
      const result = await this.oauthService.refreshToken(request.accountId);

      const duration = Date.now() - startTime;

      if (result.success) {
        logger.info('Twitter token refreshed', {
          accountId: request.accountId,
          duration,
        });

        // Emit token refreshed event
        this.emitTokenRefreshed({
          accountId: request.accountId.toString(),
          platform: this.platform,
          expiresAt: result.account!.tokenExpiresAt!,
          timestamp: new Date(),
        });

        return {
          success: true,
          expiresAt: result.account!.tokenExpiresAt,
        };
      } else {
        logger.warn('Twitter token refresh failed', {
          accountId: request.accountId,
          error: result.error,
          shouldReconnect: result.shouldReconnect,
          duration,
        });

        // Emit appropriate event
        if (result.shouldReconnect) {
          if (result.error?.includes('revoked')) {
            this.emitTokenRevoked({
              accountId: request.accountId.toString(),
              platform: this.platform,
              reason: result.error,
              timestamp: new Date(),
            });
          } else {
            this.emitTokenExpired({
              accountId: request.accountId.toString(),
              platform: this.platform,
              timestamp: new Date(),
            });
          }
        }

        return {
          success: false,
          error: result.error,
          shouldReconnect: result.shouldReconnect,
        };
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('Twitter token refresh error', {
        accountId: request.accountId,
        error: error.message,
        duration,
      });

      return {
        success: false,
        error: error.message,
        shouldReconnect: false,
      };
    }
  }

  /**
   * Publish post to Twitter
   */
  async publish(request: PublishRequest): Promise<PublishResponse> {
    const startTime = Date.now();

    // Emit publish started event
    this.emitPublishStarted({
      postId: request.postId.toString(),
      accountId: request.accountId.toString(),
      platform: this.platform,
      timestamp: new Date(),
    });

    try {
      // Fetch account with tokens
      const account = await SocialAccount.findById(request.accountId).select(
        '+accessToken +refreshToken'
      );

      if (!account) {
        throw new Error('Account not found');
      }

      // Check if token needs refresh
      if (await this.needsRefresh(request.accountId)) {
        logger.info('Token needs refresh before publish', {
          accountId: request.accountId,
        });

        const refreshResult = await this.refreshToken({ accountId: request.accountId });

        if (!refreshResult.success) {
          throw new Error(`Token refresh failed: ${refreshResult.error}`);
        }

        // Reload account with new token
        const refreshedAccount = await SocialAccount.findById(request.accountId).select(
          '+accessToken +refreshToken'
        );
        if (refreshedAccount) {
          Object.assign(account, refreshedAccount);
        }
      }

      // Validate content length
      const capabilities = this.getCapabilities();
      if (request.content.length > capabilities.maxTextLength) {
        throw new Error(
          `Content exceeds Twitter character limit of ${capabilities.maxTextLength}`
        );
      }

      // Validate media count
      if (request.mediaUrls && request.mediaUrls.length > capabilities.maxImages) {
        throw new Error(`Too many images. Twitter supports max ${capabilities.maxImages} images`);
      }

      // Publish to Twitter API
      const accessToken = account.getDecryptedAccessToken();
      const result = await this.publishToTwitterAPI(
        request.content,
        request.mediaUrls || [],
        accessToken
      );

      const duration = Date.now() - startTime;

      logger.info('Twitter publish success', {
        postId: request.postId,
        accountId: request.accountId,
        platformPostId: result.platformPostId,
        duration,
      });

      // Emit publish success event
      this.emitPublishSuccess({
        postId: request.postId.toString(),
        accountId: request.accountId.toString(),
        platform: this.platform,
        platformPostId: result.platformPostId!,
        publishedAt: result.publishedAt!,
        duration,
        timestamp: new Date(),
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Classify error
      const { oauthErrorClassifier } = await import('../services/OAuthErrorClassifier');
      const classified = oauthErrorClassifier.classify(SocialPlatform.TWITTER, error);

      logger.error('Twitter publish failed', {
        postId: request.postId,
        accountId: request.accountId,
        error: error.message,
        category: classified.category,
        retryable: classified.shouldRetry,
        duration,
      });

      // Check for rate limit
      if (classified.category === 'rate_limited') {
        this.emitRateLimitHit({
          accountId: request.accountId.toString(),
          platform: this.platform,
          operation: 'publish',
          resetAt: new Date(Date.now() + (classified.retryAfterSeconds || 900) * 1000),
          timestamp: new Date(),
        });
      }

      // Emit publish failed event
      this.emitPublishFailed({
        postId: request.postId.toString(),
        accountId: request.accountId.toString(),
        platform: this.platform,
        error: error.message,
        errorCategory: classified.category,
        retryable: classified.shouldRetry,
        duration,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: classified.userMessage,
        errorCategory: classified.category,
        retryable: classified.shouldRetry,
      };
    }
  }

  /**
   * Publish to Twitter API
   */
  private async publishToTwitterAPI(
    content: string,
    mediaUrls: string[],
    accessToken: string
  ): Promise<PublishResponse> {
    try {
      // Upload media if present
      let mediaIds: string[] = [];
      if (mediaUrls.length > 0) {
        mediaIds = await this.uploadMedia(mediaUrls, accessToken);
      }

      // Create tweet
      const response = await axios.post(
        `${this.API_BASE}/tweets`,
        {
          text: content,
          ...(mediaIds.length > 0 && { media: { media_ids: mediaIds } }),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const tweetId = response.data.data.id;

      return {
        success: true,
        platformPostId: tweetId,
        publishedAt: new Date(),
        url: `https://twitter.com/i/web/status/${tweetId}`,
      };
    } catch (error: any) {
      logger.error('Twitter API publish failed', {
        error: error.response?.data || error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Upload media to Twitter
   */
  private async uploadMedia(mediaUrls: string[], accessToken: string): Promise<string[]> {
    // TODO: Implement media upload
    // For now, return empty array
    logger.warn('Media upload not yet implemented', {
      mediaCount: mediaUrls.length,
    });
    return [];
  }

  /**
   * Revoke access
   */
  async revokeAccess(request: RevokeRequest): Promise<void> {
    try {
      await this.oauthService.revokeAccess(
        request.accountId,
        request.userId,
        request.ipAddress
      );

      logger.info('Twitter access revoked', {
        accountId: request.accountId,
        userId: request.userId,
      });

      // Emit token revoked event
      this.emitTokenRevoked({
        accountId: request.accountId.toString(),
        platform: this.platform,
        reason: 'User revoked access',
        timestamp: new Date(),
      });
    } catch (error: any) {
      logger.error('Twitter access revocation failed', {
        accountId: request.accountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate account
   */
  async validateAccount(request: AccountValidationRequest): Promise<AccountValidationResponse> {
    try {
      const account = await SocialAccount.findById(request.accountId).select('+accessToken');

      if (!account) {
        return {
          valid: false,
          reason: 'Account not found',
        };
      }

      if (account.status !== 'active') {
        return {
          valid: false,
          reason: `Account is ${account.status}`,
        };
      }

      // Check if token is expired
      if (account.isTokenExpired()) {
        return {
          valid: false,
          reason: 'Token expired',
        };
      }

      // Validate with Twitter API
      const accessToken = account.getDecryptedAccessToken();
      const isValid = await this.oauthProvider.validateToken(accessToken);

      return {
        valid: isValid,
        reason: isValid ? undefined : 'Token invalid',
      };
    } catch (error: any) {
      logger.error('Twitter account validation failed', {
        accountId: request.accountId,
        error: error.message,
      });

      return {
        valid: false,
        reason: error.message,
      };
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(accountId: mongoose.Types.ObjectId | string): Promise<RateLimitInfo[]> {
    try {
      const account = await SocialAccount.findById(accountId).select('+accessToken');

      if (!account) {
        return [];
      }

      // Get rate limit status from Twitter API
      const response = await axios.get(`${this.API_BASE}/tweets/rate_limit_status`, {
        headers: {
          Authorization: `Bearer ${account.getDecryptedAccessToken()}`,
        },
      });

      // Parse rate limit headers
      const rateLimits: RateLimitInfo[] = [];

      if (response.headers['x-rate-limit-limit']) {
        rateLimits.push({
          operation: 'publish',
          limit: parseInt(response.headers['x-rate-limit-limit']),
          remaining: parseInt(response.headers['x-rate-limit-remaining'] || '0'),
          resetAt: new Date(parseInt(response.headers['x-rate-limit-reset']) * 1000),
        });
      }

      return rateLimits;
    } catch (error: any) {
      logger.error('Failed to get Twitter rate limit status', {
        accountId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Check if token needs refresh
   */
  async needsRefresh(
    accountId: mongoose.Types.ObjectId | string,
    _thresholdMinutes: number = 5
  ): Promise<boolean> {
    return await this.oauthService.needsRefresh(accountId);
  }
}
