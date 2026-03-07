/**
 * Threads OAuth Service
 * 
 * Minimal service for Threads OAuth integration
 * Handles account connection only (no posting, analytics, etc.)
 */

import { ThreadsProvider } from './ThreadsProvider';
import { SocialAccount, SocialPlatform, AccountStatus } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';

interface ConnectAccountParams {
  workspaceId: string;
  userId: string;
  code: string;
  state: string;
  ipAddress: string;
}

interface ConnectAccountResult {
  account: any;
}

export class ThreadsOAuthService {
  private provider: ThreadsProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new ThreadsProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Connect Threads account
   */
  async connectAccount(params: ConnectAccountParams): Promise<ConnectAccountResult> {
    const { workspaceId, userId, code } = params;

    try {
      logger.info('[Threads] Starting account connection', { workspaceId, userId });

      // Step 1: Exchange code for tokens
      const tokens = await this.provider.exchangeCodeForToken({ code, state: params.state });
      
      logger.info('[Threads] Token exchange successful', { workspaceId });

      // Step 2: Fetch user profile
      const profile = await this.provider.getUserProfile(tokens.accessToken);
      
      logger.info('[Threads] Profile fetched', {
        workspaceId,
        profileId: profile.id,
        username: profile.username,
      });

      // Step 3: Check for duplicate account
      const existing = await SocialAccount.findOne({
        workspaceId,
        provider: SocialPlatform.THREADS,
        providerUserId: profile.id,
      });

      if (existing) {
        logger.warn('[Threads] Duplicate account detected', {
          workspaceId,
          profileId: profile.id,
          existingAccountId: existing._id,
        });
        throw new Error('Threads account already connected');
      }

      // Step 4: Create account
      const account = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.THREADS,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accessToken: tokens.accessToken, // Will be encrypted by pre-save hook
        refreshToken: tokens.refreshToken, // Will be encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scope || ['threads_basic', 'threads_content_publish'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        metadata: {
          username: profile.username,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          biography: profile.metadata?.biography,
        },
        lastSyncAt: new Date(),
      });

      await account.save();

      logger.info('[Threads] Account created successfully', {
        workspaceId,
        accountId: account._id,
        profileId: profile.id,
      });

      return { account };
    } catch (error: any) {
      logger.error('[Threads] Account connection failed', {
        workspaceId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Initiate OAuth flow
   */
  async initiateOAuth(): Promise<{ url: string; state: string }> {
    const { url, state } = await this.provider.getAuthorizationUrl();
    return { url, state };
  }
}
