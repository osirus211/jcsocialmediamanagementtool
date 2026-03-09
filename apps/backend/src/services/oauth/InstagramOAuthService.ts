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
        name: 'Instagram API with Facebook Login',
        description: 'For Business and Creator accounts',
        recommended: true,
        features: [
          'Publish posts, stories, and reels',
          'Schedule content',
          'Access insights and analytics',
          'Manage comments and messages',
        ],
        limitations: [
          'Requires Facebook Page linked to Instagram Business account',
          'Must have Instagram Business or Creator account',
        ],
      },
    ];

    // Only include Instagram Basic Display if credentials are configured
    const hasBasicCredentials = 
      config.oauth.instagramBasic.appId && 
      config.oauth.instagramBasic.appSecret &&
      config.oauth.instagramBasic.appId !== 'your_instagram_basic_app_id_here' &&
      config.oauth.instagramBasic.appSecret !== 'your_instagram_basic_app_secret_here';

    if (hasBasicCredentials) {
      options.push({
        type: ProviderType.INSTAGRAM_BASIC,
        name: 'Instagram API with Instagram Login',
        description: 'For personal accounts',
        recommended: false,
        features: [
          'View your profile information',
          'Access your media (photos/videos)',
          'Read basic account data',
        ],
        limitations: [
          'Cannot publish content',
          'Cannot schedule posts',
          'Limited to personal accounts only',
          'Read-only access',
        ],
      });
    }

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
      // Feature flag: Use new InstagramProfessionalProvider when enabled
      if (config.features.useInstagramProfessional) {
        // Use new unified provider (Instagram API with Instagram Login)
        // Use Instagram Basic Display app credentials (not Facebook app)
        const professionalProvider = new InstagramProfessionalProvider(
          config.oauth.instagramBasic.appId!,
          config.oauth.instagramBasic.appSecret!,
          config.oauth.instagramBasic.redirectUri!
        );

        const { url, state } = await professionalProvider.getAuthorizationUrl();

        logger.info('Instagram OAuth flow initiated (Professional Provider)', {
          providerType: 'INSTAGRAM_PROFESSIONAL',
          state,
        });

        return { url, state };
      }

      // Default: Use existing provider logic
      const provider = oauthProviderFactory.getProvider(providerType);

      const { url, state } = await provider.getAuthorizationUrl();

      logger.info('Instagram OAuth flow initiated', {
        providerType,
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
   * Handles both Business (multi-account) and Basic Display (single account) flows
   */
  async connectAccount(params: InstagramConnectParams): Promise<InstagramConnectResult> {
    const startTime = Date.now();

    try {
      logger.info('Instagram account connection started', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        providerType: params.providerType,
      });

      // Feature flag: Use new InstagramProfessionalProvider when enabled
      if (config.features.useInstagramProfessional) {
        return await this.handleProfessionalAccount(params);
      }

      // Default: Use existing provider logic
      const provider = oauthProviderFactory.getProvider(params.providerType);

      // Step 1: Exchange code for long-lived token
      const tokens = await provider.exchangeCodeForToken({
        code: params.code,
        state: params.state,
      });

      // Validate token expiration
      validateTokenExpiration(tokens.expiresAt, `Instagram ${params.providerType} token exchange`);

      logger.info('Instagram token exchange successful', {
        providerType: params.providerType,
        expiresIn: tokens.expiresIn,
        expiresInDays: tokens.expiresIn ? Math.floor(tokens.expiresIn / 86400) : undefined,
      });

      const saved: ISocialAccount[] = [];
      const failed: Array<{ username: string; error: string }> = [];

      // Step 2: Handle provider-specific account discovery
      if (params.providerType === ProviderType.INSTAGRAM_BUSINESS) {
        // Business: Multi-account flow via Facebook Pages
        await this.handleBusinessAccounts(
          params,
          tokens,
          saved,
          failed
        );
      } else if (params.providerType === ProviderType.INSTAGRAM_BASIC) {
        // Basic Display: Single account flow
        await this.handleBasicAccount(
          params,
          tokens,
          saved,
          failed
        );
      }

      const duration = Date.now() - startTime;
      logger.info('Instagram account connection completed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        providerType: params.providerType,
        saved: saved.length,
        failed: failed.length,
        duration,
      });

      return { saved, failed };
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
   * Handle Instagram Business accounts (multi-account via Facebook Pages)
   */
  private async handleBusinessAccounts(
    params: InstagramConnectParams,
    tokens: any,
    saved: ISocialAccount[],
    failed: Array<{ username: string; error: string }>
  ): Promise<void> {
    // Get Business provider
    const businessProvider = oauthProviderFactory.getProvider(ProviderType.INSTAGRAM_BUSINESS) as InstagramBusinessProvider;

    // Get Instagram Business accounts via Facebook Pages
    const instagramAccounts = await businessProvider.getInstagramAccounts(tokens.accessToken);

    if (instagramAccounts.length === 0) {
      logger.warn('No Instagram Business accounts found', {
        workspaceId: params.workspaceId,
        userId: params.userId,
      });

      throw new Error('No Instagram Business accounts found. Please ensure your Instagram account is a Business or Creator account and is connected to a Facebook Page.');
    }

    // Save each Instagram account
    for (const igData of instagramAccounts) {
      try {
        // Check for duplicate
        await assertNoDuplicateAccount(
          params.workspaceId,
          SocialPlatform.INSTAGRAM,
          igData.instagramAccount.id
        );

        // Create connection metadata
        const connectionMetadata: ConnectionMetadata = {
          type: 'INSTAGRAM_BUSINESS',
          pageId: igData.pageId,
          pageName: igData.pageName,
          tokenRefreshable: true,
          lastRefreshAttempt: undefined,
          refreshFailureCount: 0,
        };

        // Create new account
        const account = await SocialAccount.create({
          workspaceId: params.workspaceId,
          provider: SocialPlatform.INSTAGRAM,
          providerType: ModelProviderType.INSTAGRAM_BUSINESS,
          providerUserId: igData.instagramAccount.id,
          accountName: igData.instagramAccount.username,
          accountType: 'BUSINESS', // Instagram Business accounts
          accessToken: igData.pageAccessToken, // Store page token (encrypted by pre-save hook)
          tokenExpiresAt: tokens.expiresAt,
          scopes: ['instagram_basic', 'instagram_content_publish'],
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
          connectionMetadata,
          metadata: {
            username: igData.instagramAccount.username,
            name: igData.instagramAccount.name,
            profilePictureUrl: igData.instagramAccount.profile_picture_url,
            followersCount: igData.instagramAccount.followers_count,
            followsCount: igData.instagramAccount.follows_count,
            mediaCount: igData.instagramAccount.media_count,
            biography: igData.instagramAccount.biography,
            website: igData.instagramAccount.website,
          },
          lastSyncAt: new Date(),
        });

        saved.push(account);

        logger.info('Instagram Business account connected', {
          accountId: account._id,
          username: igData.instagramAccount.username,
          pageId: igData.pageId,
        });

        // Log security event
        await securityAuditService.logEvent({
          type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
          workspaceId: params.workspaceId,
          userId: params.userId,
          ipAddress: params.ipAddress,
          resource: igData.instagramAccount.id,
          success: true,
          metadata: {
            provider: SocialPlatform.INSTAGRAM,
            providerType: ProviderType.INSTAGRAM_BUSINESS,
            username: igData.instagramAccount.username,
            pageId: igData.pageId,
            pageName: igData.pageName,
          },
        });
      } catch (error: any) {
        logger.error('Failed to save Instagram Business account', {
          username: igData.instagramAccount.username,
          error: error.message,
        });

        failed.push({
          username: igData.instagramAccount.username,
          error: error.message,
        });
      }
    }
  }

  /**
   * Handle Instagram Basic Display account (single account)
   */
  private async handleBasicAccount(
    params: InstagramConnectParams,
    tokens: any,
    saved: ISocialAccount[],
    failed: Array<{ username: string; error: string }>
  ): Promise<void> {
    try {
      // Get Basic Display provider
      const basicProvider = oauthProviderFactory.getProvider(ProviderType.INSTAGRAM_BASIC) as InstagramBasicDisplayProvider;

      // Get user profile
      const profile = await basicProvider.getUserProfile(tokens.accessToken);

      // Check for duplicate
      await assertNoDuplicateAccount(
        params.workspaceId,
        SocialPlatform.INSTAGRAM,
        profile.id
      );

      // Create connection metadata
      const connectionMetadata: ConnectionMetadata = {
        type: 'INSTAGRAM_BASIC',
        longLivedTokenExpiresAt: tokens.expiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        tokenRefreshable: true,
        lastRefreshAttempt: undefined,
        refreshFailureCount: 0,
      };

      // Create new account
      const account = await SocialAccount.create({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.INSTAGRAM,
        providerType: ModelProviderType.INSTAGRAM_BASIC,
        providerUserId: profile.id,
        accountName: profile.username,
        accountType: profile.metadata?.accountType || 'PERSONAL',
        accessToken: tokens.accessToken, // Encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: ['user_profile', 'user_media'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        connectionMetadata,
        metadata: {
          username: profile.username,
          displayName: profile.displayName,
          profileUrl: profile.profileUrl,
        },
        lastSyncAt: new Date(),
      });

      saved.push(account);

      logger.info('Instagram Basic Display account connected', {
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
          providerType: ProviderType.INSTAGRAM_BASIC,
          username: profile.username,
          accountType: profile.metadata?.accountType,
        },
      });
    } catch (error: any) {
      logger.error('Failed to save Instagram Basic Display account', {
        error: error.message,
      });

      failed.push({
        username: 'Instagram User',
        error: error.message,
      });

      throw error; // Re-throw for Basic Display since it's single account
    }
  }

  /**
   * Handle Instagram Professional account (new unified flow)
   * Uses InstagramProfessionalProvider for Instagram API with Instagram Login
   */
  private async handleProfessionalAccount(params: InstagramConnectParams): Promise<InstagramConnectResult> {
    const startTime = Date.now();
    const saved: ISocialAccount[] = [];
    const failed: Array<{ username: string; error: string }> = [];

    try {
      // Create professional provider instance
      // Use Instagram Basic Display app credentials (not Facebook app)
      const professionalProvider = new InstagramProfessionalProvider(
        config.oauth.instagramBasic.appId!,
        config.oauth.instagramBasic.appSecret!,
        config.oauth.instagramBasic.redirectUri!
      );

      // Step 1: Exchange code for token
      const tokens = await professionalProvider.exchangeCodeForToken({
        code: params.code,
        state: params.state,
      });

      // Validate token expiration
      validateTokenExpiration(tokens.expiresAt, 'Instagram Professional token exchange');

      logger.info('Instagram Professional token exchange successful', {
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
        providerName: 'INSTAGRAM_PROFESSIONAL',
        tokenRefreshable: true,
        lastRefreshAttempt: undefined,
        refreshFailureCount: 0,
      };

      // Step 5: Save account to database
      const account = await SocialAccount.create({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.INSTAGRAM,
        providerType: ModelProviderType.INSTAGRAM_BUSINESS, // Keep existing enum value for now
        providerUserId: profile.id,
        accountName: profile.username,
        accountType: 'BUSINESS', // Instagram Professional accounts
        accessToken: tokens.accessToken, // Encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: [
          'instagram_business_basic',
          'instagram_business_content_publish',
          'instagram_business_manage_comments',
          'instagram_business_manage_messages',
        ],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2', // Use v2 (v3 not in enum yet)
        connectionMetadata,
        metadata: {
          username: profile.username,
        },
        lastSyncAt: new Date(),
      });

      saved.push(account);

      logger.info('Instagram Professional account connected', {
        accountId: account._id,
        username: profile.username,
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
          providerType: 'INSTAGRAM_PROFESSIONAL',
          username: profile.username,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('Instagram Professional account connection completed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        saved: saved.length,
        duration,
      });

      return { saved, failed };
    } catch (error: any) {
      logger.error('Failed to connect Instagram Professional account', {
        error: error.message,
      });

      failed.push({
        username: 'Instagram Professional User',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Refresh Instagram access token
   * 
   * Note: Instagram uses Facebook's token system
   * Long-lived tokens can be refreshed before expiry
   */
  async refreshToken(accountId: mongoose.Types.ObjectId | string): Promise<ISocialAccount> {
    try {
      const account = await SocialAccount.findById(accountId).select('+accessToken');

      if (!account) {
        throw new Error('Account not found');
      }

      const decryptedToken = account.getDecryptedAccessToken();

      // Refresh token by exchanging current token for new long-lived token
      const tokens = await this.provider.refreshAccessToken({
        refreshToken: decryptedToken, // Instagram uses current token for refresh
      });

      // Update account with new token
      account.accessToken = tokens.accessToken;
      account.tokenExpiresAt = tokens.expiresAt;
      account.lastRefreshedAt = new Date();
      account.status = AccountStatus.ACTIVE;

      await account.save();

      logger.info('Instagram token refreshed', {
        accountId,
        expiresIn: tokens.expiresIn,
      });

      return account;
    } catch (error: any) {
      logger.error('Instagram token refresh failed', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }
}
