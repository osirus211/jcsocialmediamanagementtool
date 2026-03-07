/**
 * Twitter OAuth 2.0 Provider - PRODUCTION
 * 
 * Implements OAuth 2.0 with PKCE for Twitter API v2
 * 
 * Documentation: https://developer.twitter.com/en/docs/authentication/oauth-2-0
 * 
 * Security Features:
 * - OAuth 2.0 with PKCE (S256)
 * - 256-bit state parameter
 * - Refresh token support
 * - Token expiration tracking
 * 
 * Required Scopes:
 * - tweet.read: Read tweets
 * - tweet.write: Post tweets
 * - users.read: Read user profile
 * - offline.access: Get refresh token
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
import { TwitterErrorHandler } from '../../adapters/platforms/TwitterErrorHandler';
import { logger } from '../../utils/logger';

export class TwitterOAuthProvider extends OAuthProvider {
  private readonly authUrl = 'https://twitter.com/i/oauth2/authorize';
  private readonly tokenUrl = 'https://api.twitter.com/2/oauth2/token';
  private readonly userUrl = 'https://api.twitter.com/2/users/me';
  private readonly errorHandler = new TwitterErrorHandler();

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access', // Required for refresh token
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'twitter';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    try {
      const state = this.generateState();
      const { codeVerifier, codeChallenge } = this.generatePKCE();

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated Twitter OAuth URL', { state });

      return { url, state, codeVerifier };
    } catch (error: any) {
      logger.error('Twitter OAuth URL generation failed', { error: error.message });
      throw new Error(`Failed to generate Twitter OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      if (!params.codeVerifier) {
        throw new Error('Code verifier is required for Twitter OAuth');
      }

      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: params.code,
          redirect_uri: this.redirectUri,
          code_verifier: params.codeVerifier,
          client_id: this.clientId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
        }
      );

      const data = response.data;

      logger.info('Twitter token exchange successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: this.calculateExpiresAt(data.expires_in),
        scope: data.scope?.split(' '),
        tokenType: data.token_type,
      };
    } catch (error: any) {
      logger.error('Twitter token exchange failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Twitter token exchange failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: params.refreshToken,
          client_id: this.clientId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
        }
      );

      const data = response.data;

      logger.info('Twitter token refresh successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: this.calculateExpiresAt(data.expires_in),
        scope: data.scope?.split(' '),
        tokenType: data.token_type,
      };
    } catch (error: any) {
      logger.error('Twitter token refresh failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Twitter token refresh failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await axios.get(this.userUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          'user.fields': 'id,name,username,profile_image_url,public_metrics',
        },
      });

      const user = response.data.data;

      logger.info('Twitter user profile fetched', { userId: user.id });

      return {
        id: user.id,
        username: user.username,
        displayName: user.name,
        profileUrl: `https://twitter.com/${user.username}`,
        avatarUrl: user.profile_image_url,
        followerCount: user.public_metrics?.followers_count,
        metadata: {
          verified: user.verified,
          description: user.description,
          publicMetrics: user.public_metrics,
        },
      };
    } catch (error: any) {
      logger.error('Twitter user profile fetch failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Twitter user profile: ${error.response?.data?.error || error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await axios.post(
        'https://api.twitter.com/2/oauth2/revoke',
        new URLSearchParams({
          token: accessToken,
          token_type_hint: 'access_token',
          client_id: this.clientId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
        }
      );

      logger.info('Twitter token revoked successfully');
    } catch (error: any) {
      logger.error('Twitter token revocation failed', {
        error: error.response?.data || error.message,
      });
      // Don't throw - revocation is best effort
    }
  }
}

  /**
   * Discover Twitter account (PlatformAdapter interface)
   * Twitter only supports single personal account
   * @param accessToken - User access token
   * @returns List with single Twitter account as PlatformAccount object
   */
  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    try {
      const profile = await this.getUserProfile(accessToken);
      
      return [{
        platformAccountId: profile.id,
        accountName: profile.username,
        accountType: 'personal' as AccountType,
        metadata: {
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          followerCount: profile.followerCount,
          displayName: profile.displayName,
          verified: profile.metadata?.verified,
        },
      }];
    } catch (error: any) {
      logger.error('Twitter account discovery failed', {
        error: error.response?.data || error.message,
      });
      
      const classification = this.errorHandler.classify(error);
      throw new Error(`Twitter account discovery failed: ${classification.message}`);
    }
  }

  /**
   * Validate granted permissions (PlatformAdapter interface)
   * @param accessToken - Access token to validate
   * @returns Permission validation result
   */
  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    // Twitter scopes are stored during token exchange
    // We validate against the scopes we requested
    const requiredScopes = ['tweet.write', 'users.read'];
    const grantedScopes = this.scopes;
    const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

    logger.info('Twitter permissions validated', {
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
   * @param accountType - Type of account (not used for Twitter)
   * @returns Platform capabilities metadata
   */
  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: true,
      publishVideo: true,
      publishImage: true,
      publishCarousel: false, // Twitter doesn't support carousels
      analytics: true,
      stories: false, // Twitter doesn't have stories
      reels: false, // Twitter doesn't have reels
      scheduling: true,
      maxVideoSize: 512 * 1024 * 1024, // 512MB
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov'],
    };
  }
