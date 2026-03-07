/**
 * Platform Adapter Interface
 * 
 * Defines the contract for social media platform integrations
 * 
 * Each platform (Twitter, LinkedIn, Facebook, Instagram) implements this interface
 */

export interface PublishResult {
  success: boolean;
  platformPostId: string;
  publishedAt: Date;
  url?: string;
}

export interface AccountInfo {
  accountId: string;
  accountName: string;
  profileUrl?: string;
  avatarUrl?: string;
  followerCount?: number;
  metadata?: any;
}

export interface PlatformAdapter {
  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string): string;

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  handleCallback(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes: string[];
  }>;

  /**
   * Refresh access token
   */
  refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;

  /**
   * Publish a post to the platform
   */
  publishPost(content: string, mediaUrls: string[], accessToken: string): Promise<PublishResult>;

  /**
   * Get account information
   */
  getAccountInfo(accessToken: string): Promise<AccountInfo>;

  /**
   * Validate account and token
   */
  validateAccount(accessToken: string): Promise<boolean>;

  /**
   * Get platform-specific character limit
   */
  getCharacterLimit(): number;

  /**
   * Get platform-specific media limits
   */
  getMediaLimits(): {
    maxImages: number;
    maxVideos: number;
    maxImageSize: number; // in bytes
    maxVideoSize: number; // in bytes
  };
}
