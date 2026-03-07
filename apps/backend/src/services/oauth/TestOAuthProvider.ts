/**
 * Test OAuth Provider
 * 
 * Simulates OAuth flow for development and testing
 * Bypasses real OAuth and generates mock tokens
 * 
 * Enable by setting OAUTH_TEST_MODE=true in .env
 */

import {
  OAuthProvider,
  OAuthTokens,
  OAuthUserProfile,
  OAuthAuthorizationUrl,
  OAuthCallbackParams,
  OAuthRefreshParams,
} from './OAuthProvider';
import { logger } from '../../utils/logger';

export class TestOAuthProvider extends OAuthProvider {
  private platform: string;

  constructor(platform: string, redirectUri: string) {
    super('test-client-id', 'test-client-secret', redirectUri, ['test-scope']);
    this.platform = platform;
  }

  getPlatformName(): string {
    return this.platform;
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    const state = this.generateState();
    
    // Return a test URL that points to our callback with a test code
    const testCode = `test_code_${Date.now()}`;
    const url = `${this.redirectUri}?code=${testCode}&state=${state}`;

    logger.info('Generated test OAuth URL', { platform: this.platform, state });

    return { url, state };
  }

  async exchangeCodeForToken(params: OAuthCallbackParams): Promise<OAuthTokens> {
    logger.info('Test OAuth token exchange', { platform: this.platform });

    // Generate mock tokens
    const accessToken = `test_access_token_${this.platform}_${Date.now()}`;
    const refreshToken = `test_refresh_token_${this.platform}_${Date.now()}`;

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour
      expiresAt: this.calculateExpiresAt(3600),
      scope: ['test-scope'],
      tokenType: 'Bearer',
    };
  }

  async refreshAccessToken(params: OAuthRefreshParams): Promise<OAuthTokens> {
    logger.info('Test OAuth token refresh', { platform: this.platform });

    // Generate new mock tokens
    const accessToken = `test_access_token_${this.platform}_${Date.now()}_refreshed`;
    const refreshToken = `test_refresh_token_${this.platform}_${Date.now()}_refreshed`;

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      expiresAt: this.calculateExpiresAt(3600),
      scope: ['test-scope'],
      tokenType: 'Bearer',
    };
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    logger.info('Test OAuth user profile fetch', { platform: this.platform });

    // Return mock user profile
    return {
      id: `test_user_${this.platform}_${Math.random().toString(36).substring(7)}`,
      username: `test_${this.platform}_user`,
      displayName: `Test ${this.platform.charAt(0).toUpperCase() + this.platform.slice(1)} User`,
      email: `test@${this.platform}.com`,
      profileUrl: `https://${this.platform}.com/test_user`,
      avatarUrl: `https://via.placeholder.com/150?text=${this.platform}`,
      followerCount: 1000,
      metadata: {
        testMode: true,
        platform: this.platform,
      },
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    logger.info('Test OAuth token revoked', { platform: this.platform });
    // No-op for test mode
  }

  async validateToken(accessToken: string): Promise<boolean> {
    // Test tokens are always valid
    return accessToken.startsWith('test_access_token_');
  }
}
