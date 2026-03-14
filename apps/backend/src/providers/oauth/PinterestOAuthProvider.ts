/**
 * Pinterest OAuth Provider
 * Handles Pinterest OAuth 2.0 authentication flow using Pinterest API v5
 */

import { OAuthProvider } from '../../services/oauth/OAuthProvider';
import { logger } from '../../utils/logger';
import { BadRequestError, UnauthorizedError } from '../../utils/errors';

export interface PinterestTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

export interface PinterestUserProfile {
  id: string;
  username: string;
  displayName?: string; // Add displayName for OAuthUserProfile compliance
  first_name?: string;
  last_name?: string;
  bio?: string;
  profile_image?: string;
  follower_count?: number;
  following_count?: number;
  monthly_views?: number;
  account_type: 'PERSONAL' | 'BUSINESS';
  website_url?: string;
}

export interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
  pin_count?: number;
  follower_count?: number;
  media?: {
    image_cover_url?: string;
  };
}

export class PinterestOAuthProvider extends OAuthProvider {
  private readonly authUrl = 'https://www.pinterest.com/oauth/';
  private readonly tokenUrl = 'https://api.pinterest.com/v5/oauth/token';
  private readonly apiBaseUrl = 'https://api.pinterest.com/v5';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = [
      'boards:read',
      'boards:write', 
      'pins:read',
      'pins:write',
      'user_accounts:read',
      'ads:read' // Optional for analytics
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'pinterest';
  }

  async getAuthorizationUrl(): Promise<{ url: string; state: string }> {
    const state = this.generateState();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(','),
      state,
    });
    const url = `${this.authUrl}?${params.toString()}`;
    
    logger.info('Generated Pinterest authorization URL', {
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      scopes: this.scopes,
      state
    });
    
    return { url, state };
  }

  async exchangeCodeForTokens(code: string, state: string): Promise<PinterestTokenResponse> {
    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Pinterest token exchange failed', {
          status: response.status,
          error: errorText,
        });
        throw new BadRequestError(`Pinterest token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData: any = await response.json();
      
      logger.info('Pinterest token exchange successful', {
        scope: tokenData.scope,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      });

      return tokenData;
    } catch (error: any) {
      logger.error('Pinterest token exchange error', {
        error: error.message,
        code: code.substring(0, 10) + '...',
      });
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<any> {
    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: this.scopes.join(','),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Pinterest token refresh failed', {
          status: response.status,
          error: errorText,
        });
        throw new UnauthorizedError(`Pinterest token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData: any = await response.json();
      
      logger.info('Pinterest token refresh successful', {
        scope: tokenData.scope,
        expiresIn: tokenData.expires_in,
      });

      return tokenData;
    } catch (error: any) {
      logger.error('Pinterest token refresh error', {
        error: error.message,
      });
      throw error;
    }
  }

  async getAccountInfo(accessToken: string): Promise<PinterestUserProfile> {
    return this.getUserProfile(accessToken);
  }

  async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/user_account`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Pinterest user profile fetch failed', {
          status: response.status,
          error: errorText,
        });
        throw new UnauthorizedError(`Pinterest user profile fetch failed: ${response.status} ${errorText}`);
      }

      const profile: any = await response.json();
      
      // Add displayName for compatibility
      profile.displayName = profile.username;
      
      logger.info('Pinterest user profile fetched successfully', {
        username: profile.username,
        accountType: profile.account_type,
        followerCount: profile.follower_count,
      });

      return profile;
    } catch (error: any) {
      logger.error('Pinterest user profile fetch error', {
        error: error.message,
      });
      throw error;
    }
  }

  async getUserBoards(accessToken: string): Promise<PinterestBoard[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/boards?page_size=100`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Pinterest boards fetch failed', {
          status: response.status,
          error: errorText,
        });
        throw new UnauthorizedError(`Pinterest boards fetch failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const boards: PinterestBoard[] = (data as any).items || [];
      
      logger.info('Pinterest boards fetched successfully', {
        boardCount: boards.length,
      });

      return boards;
    } catch (error: any) {
      logger.error('Pinterest boards fetch error', {
        error: error.message,
      });
      throw error;
    }
  }

  async discoverAccounts(accessToken: string): Promise<any[]> {
    const profile = await this.getUserProfile(accessToken);
    return [{
      platformAccountId: profile.id,
      accountName: profile.username,
      accountType: profile.account_type,
      metadata: profile
    }];
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserProfile(accessToken);
      return true;
    } catch (error) {
      logger.warn('Pinterest token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    // Pinterest doesn't have a token revocation endpoint in API v5
    // Tokens expire automatically based on expires_in
    logger.info('Pinterest token revocation requested (no API endpoint available)');
  }

  async validatePermissions(accessToken: string): Promise<any> {
    try {
      // Test basic permissions by fetching user profile and boards
      await this.getUserProfile(accessToken);
      await this.getUserBoards(accessToken);
      
      return { 
        valid: true, 
        missingScopes: [],
        grantedScopes: this.scopes,
        requiredScopes: this.scopes,
        status: 'valid'
      };
    } catch (error) {
      logger.warn('Pinterest permissions validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { 
        valid: false, 
        missingScopes: this.scopes,
        grantedScopes: [],
        requiredScopes: this.scopes,
        status: 'invalid'
      };
    }
  }

  getCapabilities(): any {
    return {
      publishPost: true,
      publishVideo: true,
      publishImage: true,
      publishCarousel: false,
      publishStory: false,
      publishReel: false,
      supportsScheduling: true,
      supportsHashtags: true
    };
  }

  // Legacy methods for compatibility
  async exchangeCodeForTokenLegacy(params: any): Promise<any> {
    return this.exchangeCodeForTokens(params.code, params.state);
  }

  async refreshAccessTokenLegacy(params: any): Promise<any> {
    return this.refreshAccessToken(params.refresh_token);
  }
}