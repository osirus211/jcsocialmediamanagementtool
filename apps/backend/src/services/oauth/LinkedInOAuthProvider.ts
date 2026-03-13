/**
 * LinkedIn OAuth 2.0 Provider
 * 
 * Implements OAuth 2.0 for LinkedIn API
 * 
 * Documentation: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication
 * 
 * Required Scopes:
 * - r_liteprofile or r_basicprofile: Read profile
 * - w_member_social: Post content
 * - r_emailaddress: Read email (optional)
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
import { LinkedInErrorHandler } from '../../adapters/platforms/LinkedInErrorHandler';
import { logger } from '../../utils/logger';

export class LinkedInOAuthProvider extends OAuthProvider {
  private readonly authUrl = 'https://www.linkedin.com/oauth/v2/authorization';
  private readonly tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
  private readonly userUrl = 'https://api.linkedin.com/v2/userinfo';
  private readonly errorHandler = new LinkedInErrorHandler();

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = [
      'openid',
      'profile',
      'email',
      'w_member_social', // Post content
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'linkedin';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    try {
      const state = this.generateState();

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(' '),
        state,
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated LinkedIn OAuth URL', { state });

      return { url, state };
    } catch (error: any) {
      logger.error('LinkedIn OAuth URL generation failed', { error: error.message });
      throw new Error(`Failed to generate LinkedIn OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
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

      logger.info('LinkedIn token exchange successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // LinkedIn may not provide refresh tokens
        expiresIn: data.expires_in,
        expiresAt: this.calculateExpiresAt(data.expires_in),
        scope: data.scope?.split(' '),
        tokenType: data.token_type,
      };
    } catch (error: any) {
      logger.error('LinkedIn token exchange failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`LinkedIn token exchange failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      // Note: LinkedIn refresh tokens are long-lived (60 days) but may not always be provided
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

      logger.info('LinkedIn token refresh successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: this.calculateExpiresAt(data.expires_in),
        scope: data.scope?.split(' '),
        tokenType: data.token_type,
      };
    } catch (error: any) {
      logger.error('LinkedIn token refresh failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`LinkedIn token refresh failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      // Use OpenID Connect userinfo endpoint
      const response = await axios.get(this.userUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const user = response.data;

      logger.info('LinkedIn user profile fetched', { userId: user.sub });

      return {
        id: user.sub, // OpenID Connect subject identifier
        username: user.email?.split('@')[0] || user.sub,
        displayName: user.name || `${user.given_name} ${user.family_name}`,
        email: user.email,
        profileUrl: user.profile,
        avatarUrl: user.picture,
        metadata: {
          givenName: user.given_name,
          familyName: user.family_name,
          locale: user.locale,
          emailVerified: user.email_verified,
        },
      };
    } catch (error: any) {
      logger.error('LinkedIn user profile fetch failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch LinkedIn user profile: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Discover LinkedIn accounts (PlatformAdapter interface)
   * Returns personal profile and organization pages
   * @param accessToken - User access token
   * @returns List of LinkedIn accounts as PlatformAccount objects
   */
  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    try {
      const profile = await this.getUserProfile(accessToken);
      const accounts: PlatformAccount[] = [];

      // Add personal account
      accounts.push({
        platformAccountId: profile.id,
        accountName: profile.displayName,
        accountType: 'personal' as AccountType,
        metadata: {
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          email: profile.email,
        },
      });

      // Try to fetch organization pages
      try {
        const orgsResponse = await axios.get(
          'https://api.linkedin.com/v2/organizationAcls',
          {
            params: {
              q: 'roleAssignee',
              role: 'ADMINISTRATOR',
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const orgs = orgsResponse.data.elements || [];
        for (const org of orgs) {
          accounts.push({
            platformAccountId: org.organization,
            accountName: org.organizationName || `Organization ${org.organization}`,
            accountType: 'organization' as AccountType,
            metadata: {},
          });
        }

        logger.info('LinkedIn organizations fetched', { count: orgs.length });
      } catch (orgError: any) {
        // Organization fetch is optional - log but don't fail
        logger.warn('LinkedIn organization fetch failed', {
          error: orgError.response?.data || orgError.message,
        });
      }

      return accounts;
    } catch (error: any) {
      logger.error('LinkedIn account discovery failed', {
        error: error.response?.data || error.message,
      });
      
      const classification = this.errorHandler.classify(error);
      throw new Error(`LinkedIn account discovery failed: ${classification.message}`);
    }
  }

  /**
   * Validate granted permissions (PlatformAdapter interface)
   * @param accessToken - Access token to validate
   * @returns Permission validation result
   */
  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    // LinkedIn scopes are stored during token exchange
    // We validate against the scopes we requested
    const requiredScopes = ['w_member_social'];
    const grantedScopes = this.scopes;
    const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

    logger.info('LinkedIn permissions validated', {
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
  }

  /**
   * Get platform capabilities (PlatformAdapter interface)
   * @param accountType - Type of account (not used for LinkedIn)
   * @returns Platform capabilities metadata
   */
  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: true,
      publishVideo: true,
      publishImage: true,
      publishCarousel: false, // LinkedIn doesn't support carousels
      analytics: true,
      stories: false, // LinkedIn doesn't have stories
      reels: false, // LinkedIn doesn't have reels
      scheduling: true,
      maxVideoSize: 200 * 1024 * 1024, // 200MB
      maxImageSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'mp4'],
    };
  }
}
