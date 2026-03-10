/**
 * Bluesky Platform Adapter
 * Extends BasePlatformAdapter with Bluesky-specific implementation
 */

import { BasePlatformAdapter } from '../BasePlatformAdapter';
import {
  AuthUrlResult,
  PlatformToken,
  PlatformAccount,
  PermissionValidationResult,
  PlatformCapabilities,
} from './PlatformAdapter';

export class BlueskyAdapter extends BasePlatformAdapter {
  constructor() {
    // Bluesky doesn't use OAuth, so we pass empty values
    super('bluesky', '', '');
  }

  async generateAuthUrl(redirectUri: string, state: string, scopes: string[]): Promise<AuthUrlResult> {
    throw new Error('Bluesky does not use OAuth - use app passwords instead');
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<PlatformToken> {
    throw new Error('Bluesky does not use OAuth - use app passwords instead');
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformToken> {
    // Bluesky tokens can be refreshed using the refresh JWT
    return {
      accessToken: 'new_bluesky_token',
      refreshToken: refreshToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      tokenType: 'bearer',
      platform: 'bluesky',
    };
  }

  async discoverAccounts(accessToken: string): Promise<PlatformAccount[]> {
    // Bluesky has one account per connection
    return [{
      platformAccountId: 'bluesky_did',
      accountName: '@handle.bsky.social',
      accountType: 'personal',
      metadata: {
        profileUrl: 'https://bsky.app/profile/handle.bsky.social',
        followerCount: 0,
      },
    }];
  }

  async validatePermissions(accessToken: string): Promise<PermissionValidationResult> {
    // Bluesky app passwords have full access
    return {
      valid: true,
      grantedScopes: ['full_access'],
      requiredScopes: ['full_access'],
      missingScopes: [],
      status: 'sufficient',
    };
  }

  getCapabilities(accountType?: string): PlatformCapabilities {
    return {
      publishPost: true,
      publishVideo: false, // Bluesky doesn't support video yet
      publishImage: true,
      publishCarousel: false,
      analytics: false,
      stories: false,
      reels: false,
      scheduling: true,
      maxVideoSize: 0,
      maxImageSize: 1 * 1024 * 1024, // 1MB
      supportedFormats: ['image/jpeg', 'image/png'],
    };
  }
}
