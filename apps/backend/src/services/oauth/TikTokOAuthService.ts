/**
 * TikTok OAuth Service
 * 
 * Handles TikTok account connection and lifecycle management
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - User profile retrieval
 * - Secure token storage with encryption
 * - Security audit logging
 * - Duplicate account prevention
 * - Token refresh management
 * - Account disconnection
 * 
 * Scopes: user.info.basic, video.upload, video.publish
 * 
 * Flow:
 * 1. User initiates OAuth
 * 2. User authorizes via TikTok
 * 3. Exchange code for tokens (access + refresh)
 * 4. Fetch TikTok user profile
 * 5. Check for duplicate account
 * 6. Save to database with encryption
 * 7. Log security audit event
 */

import { TikTokProvider } from './TikTokProvider';
import {
  SocialAccount,
  ISocialAccount,
  AccountStatus,
  SocialPlatform,
  ConnectionMetadata,
} from '../../models/SocialAccount';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';
import { assertNoDuplicateAccount } from '../../utils/duplicateAccountPrevention';
import { validateTokenExpiration } from '../../utils/expirationGuard';
import { distributedLockService } from '../DistributedLockService';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import mongoose from 'mongoose';

export interface TikTokConnectParams {
  workspaceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  code: string;
  state: string;
  codeVerifier: string; // Added for PKCE support
  ipAddress: string;
}

export interface TikTokConnectResult {
  account: ISocialAccount;
}

