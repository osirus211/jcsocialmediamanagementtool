/**
 * Platform Adapter Interface for OAuth Integrations
 * 
 * Defines the contract for real social media platform API integrations
 * Replaces mock implementations with production-ready OAuth flows
 * 
 * Supports: Facebook, Instagram, Twitter/X, LinkedIn, TikTok
 */

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'threads' | 'bluesky' | 'youtube' | 'pinterest' | 'google-business';
export type TokenType = 'bearer' | 'page' | 'user';
export type AccountType = 'personal' | 'business' | 'creator' | 'page' | 'organization';
export type PermissionStatus = 'sufficient' | 'insufficient_permissions';

/**
 * Normalized token structure across all platforms
 */
export interface PlatformToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  tokenType: TokenType;
  platform: SocialPlatform;
}

/**
 * Standardized account information from discovery
 */
export interface PlatformAccount {
  platformAccountId: string;
  accountName: string;
  accountType: AccountType;
  metadata: {
    profileUrl?: string;
    avatarUrl?: string;
    followerCount?: number;
    linkedPageId?: string; // Instagram only
    linkedPageName?: string; // Instagram only
    category?: string; // Facebook only
    [key: string]: any;
  };
  pageAccessToken?: string; // Facebook/Instagram only
}

/**
 * OAuth authorization URL result
 */
export interface AuthUrlResult {
  authUrl: string;
  codeVerifier?: string; // PKCE for Twitter
}

/**
 * Permission validation result
 */
export interface PermissionValidationResult {
  valid: boolean;
  grantedScopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  status: PermissionStatus;
}

/**
 * Platform capabilities metadata
 */
export interface PlatformCapabilities {
  publishPost: boolean;
  publishVideo: boolean;
  publishImage: boolean;
  publishCarousel: boolean;
  analytics: boolean;
  stories: boolean;
  reels: boolean;
  scheduling: boolean;
  maxVideoSize?: number; // bytes
  maxImageSize?: number; // bytes
  supportedFormats?: string[];
}

/**
 * Core Platform Adapter Interface
 * 
 * All platform adapters must implement this interface
 */
export interface PlatformAdapter {
  /**
   * Generate OAuth authorization URL
   * @param redirectUri - OAuth callback URL
   * @param state - CSRF protection state parameter
   * @param scopes - Required OAuth scopes
   * @returns Authorization URL and optional PKCE parameters
   */
  generateAuthUrl(
    redirectUri: string,
    state: string,
    scopes: string[]
  ): Promise<AuthUrlResult>;

  /**
   * Exchange authorization code for access tokens
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - Must match the redirect URI used in authorization
   * @param codeVerifier - PKCE code verifier (Twitter only)
   * @returns Normalized platform token
   */
  exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<PlatformToken>;

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Current refresh token
   * @returns New platform token
   */
  refreshAccessToken(refreshToken: string): Promise<PlatformToken>;

  /**
   * Discover available accounts for connection
   * @param accessToken - User access token
   * @returns List of available accounts (Pages, profiles, etc.)
   */
  discoverAccounts(accessToken: string): Promise<PlatformAccount[]>;

  /**
   * Validate granted permissions
   * @param accessToken - Access token to validate
   * @returns Permission validation result
   */
  validatePermissions(accessToken: string): Promise<PermissionValidationResult>;

  /**
   * Get platform capabilities
   * @param accountType - Type of account (e.g., Business, Personal)
   * @returns Platform capabilities metadata
   */
  getCapabilities(accountType?: string): PlatformCapabilities;
}
