/**
 * Twitter Platform Adapter (Phase 1)
 * Extends BasePlatformAdapter with Twitter-specific implementation
 */

import { BasePlatformAdapter } from '../BasePlatformAdapter';
import {
  AuthUrlResult,
  PlatformToken,
  PlatformAccount,
  PermissionValidationResult,
  PlatformCapabilities,
} from './PlatformAdapter';

/**
 * @deprecated This adapter is not used. Use TwitterOAuthProvider instead.
 * SECURITY WARNING: This contains a PKCE placeholder and should not be used in production.
 */
export class TwitterPlatformAdapter extends BasePlatformAdapter {
  constructor(clientId: string, clientSecret: string) {
    super('twitter', clientId, clientSecret);
  }

  /**
   * @deprecated Use TwitterOAuthProvider.getAuthorizationUrl() instead
   */
  async generateAuthUrl(redirectUri: string, state: string, scopes: string[]): Promise<AuthUrlResult> {
    throw new Error('TwitterPlatformAdapter is deprecated. Use TwitterOAuthProvider instead.');
  }

  async exchangeCodeForToken(code: string, redirectUri: string, codeVerifier?: string): Promise<PlatformToken> {
    // Placeholder implementation
    return {
      accessToken: 'twitter_token',
      refreshToken: 'twitter_refresh',
      expiresAt: new Date(Date.now() + 7200000),
      tokenType: 'bearer',
      platform: 'twitter',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformToken> {
    // Placeholder implementation
    return {
      accessToken: 'new_twitter_token',
      refreshToken: 'new_twitter_refresh',
      expiresAt: new Date(Date.now() + 7200000),
      tokenType: 'bearer',
      platform: 'twitter',
    };
  }

  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    // Placeholder implementation
    return [{
      platformAccountId: 'twitter_123',
      accountName: '@username',
      accountType: 'personal',
      metadata: {
        profileUrl: 'https://twitter.com/username',
        followerCount: 0,
      },
    }];
  }

  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    // Placeholder implementation
    return {
      valid: true,
      grantedScopes: ['tweet.read', 'tweet.write'],
      requiredScopes: ['tweet.read', 'tweet.write'],
      missingScopes: [],
      status: 'sufficient',
    };
  }

  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: true,
      publishVideo: true,
      publishImage: true,
      publishCarousel: false,
      analytics: true,
      stories: false,
      reels: false,
      scheduling: true,
      maxVideoSize: 512 * 1024 * 1024,
      maxImageSize: 5 * 1024 * 1024,
      supportedFormats: ['image/jpeg', 'image/png', 'video/mp4'],
    };
  }
}