export class TikTokOAuthService {
  private provider: TikTokProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new TikTokProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Initiate TikTok OAuth flow with PKCE
   * 
   * Generates authorization URL with state parameter for CSRF protection
   * and PKCE challenge for enhanced security
   */
  async initiateOAuth(): Promise<{
    url: string;
    state: string;
    codeVerifier: string;
  }> {
    try {
      const result = await this.provider.getAuthorizationUrl();

      logger.info('TikTok OAuth flow initiated with PKCE', {
        state: result.state.substring(0, 10) + '...',
        hasPKCE: !!result.codeVerifier,
      });

      return { 
        url: result.url, 
        state: result.state,
        codeVerifier: result.codeVerifier || ''
      };
    } catch (error: any) {
      logger.error('Failed to initiate TikTok OAuth', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Connect TikTok account (OAuth callback)
   * 
   * Steps:
   * 1. Exchange authorization code for tokens
   * 2. Validate token expiration
   * 3. Fetch TikTok user profile
   * 4. Check for duplicate account
   * 5. Create SocialAccount record with encrypted tokens
   * 6. Log security audit event
   */
  async connectAccount(params: TikTokConnectParams): Promise<TikTokConnectResult> {
    const startTime = Date.now();

    try {
      logger.info('TikTok account connection started', {
        workspaceId: params.workspaceId,
        userId: params.userId,
      });

      // Step 1: Exchange code for tokens using PKCE
      const tokens = await this.provider.exchangeCodeForTokenLegacy({
        code: params.code,
        state: params.state,
        codeVerifier: params.codeVerifier,
      });

      // Validate token expiration
      validateTokenExpiration(tokens.expiresAt, 'TikTok token exchange');

      if (!tokens.refreshToken) {
        logger.warn('No refresh token received - user may need to re-authorize', {
          workspaceId: params.workspaceId,
        });
      }

      logger.info('TikTok token exchange successful', {
        hasRefreshToken: !!tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      });

      // Step 2: Get TikTok user profile and creator info
      const profile = await this.provider.getUserProfile(tokens.accessToken);
      
      // Get creator info for enhanced metadata
      let creatorInfo;
      try {
        creatorInfo = await this.provider.getCreatorInfo(tokens.accessToken);
      } catch (error) {
        logger.warn('Failed to fetch creator info, continuing without it', {
          error: (error as Error).message,
        });
      }

      logger.info('TikTok profile fetched', {
        userId: profile.id,
        username: profile.username,
        displayName: profile.displayName,
      });

      // Step 3: Check for duplicate account
      await assertNoDuplicateAccount(
        params.workspaceId,
        SocialPlatform.TIKTOK,
        profile.id
      );

      // Step 4: Create connection metadata
      const connectionMetadata: ConnectionMetadata = {
        type: 'OTHER',
        providerName: 'TIKTOK',
        tokenRefreshable: !!tokens.refreshToken,
        lastRefreshAttempt: undefined,
        refreshFailureCount: 0,
      };

      // Step 5: Save account to database
      const account = await SocialAccount.create({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accountType: 'PERSONAL',
        accessToken: tokens.accessToken, // Encrypted by pre-save hook
        refreshToken: tokens.refreshToken, // Encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.upload', 'video.publish', 'creator.info.basic'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        connectionMetadata,
        metadata: {
          username: creatorInfo?.creator_username || profile.username,
          displayName: profile.displayName,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          unionId: profile.metadata?.unionId,
          bio: profile.metadata?.bio,
          isVerified: profile.metadata?.isVerified,
          followerCount: profile.metadata?.followerCount,
          followingCount: profile.metadata?.followingCount,
          likesCount: profile.metadata?.likesCount,
          videoCount: profile.metadata?.videoCount,
          // Creator-specific metadata
          creatorUsername: creatorInfo?.creator_username,
          creatorNickname: creatorInfo?.creator_nickname,
          privacyLevelOptions: creatorInfo?.privacy_level_options,
          maxVideoDurationSec: creatorInfo?.max_video_post_duration_sec,
          defaultCommentDisabled: creatorInfo?.comment_disabled,
          defaultDuetDisabled: creatorInfo?.duet_disabled,
          defaultStitchDisabled: creatorInfo?.stitch_disabled,
        },
        lastSyncAt: new Date(),
      });

      logger.info('TikTok account connected', {
        accountId: account._id,
        userId: profile.id,
        username: profile.username,
      });

      // Step 6: Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: profile.id,
        success: true,
        metadata: {
          provider: SocialPlatform.TIKTOK,
          userId: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          hasRefreshToken: !!tokens.refreshToken,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('TikTok account connection completed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        accountId: account._id,
        duration,
      });

      return { account };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('TikTok account connection failed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        error: error.message,
        duration,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: 'tiktok',
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.TIKTOK,
          duration,
        },
      });

      throw error;
    }
  }

  /**
   * Refresh access token for TikTok account
   * 
   * Uses refresh token to obtain new access token
   * Updates account record with new token and expiration
   */
  async refreshToken(accountId: string): Promise<void> {
    const lockKey = `oauth:tiktok:refresh:lock:${accountId}`;
    
    try {
      logger.info('Refreshing TikTok token', { accountId });

      // Acquire distributed lock
      const lockAcquired = await distributedLockService.acquireLock(lockKey, { ttl: 300 } as any); // 5 min TTL
      
      if (!lockAcquired) {
        logger.warn('Failed to acquire lock - another worker processing', {
          accountId,
        });
        throw new Error('Token refresh already in progress');
      }

      try {
        // Fetch account with tokens
        const account = await SocialAccount.findById(accountId)
          .select('+accessToken +refreshToken');

        if (!account) {
          throw new Error('Account not found');
        }

        if (account.provider !== SocialPlatform.TIKTOK) {
          throw new Error('Account is not a TikTok account');
        }

        const refreshToken = account.getDecryptedRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Refresh token
        const tokens = await this.provider.refreshAccessToken(refreshToken);

        // Update account
        account.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
        account.refreshToken = tokens.refreshToken; // Update refresh token if new one provided
        account.tokenExpiresAt = tokens.expiresAt;
        account.lastRefreshedAt = new Date();
        account.status = AccountStatus.ACTIVE;

        await account.save();

        logger.info('TikTok token refreshed', {
          accountId,
          expiresAt: tokens.expiresAt,
        });

        // Log security event
        await securityAuditService.logEvent({
          type: SecurityEventType.TOKEN_REFRESH_SUCCESS,
          workspaceId: account.workspaceId,
          ipAddress: '0.0.0.0', // System-initiated
          resource: accountId,
          success: true,
          metadata: {
            provider: SocialPlatform.TIKTOK,
            accountId,
          },
        });
      } finally {
        // Release lock
        await distributedLockService.releaseLock(lockKey as any);
      }
    } catch (error: any) {
      logger.error('Failed to refresh TikTok token', {
        accountId,
        error: error.message,
      });

      // Release lock on error
      await distributedLockService.releaseLock(lockKey as any);

      // Update account status
      const account = await SocialAccount.findById(accountId);
      if (account) {
        account.status = AccountStatus.REAUTH_REQUIRED;
        await account.save();

        // Log security event
        await securityAuditService.logEvent({
          type: SecurityEventType.TOKEN_REFRESH_FAILURE,
          workspaceId: account.workspaceId,
          ipAddress: '0.0.0.0', // System-initiated
          resource: accountId,
          success: false,
          errorMessage: error.message,
          metadata: {
            provider: SocialPlatform.TIKTOK,
            accountId,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Disconnect TikTok account
   * 
   * Deletes tokens and marks account as disconnected
   * Note: TikTok does not provide a token revocation endpoint
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      logger.info('Disconnecting TikTok account', { accountId });

      // Fetch account
      const account = await SocialAccount.findById(accountId)
        .select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Account not found');
      }

      if (account.provider !== SocialPlatform.TIKTOK) {
        throw new Error('Account is not a TikTok account');
      }

      // Note: TikTok does not provide a token revocation endpoint
      // Tokens will expire naturally (24 hours for access token)
      logger.info('TikTok tokens will expire naturally (no revocation endpoint)', {
        accountId,
      });

      // Update account status and clear tokens
      account.status = AccountStatus.DISCONNECTED;
      account.disconnectedAt = new Date();
      account.accessToken = ''; // Will be encrypted but effectively cleared
      account.refreshToken = undefined;

      await account.save();

      logger.info('TikTok account disconnected', { accountId });

      // Pause all scheduled/queued posts for this disconnected account
      try {
        const { Post } = await import('../../models/Post');
        await Post.updateMany(
          {
            socialAccountId: account._id,
            status: { $in: ['SCHEDULED', 'QUEUED'] },
            scheduledAt: { $gt: new Date() },
          },
          {
            $set: {
              status: 'PAUSED',
              pausedReason: 'ACCOUNT_DISCONNECTED',
              pausedAt: new Date(),
            },
          }
        );
      } catch (pauseErr: any) {
        logger.warn('Failed to pause posts on account disconnect', {
          accountId: account._id,
          provider: account.provider,
          error: pauseErr.message,
        });
      }

      // Send disconnect email notification
      try {
        const { User } = await import('../../models/User');
        const { Workspace } = await import('../../models/Workspace');
        const { emailNotificationService } = await import('../EmailNotificationService');
        
        const workspace = await Workspace.findById(account.workspaceId);
        if (workspace) {
          const user = await User.findById(workspace.ownerId).select('email firstName');
          if (user?.email) {
            await emailNotificationService.sendAccountDisconnectedEmail({
              to: user.email,
              userName: user.firstName || 'there',
              platform: account.provider,
              accountName: account.accountName || account.providerUserId || account.provider,
              reconnectUrl: `${process.env.FRONTEND_URL}/settings/accounts`,
            });
          }
        }
      } catch (emailErr: any) {
        logger.warn('Failed to send disconnect email', {
          accountId: account._id,
          error: emailErr.message,
        });
      }

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_DISCONNECT,
        workspaceId: account.workspaceId,
        ipAddress: '0.0.0.0', // System-initiated
        resource: accountId,
        success: true,
        metadata: {
          provider: SocialPlatform.TIKTOK,
          accountId,
        },
      });
    } catch (error: any) {
      logger.error('Failed to disconnect TikTok account', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }
}
