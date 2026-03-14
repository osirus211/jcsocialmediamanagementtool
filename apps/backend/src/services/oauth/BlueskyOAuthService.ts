/**
 * Bluesky OAuth Service
 * 
 * Handles Bluesky authentication using AT Protocol app passwords
 * Note: Bluesky uses app passwords, not traditional OAuth
 */

import { BskyAgent } from '@atproto/api';
import { ISocialAccount, SocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import { TokenEncryptionService } from '../TokenEncryptionService';
import { OAuthStateService } from './OAuthStateService';

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

export interface BlueskySessionData {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  handle: string;
  email?: string;
}

export class BlueskyOAuthService {
  private readonly service = 'https://bsky.social';
  private tokenEncryption: TokenEncryptionService;
  private stateService: OAuthStateService;

  constructor() {
    this.tokenEncryption = new TokenEncryptionService();
    this.stateService = new OAuthStateService();
  }

  /**
   * Connect Bluesky account using handle and app password
   */
  async connectAccount(
    handle: string,
    appPassword: string,
    userId: string,
    workspaceId: string
  ): Promise<ISocialAccount> {
    try {
      // Create session with Bluesky
      const sessionData = await this.createSession(handle, appPassword);
      
      // Get profile information
      const profile = await this.getProfile(sessionData.accessJwt, handle);
      
      // Save account to database
      const account = await this.saveAccount(userId, workspaceId, sessionData, profile);
      
      logger.info('Bluesky account connected successfully', {
        userId,
        workspaceId,
        handle,
        did: sessionData.did
      });

      return account;
    } catch (error: any) {
      logger.error('Failed to connect Bluesky account', {
        userId,
        workspaceId,
        handle,
        error: error.message
      });
      throw new Error(`Failed to connect Bluesky account: ${error.message}`);
    }
  }

  /**
   * Create session with Bluesky using handle and app password
   */
  async createSession(handle: string, appPassword: string): Promise<BlueskySessionData> {
    try {
      const agent = new BskyAgent({ service: this.service });

      const response = await agent.login({
        identifier: handle,
        password: appPassword,
      });

      return {
        accessJwt: response.data.accessJwt,
        refreshJwt: response.data.refreshJwt,
        did: response.data.did,
        handle: response.data.handle,
        email: response.data.email,
      };
    } catch (error: any) {
      logger.error('Bluesky session creation failed', {
        handle,
        error: error.message
      });
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Refresh session using refresh token
   */
  async refreshSession(account: ISocialAccount): Promise<string> {
    try {
      const agent = new BskyAgent({ service: this.service });
      
      const decryptedRefreshToken = this.tokenEncryption.decryptToken(account.refreshToken!);
      
      await agent.resumeSession({
        accessJwt: '',
        refreshJwt: decryptedRefreshToken,
        did: account.providerUserId,
        handle: account.accountName,
      } as any);

      // Get new tokens from the agent
      const session = agent.session;
      if (!session) {
        throw new Error('No session after refresh');
      }

      // Update account with new tokens
      const encryptedAccessToken = this.tokenEncryption.encryptToken(session.accessJwt);
      const encryptedRefreshToken = this.tokenEncryption.encryptToken(session.refreshJwt);

      await SocialAccount.findByIdAndUpdate(account._id, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      });

      logger.info('Bluesky session refreshed successfully', {
        accountId: account._id.toString(),
        handle: account.accountName
      });

      return session.accessJwt;
    } catch (error: any) {
      logger.error('Failed to refresh Bluesky session', {
        accountId: account._id.toString(),
        error: error.message
      });
      throw new Error(`Session refresh failed: ${error.message}`);
    }
  }

  /**
   * Get profile information from Bluesky
   */
  async getProfile(accessJwt: string, handle: string): Promise<BlueskyProfile> {
    try {
      const agent = new BskyAgent({ service: this.service });
      
      // Set the access token (create a session-like object)
      (agent as any).session = {
        accessJwt,
        refreshJwt: '',
        did: '',
        handle: '',
      };

      const profile = await agent.getProfile({ actor: handle });

      return {
        did: profile.data.did,
        handle: profile.data.handle,
        displayName: profile.data.displayName,
        description: profile.data.description,
        avatar: profile.data.avatar,
        followersCount: profile.data.followersCount,
        followsCount: profile.data.followsCount,
        postsCount: profile.data.postsCount,
      };
    } catch (error: any) {
      logger.error('Failed to get Bluesky profile', {
        handle,
        error: error.message
      });
      throw new Error(`Profile fetch failed: ${error.message}`);
    }
  }

  /**
   * Save Bluesky account to database
   */
  private async saveAccount(
    userId: string,
    workspaceId: string,
    sessionData: BlueskySessionData,
    profile: BlueskyProfile
  ): Promise<ISocialAccount> {
    const encryptedAccessToken = this.tokenEncryption.encryptToken(sessionData.accessJwt);
    const encryptedRefreshToken = this.tokenEncryption.encryptToken(sessionData.refreshJwt);

    const accountData = {
      userId,
      workspaceId,
      provider: 'bluesky',
      platformAccountId: profile.did,
      providerUserId: profile.did,
      accountName: profile.handle,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      scopes: [],
      status: 'active',
      encryptionKeyVersion: 1,
      metadata: {
        displayName: profile.displayName || profile.handle,
        profileUrl: `https://bsky.app/profile/${profile.handle}`,
        avatarUrl: profile.avatar,
        followersCount: profile.followersCount || 0,
        followsCount: profile.followsCount || 0,
        postsCount: profile.postsCount || 0,
        description: profile.description,
        service: this.service,
      },
    };

    // Check if account already exists
    const existingAccount = await SocialAccount.findOne({
      userId,
      workspaceId,
      provider: 'bluesky',
      platformAccountId: profile.did,
    });

    if (existingAccount) {
      // Update existing account
      Object.assign(existingAccount, accountData);
      return await existingAccount.save();
    } else {
      // Create new account
      return await SocialAccount.create(accountData);
    }
  }

  /**
   * Disconnect Bluesky account
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      await SocialAccount.findByIdAndUpdate(accountId, {
        status: 'inactive',
        accessToken: null,
        refreshToken: null,
      });

      logger.info('Bluesky account disconnected', { accountId });
    } catch (error: any) {
      logger.error('Failed to disconnect Bluesky account', {
        accountId,
        error: error.message
      });
      throw new Error(`Disconnect failed: ${error.message}`);
    }
  }

  /**
   * Validate connection by testing the access token
   */
  async validateConnection(account: ISocialAccount): Promise<boolean> {
    try {
      const decryptedAccessToken = this.tokenEncryption.decryptToken(account.accessToken!);
      await this.getProfile(decryptedAccessToken, account.accountName);
      return true;
    } catch (error) {
      logger.warn('Bluesky connection validation failed', {
        accountId: account._id.toString(),
        error: (error as Error).message
      });
      return false;
    }
  }
}