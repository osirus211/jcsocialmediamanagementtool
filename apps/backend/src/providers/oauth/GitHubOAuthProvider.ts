/**
 * GitHub OAuth Provider
 * 
 * Implements GitHub OAuth 2.0 flow for user authentication
 * Handles private email settings using GitHub email API
 */

import axios from 'axios';
import { OAuthProvider, OAuthTokens, OAuthUserProfile, OAuthAuthorizationUrl, OAuthCallbackParams, OAuthRefreshParams } from '../../services/oauth/OAuthProvider';
import { PlatformAccount, PermissionValidationResult, PlatformCapabilities } from '../../adapters/platforms/PlatformAdapter';
import { logger } from '../../utils/logger';

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: 'public' | 'private' | null;
}

export class GitHubOAuthProvider extends OAuthProvider {
  private readonly authUrl = 'https://github.com/login/oauth/authorize';
  private readonly tokenUrl = 'https://github.com/login/oauth/access_token';
  private readonly apiUrl = 'https://api.github.com';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    super(clientId, clientSecret, redirectUri, ['user:email', 'read:user']);
  }

  getPlatformName(): string {
    return 'github';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    const state = this.generateState();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state,
      response_type: 'code',
    });

    return {
      url: `${this.authUrl}?${params.toString()}`,
      state,
    };
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        this.tokenUrl,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: params.code,
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      const { access_token, token_type, scope } = response.data;

      if (!access_token) {
        throw new Error('No access token received from GitHub');
      }

      logger.info('GitHub OAuth token exchange successful', {
        scope: scope || 'unknown',
        tokenType: token_type || 'bearer',
      });

      return {
        accessToken: access_token,
        tokenType: token_type || 'bearer',
        scope: scope ? scope.split(',') : this.scopes,
      };
    } catch (error: any) {
      logger.error('GitHub OAuth token exchange failed', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`GitHub OAuth token exchange failed: ${error.message}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    // GitHub doesn't support refresh tokens - tokens don't expire
    throw new Error('GitHub OAuth tokens do not expire and cannot be refreshed');
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      // Get user profile
      const userResponse = await axios.get<GitHubUserProfile>(`${this.apiUrl}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const user = userResponse.data;
      let email = user.email;

      // If email is null (private), fetch from emails API
      if (!email) {
        try {
          const emailsResponse = await axios.get<GitHubEmail[]>(`${this.apiUrl}/user/emails`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });

          // Find primary email
          const primaryEmail = emailsResponse.data.find(e => e.primary && e.verified);
          email = primaryEmail?.email || null;
        } catch (emailError: any) {
          logger.warn('Failed to fetch GitHub user emails', {
            error: emailError.message,
            userId: user.id,
          });
        }
      }

      logger.info('GitHub user profile fetched successfully', {
        userId: user.id,
        username: user.login,
        hasEmail: !!email,
      });

      return {
        id: user.id.toString(),
        username: user.login,
        displayName: user.name || user.login,
        email: email || undefined,
        profileUrl: user.html_url,
        avatarUrl: user.avatar_url,
        followerCount: user.followers,
        metadata: {
          publicRepos: user.public_repos,
          following: user.following,
          githubId: user.id,
        },
      };
    } catch (error: any) {
      logger.error('GitHub user profile fetch failed', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to fetch GitHub user profile: ${error.message}`);
    }
  }

  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    try {
      const profile = await this.getUserProfile(accessToken);
      
      return [{
        platformAccountId: profile.id,
        accountName: profile.displayName,
        accountType: 'personal',
        metadata: {
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          followerCount: profile.followerCount,
          ...profile.metadata,
        },
      }];
    } catch (error: any) {
      logger.error('GitHub account discovery failed', {
        error: error.message,
      });
      throw new Error(`Failed to discover GitHub accounts: ${error.message}`);
    }
  }

  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    try {
      // Test API access with a simple user call
      await axios.get(`${this.apiUrl}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      return {
        valid: true,
        grantedScopes: this.scopes,
        requiredScopes: this.scopes,
        missingScopes: [],
        status: 'sufficient',
      };
    } catch (error: any) {
      logger.error('GitHub permission validation failed', {
        error: error.message,
        response: error.response?.data,
      });

      return {
        valid: false,
        grantedScopes: [],
        requiredScopes: this.scopes,
        missingScopes: this.scopes,
        status: 'insufficient_permissions',
      };
    }
  }

  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: false, // GitHub is for authentication only
      publishVideo: false,
      publishImage: false,
      publishCarousel: false,
      analytics: false,
      stories: false,
      reels: false,
      scheduling: false,
      supportedFormats: [],
    };
  }
}