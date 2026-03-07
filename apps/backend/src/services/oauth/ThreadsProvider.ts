/**
 * Threads OAuth 2.0 Provider
 * 
 * Implements OAuth 2.0 for Meta Threads API
 * 
 * Documentation: https://developers.facebook.com/docs/threads
 * 
 * Required Scopes:
 * - threads_basic: Read basic profile information
 * - threads_content_publish: Publish content to Threads
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

export class ThreadsProvider extends OAuthProvider {
  private readonly authUrl = 'https://threads.net/oauth/authorize';
  private readonly tokenUrl = 'https://graph.threads.net/oauth/access_token';
  private readonly userUrl = 'https://graph.threads.net/v1.0/me';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = [
      'threads_basic',
      'threads_content_publish',
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'threads';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    try {
      const state = this.generateState();

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(','), // Threads uses comma-separated scopes
        state,
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated Threads OAuth URL', { state });

      return { url, state };
    } catch (error: any) {
      logger.error('Threads OAuth URL generation failed', { error: error.message });
      throw new Error(`Failed to generate Threads OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForToken(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: params.code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;

      logger.info('Threads token exchange successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: this.calculateExpiresAt(data.expires_in),
        scope: this.scopes, // Threads doesn't return scope in response
        tokenType: data.token_type || 'Bearer',
      };
    } catch (error: any) {
      logger.error('Threads token exchange failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Threads token exchange failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async refreshAccessToken(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: params.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;

      logger.info('Threads token refresh successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: this.calculateExpiresAt(data.expires_in),
        scope: this.scopes,
        tokenType: data.token_type || 'Bearer',
      };
    } catch (error: any) {
      logger.error('Threads token refresh failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Threads token refresh failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await axios.get(this.userUrl, {
        params: {
          fields: 'id,username,name,threads_profile_picture_url,threads_biography',
          access_token: accessToken,
        },
      });

      const user = response.data;

      logger.info('Threads user profile fetched', { userId: user.id });

      return {
        id: user.id,
        username: user.username,
        displayName: user.name || user.username,
        profileUrl: `https://threads.net/@${user.username}`,
        avatarUrl: user.threads_profile_picture_url,
        metadata: {
          biography: user.threads_biography,
        },
      };
    } catch (error: any) {
      logger.error('Threads user profile fetch failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Threads user profile: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}
