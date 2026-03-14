/**
 * Facebook OAuth 2.0 Provider - PRODUCTION
 * 
 * Implements OAuth 2.0 for Facebook Graph API v21.0
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
 * - pages_manage_engagement: Manage page engagement (comments, reactions)
 * - publish_to_groups: Publish to groups (optional)
 * - instagram_basic: Access linked Instagram accounts
 * - read_insights: Read page and post insights
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
  private readonly authUrl = 'https://www.facebook.com/v21.0/dialog/oauth';
  private readonly tokenUrl = 'https://graph.facebook.com/v21.0/oauth/access_token';
  private readonly userUrl = 'https://graph.facebook.com/v21.0/me';
  private readonly pagesUrl = 'https://graph.facebook.com/v21.0/me/accounts';
  private readonly errorHandler = new FacebookErrorHandler();

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_engagement',
      'publish_to_groups',
      'instagram_basic',
      'read_insights',
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
      const response = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
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
      await axios.delete(`https://graph.facebook.com/v21.0/me/permissions`, {
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
      maxTextLength: 63206,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
    };
  }
}