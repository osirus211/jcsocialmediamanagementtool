/**
 * LinkedIn OAuth Service
 * 
 * Complete LinkedIn OAuth integration with company pages support
 * Handles personal profiles and organization pages
 * Uses LinkedIn API v2 with proper UGC Posts API
 */

import { LinkedInOAuthProvider } from './LinkedInOAuthProvider';
import { SocialAccount, SocialPlatform, AccountStatus } from '../../models/SocialAccount';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';
import { logger } from '../../utils/logger';
import axios from 'axios';

interface ConnectAccountParams {
  workspaceId: string;
  userId: string;
  code: string;
  state: string;
  ipAddress: string;
}

interface ConnectAccountResult {
  account: any;
  organizations?: any[];
  saved: any[];
  failed: any[];
}

interface LinkedInProfile {
  id: string;
  displayName: string;
  username?: string;
  email?: string;
  profileUrl?: string;
  avatarUrl?: string;
  metadata?: {
    givenName?: string;
    familyName?: string;
    locale?: string;
    emailVerified?: boolean;
  };
}

interface LinkedInOrganization {
  id: string;
  name: string;
  logoUrl?: string;
  vanityName?: string;
  websiteUrl?: string;
  followerCount?: number;
}

export class LinkedInOAuthService {
  private provider: LinkedInOAuthProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new LinkedInOAuthProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Connect LinkedIn account with company pages support
   */
  async connectAccount(params: ConnectAccountParams): Promise<ConnectAccountResult> {
    const { workspaceId, userId, code, ipAddress } = params;

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

      // Step 3: Fetch organization pages (company pages)
      const organizations = await this.getUserOrganizations(tokens.accessToken);
      
      logger.info('[LinkedIn] Organizations fetched', {
        workspaceId,
        organizationCount: organizations.length,
      });

      // Step 4: Save personal profile and organizations
      const saved: any[] = [];
      const failed: any[] = [];

      // Save personal profile
      try {
        const personalAccount = await this.savePersonalAccount(
          workspaceId, 
          profile, 
          tokens
        );
        saved.push(personalAccount);
        logger.info('[LinkedIn] Personal profile saved', {
          workspaceId,
          accountId: personalAccount._id,
        });
      } catch (error: any) {
        logger.error('[LinkedIn] Failed to save personal profile', {
          workspaceId,
          error: error.message,
        });
        failed.push({
          type: 'personal',
          id: profile.id,
          name: profile.displayName,
          error: error.message,
        });
      }

      // Save organization pages
      for (const org of organizations) {
        try {
          const orgAccount = await this.saveOrganizationAccount(
            workspaceId,
            org,
            tokens
          );
          saved.push(orgAccount);
          logger.info('[LinkedIn] Organization saved', {
            workspaceId,
            accountId: orgAccount._id,
            organizationId: org.id,
          });
        } catch (error: any) {
          logger.error('[LinkedIn] Failed to save organization', {
            workspaceId,
            organizationId: org.id,
            error: error.message,
          });
          failed.push({
            type: 'organization',
            id: org.id,
            name: org.name,
            error: error.message,
          });
        }
      }

      logger.info('[LinkedIn] Account connection completed', {
        workspaceId,
        saved: saved.length,
        failed: failed.length,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: workspaceId,
        userId: userId,
        ipAddress: ipAddress,
        resource: saved[0]?.providerUserId || 'linkedin',
        success: true,
        metadata: {
          provider: SocialPlatform.LINKEDIN,
          accountsConnected: saved.length,
          accountsFailed: failed.length,
          hasRefreshToken: !!tokens.refreshToken,
        },
      });

      return { 
        account: saved[0], // Return first saved account (personal profile)
        organizations,
        saved,
        failed,
      };
    } catch (error: any) {
      logger.error('[LinkedIn] Account connection failed', {
        workspaceId,
        userId,
        error: error.message,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        workspaceId: workspaceId,
        userId: userId,
        ipAddress: ipAddress,
        resource: 'linkedin',
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.LINKEDIN,
        },
      });

