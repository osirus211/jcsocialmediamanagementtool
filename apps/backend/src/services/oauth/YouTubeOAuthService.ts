/**
 * YouTube OAuth Service - MINIMAL
 * 
 * Handles YouTube account connection - connection only
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Channel information retrieval
 * - Secure token storage
 * - Security audit logging
 * - Duplicate account prevention
 * 
 * Scope: youtube.readonly (read-only access)
 * 
 * Flow:
 * 1. User initiates OAuth
 * 2. User authorizes via Google
 * 3. Exchange code for tokens (access + refresh)
 * 4. Fetch channel information
 * 5. Save to database with encryption
 */

import { YouTubeProvider } from './YouTubeProvider';
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
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export interface YouTubeConnectParams {
  workspaceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  code: string;
  state: string;
  ipAddress: string;
}

export interface YouTubeConnectResult {
  account: ISocialAccount;
}

export class YouTubeOAuthService {
  private provider: YouTubeProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new YouTubeProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Initiate YouTube OAuth flow
   */
  async initiateOAuth(): Promise<{
    url: string;
    state: string;
  }> {
    try {
      const { url, state } = await this.provider.getAuthorizationUrl();

      logger.info('YouTube OAuth flow initiated', {
        state: state.substring(0, 10) + '...',
      });

      return { url, state };
    } catch (error: any) {
      logger.error('Failed to initiate YouTube OAuth', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Connect YouTube account (OAuth callback)
   * MINIMAL: Just connect and save channel info
   */
  async connectAccount(params: YouTubeConnectParams): Promise<YouTubeConnectResult> {
    const startTime = Date.now();

    try {
      logger.info('YouTube account connection started', {
        workspaceId: params.workspaceId,
        userId: params.userId,
      });

      // Step 1: Exchange code for tokens
      const tokens = await this.provider.exchangeCodeForToken({
        code: params.code,
        state: params.state,
      });

      // Validate token expiration
      validateTokenExpiration(tokens.expiresAt, 'YouTube token exchange');

      if (!tokens.refreshToken) {
        logger.warn('No refresh token received - user may need to re-authorize', {
          workspaceId: params.workspaceId,
        });
      }

      logger.info('YouTube token exchange successful', {
        hasRefreshToken: !!tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });

      // Step 2: Get channel information
      const profile = await this.provider.getUserProfile(tokens.accessToken);

      // Step 3: Check for duplicate account
      await assertNoDuplicateAccount(
        params.workspaceId,
        SocialPlatform.YOUTUBE,
        profile.id
      );

      // Step 4: Create connection metadata
      const connectionMetadata: ConnectionMetadata = {
        type: 'OTHER',
        providerName: 'YOUTUBE',
        tokenRefreshable: !!tokens.refreshToken,
        lastRefreshAttempt: undefined,
        refreshFailureCount: 0,
      };

      // Step 5: Save account to database
      const account = await SocialAccount.create({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.YOUTUBE,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accountType: 'CHANNEL',
        accessToken: tokens.accessToken, // Encrypted by pre-save hook
        refreshToken: tokens.refreshToken, // Encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        connectionMetadata,
        metadata: {
          channelId: profile.metadata?.channelId,
          channelTitle: profile.metadata?.channelTitle,
          channelThumbnail: profile.metadata?.channelThumbnail,
        },
        lastSyncAt: new Date(),
      });

      logger.info('YouTube account connected', {
        accountId: account._id,
        channelId: profile.id,
        channelTitle: profile.displayName,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: profile.id,
        success: true,
        metadata: {
          provider: SocialPlatform.YOUTUBE,
          channelId: profile.id,
          channelTitle: profile.displayName,
          hasRefreshToken: !!tokens.refreshToken,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('YouTube account connection completed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        duration,
      });

      return { account };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('YouTube account connection failed', {
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
        resource: 'youtube',
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.YOUTUBE,
          duration,
        },
      });

      throw error;
    }
  }
}
