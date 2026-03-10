/**
 * Bluesky OAuth Provider
 * 
 * Bluesky uses app passwords instead of OAuth
 * Implements credential-based authentication using @atproto/api
 */

import { BskyAgent } from '@atproto/api';
import { OAuthProvider } from './OAuthProvider';
import { logger } from '../../utils/logger';

export class BlueskyOAuthProvider extends OAuthProvider {
  private readonly service = 'https://bsky.social';

  constructor() {
    // Bluesky doesn't use OAuth, so we pass empty values
    super('', '', '', []);
  }

  getPlatformName(): string {
    return 'bluesky';
  }

  /**
   * Connect using handle and app password
   */
  async connect(handle: string, appPassword: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    profile: {
      id: string;
      username: string;
      displayName: string;
      profileUrl: string;
      avatarUrl?: string;
      metadata?: Record<string, any>;
    };
  }> {
    try {
      const agent = new BskyAgent({ service: this.service });

      // Login with handle and app password
      const response = await agent.login({
        identifier: handle,
        password: appPassword,
      });

      logger.info('Bluesky login successful', { handle });

      // Get profile info
      const profile = await agent.getProfile({ actor: handle });

      return {
        accessToken: response.data.accessJwt,
        refreshToken: response.data.refreshJwt,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        profile: {
          id: response.data.did,
          username: handle,
          displayName: profile.data.displayName || handle,
          profileUrl: `https://bsky.app/profile/${handle}`,
          avatarUrl: profile.data.avatar,
          metadata: {
            followersCount: profile.data.followersCount,
            followsCount: profile.data.followsCount,
            postsCount: profile.data.postsCount,
            description: profile.data.description,
          },
        },
      };
    } catch (error: any) {
      logger.error('Bluesky login failed', {
        handle,
        error: error.message,
      });
      throw new Error(`Bluesky login failed: ${error.message}`);
    }
  }

  /**
   * Resume session from stored tokens
   */
  async resumeSession(accessToken: string, refreshToken: string): Promise<BskyAgent> {
    const agent = new BskyAgent({ service: this.service });

    try {
      await agent.resumeSession({
        accessJwt: accessToken,
        refreshJwt: refreshToken,
        did: '', // Will be populated from token
        handle: '', // Will be populated from token
      });

      return agent;
    } catch (error: any) {
      logger.error('Bluesky session resume failed', {
        error: error.message,
      });
      throw new Error(`Failed to resume Bluesky session: ${error.message}`);
    }
  }

  /**
   * Get account info from handle
   */
  async getAccountInfo(handle: string, accessToken: string): Promise<{
    id: string;
    username: string;
    displayName: string;
    profileUrl: string;
    avatarUrl?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      const agent = new BskyAgent({ service: this.service });
      const profile = await agent.getProfile({ actor: handle });

      return {
        id: profile.data.did,
        username: handle,
        displayName: profile.data.displayName || handle,
        profileUrl: `https://bsky.app/profile/${handle}`,
        avatarUrl: profile.data.avatar,
        metadata: {
          followersCount: profile.data.followersCount,
          followsCount: profile.data.followsCount,
          postsCount: profile.data.postsCount,
          description: profile.data.description,
        },
      };
    } catch (error: any) {
      logger.error('Bluesky account info fetch failed', {
        handle,
        error: error.message,
      });
      throw new Error(`Failed to fetch Bluesky account info: ${error.message}`);
    }
  }

  // OAuth methods (not used for Bluesky)
  async generateAuthUrl(): Promise<{ url: string; state: string }> {
    throw new Error('Bluesky does not use OAuth');
  }

  async exchangeCodeForToken(): Promise<any> {
    throw new Error('Bluesky does not use OAuth');
  }

  async refreshAccessToken(): Promise<any> {
    throw new Error('Bluesky does not use OAuth');
  }

  async getUserProfile(): Promise<any> {
    throw new Error('Use getAccountInfo instead');
  }
}
