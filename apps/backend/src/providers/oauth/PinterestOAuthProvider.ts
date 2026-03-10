/**
 * Pinterest OAuth Provider
 * Handles Pinterest OAuth 2.0 authentication flow
 */

import { OAuthProvider } from '../../services/oauth/OAuthProvider';
import { logger } from '../../utils/logger';

export interface PinterestTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface PinterestUserProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
  profile_image: string;
  follower_count: number;
  following_count: number;
  pin_count: number;
  board_count: number;
}

export class PinterestOAuthProvider extends OAuthProvider {
  private readonly authUrl = 'https://www.pinterest.com/oauth/';
  private readonly tokenUrl = 'https://api.pinterest.com/v5/oauth/token';
  private readonly apiBaseUrl = 'https://api.pinterest.com/v5';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = ['boards:read', 'pins:read', 'pins:write'];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'pinterest';
  }

  async getAuthorizationUrl(): Promise<{ url: string; state: string }> {
    try {
      const state = this.generateState();
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: this.scopes.join(','),
        state,
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated Pinterest OAuth URL', {
        clientId: this.clientId.substring(0, 8) + '...',
        state: state.substring(0, 10) + '...',
        provider: 'PinterestOAuthProvider',
      });

      return { url, state };
    } catch (error: any) {
      logger.error('Pinterest OAuth URL generation failed', {
        error: error.message,
        provider: 'PinterestOAuthProvider',
      });
      throw error;
    }
  }

  async exchangeCodeForTokens(code: string, state: string): Promise<any> {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinterest token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData: PinterestTokenResponse = await response.json();

      logger.info('Pinterest token exchange successful', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        provider: 'PinterestOAuthProvider',
      });

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresIn: tokenData.expires_in || 3600,
        expiresAt: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : new Date(Date.now() + 3600 * 1000),
        tokenType: tokenData.token_type || 'bearer',
        scope: tokenData.scope,
      };
    } catch (error: any) {
      logger.error('Pinterest token exchange failed', {
        error: error.message,
        provider: 'PinterestOAuthProvider',
      });
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<any> {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinterest token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData: PinterestTokenResponse = await response.json();

      logger.info('Pinterest token refresh successful', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        provider: 'PinterestOAuthProvider',
      });

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresIn: tokenData.expires_in || 3600,
        expiresAt: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : new Date(Date.now() + 3600 * 1000),
        tokenType: tokenData.token_type || 'bearer',
        scope: tokenData.scope,
      };
    } catch (error: any) {
      logger.error('Pinterest token refresh failed', {
        error: error.message,
        provider: 'PinterestOAuthProvider',
      });
      throw error;
    }
  }

  async getAccountInfo(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/user_account`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinterest user info failed: ${response.status} ${errorText}`);
      }

      const userData: PinterestUserProfile = await response.json();

      logger.info('Pinterest user info retrieved', {
        userId: userData.id,
        username: userData.username,
        provider: 'PinterestOAuthProvider',
      });

      return {
        id: userData.id,
        username: userData.username,
        displayName: `${userData.first_name} ${userData.last_name}`.trim() || userData.username,
        profileUrl: `https://pinterest.com/${userData.username}`,
        avatarUrl: userData.profile_image,
        metadata: {
          platform: 'pinterest',
          bio: userData.bio,
          followerCount: userData.follower_count,
          followingCount: userData.following_count,
          pinCount: userData.pin_count,
          boardCount: userData.board_count,
        },
      };
    } catch (error: any) {
      logger.error('Pinterest user info failed', {
        error: error.message,
        provider: 'PinterestOAuthProvider',
      });
      throw error;
    }
  }
}