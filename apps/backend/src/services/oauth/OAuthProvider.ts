/**
 * OAuth Provider Interface
 * 
 * Defines the contract for all OAuth providers
 * Each platform (Twitter, LinkedIn, Facebook, Instagram) implements this interface
 * 
 * Now implements PlatformAdapter interface for Phase 3 integration
 */

import {
  PlatformAdapter,
  PlatformToken,
  PlatformAccount,
  AuthUrlResult,
  PermissionValidationResult,
  PlatformCapabilities,
} from '../../adapters/platforms/PlatformAdapter';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // Seconds until expiration
  expiresAt?: Date; // Absolute expiration time
  scope?: string[];
  tokenType?: string;
}

export interface OAuthUserProfile {
  id: string; // Platform user ID
  username: string;
  displayName: string;
  email?: string;
  profileUrl?: string;
  avatarUrl?: string;
  followerCount?: number;
  metadata?: Record<string, any>;
}

export interface OAuthAuthorizationUrl {
  url: string;
  state: string;
  codeVerifier?: string; // For PKCE
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  codeVerifier?: string; // For PKCE
}

export interface OAuthRefreshParams {
  refreshToken: string;
}

export abstract class OAuthProvider implements PlatformAdapter {
  protected clientId: string;
  protected clientSecret: string;
  protected redirectUri: string;
  protected scopes: string[];

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    scopes: string[]
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.scopes = scopes;
  }

  /**
   * Get the platform name
   */
  abstract getPlatformName(): string;

  /**
   * Generate authorization URL for OAuth flow (legacy method)
   * Returns URL and state parameter for CSRF protection
   */
  abstract getAuthorizationUrl(): Promise<OAuthAuthorizationUrl>;

  /**
   * Generate authorization URL for OAuth flow (PlatformAdapter interface)
   * @param redirectUri - OAuth callback URL
   * @param state - CSRF protection state parameter
   * @param scopes - Required OAuth scopes
   * @returns Authorization URL and optional PKCE parameters
   */
  async generateAuthUrl(
    redirectUri: string,
    state: string,
    scopes: string[]
  ): Promise<AuthUrlResult> {
    // Update redirect URI and scopes if provided
    if (redirectUri) this.redirectUri = redirectUri;
    if (scopes && scopes.length > 0) this.scopes = scopes;
    
    const result = await this.getAuthorizationUrl();
    return {
      authUrl: result.url,
      codeVerifier: result.codeVerifier,
    };
  }

  /**
   * Exchange authorization code for access token (legacy signature)
   */
  abstract exchangeCodeForTokenLegacy(params: OAuthCallbackParams): Promise<OAuthTokens>;

  /**
   * Exchange authorization code for access tokens (PlatformAdapter interface)
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - Must match the redirect URI used in authorization
   * @param codeVerifier - PKCE code verifier (Twitter only)
   * @returns Normalized platform token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<PlatformToken> {
    const tokens = await this.exchangeCodeForTokenLegacy({ code, state: '', codeVerifier });
    return this.normalizeToPlatformToken(tokens);
  }

  /**
   * Refresh access token using refresh token (legacy signature)
   */
  abstract refreshAccessTokenLegacy(params: OAuthRefreshParams): Promise<OAuthTokens>;

  /**
   * Refresh access token using refresh token (PlatformAdapter interface)
   * @param refreshToken - Current refresh token
   * @returns New platform token
   */
  async refreshAccessToken(refreshToken: string): Promise<PlatformToken> {
    const tokens = await this.refreshAccessTokenLegacy({ refreshToken });
    return this.normalizeToPlatformToken(tokens);
  }

  /**
   * Get user profile information
   */
  abstract getUserProfile(accessToken: string): Promise<OAuthUserProfile>;

  /**
   * Discover available accounts for connection (PlatformAdapter interface)
   * Must be implemented by each platform
   * @param accessToken - User access token
   * @returns List of available accounts (Pages, profiles, etc.)
   */
  abstract discoverAccounts(accessToken: string): Promise<PlatformAccount[]>;

  /**
   * Validate granted permissions (PlatformAdapter interface)
   * Must be implemented by each platform
   * @param accessToken - Access token to validate
   * @returns Permission validation result
   */
  abstract validatePermissions(accessToken: string): Promise<PermissionValidationResult>;

  /**
   * Get platform capabilities (PlatformAdapter interface)
   * Must be implemented by each platform
   * @param accountType - Type of account (e.g., Business, Personal)
   * @returns Platform capabilities metadata
   */
  abstract getCapabilities(accountType?: string): PlatformCapabilities;

  /**
   * Revoke access token (optional, not all platforms support this)
   */
  async revokeToken(accessToken: string): Promise<void> {
    // Default implementation does nothing
    // Override in platform-specific providers if supported
  }

  /**
   * Validate token (check if still valid)
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserProfile(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate secure random state parameter for CSRF protection
   * 256-bit entropy encoded as base64url (~43 characters)
   */
  protected generateState(): string {
    return require('crypto').randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  protected generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Calculate token expiration date
   */
  protected calculateExpiresAt(expiresIn: number): Date {
    return new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Normalize OAuthTokens to PlatformToken format
   * Helper method for adapter methods
   */
  protected normalizeToPlatformToken(tokens: OAuthTokens): PlatformToken {
    const platformName = this.getPlatformName() as any;
    
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || null,
      expiresAt: tokens.expiresAt || null,
      tokenType: this.getTokenType(tokens.tokenType),
      platform: platformName,
    };
  }

  /**
   * Get normalized token type
   */
  protected getTokenType(tokenType?: string): 'bearer' | 'page' | 'user' {
    if (!tokenType) return 'bearer';
    const normalized = tokenType.toLowerCase();
    if (normalized === 'page') return 'page';
    if (normalized === 'user') return 'user';
    return 'bearer';
  }
}
