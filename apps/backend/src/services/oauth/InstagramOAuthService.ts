/**
 * Instagram OAuth Service - PRODUCTION
 * 
 * Handles Instagram account connection for both Business and Basic Display
 * 
 * Features:
 * - Dual provider support (Business via Facebook, Basic Display)
 * - Instagram Business account discovery via Facebook Pages
 * - Long-lived token management (60 days)
 * - Multiple Instagram account support (Business only)
 * - Secure token storage
 * - Security audit logging
 * - Duplicate account prevention
 * 
 * Flow:
 * 1. User selects provider type (Business or Basic)
 * 2. User authorizes via appropriate OAuth flow
 * 3. Exchange code for long-lived token
 * 4. Fetch profile/accounts
 * 5. Save to database with provider type
 */

import { InstagramBusinessProvider } from './InstagramBusinessProvider';
import { InstagramBasicDisplayProvider } from './InstagramBasicDisplayProvider';
import { InstagramProfessionalProvider } from './InstagramProfessionalProvider';
import { oauthProviderFactory, ProviderType } from './OAuthProviderFactory';
import { SocialAccount, ISocialAccount, AccountStatus, SocialPlatform, ProviderType as ModelProviderType, ConnectionMetadata } from '../../models/SocialAccount';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';
import { assertNoDuplicateAccount } from '../../utils/duplicateAccountPrevention';
import { validateTokenExpiration } from '../../utils/expirationGuard';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import mongoose from 'mongoose';

export interface InstagramConnectParams {
  workspaceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  providerType: ProviderType;
  code: string;
  state: string;
  ipAddress: string;
}

export interface InstagramConnectResult {
  saved: ISocialAccount[];
  failed: Array<{
    username: string;
    error: string;
  }>;
}

export interface ConnectionOption {
  type: string;
  name: string;
  description: string;
  recommended: boolean;
  limitations: string[];
  features: string[];
}

export class InstagramOAuthService {
  private provider: InstagramBusinessProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new InstagramBusinessProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Get connection options for Instagram
   * Static configuration-driven response
   */
  getConnectionOptions(): { options: ConnectionOption[] } {
    const options: ConnectionOption[] = [
      {
        type: ProviderType.INSTAGRAM_BUSINESS,
        name: 'Instagram Graph API with Instagram Login',
        description: 'For Business and Creator accounts (Recommended)',
        recommended: true,
        features: [
          'Publish posts, stories, and reels',
          'Schedule content',
          'Access insights and analytics',
          'Manage comments and messages',
          'Full publishing capabilities',
        ],
        limitations: [
          'Requires Instagram Business or Creator account',
          'Account must be eligible for Instagram Graph API',
        ],
      },
    ];

    return { options };
  }

