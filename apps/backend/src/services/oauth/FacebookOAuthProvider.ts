/**
 * Facebook OAuth 2.0 Provider - PRODUCTION
 * 
 * Implements OAuth 2.0 for Facebook Graph API v19.0
 * 
 * Documentation: https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow
 * 
 * Security Features:
 * - OAuth 2.0 (no PKCE required for server-side)
 * - 256-bit state parameter
 * - Long-lived page access tokens
 * - Token expiration tracking
 * 
 * Required Scopes:
 * - pages_show_list: List managed pages
 * - pages_read_engagement: Read page engagement metrics
 * - pages_manage_posts: Publish to pages
 * - public_profile: Read user profile
 * - email: Read user email (optional)
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
import { FacebookErrorHandler } from '../../adapters/platforms/FacebookErrorHandler';
import { logger } from '../../utils/logger';

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

export class FacebookOAuthProvider extends OAuthProvider {
  private readonly authUrl = 'https://www.facebook.com/v19.0/dialog/oauth';
  private readonly tokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token';
  private readonly userUrl = 'https://graph.facebook.com/v19.0/me';
  private readonly pagesUrl = 'https://graph.facebook.com/v19.0/me/accounts';
  private readonly errorHandler = new FacebookErrorHandler();

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'public_profile',
      // Note: 'email' is optional and may not be available for all users
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'facebook';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    try {
      const state = this.generateState();

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(','),
        state,
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated Facebook OAuth URL', { state });

      return { url, state };
    } catch (error: any) {
      logger.error('Facebook OAuth URL generation failed', { error: error.message });
      throw new Error(`Failed to generate Facebook OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      // Step 1: Exchange code for short-lived token
      const response = await axios.get(this.tokenUrl, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code: params.code,
        },
      });

      const shortLivedToken = response.data.access_token;
      const shortLivedExpiresIn = response.data.expires_in;

      logger.info('Facebook short-lived token obtained', {
        expiresIn: shortLivedExpiresIn,
      });

      // Step 2: Exchange short-lived token for long-lived token (60 days)
      const longLivedResponse = await axios.get(this.tokenUrl, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      const longLivedToken = longLivedResponse.data.access_token;
      const longLivedExpiresIn = longLivedResponse.data.expires_in;

      logger.info('Facebook long-lived token obtained', {
        expiresIn: longLivedExpiresIn,
        expiresInDays: Math.floor(longLivedExpiresIn / 86400),
      });

      return {
        accessToken: longLivedToken,
        expiresIn: longLivedExpiresIn,
        expiresAt: this.calculateExpiresAt(longLivedExpiresIn),
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Facebook token exchange failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Facebook token exchange failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    // Facebook uses fb_exchange_token to refresh long-lived tokens
    try {
      const response = await axios.get(this.tokenUrl, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          fb_exchange_token: params.refreshToken, // Actually the current access token
        },
      });

      const newToken = response.data.access_token;
      const expiresIn = response.data.expires_in;

      logger.info('Facebook token refreshed', {
        expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
      });

      return {
        accessToken: newToken,
        expiresIn,
        expiresAt: this.calculateExpiresAt(expiresIn),
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Facebook token refresh failed', {
        error: error.response?.data || error.message,
      });
      
      // Classify error
      const classification = this.errorHandler.classify(error);
      throw new Error(`Facebook token refresh failed: ${classification.message}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      // Try to fetch with email first
      let response;
      try {
        response = await axios.get(this.userUrl, {
          params: {
            fields: 'id,name,email',
            access_token: accessToken,
          },
        });
      } catch (emailError: any) {
        // If email field fails, try without it
        if (emailError.response?.data?.error?.code === 100) {
          logger.warn('Facebook email field not accessible, fetching without email', {
            error: emailError.response?.data?.error?.message,
          });
          
          response = await axios.get(this.userUrl, {
            params: {
              fields: 'id,name',
              access_token: accessToken,
            },
          });
        } else {
          throw emailError;
        }
      }

      const user = response.data;

      logger.info('Facebook user profile fetched', { 
        userId: user.id,
        hasEmail: !!user.email,
      });

      return {
        id: user.id,
        username: user.name, // Facebook doesn't have usernames like Twitter
        displayName: user.name,
        profileUrl: `https://facebook.com/${user.id}`,
        metadata: {
          email: user.email || undefined,
        },
      };
    } catch (error: any) {
      logger.error('Facebook user profile fetch failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook user profile: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getUserPages(accessToken: string): Promise<FacebookPage[]> {
    try {
      const response = await axios.get(this.pagesUrl, {
        params: {
          access_token: accessToken,
        },
      });

      const pages = response.data.data || [];

      logger.info('Facebook pages fetched', { count: pages.length });

      return pages;
    } catch (error: any) {
      logger.error('Facebook pages fetch failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook pages: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get long-lived page access token
   * Page tokens obtained from /me/accounts are already long-lived (never expire)
   * when the user token is long-lived
   */
  async getLongLivedPageToken(pageId: string, pageAccessToken: string): Promise<string> {
    // Facebook page tokens obtained from /me/accounts with a long-lived user token
    // are already long-lived and never expire
    // No additional exchange needed
    logger.info('Facebook page token is already long-lived', { pageId });
    return pageAccessToken;
  }

  /**
   * Get page information
   * Used for syncing page account details
   */
  async getPageInfo(pageId: string, pageAccessToken: string): Promise<FacebookPage> {
    try {
      const response = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
        params: {
          fields: 'id,name,category,picture',
          access_token: pageAccessToken,
        },
      });

      logger.info('Facebook page info fetched', { pageId, pageName: response.data.name });

      return response.data;
    } catch (error: any) {
      logger.error('Facebook page info fetch failed', {
        pageId,
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook page info: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await axios.delete(`https://graph.facebook.com/v19.0/me/permissions`, {
        params: {
          access_token: accessToken,
        },
      });

      logger.info('Facebook token revoked successfully');
    } catch (error: any) {
      logger.error('Facebook token revocation failed', {
        error: error.response?.data || error.message,
      });
      // Don't throw - revocation is best effort
    }
  }
}

  /**
   * Discover available Facebook Pages for connection (PlatformAdapter interface)
   * @param accessToken - User access token
   * @returns List of Facebook Pages as PlatformAccount objects
   */
  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    try {
      const pages = await this.getUserPages(accessToken);
      
      return pages.map(page => ({
        platformAccountId: page.id,
        accountName: page.name,
        accountType: 'page' as AccountType,
        metadata: {
          category: page.category,
          avatarUrl: page.picture?.data?.url,
          profileUrl: `https://facebook.com/${page.id}`,
        },
        pageAccessToken: page.access_token,
      }));
    } catch (error: any) {
      logger.error('Facebook account discovery failed', {
        error: error.response?.data || error.message,
      });
      
      const classification = this.errorHandler.classify(error);
      throw new Error(`Facebook account discovery failed: ${classification.message}`);
    }
  }

  /**
   * Validate granted permissions (PlatformAdapter interface)
   * @param accessToken - Access token to validate
   * @returns Permission validation result
   */
  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    try {
      const response = await axios.get('https://graph.facebook.com/v19.0/me/permissions', {
        params: {
          access_token: accessToken,
        },
      });

      const grantedScopes = response.data.data
        .filter((p: any) => p.status === 'granted')
        .map((p: any) => p.permission);

      const requiredScopes = ['pages_manage_posts', 'pages_read_engagement'];
      const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

      logger.info('Facebook permissions validated', {
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
    } catch (error: any) {
      logger.error('Facebook permission validation failed', {
        error: error.response?.data || error.message,
      });
      
      const classification = this.errorHandler.classify(error);
      throw new Error(`Facebook permission validation failed: ${classification.message}`);
    }
  }

  /**
   * Get platform capabilities (PlatformAdapter interface)
   * @param accountType - Type of account (not used for Facebook)
   * @returns Platform capabilities metadata
   */
  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: true,
      publishVideo: true,
      publishImage: true,
      publishCarousel: true,
      analytics: true,
      stories: true,
      reels: true,
      scheduling: true,
      maxVideoSize: 4 * 1024 * 1024 * 1024, // 4GB
      maxImageSize: 8 * 1024 * 1024, // 8MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov'],
    };
  }
