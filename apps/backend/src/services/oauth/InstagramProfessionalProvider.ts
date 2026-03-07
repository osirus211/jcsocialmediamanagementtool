/**
 * Instagram Professional API Provider
 * 
 * Implements OAuth 2.0 for Instagram Professional accounts (Business and Creator)
 * via Instagram API with Instagram Login
 * 
 * Documentation: https://developers.facebook.com/docs/instagram-api
 * 
 * Security Features:
 * - OAuth 2.0 via Instagram Login
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
 * Note: This provider uses Instagram API directly (not Facebook Login)
 * and supports full publishing capabilities for Professional accounts.
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
  private readonly authUrl = 'https://api.instagram.com/oauth/authorize';
  private readonly tokenUrl = 'https://api.instagram.com/oauth/access_token';
  private readonly apiBaseUrl = 'https://graph.instagram.com';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    // Instagram Professional API scopes
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

      logger.info('Generated Instagram Professional OAuth URL', { 
        state: state.substring(0, 10) + '...',
        provider: 'InstagramProfessionalProvider',
      });

      return { url, state };
    } catch (error: any) {
      logger.error('Instagram Professional OAuth URL generation failed', {
        error: error.message,
        provider: 'InstagramProfessionalProvider',
      });
      throw new Error(`Failed to generate Instagram Professional OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForToken(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      logger.debug('Exchanging code for Instagram Professional token', {
        step: 'token-exchange',
        provider: 'InstagramProfessionalProvider',
      });

      const formData = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code: params.code,
      });

      const response = await axios.post(this.tokenUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const accessToken = response.data.access_token;
      const userId = response.data.user_id;
      const expiresIn = response.data.expires_in || 5184000; // Default 60 days

      if (!accessToken) {
        throw new Error('No access token received from Instagram Professional API');
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('Instagram Professional token obtained', {
        userId,
        expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
        expiresAt: expiresAt.toISOString(),
        provider: 'InstagramProfessionalProvider',
      });

      return {
        accessToken,
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Instagram Professional token exchange failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'InstagramProfessionalProvider',
      });

      const errorMessage = error.response?.data?.error_message || 
                          error.response?.data?.error?.message ||
                          error.message;
      throw new Error(`Instagram Professional token exchange failed: ${errorMessage}`);
    }
  }

  async refreshAccessToken(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      logger.debug('Refreshing Instagram Professional token', {
        step: 'token-refresh',
        provider: 'InstagramProfessionalProvider',
      });

      // Instagram Professional API uses the current access token to get a new one
      const response = await axios.get(`${this.apiBaseUrl}/refresh_access_token`, {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: params.refreshToken, // Actually the current access token
        },
      });

      const newToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 5184000; // Default 60 days

      if (!newToken) {
        throw new Error('No refreshed token received from Instagram Professional API');
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('Instagram Professional token refreshed', {
        expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
        expiresAt: expiresAt.toISOString(),
        provider: 'InstagramProfessionalProvider',
      });

      return {
        accessToken: newToken,
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Instagram Professional token refresh failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'InstagramProfessionalProvider',
      });

      const errorMessage = error.response?.data?.error_message || 
                          error.response?.data?.error?.message ||
                          error.message;
      throw new Error(`Instagram Professional token refresh failed: ${errorMessage}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      logger.debug('Fetching Instagram Professional user profile', {
        step: 'profile-fetch',
        provider: 'InstagramProfessionalProvider',
      });

      const response = await axios.get(`${this.apiBaseUrl}/me`, {
        params: {
          fields: 'id,username,account_type',
          access_token: accessToken,
        },
      });

      const user = response.data;

      if (!user.id || !user.username) {
        throw new Error('Invalid user profile data received from Instagram Professional API');
      }

      logger.info('Instagram Professional user profile fetched', {
        userId: user.id,
        username: user.username,
        accountType: user.account_type,
        provider: 'InstagramProfessionalProvider',
      });

      return {
        id: user.id,
        username: user.username,
        displayName: user.username,
        profileUrl: `https://instagram.com/${user.username}`,
        metadata: {
          platform: 'instagram',
          accountType: user.account_type, // BUSINESS or CREATOR
        },
      };
    } catch (error: any) {
      logger.error('Instagram Professional user profile fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'InstagramProfessionalProvider',
      });

      const errorMessage = error.response?.data?.error_message || 
                          error.response?.data?.error?.message ||
                          error.message;
      throw new Error(`Failed to fetch Instagram Professional user profile: ${errorMessage}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    // Instagram Professional API doesn't provide a token revocation endpoint
    // Tokens expire after 60 days or can be revoked by the user in Instagram settings
    logger.info('Instagram Professional token revocation not supported by API', {
      note: 'Tokens expire after 60 days or can be revoked by user in Instagram settings',
      provider: 'InstagramProfessionalProvider',
    });
  }
}