      throw error;
    }
  }

  /**
   * Get user organizations (company pages)
   */
  async getUserOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
    try {
      const response = await axios.get(
        'https://api.linkedin.com/v2/organizationAcls',
        {
          params: {
            q: 'roleAssignee',
            role: 'ADMINISTRATOR',
            state: 'APPROVED',
            projection: '(elements*(organization~(id,name,logoV2,vanityName,websiteUrl,followersCount)))',
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      const organizations: LinkedInOrganization[] = [];
      const elements = response.data.elements || [];

      for (const element of elements) {
        const org = element['organization~'];
        if (org) {
          organizations.push({
            id: org.id,
            name: org.name,
            logoUrl: org.logoV2?.['cropped~']?.elements?.[0]?.identifiers?.[0]?.identifier,
            vanityName: org.vanityName,
            websiteUrl: org.websiteUrl,
            followerCount: org.followersCount,
          });
        }
      }

      logger.info('[LinkedIn] Organizations fetched', {
        count: organizations.length,
      });

      return organizations;
    } catch (error: any) {
      logger.warn('[LinkedIn] Failed to fetch organizations', {
        error: error.response?.data || error.message,
      });
      // Return empty array if organizations fetch fails (not critical)
      return [];
    }
  }

  /**
   * Save personal LinkedIn account
   */
  private async savePersonalAccount(
    workspaceId: string,
    profile: LinkedInProfile,
    tokens: any
  ): Promise<any> {
    // Check for duplicate personal account
    const existing = await SocialAccount.findOne({
      workspaceId,
      provider: SocialPlatform.LINKEDIN,
      providerUserId: profile.id,
      'metadata.accountType': { $ne: 'organization' },
    });

    if (existing) {
      logger.warn('[LinkedIn] Duplicate personal account detected', {
        workspaceId,
        profileId: profile.id,
        existingAccountId: existing._id,
      });
      throw new Error('LinkedIn personal account already connected');
    }

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
        accountType: 'personal',
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
    return account;
  }

  /**
   * Save organization LinkedIn account
   */
  private async saveOrganizationAccount(
    workspaceId: string,
    organization: LinkedInOrganization,
    tokens: any
  ): Promise<any> {
    // Check for duplicate organization account
    const existing = await SocialAccount.findOne({
      workspaceId,
      provider: SocialPlatform.LINKEDIN,
      providerUserId: organization.id,
      'metadata.accountType': 'organization',
    });

    if (existing) {
      logger.warn('[LinkedIn] Duplicate organization account detected', {
        workspaceId,
        organizationId: organization.id,
        existingAccountId: existing._id,
      });
      throw new Error(`LinkedIn organization "${organization.name}" already connected`);
    }

    const account = new SocialAccount({
      workspaceId,
      provider: SocialPlatform.LINKEDIN,
      providerUserId: organization.id,
      accountName: organization.name,
      accessToken: tokens.accessToken, // Will be encrypted by pre-save hook
      refreshToken: tokens.refreshToken, // Will be encrypted by pre-save hook
      tokenExpiresAt: tokens.expiresAt,
      scopes: (tokens as any).scope || ['openid', 'profile', 'email', 'w_member_social', 'w_organization_social'],
      status: AccountStatus.ACTIVE,
      connectionVersion: 'v2',
      metadata: {
        accountType: 'organization',
        organizationId: organization.id,
        vanityName: organization.vanityName,
        websiteUrl: organization.websiteUrl,
        logoUrl: organization.logoUrl,
        followerCount: organization.followerCount,
      },
      lastSyncAt: new Date(),
    });

    await account.save();
    return account;
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

  /**
   * Disconnect LinkedIn account
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      logger.info('[LinkedIn] Disconnecting account', { accountId });

      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      if (account.provider !== SocialPlatform.LINKEDIN) {
        throw new Error('Account is not a LinkedIn account');
      }

      // Update account status to disconnected
      account.status = AccountStatus.DISCONNECTED;
      account.accessToken = null;
      account.refreshToken = null;
      account.tokenExpiresAt = null;
      await account.save();

      logger.info('[LinkedIn] Account disconnected successfully', { accountId });

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
    } catch (error: any) {
      logger.error('[LinkedIn] Account disconnection failed', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }
}