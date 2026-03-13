/**
 * LinkedIn OAuth Service
 * 
 * Minimal service for LinkedIn OAuth integration
 * Handles account connection only (no posting, analytics, etc.)
 */

import { LinkedInOAuthProvider } from './LinkedInOAuthProvider';
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

export class LinkedInOAuthService {
  private provider: LinkedInOAuthProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new LinkedInOAuthProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Connect LinkedIn account
   */
  async connectAccount(params: ConnectAccountParams): Promise<ConnectAccountResult> {
    const { workspaceId, userId, code } = params;

    try {
      logger.info('[LinkedIn] Starting account connection', { workspaceId, userId });

      // Step 1: Exchange code for tokens
      const tokens = await this.provider.exchangeCodeForTokenLegacy({ code, state: '' });
      
      logger.info('[LinkedIn] Token exchange successful', { workspaceId });

      // Step 2: Fetch user profile
      const profile = await this.provider.getUserProfile(tokens.accessToken);
      
      logger.info('[LinkedIn] Profile fetched', {
        workspaceId,
        profileId: profile.id,
        displayName: profile.displayName,
      });

      // Step 3: Check for duplicate account
      const existing = await SocialAccount.findOne({
        workspaceId,
        provider: SocialPlatform.LINKEDIN,
        providerUserId: profile.id,
      });

      if (existing) {
        logger.warn('[LinkedIn] Duplicate account detected', {
          workspaceId,
          profileId: profile.id,
          existingAccountId: existing._id,
        });
        throw new Error('LinkedIn account already connected');
      }

      // Step 4: Create account
      const account = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.LINKEDIN,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accessToken: tokens.accessToken, // Will be encrypted by pre-save hook
        refreshToken: tokens.refreshToken, // Will be encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: (tokens as any).scope || ['openid', 'profile', 'email', 'w_member_social'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        metadata: {
          username: profile.username,
          email: profile.email,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          givenName: profile.metadata?.givenName,
          familyName: profile.metadata?.familyName,
          locale: profile.metadata?.locale,
          emailVerified: profile.metadata?.emailVerified,
        },
        lastSyncAt: new Date(),
      });

      await account.save();

      logger.info('[LinkedIn] Account created successfully', {
        workspaceId,
        accountId: account._id,
        profileId: profile.id,
      });

      return { account };
    } catch (error: any) {
      logger.error('[LinkedIn] Account connection failed', {
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

  /**
   * Refresh LinkedIn access token
   * 
   * Uses refresh token to obtain new access token
   * Updates account record with new token and expiration
   */
  async refreshToken(accountId: string): Promise<void> {
    try {
      logger.info('[LinkedIn] Starting token refresh', { accountId });

      // Fetch account with tokens
      const account = await SocialAccount.findById(accountId)
        .select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Account not found');
      }

      if (account.provider !== SocialPlatform.LINKEDIN) {
        throw new Error('Account is not a LinkedIn account');
      }

      const refreshToken = account.getDecryptedRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Refresh token via LinkedIn API
      const tokens = await this.provider.refreshAccessToken(refreshToken);

      // Update account
      account.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
      account.refreshToken = tokens.refreshToken || refreshToken; // Update if new one provided
      account.tokenExpiresAt = tokens.expiresAt;
      account.lastRefreshedAt = new Date();
      account.status = AccountStatus.ACTIVE;

      await account.save();

      logger.info('[LinkedIn] Token refreshed successfully', {
        accountId,
        expiresAt: tokens.expiresAt,
      });
    } catch (error: any) {
      logger.error('[LinkedIn] Token refresh failed', {
        accountId,
        error: error.message,
      });

      // Update account status
      const account = await SocialAccount.findById(accountId);
      if (account) {
        account.status = AccountStatus.REAUTH_REQUIRED;
        await account.save();
      }

      throw error;
    }
  }
}
