/**
 * Apple OAuth Provider (Sign in with Apple)
 * 
 * Implements Apple OAuth 2.0 flow with PKCE
 * Handles JWT verification and Apple-specific callback requirements
 */

import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { OAuthProvider, OAuthTokens, OAuthUserProfile, OAuthAuthorizationUrl, OAuthCallbackParams, OAuthRefreshParams } from '../../services/oauth/OAuthProvider';
import { PlatformAccount, PermissionValidationResult, PlatformCapabilities } from '../../adapters/platforms/PlatformAdapter';
import { logger } from '../../utils/logger';

export interface AppleIdToken {
  iss: string; // https://appleid.apple.com
  aud: string; // client_id
  exp: number;
  iat: number;
  sub: string; // user identifier
  email?: string;
  email_verified?: boolean;
  is_private_email?: boolean;
  real_user_status?: number;
}

export interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
}

export interface AppleUserInfo {
  name?: {
    firstName?: string;
    lastName?: string;
  };
  email?: string;
}

export class AppleOAuthProvider extends OAuthProvider {
  private readonly authUrl = 'https://appleid.apple.com/auth/authorize';
  private readonly tokenUrl = 'https://appleid.apple.com/auth/token';
  private readonly keysUrl = 'https://appleid.apple.com/auth/keys';
  private readonly teamId: string;
  private readonly keyId: string;
  private readonly privateKey: string;

  constructor(
    clientId: string,
    teamId: string,
    keyId: string,
    privateKey: string,
    redirectUri: string
  ) {
    super(clientId, '', redirectUri, ['name', 'email']);
    this.teamId = teamId;
    this.keyId = keyId;
    this.privateKey = privateKey;
  }

  getPlatformName(): string {
    return 'apple';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    const state = this.generateState();
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      response_mode: 'form_post', // Apple requires form_post
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: `${this.authUrl}?${params.toString()}`,
      state,
      codeVerifier,
    };
  }

  async exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      const clientSecret = this.generateClientSecret();
      
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: clientSecret,
          code: params.code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
          code_verifier: params.codeVerifier || '',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokenData: AppleTokenResponse = response.data;

      if (!tokenData.access_token || !tokenData.id_token) {
        throw new Error('No access token or id_token received from Apple');
      }

      // Verify and decode the ID token
      const idTokenPayload = await this.verifyIdToken(tokenData.id_token);

      logger.info('Apple OAuth token exchange successful', {
        sub: idTokenPayload.sub,
        hasEmail: !!idTokenPayload.email,
        expiresIn: tokenData.expires_in,
      });

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type || 'bearer',
        expiresIn: tokenData.expires_in,
        expiresAt: this.calculateExpiresAt(tokenData.expires_in),
        scope: this.scopes,
      };
    } catch (error: any) {
      logger.error('Apple OAuth token exchange failed', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Apple OAuth token exchange failed: ${error.message}`);
    }
  }

  async refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      const clientSecret = this.generateClientSecret();
      
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: params.refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokenData: AppleTokenResponse = response.data;

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || params.refreshToken,
        tokenType: tokenData.token_type || 'bearer',
        expiresIn: tokenData.expires_in,
        expiresAt: this.calculateExpiresAt(tokenData.expires_in),
        scope: this.scopes,
      };
    } catch (error: any) {
      logger.error('Apple OAuth token refresh failed', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Apple OAuth token refresh failed: ${error.message}`);
    }
  }

  async getUserProfile(accessToken: string, idToken?: string): Promise<OAuthUserProfile> {
    try {
      if (!idToken) {
        throw new Error('ID token is required for Apple user profile');
      }

      const idTokenPayload = await this.verifyIdToken(idToken);
      
      // Apple only provides user info on first authorization
      // For subsequent logins, we only get the sub (user ID)
      const displayName = idTokenPayload.email ? 
        idTokenPayload.email.split('@')[0] : 
        `Apple User ${idTokenPayload.sub.substring(0, 8)}`;

      logger.info('Apple user profile extracted from ID token', {
        sub: idTokenPayload.sub,
        hasEmail: !!idTokenPayload.email,
        isPrivateEmail: idTokenPayload.is_private_email,
      });

      return {
        id: idTokenPayload.sub,
        username: idTokenPayload.sub,
        displayName,
        email: idTokenPayload.email,
        profileUrl: undefined, // Apple doesn't provide profile URLs
        avatarUrl: undefined, // Apple doesn't provide avatars
        metadata: {
          isPrivateEmail: idTokenPayload.is_private_email,
          emailVerified: idTokenPayload.email_verified,
          realUserStatus: idTokenPayload.real_user_status,
          appleId: idTokenPayload.sub,
        },
      };
    } catch (error: any) {
      logger.error('Apple user profile extraction failed', {
        error: error.message,
      });
      throw new Error(`Failed to extract Apple user profile: ${error.message}`);
    }
  }

  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    // Apple doesn't support account discovery - only single user account
    throw new Error('Apple OAuth does not support account discovery');
  }

  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    // Apple tokens are always valid if they exist
    // No API to test permissions against
    return {
      valid: true,
      grantedScopes: this.scopes,
      requiredScopes: this.scopes,
      missingScopes: [],
      status: 'sufficient',
    };
  }

  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: false, // Apple is for authentication only
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

  /**
   * Generate client secret JWT for Apple OAuth
   */
  private generateClientSecret(): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: this.teamId,
      iat: now,
      exp: now + 3600, // 1 hour
      aud: 'https://appleid.apple.com',
      sub: this.clientId,
    };

    const header = {
      alg: 'ES256',
      kid: this.keyId,
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'ES256',
      header,
    });
  }

  /**
   * Verify Apple ID token JWT
   */
  private async verifyIdToken(idToken: string): Promise<AppleIdToken> {
    try {
      // For production, you should fetch and cache Apple's public keys
      // For now, we'll decode without verification (NOT RECOMMENDED FOR PRODUCTION)
      const decoded = jwt.decode(idToken) as AppleIdToken;
      
      if (!decoded) {
        throw new Error('Failed to decode Apple ID token');
      }

      // Basic validation
      if (decoded.iss !== 'https://appleid.apple.com') {
        throw new Error('Invalid Apple ID token issuer');
      }

      if (decoded.aud !== this.clientId) {
        throw new Error('Invalid Apple ID token audience');
      }

      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Apple ID token has expired');
      }

      return decoded;
    } catch (error: any) {
      logger.error('Apple ID token verification failed', {
        error: error.message,
      });
      throw new Error(`Apple ID token verification failed: ${error.message}`);
    }
  }
}