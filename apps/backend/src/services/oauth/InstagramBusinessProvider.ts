/**
 * Instagram Business OAuth 2.0 Provider - PRODUCTION
 * 
 * Implements OAuth 2.0 for Instagram Business/Creator accounts via Facebook Login
 * 
 * Documentation: https://developers.facebook.com/docs/instagram-basic-display-api
 * Business API: https://developers.facebook.com/docs/instagram-api
 * 
 * Security Features:
 * - OAuth 2.0 via Facebook Login
 * - 256-bit state parameter
 * - Long-lived access tokens (60 days)
 * - Token expiration tracking
 * 
 * Required Scopes:
 * - instagram_basic: Basic Instagram profile access
 * - instagram_content_publish: Publish content to Instagram
 * - pages_show_list: List Facebook pages (required for Instagram Business)
 * - pages_read_engagement: Read engagement metrics
 * 
 * Note: Instagram Business accounts are connected via Facebook Pages
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
import { InstagramErrorHandler } from '../../adapters/platforms/InstagramErrorHandler';
import { logger } from '../../utils/logger';

export interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  biography?: string;
  website?: string;
}

export class InstagramBusinessProvider extends OAuthProvider {
  private readonly authUrl = 'https://www.facebook.com/v21.0/dialog/oauth';
  private readonly tokenUrl = 'https://graph.facebook.com/v21.0/oauth/access_token';
  private readonly pagesUrl = 'https://graph.facebook.com/v21.0/me/accounts';
  private readonly errorHandler = new InstagramErrorHandler();

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    // Instagram OAuth uses Facebook Login with Instagram-specific scopes
    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'public_profile',
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'instagram';
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

      logger.info('Generated Instagram OAuth URL', { state });

      return { url, state };
    } catch (error: any) {
      logger.error('Instagram OAuth URL generation failed', { error: error.message });
      throw new Error(`Failed to generate Instagram OAuth URL: ${error.message}`);
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

      logger.info('Instagram short-lived token obtained', {
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

      logger.info('Instagram long-lived token obtained', {
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
      logger.error('Instagram token exchange failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Instagram token exchange failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    // Instagram uses Facebook's token system - long-lived tokens don't have refresh tokens
    // Instead, tokens can be refreshed by exchanging them before expiry
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

      logger.info('Instagram token refreshed', {
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
      logger.error('Instagram token refresh failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Instagram token refresh failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    // For Instagram, we need to get the user's Facebook profile first,
    // then get their Instagram Business accounts via Facebook Pages
    try {
      const response = await axios.get('https://graph.facebook.com/v21.0/me', {
        params: {
          fields: 'id,name',
          access_token: accessToken,
        },
      });

      const user = response.data;

      logger.info('Instagram user profile fetched (via Facebook)', { userId: user.id });

      return {
        id: user.id,
        username: user.name,
        displayName: user.name,
        profileUrl: `https://facebook.com/${user.id}`,
        metadata: {
          platform: 'instagram',
        },
      };
    } catch (error: any) {
      logger.error('Instagram user profile fetch failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Instagram user profile: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get Instagram Business accounts connected to Facebook Pages
   * This is the main method for discovering Instagram accounts
   */
  async getInstagramAccounts(accessToken: string): Promise<Array<{
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    instagramAccount: InstagramAccount;
  }>> {
    try {
      // Step 1: Get Facebook Pages
      const pagesResponse = await axios.get(this.pagesUrl, {
        params: {
          access_token: accessToken,
        },
      });

      const pages = pagesResponse.data.data || [];
      logger.info('Facebook pages fetched for Instagram', { count: pages.length });

      // Step 2: For each page, check if it has an Instagram Business account
      const instagramAccounts = [];

      for (const page of pages) {
        try {
          // Get Instagram Business Account ID for this page
          const igAccountResponse = await axios.get(
            `https://graph.facebook.com/v21.0/${page.id}`,
            {
              params: {
                fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website}',
                access_token: page.access_token,
              },
            }
          );

          if (igAccountResponse.data.instagram_business_account) {
            const igAccount = igAccountResponse.data.instagram_business_account;
            
            instagramAccounts.push({
              pageId: page.id,
              pageName: page.name,
              pageAccessToken: page.access_token,
              instagramAccount: igAccount,
            });

            logger.info('Instagram Business account found', {
              pageId: page.id,
              pageName: page.name,
              instagramUsername: igAccount.username,
            });
          }
        } catch (error: any) {
          // Page doesn't have Instagram Business account - skip it
          logger.debug('Page has no Instagram Business account', {
            pageId: page.id,
            pageName: page.name,
          });
        }
      }

      logger.info('Instagram accounts discovery complete', {
        totalPages: pages.length,
        instagramAccounts: instagramAccounts.length,
      });

      return instagramAccounts;
    } catch (error: any) {
      logger.error('Instagram accounts fetch failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Instagram accounts: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get Instagram account info by ID
   * Used for syncing account details
   */
  async getInstagramAccountInfo(
    instagramAccountId: string,
    pageAccessToken: string
  ): Promise<InstagramAccount> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v21.0/${instagramAccountId}`,
        {
          params: {
            fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
            access_token: pageAccessToken,
          },
        }
      );

      logger.info('Instagram account info fetched', {
        instagramAccountId,
        username: response.data.username,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Instagram account info fetch failed', {
        instagramAccountId,
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Instagram account info: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      // Revoke via Facebook Graph API
      await axios.delete(`https://graph.facebook.com/v21.0/me/permissions`, {
        params: {
          access_token: accessToken,
        },
      });

      logger.info('Instagram token revoked successfully');
    } catch (error: any) {
      logger.error('Instagram token revocation failed', {
        error: error.response?.data || error.message,
      });
      // Don't throw - revocation is best effort
    }
  }

  /**
   * Discover Instagram Business accounts (PlatformAdapter interface)
   * @param accessToken - User access token
   * @returns List of Instagram Business accounts as PlatformAccount objects
   */
  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    try {
      const accounts = await this.getInstagramAccounts(accessToken);
      
      return accounts.map(acc => ({
        platformAccountId: acc.instagramAccount.id,
        accountName: acc.instagramAccount.username,
        accountType: 'business' as AccountType,
        metadata: {
          profileUrl: `https://instagram.com/${acc.instagramAccount.username}`,
          avatarUrl: acc.instagramAccount.profile_picture_url,
          followerCount: acc.instagramAccount.followers_count,
          linkedPageId: acc.pageId,
          linkedPageName: acc.pageName,
          biography: acc.instagramAccount.biography,
          website: acc.instagramAccount.website,
        },
        pageAccessToken: acc.pageAccessToken,
      }));
    } catch (error: any) {
      logger.error('Instagram account discovery failed', {
        error: error.response?.data || error.message,
      });
      
      const classification = this.errorHandler.classify(error);
      throw new Error(`Instagram account discovery failed: ${classification.message}`);
    }
  }

  /**
   * Validate granted permissions (PlatformAdapter interface)
   * @param accessToken - Access token to validate
   * @returns Permission validation result
   */
  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    try {
      const response = await axios.get('https://graph.facebook.com/v21.0/me/permissions', {
        params: {
          access_token: accessToken,
        },
      });

      const grantedScopes = response.data.data
        .filter((p: any) => p.status === 'granted')
        .map((p: any) => p.permission);

      const requiredScopes = ['instagram_basic', 'instagram_content_publish'];
      const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

      logger.info('Instagram permissions validated', {
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
      logger.error('Instagram permission validation failed', {
        error: error.response?.data || error.message,
      });
      
      const classification = this.errorHandler.classify(error);
      throw new Error(`Instagram permission validation failed: ${classification.message}`);
    }
  }

  /**
   * Get platform capabilities (PlatformAdapter interface)
   * @param accountType - Type of account (not used for Instagram)
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
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxImageSize: 8 * 1024 * 1024, // 8MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
    };
  }
}
