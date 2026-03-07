/**
 * Instagram Basic Display API Provider - PRODUCTION
 * 
 * Implements OAuth 2.0 for Instagram Personal accounts via Instagram Basic Display API
 * 
 * Documentation: https://developers.facebook.com/docs/instagram-basic-display-api
 * 
 * Security Features:
 * - OAuth 2.0 via Instagram Login
 * - 256-bit state parameter
 * - Long-lived access tokens (60 days)
 * - Token expiration tracking
 * 
 * Required Scopes:
 * - user_profile: Basic Instagram profile access
 * - user_media: Access to user's media
 * 
 * Limitations:
 * - Read-only access (no publishing)
 * - No insights/analytics
 * - No comment moderation
 * - Personal accounts only
 * 
 * Note: This provider is for personal Instagram accounts that don't require
 * a Facebook Business Page connection.
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

export class InstagramBasicDisplayProvider extends OAuthProvider {
  private readonly authUrl = 'https://api.instagram.com/oauth/authorize';
  private readonly tokenUrl = 'https://api.instagram.com/oauth/access_token';
  private readonly longLivedTokenUrl = 'https://graph.instagram.com/access_token';
  private readonly profileUrl = 'https://graph.instagram.com/me';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    // Instagram Basic Display scopes
    const scopes = ['user_profile', 'user_media'];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'instagram-basic';
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

      logger.info('Generated Instagram Basic Display OAuth URL', { state });

      return { url, state };
    } catch (error: any) {
      logger.error('Instagram Basic Display OAuth URL generation failed', {
        error: error.message,
      });
      throw new Error(`Failed to generate Instagram Basic Display OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForToken(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      // Step 1: Exchange code for short-lived token
      const formData = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code: params.code,
      });

      logger.debug('Exchanging code for short-lived token', {
        step: 'short-lived-token-exchange',
      });

      const shortLivedResponse = await axios.post(this.tokenUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const shortLivedToken = shortLivedResponse.data.access_token;
      const shortLivedUserId = shortLivedResponse.data.user_id;

      if (!shortLivedToken) {
        throw new Error('No access token received from Instagram');
      }

      logger.info('Instagram Basic Display short-lived token obtained', {
        userId: shortLivedUserId,
      });

      // Step 2: Exchange short-lived token for long-lived token (60 days)
      logger.debug('Exchanging short-lived token for long-lived token', {
        step: 'long-lived-token-exchange',
      });

      const longLivedResponse = await axios.get(this.longLivedTokenUrl, {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.clientSecret,
          access_token: shortLivedToken,
        },
      });

      const longLivedToken = longLivedResponse.data.access_token;
      const longLivedExpiresIn = longLivedResponse.data.expires_in;
      const tokenType = longLivedResponse.data.token_type || 'bearer';

      if (!longLivedToken) {
        throw new Error('No long-lived token received from Instagram');
      }

      logger.info('Instagram Basic Display long-lived token obtained', {
        expiresIn: longLivedExpiresIn,
        expiresInDays: Math.floor(longLivedExpiresIn / 86400),
        userId: shortLivedUserId,
      });

      return {
        accessToken: longLivedToken,
        expiresIn: longLivedExpiresIn,
        expiresAt: this.calculateExpiresAt(longLivedExpiresIn),
        tokenType,
      };
    } catch (error: any) {
      // Determine which step failed for better error reporting
      const step = error.config?.url?.includes('graph.instagram.com')
        ? 'long-lived-token-exchange'
        : 'short-lived-token-exchange';

      logger.error('Instagram Basic Display token exchange failed', {
        step,
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
      });

      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Instagram Basic Display token exchange failed at step "${step}": ${errorMessage}`);
    }
  }

  async refreshAccessToken(params: OAuthRefreshParams): Promise<OAuthTokens> {
    // Instagram Basic Display long-lived tokens can be refreshed
    // by exchanging them for new long-lived tokens
    try {
      logger.debug('Refreshing Instagram Basic Display token', {
        step: 'token-refresh',
      });

      const response = await axios.get(this.longLivedTokenUrl, {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: params.refreshToken, // Actually the current access token
        },
      });

      const newToken = response.data.access_token;
      const expiresIn = response.data.expires_in;
      const tokenType = response.data.token_type || 'bearer';

      if (!newToken) {
        throw new Error('No refreshed token received from Instagram');
      }

      logger.info('Instagram Basic Display token refreshed', {
        expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
      });

      return {
        accessToken: newToken,
        expiresIn,
        expiresAt: this.calculateExpiresAt(expiresIn),
        tokenType,
      };
    } catch (error: any) {
      logger.error('Instagram Basic Display token refresh failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
      });

      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Instagram Basic Display token refresh failed: ${errorMessage}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      logger.debug('Fetching Instagram Basic Display user profile', {
        step: 'profile-fetch',
      });

      const response = await axios.get(this.profileUrl, {
        params: {
          fields: 'id,username,account_type',
          access_token: accessToken,
        },
      });

      const user = response.data;

      if (!user.id || !user.username) {
        throw new Error('Invalid user profile data received from Instagram');
      }

      logger.info('Instagram Basic Display user profile fetched', {
        userId: user.id,
        username: user.username,
        accountType: user.account_type,
      });

      return {
        id: user.id,
        username: user.username,
        displayName: user.username,
        profileUrl: `https://instagram.com/${user.username}`,
        metadata: {
          platform: 'instagram-basic',
          accountType: user.account_type,
        },
      };
    } catch (error: any) {
      logger.error('Instagram Basic Display user profile fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
      });

      const errorMessage = error.response?.data?.error_message || error.message;
      throw new Error(`Failed to fetch Instagram Basic Display user profile: ${errorMessage}`);
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    // Instagram Basic Display API doesn't provide a token revocation endpoint
    // Tokens expire after 60 days or can be revoked by the user in Instagram settings
    logger.info('Instagram Basic Display token revocation not supported by API', {
      note: 'Tokens expire after 60 days or can be revoked by user in Instagram settings',
    });
  }
}
