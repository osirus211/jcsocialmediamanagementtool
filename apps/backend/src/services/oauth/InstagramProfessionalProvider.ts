/**
 * Instagram Graph API Provider with Instagram Login
 * 
 * Implements OAuth 2.0 for Instagram Business and Creator accounts
 * using Instagram Graph API with Instagram Login (NOT Facebook Login)
 * 
 * Documentation: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 * 
 * CRITICAL: This uses Instagram Graph API, NOT Instagram Basic Display API (deprecated)
 * 
 * OAuth Flow:
 * 1. Authorization: https://www.instagram.com/oauth/authorize
 * 2. Short-lived token: https://api.instagram.com/oauth/access_token  
 * 3. Long-lived token: https://graph.instagram.com/access_token
 * 4. Refresh: https://graph.instagram.com/refresh_access_token
 * 5. Profile: https://graph.instagram.com/v21.0/me
 * 
 * Security Features:
 * - OAuth 2.0 via Instagram Login (not Facebook)
 * - 256-bit state parameter
 * - Long-lived access tokens (60 days)
 * - Token expiration tracking
 * 
 * Required Scopes:
 * - instagram_business_basic: Basic profile and content access
 * - instagram_business_content_publish: Publish posts, stories, and reels
 * - instagram_business_manage_comments: Manage comments on posts
 * - instagram_business_manage_messages: Manage direct messages
 * 
 * Supported Account Types:
 * - Instagram Business accounts
 * - Instagram Creator accounts
 * 
 * Key Differences from Basic Display API:
 * - Uses Instagram Graph API (graph.instagram.com) not Basic Display
 * - Supports publishing (not read-only)
 * - Works with Business/Creator accounts (not personal)
 * - Uses Instagram Login (not Facebook Login)
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

export class InstagramProfessionalProvider extends OAuthProvider {
  // Instagram Graph API with Instagram Login endpoints
  private readonly authUrl = 'https://www.instagram.com/oauth/authorize';
  private readonly shortTokenUrl = 'https://api.instagram.com/oauth/access_token';
  private readonly longTokenUrl = 'https://graph.instagram.com/access_token';
  private readonly refreshUrl = 'https://graph.instagram.com/refresh_access_token';
  private readonly apiBaseUrl = 'https://graph.instagram.com/v21.0';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    // Instagram Graph API scopes for Business/Creator accounts
    const scopes = [
      'instagram_business_basic',
      'instagram_business_content_publish',
      'instagram_business_manage_comments',
      'instagram_business_manage_messages',
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
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(','),
        response_type: 'code',
        state,
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated Instagram Graph API OAuth URL', { 
        state: state.substring(0, 10) + '...',
        provider: 'InstagramGraphAPI',
        authUrl: this.authUrl,
      });

      return { url, state };
    } catch (error: any) {
      logger.error('Instagram Graph API OAuth URL generation failed', {
        error: error.message,
        provider: 'InstagramGraphAPI',
      });
      throw new Error(`Failed to generate Instagram Graph API OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      logger.debug('Exchanging code for Instagram Graph API token', {
        step: 'short-lived-token-exchange',
        provider: 'InstagramGraphAPI',
      });

      // Step 1: Exchange code for short-lived token
      const formData = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code: params.code,
      });

      const shortTokenResponse = await axios.post(this.shortTokenUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const shortLivedToken = shortTokenResponse.data.access_token;
      const userId = shortTokenResponse.data.user_id;

      if (!shortLivedToken) {
        throw new Error('No short-lived access token received from Instagram Graph API');
      }

      logger.debug('Short-lived token obtained, exchanging for long-lived token', {
        userId,
        provider: 'InstagramGraphAPI',
      });

      // Step 2: Exchange short-lived token for long-lived token
      const longTokenResponse = await axios.get(this.longTokenUrl, {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.clientSecret,
          access_token: shortLivedToken,
        },
      });

      const longLivedToken = longTokenResponse.data.access_token;
      const expiresIn = longTokenResponse.data.expires_in || 5184000; // Default 60 days

      if (!longLivedToken) {
        throw new Error('No long-lived access token received from Instagram Graph API');
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('Instagram Graph API long-lived token obtained', {
        userId,
        expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
        expiresAt: expiresAt.toISOString(),
        provider: 'InstagramGraphAPI',
      });

      return {
        accessToken: longLivedToken,
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Instagram Graph API token exchange failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'InstagramGraphAPI',
      });

      const errorMessage = error.response?.data?.error_message || 
                          error.response?.data?.error?.message ||
                          error.message;
      throw new Error(`Instagram Graph API token exchange failed: ${errorMessage}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      logger.debug('Refreshing Instagram Graph API token', {
        step: 'token-refresh',
        provider: 'InstagramGraphAPI',
      });

      // Instagram Graph API refresh endpoint
      const response = await axios.get(this.refreshUrl, {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: params.refreshToken, // Current long-lived token
        },
      });

      const newToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 5184000; // Default 60 days

      if (!newToken) {
        throw new Error('No refreshed token received from Instagram Graph API');
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('Instagram Graph API token refreshed', {
        expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
        expiresAt: expiresAt.toISOString(),
        provider: 'InstagramGraphAPI',
      });

      return {
        accessToken: newToken,
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Instagram Graph API token refresh failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'InstagramGraphAPI',
      });

      const errorMessage = error.response?.data?.error_message || 
                          error.response?.data?.error?.message ||
                          error.message;
      throw new Error(`Instagram Graph API token refresh failed: ${errorMessage}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      logger.debug('Fetching Instagram Graph API user profile', {
        step: 'profile-fetch',
        provider: 'InstagramGraphAPI',
      });

      const response = await axios.get(`${this.apiBaseUrl}/me`, {
        params: {
          fields: 'id,username,account_type,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
          access_token: accessToken,
        },
      });

      const user = response.data;

      if (!user.id || !user.username) {
        throw new Error('Invalid user profile data received from Instagram Graph API');
      }

      logger.info('Instagram Graph API user profile fetched', {
        userId: user.id,
        username: user.username,
        accountType: user.account_type,
        followersCount: user.followers_count,
        provider: 'InstagramGraphAPI',
      });

      return {
        id: user.id,
        username: user.username,
        displayName: user.name || user.username,
        profileUrl: `https://instagram.com/${user.username}`,
        metadata: {
          platform: 'instagram',
          accountType: user.account_type, // BUSINESS or CREATOR
          profilePictureUrl: user.profile_picture_url,
          followersCount: user.followers_count,
          followsCount: user.follows_count,
          mediaCount: user.media_count,
          biography: user.biography,
          website: user.website,
        },
      };
    } catch (error: any) {
      logger.error('Instagram Graph API user profile fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'InstagramGraphAPI',
      });

      const errorMessage = error.response?.data?.error_message || 
                          error.response?.data?.error?.message ||
                          error.message;
      throw new Error(`Failed to fetch Instagram Graph API user profile: ${errorMessage}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    // Instagram Graph API doesn't provide a token revocation endpoint
    // Tokens expire after 60 days or can be revoked by the user in Instagram settings
    logger.info('Instagram Graph API token revocation not supported by API', {
      note: 'Tokens expire after 60 days or can be revoked by user in Instagram settings',
      provider: 'InstagramGraphAPI',
    });
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
      maxTextLength: 2200,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
      supportedContentTypes: ['feed', 'story', 'reel', 'carousel'],
    };
  }
}