  /**
   * Initiate Instagram OAuth flow with provider type
   */
  async initiateOAuth(providerType: ProviderType): Promise<{
    url: string;
    state: string;
  }> {
    try {
      // Always use Instagram Graph API with Instagram Login (new approach)
      // Use Instagram app credentials (not Facebook app)
      const professionalProvider = new InstagramProfessionalProvider(
        config.oauth.instagramBasic.appId!,
        config.oauth.instagramBasic.appSecret!,
        config.oauth.instagramBasic.redirectUri!
      );

      const { url, state } = await professionalProvider.getAuthorizationUrl();

      logger.info('Instagram OAuth flow initiated (Graph API)', {
        providerType: 'INSTAGRAM_GRAPH_API',
        state,
      });

      return { url, state };
    } catch (error: any) {
      logger.error('Failed to initiate Instagram OAuth', {
        providerType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Connect Instagram accounts (OAuth callback)
   * 
   * Uses Instagram Graph API with Instagram Login for all connections
   */
  async connectAccount(params: InstagramConnectParams): Promise<InstagramConnectResult> {
    const startTime = Date.now();

    try {
      logger.info('Instagram account connection started', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        providerType: params.providerType,
      });

      // Always use Instagram Graph API with Instagram Login
      return await this.handleInstagramGraphAPI(params);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('Instagram account connection failed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        providerType: params.providerType,
        error: error.message,
        duration,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: 'instagram',
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.INSTAGRAM,
          providerType: params.providerType,
          duration,
        },
      });

      throw error;
    }
  }

  /**
   * Handle Instagram Graph API account (new unified flow)
   * Uses InstagramProfessionalProvider for Instagram Graph API with Instagram Login
   */
  private async handleInstagramGraphAPI(params: InstagramConnectParams): Promise<InstagramConnectResult> {
    const startTime = Date.now();
    const saved: ISocialAccount[] = [];
    const failed: Array<{ username: string; error: string }> = [];

    try {
      // Create Instagram Graph API provider instance
      const professionalProvider = new InstagramProfessionalProvider(
        config.oauth.instagramBasic.appId!,
        config.oauth.instagramBasic.appSecret!,
        config.oauth.instagramBasic.redirectUri!
      );

      // Step 1: Exchange code for long-lived token
      const tokens = await professionalProvider.exchangeCodeForTokenLegacy({
        code: params.code,
        state: params.state,
      });

      // Validate token expiration
      validateTokenExpiration(tokens.expiresAt, 'Instagram Graph API token exchange');

      logger.info('Instagram Graph API token exchange successful', {
        expiresIn: tokens.expiresIn,
        expiresInDays: tokens.expiresIn ? Math.floor(tokens.expiresIn / 86400) : undefined,
      });

      // Step 2: Get user profile
      const profile = await professionalProvider.getUserProfile(tokens.accessToken);

      // Step 3: Check for duplicate
      await assertNoDuplicateAccount(
        params.workspaceId,
        SocialPlatform.INSTAGRAM,
        profile.id
      );

      // Step 4: Create connection metadata
      const connectionMetadata: ConnectionMetadata = {
        type: 'OTHER',
        providerName: 'INSTAGRAM_GRAPH_API',
        tokenRefreshable: true,
        lastRefreshAttempt: undefined,
        refreshFailureCount: 0,
      };

      // Step 5: Save account to database
      const account = await SocialAccount.create({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.INSTAGRAM,
        providerType: ModelProviderType.INSTAGRAM_BUSINESS, // Keep existing enum value
        providerUserId: profile.id,
        accountName: profile.username,
        accountType: profile.metadata?.accountType || 'BUSINESS', // BUSINESS or CREATOR
        accessToken: tokens.accessToken, // Encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: [
          'instagram_business_basic',
          'instagram_business_content_publish',
          'instagram_business_manage_comments',
          'instagram_business_manage_messages',
        ],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        connectionMetadata,
        metadata: {
          username: profile.username,
          name: profile.displayName,
          profilePictureUrl: profile.metadata?.profilePictureUrl,
          followersCount: profile.metadata?.followersCount,
          followsCount: profile.metadata?.followsCount,
          mediaCount: profile.metadata?.mediaCount,
          biography: profile.metadata?.biography,
          website: profile.metadata?.website,
          accountType: profile.metadata?.accountType,
        },
        lastSyncAt: new Date(),
      });

      saved.push(account);

      logger.info('Instagram Graph API account connected', {
        accountId: account._id,
        username: profile.username,
        accountType: profile.metadata?.accountType,
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
          provider: SocialPlatform.INSTAGRAM,
          providerType: 'INSTAGRAM_GRAPH_API',
          username: profile.username,
          accountType: profile.metadata?.accountType,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('Instagram Graph API account connection completed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        saved: saved.length,
        duration,
      });

      return { saved, failed };
    } catch (error: any) {
      logger.error('Failed to connect Instagram Graph API account', {
        error: error.message,
      });

      failed.push({
        username: 'Instagram User',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Refresh Instagram access token
   * 
   * Uses Instagram Graph API refresh endpoint
   */
  async refreshToken(accountId: mongoose.Types.ObjectId | string): Promise<ISocialAccount> {
    try {
      const account = await SocialAccount.findById(accountId).select('+accessToken');

      if (!account) {
        throw new Error('Account not found');
      }

      const decryptedToken = account.getDecryptedAccessToken();

      // Use Instagram Graph API provider for token refresh
      const professionalProvider = new InstagramProfessionalProvider(
        config.oauth.instagramBasic.appId!,
        config.oauth.instagramBasic.appSecret!,
        config.oauth.instagramBasic.redirectUri!
      );

      const tokens = await professionalProvider.refreshAccessTokenLegacy({
        refreshToken: decryptedToken, // Current long-lived token
      });

      // Update account with new token
      account.accessToken = tokens.accessToken;
      account.tokenExpiresAt = tokens.expiresAt;
      account.lastRefreshedAt = new Date();
      account.status = AccountStatus.ACTIVE;

      await account.save();

      logger.info('Instagram Graph API token refreshed', {
        accountId,
        expiresAt: tokens.expiresAt,
      });

      return account;
    } catch (error: any) {
      logger.error('Instagram Graph API token refresh failed', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }
}
