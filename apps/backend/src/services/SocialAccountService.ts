import { SocialAccount, ISocialAccount, SocialPlatform, AccountStatus } from '../models/SocialAccount';
import { config } from '../config';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';
import { usageService } from './UsageService';
import { workspaceService } from './WorkspaceService';
import { ActivityAction } from '../models/WorkspaceActivityLog';

/**
 * Social Account Service
 * 
 * Handles social media account connections and management
 * 
 * Features:
 * - Connect/disconnect accounts
 * - Token management
 * - Account sync
 * - Multi-tenant safe
 */

export interface ConnectAccountInput {
  workspaceId: string;
  platform: SocialPlatform;
  accountName: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  metadata?: any;
  // Activity logging context
  connectedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateAccountInput {
  accountName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  status?: AccountStatus;
  metadata?: any;
}

export class SocialAccountService {
  /**
   * Connect a new social account
   */
  async connectAccount(input: ConnectAccountInput): Promise<ISocialAccount> {
    try {
      // Check if account already exists
      const existing = await SocialAccount.findOne({
        workspaceId: input.workspaceId,
        provider: input.platform,
        providerUserId: input.accountId,
      });

      if (existing) {
        // Update existing account
        existing.accountName = input.accountName;
        existing.accessToken = input.accessToken;
        existing.refreshToken = input.refreshToken;
        existing.tokenExpiresAt = input.tokenExpiresAt;
        existing.scopes = input.scopes;
        existing.status = AccountStatus.ACTIVE;
        existing.metadata = { ...existing.metadata, ...input.metadata };
        existing.lastSyncAt = new Date();

        await existing.save();

        // Log reconnection activity
        if (input.connectedBy) {
          await workspaceService.logActivity({
            workspaceId: input.workspaceId,
            userId: input.connectedBy,
            action: ActivityAction.ACCOUNT_RECONNECTED,
            resourceType: 'SocialAccount',
            resourceId: existing._id,
            details: {
              platform: input.platform,
              accountName: input.accountName,
              accountId: input.accountId,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          });
        }

        logger.info('Social account reconnected', {
          workspaceId: input.workspaceId,
          platform: input.platform,
          accountId: input.accountId,
        });

        return existing;
      }

      // Create new account
      const account = new SocialAccount({
        workspaceId: input.workspaceId,
        provider: input.platform,
        providerUserId: input.accountId,
        accountName: input.accountName,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: input.scopes,
        status: AccountStatus.ACTIVE,
        metadata: input.metadata || {},
        lastSyncAt: new Date(),
      });

      await account.save();

      // Update usage tracking
      await usageService.incrementAccounts(input.workspaceId);

      // Log connection activity
      if (input.connectedBy) {
        await workspaceService.logActivity({
          workspaceId: input.workspaceId,
          userId: input.connectedBy,
          action: ActivityAction.ACCOUNT_CONNECTED,
          resourceType: 'SocialAccount',
          resourceId: account._id,
          details: {
            platform: input.platform,
            accountName: input.accountName,
            accountId: input.accountId,
          },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });
      }

      logger.info('Social account connected', {
        workspaceId: input.workspaceId,
        platform: input.platform,
        accountId: input.accountId,
      });

      return account;
    } catch (error: any) {
      logger.error('Connect account error', { error: error.message, input });
      throw error;
    }
  }

  /**
   * Get all accounts for a workspace
   */
  async getAccountsByWorkspace(workspaceId: string): Promise<ISocialAccount[]> {
    try {
      const accounts = await SocialAccount.find({
        workspaceId,
        status: { $nin: [AccountStatus.DISCONNECTED] },
      }).sort({ createdAt: -1 });

      return accounts;
    } catch (error: any) {
      logger.error('Get accounts error', { error: error.message, workspaceId });
      throw error;
    }
  }

  /**
   * Get account by ID (with workspace validation)
   */
  async getAccountById(accountId: string, workspaceId: string): Promise<ISocialAccount> {
    try {
      const account = await SocialAccount.findOne({
        _id: accountId,
        workspaceId,
      });

      if (!account) {
        throw new NotFoundError('Social account not found');
      }

      return account;
    } catch (error: any) {
      logger.error('Get account error', { error: error.message, accountId, workspaceId });
      throw error;
    }
  }

  /**
   * Get account with decrypted tokens (for internal use only)
   */
  async getAccountWithTokens(accountId: string, workspaceId: string): Promise<ISocialAccount> {
    try {
      const account = await SocialAccount.findOne({
        _id: accountId,
        workspaceId,
      }).select('+accessToken +refreshToken');

      if (!account) {
        throw new NotFoundError('Social account not found');
      }

      return account;
    } catch (error: any) {
      logger.error('Get account with tokens error', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update account
   */
  async updateAccount(
    accountId: string,
    workspaceId: string,
    input: UpdateAccountInput
  ): Promise<ISocialAccount> {
    try {
      const account = await this.getAccountById(accountId, workspaceId);

      if (input.accountName) account.accountName = input.accountName;
      if (input.accessToken) account.accessToken = input.accessToken;
      if (input.refreshToken) account.refreshToken = input.refreshToken;
      if (input.tokenExpiresAt) account.tokenExpiresAt = input.tokenExpiresAt;
      if (input.status) account.status = input.status;
      if (input.metadata) {
        account.metadata = { ...account.metadata, ...input.metadata };
      }

      await account.save();

      logger.info('Social account updated', {
        accountId,
        workspaceId,
      });

      return account;
    } catch (error: any) {
      logger.error('Update account error', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Disconnect account (soft delete)
   */
  async disconnectAccount(accountId: string, workspaceId: string, userId?: string, ipAddress?: string): Promise<void> {
    try {
      const account = await this.getAccountById(accountId, workspaceId);

      // Soft delete: mark as DISCONNECTED (preserves audit log)
      account.status = AccountStatus.DISCONNECTED;
      await account.save();

      // Log disconnection activity
      if (userId) {
        await workspaceService.logActivity({
          workspaceId: workspaceId,
          userId: userId,
          action: ActivityAction.ACCOUNT_DISCONNECTED,
          resourceType: 'SocialAccount',
          resourceId: account._id,
          details: {
            platform: account.provider,
            accountName: account.accountName,
            providerUserId: account.providerUserId,
          },
          ipAddress: ipAddress,
        });
      }

      // Log security event
      if (userId && ipAddress) {
        const { securityAuditService } = await import('./SecurityAuditService');
        const { SecurityEventType } = await import('../models/SecurityEvent');
        
        await securityAuditService.logEvent({
          type: SecurityEventType.ACCOUNT_DISCONNECTED,
          userId,
          workspaceId,
          ipAddress,
          resource: accountId,
          success: true,
          metadata: {
            platform: account.provider,
            accountName: account.accountName,
            providerUserId: account.providerUserId,
          },
        });
      }

      logger.info('Social account disconnected', {
        accountId,
        workspaceId,
        platform: account.provider,
        userId,
      });
    } catch (error: any) {
      logger.error('Disconnect account error', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Refresh account token (placeholder for OAuth refresh logic)
   */
  async refreshAccountToken(accountId: string, workspaceId: string): Promise<ISocialAccount> {
    try {
      const account = await this.getAccountWithTokens(accountId, workspaceId);

      if (!account.refreshToken) {
        throw new BadRequestError('Account does not have a refresh token');
      }

      if (account.status !== AccountStatus.ACTIVE) {
        throw new UnauthorizedError('Account is not active');
      }

      // Import OAuth manager dynamically to avoid circular dependencies
      const { oauthManager } = await import('./oauth/OAuthManager');

      // Get OAuth provider for platform
      const provider = oauthManager.getProvider(account.provider);

      // Refresh token using OAuth provider
      const decryptedRefreshToken = account.getDecryptedRefreshToken();
      if (!decryptedRefreshToken) {
        throw new BadRequestError('Failed to decrypt refresh token');
      }

      const tokens = await provider.refreshAccessToken(decryptedRefreshToken);

      // Update account with new tokens
      account.accessToken = tokens.accessToken;
      if (tokens.refreshToken) {
        account.refreshToken = tokens.refreshToken;
      }
      account.tokenExpiresAt = tokens.expiresAt;
      account.lastRefreshedAt = new Date();
      account.status = AccountStatus.ACTIVE;

      await account.save();

      logger.info('Token refresh successful', {
        accountId,
        platform: account.provider,
      });

      return account;
    } catch (error: any) {
      logger.error('Refresh token error', { error: error.message, accountId });
      
      // Mark account as expired if refresh fails
      try {
        await this.updateAccount(accountId, workspaceId, {
          status: AccountStatus.EXPIRED,
        });

        // Send OAuth expired email notification (non-blocking)
        this.sendOAuthExpiredEmail(accountId, workspaceId).catch(err => {
          logger.warn('Failed to send OAuth expired email', { accountId, error: err.message });
        });
      } catch (updateError) {
        logger.error('Failed to mark account as expired', { accountId });
      }

      throw error;
    }
  }

  /**
   * Sync account info from platform (placeholder)
   */
  async syncAccountInfo(accountId: string, workspaceId: string): Promise<ISocialAccount> {
    try {
      const account = await this.getAccountWithTokens(accountId, workspaceId);

      if (account.status !== AccountStatus.ACTIVE) {
        throw new UnauthorizedError('Account is not active');
      }

      // Check if token is expired or about to expire (within 5 minutes)
      if (account.tokenExpiresAt) {
        const fiveMinutes = 5 * 60 * 1000;
        const timeUntilExpiry = account.tokenExpiresAt.getTime() - Date.now();

        if (timeUntilExpiry <= fiveMinutes && account.refreshToken) {
          logger.info('Token expired or expiring soon, attempting refresh', {
            accountId,
            timeUntilExpiry: Math.floor(timeUntilExpiry / 1000 / 60) + ' minutes',
          });
          
          try {
            await this.refreshAccountToken(accountId, workspaceId);
            // Recursively call sync after refresh
            return await this.syncAccountInfo(accountId, workspaceId);
          } catch (refreshError: any) {
            logger.error('Token refresh failed during sync', {
              accountId,
              error: refreshError.message,
            });
            // If refresh fails, mark account as expired and throw
            account.status = AccountStatus.EXPIRED;
            await account.save();
            throw new UnauthorizedError('Token expired and refresh failed. Please reconnect your account.');
          }
        }
      }

      const decryptedAccessToken = account.getDecryptedAccessToken();

      // Validate token length (OAuth 2.0 tokens should be at least 40 characters)
      if (!decryptedAccessToken || decryptedAccessToken.length < 40) {
        logger.error('Invalid token detected - too short or missing', {
          accountId,
          tokenLength: decryptedAccessToken?.length || 0,
        });
        account.status = AccountStatus.EXPIRED;
        await account.save();
        throw new UnauthorizedError('Invalid access token. Please reconnect your account.');
      }

      // Handle Facebook pages differently
      if (account.provider === SocialPlatform.FACEBOOK) {
        // For Facebook pages, fetch page info directly
        const { FacebookOAuthProvider } = await import('./oauth/FacebookOAuthProvider');
        const { config } = await import('../config');
        
        const provider = new FacebookOAuthProvider(
          config.oauth?.facebook?.appId!,
          config.oauth?.facebook?.appSecret!,
          config.oauth?.facebook?.callbackUrl || ''
        );

        const pageInfo = await provider.getPageInfo(account.providerUserId, decryptedAccessToken);

        // Update account with fresh page data
        account.accountName = pageInfo.name;
        account.metadata = {
          ...account.metadata,
          category: pageInfo.category,
          pictureUrl: pageInfo.picture?.data?.url,
        };
        account.lastSyncAt = new Date();

        await account.save();

        logger.info('Facebook page sync successful', {
          accountId,
          pageId: account.providerUserId,
          pageName: pageInfo.name,
        });

        return account;
      }

      // Handle Instagram Business accounts
      if (account.provider === SocialPlatform.INSTAGRAM) {
        // For Instagram, fetch account info using page token
        const { InstagramBusinessProvider } = await import('./oauth/InstagramBusinessProvider');
        const { config } = await import('../config');
        
        const provider = new InstagramBusinessProvider(
          config.oauth?.instagram?.clientId!,
          config.oauth?.instagram?.clientSecret!,
          config.oauth?.instagram?.callbackUrl || ''
        );

        const igInfo = await provider.getInstagramAccountInfo(
          account.providerUserId,
          decryptedAccessToken
        );

        // Update account with fresh Instagram data
        account.accountName = igInfo.username;
        account.metadata = {
          ...account.metadata,
          username: igInfo.username,
          name: igInfo.name,
          profilePictureUrl: igInfo.profile_picture_url,
          followersCount: igInfo.followers_count,
          followsCount: igInfo.follows_count,
          mediaCount: igInfo.media_count,
          biography: igInfo.biography,
          website: igInfo.website,
        };
        account.lastSyncAt = new Date();

        await account.save();

        logger.info('Instagram account sync successful', {
          accountId,
          instagramId: account.providerUserId,
          username: igInfo.username,
        });

        return account;
      }

      // For other platforms (Twitter, LinkedIn, etc.), use OAuth manager
      const { oauthManager } = await import('./oauth/OAuthManager');
      const provider = oauthManager.getProvider(account.provider);

      // Fetch user profile using OAuth provider with retry logic for 503 errors
      let profile;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second

      while (retryCount <= maxRetries) {
        try {
          profile = await provider.getUserProfile(decryptedAccessToken);
          break; // Success, exit retry loop
        } catch (error: any) {
          retryCount++;
          
          // Retry on 503 (Service Unavailable) errors
          if (error.message?.includes('503') && retryCount <= maxRetries) {
            logger.warn('Twitter API returned 503, retrying...', {
              accountId,
              attempt: retryCount,
              maxRetries,
            });
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          
          // Max retries reached or non-503 error
          logger.error('Profile fetch failed during sync', {
            accountId,
            platform: account.provider,
            error: error.message,
            retries: retryCount,
          });
          throw error;
        }
      }

      // Update account metadata with fresh profile data
      account.accountName = profile.displayName;
      account.metadata = {
        ...account.metadata,
        username: profile.username,
        email: profile.email,
        profileUrl: profile.profileUrl,
        avatarUrl: profile.avatarUrl,
        followerCount: profile.followerCount,
        ...profile.metadata,
      };
      account.lastSyncAt = new Date();

      await account.save();

      logger.info('Account sync successful', {
        accountId,
        platform: account.provider,
      });

      return account;
    } catch (error: any) {
      logger.error('Sync account error', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get accounts by platform
   */
  async getAccountsByPlatform(
    workspaceId: string,
    platform: SocialPlatform
  ): Promise<ISocialAccount[]> {
    try {
      const accounts = await SocialAccount.find({
        workspaceId,
        platform,
        status: AccountStatus.ACTIVE,
      }).sort({ createdAt: -1 });

      return accounts;
    } catch (error: any) {
      logger.error('Get accounts by platform error', { error: error.message, workspaceId, platform });
      throw error;
    }
  }

  /**
   * Check if account exists
   */
  async accountExists(workspaceId: string, platform: SocialPlatform, accountId: string): Promise<boolean> {
    try {
      const count = await SocialAccount.countDocuments({
        workspaceId,
        provider: platform,
        providerUserId: accountId,
        status: { $nin: [AccountStatus.DISCONNECTED] },
      });

      return count > 0;
    } catch (error: any) {
      logger.error('Account exists check error', { error: error.message });
      return false;
    }
  }

  /**
   * Send OAuth expired email notification
   */
  private async sendOAuthExpiredEmail(accountId: string, workspaceId: string): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');
      const { User } = await import('../models/User');
      const { Workspace } = await import('../models/Workspace');

      // Get account
      const account = await this.getAccountById(accountId, workspaceId);

      // Get workspace to find owner email
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        logger.warn('Workspace not found for email notification', { workspaceId });
        return;
      }

      // Get workspace owner
      const owner = await User.findById(workspace.ownerId);
      if (!owner) {
        logger.warn('Workspace owner not found for email notification', { ownerId: workspace.ownerId });
        return;
      }

      await emailNotificationService.sendOAuthExpired({
        to: owner.email,
        platform: account.provider,
        reconnectUrl: `${config.frontend.url}/workspace/${workspaceId}/accounts`,
        userId: owner._id.toString(),
        workspaceId: workspaceId,
      });
    } catch (error: any) {
      logger.error('Error sending OAuth expired email', { error: error.message });
      // Don't throw - email failures should not affect account operations
    }
  }
}

export const socialAccountService = new SocialAccountService();

