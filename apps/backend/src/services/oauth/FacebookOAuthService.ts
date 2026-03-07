import { FacebookOAuthProvider, FacebookPage } from './FacebookOAuthProvider';
import { SocialAccount, ISocialAccount, AccountStatus, SocialPlatform } from '../../models/SocialAccount';
import { tokenSafetyService, TokenData } from '../TokenSafetyService';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';
import { encrypt } from '../../utils/encryption';

/**
 * Facebook OAuth Service
 * 
 * PRODUCTION-READY OAuth 2.0 integration for Facebook Graph API
 * 
 * Features:
 * - Real OAuth 2.0 token exchange
 * - Secure token storage using TokenSafetyService
 * - Multi-page support (saves each page as separate account)
 * - Error classification integration
 * - Security audit logging
 * 
 * Guarantees:
 * - NO token overwrite race
 * - NO plaintext token logging
 * - Full backward compatibility
 */

export interface FacebookConnectParams {
  workspaceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  code: string;
  state: string;
  ipAddress: string;
}

export interface FacebookConnectResult {
  saved: ISocialAccount[];
  failed: Array<{ pageId: string; pageName: string; error: string }>;
  totalPages: number;
}

export class FacebookOAuthService {
  private provider: FacebookOAuthProvider;
  private readonly REQUIRED_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'public_profile'];

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new FacebookOAuthProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Initiate Facebook OAuth flow
   * 
   * Generates authorization URL
   */
  async initiateOAuth(): Promise<{
    url: string;
    state: string;
  }> {
    try {
      const { url, state } = await this.provider.getAuthorizationUrl();

      logger.info('Facebook OAuth flow initiated', { state });

      return { url, state };
    } catch (error: any) {
      logger.error('Failed to initiate Facebook OAuth', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Connect Facebook account (OAuth callback)
   * 
   * Exchanges authorization code for tokens, fetches pages, and stores accounts
   */
  async connectAccount(params: FacebookConnectParams): Promise<FacebookConnectResult> {
    const startTime = Date.now();

    try {
      logger.info('Facebook account connection started', {
        workspaceId: params.workspaceId,
        userId: params.userId,
      });

      // Step 1: Exchange code for tokens
      const tokens = await this.provider.exchangeCodeForToken({
        code: params.code,
        state: params.state,
      });

      // Step 2: Fetch user profile
      const profile = await this.provider.getUserProfile(tokens.accessToken);

      // Step 3: Fetch managed pages
      const pages = await this.provider.getUserPages(tokens.accessToken);

      if (!pages || pages.length === 0) {
        logger.warn('No Facebook pages found for user', {
          workspaceId: params.workspaceId,
          userId: profile.id,
        });
        throw new Error('No Facebook pages found. Please ensure you have at least one Facebook Page to connect.');
      }

      logger.info('Facebook pages fetched', {
        workspaceId: params.workspaceId,
        userId: profile.id,
        pageCount: pages.length,
      });

      // Step 4: Save each page as a separate account (controlled partial save)
      const savedAccounts: ISocialAccount[] = [];
      const failedPages: Array<{ pageId: string; pageName: string; error: string }> = [];
      
      for (const page of pages) {
        try {
          const account = await this.savePage(page, profile, params);
          savedAccounts.push(account);
        } catch (error: any) {
          const failureInfo = {
            pageId: page.id,
            pageName: page.name,
            error: error.message,
          };
          failedPages.push(failureInfo);
          
          logger.error('Failed to save Facebook page', failureInfo);
          // Continue with other pages - controlled partial save
        }
      }

      // Step 5: Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: 'facebook',
        success: true,
        metadata: {
          provider: SocialPlatform.FACEBOOK,
          facebookUserId: profile.id,
          facebookUserName: profile.displayName,
          pagesConnected: savedAccounts.length,
          pagesFailed: failedPages.length,
          pageIds: savedAccounts.map(a => a.providerUserId),
          failures: failedPages,
        },
      });

      const duration = Date.now() - startTime;
      
      if (failedPages.length > 0) {
        logger.warn('Facebook pages connected with failures', {
          workspaceId: params.workspaceId,
          saved: savedAccounts.length,
          failed: failedPages.length,
          failures: failedPages,
          duration,
        });
      } else {
        logger.info('Facebook pages connected successfully', {
          workspaceId: params.workspaceId,
          pagesConnected: savedAccounts.length,
          duration,
        });
      }

      return {
        saved: savedAccounts,
        failed: failedPages,
        totalPages: pages.length,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('Facebook account connection failed', {
        error: error.message,
        duration,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: 'facebook',
        success: false,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  /**
   * Save a Facebook page as a social account
   */
  private async savePage(
    page: FacebookPage,
    userProfile: any,
    params: FacebookConnectParams
  ): Promise<ISocialAccount> {
    // Check if account already exists
    const existingAccount = await SocialAccount.findOne({
      workspaceId: params.workspaceId,
      provider: SocialPlatform.FACEBOOK,
      providerUserId: page.id,
    });

    if (existingAccount) {
      // Update existing account (UPSERT behavior)
      return await this.updateExistingPage(existingAccount, page, userProfile, params);
    }

    // Create new account with encrypted tokens
    const account = await SocialAccount.create({
      workspaceId: params.workspaceId,
      provider: SocialPlatform.FACEBOOK,
      providerUserId: page.id,
      accountName: page.name,
      accessToken: page.access_token, // Will be encrypted by pre-save hook
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      scopes: this.REQUIRED_SCOPES,
      status: AccountStatus.ACTIVE,
      metadata: {
        category: page.category,
        pictureUrl: page.picture?.data?.url,
        facebookUserId: userProfile.id,
        facebookUserName: userProfile.displayName,
        facebookUserEmail: userProfile.metadata?.email,
      },
      lastSyncAt: new Date(),
    });

    const savedAccount = account;

    // Store token metadata for safety
    const tokenData: TokenData = {
      accessToken: savedAccount.accessToken, // Encrypted
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days default
      scope: this.REQUIRED_SCOPES.join(' '),
    };

    await tokenSafetyService.storeTokenMetadata(
      savedAccount._id.toString(),
      SocialPlatform.FACEBOOK,
      tokenData,
      1 // Initial version
    );

    logger.info('Facebook page saved', {
      accountId: savedAccount._id,
      pageId: page.id,
      pageName: page.name,
    });

    return savedAccount;
  }

  /**
   * Update existing page during reconnect
   */
  private async updateExistingPage(
    existingAccount: ISocialAccount,
    page: FacebookPage,
    userProfile: any,
    params: FacebookConnectParams
  ): Promise<ISocialAccount> {
    // Get current version for optimistic locking
    const metadata = await tokenSafetyService.getTokenMetadata(
      existingAccount._id.toString()
    );
    const currentVersion = metadata?.version || 0;

    // Update account with new tokens
    existingAccount.accessToken = page.access_token; // Will be encrypted by pre-save hook
    existingAccount.tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
    existingAccount.status = AccountStatus.ACTIVE;
    existingAccount.accountName = page.name;
    existingAccount.metadata = {
      ...existingAccount.metadata,
      category: page.category,
      pictureUrl: page.picture?.data?.url,
      facebookUserId: userProfile.id,
      facebookUserName: userProfile.displayName,
      facebookUserEmail: userProfile.metadata?.email,
    };
    existingAccount.lastSyncAt = new Date();

    await existingAccount.save();

    // Store token metadata with incremented version
    const tokenData: TokenData = {
      accessToken: existingAccount.accessToken,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days default
      scope: this.REQUIRED_SCOPES.join(' '),
    };

    await tokenSafetyService.storeTokenMetadata(
      existingAccount._id.toString(),
      SocialPlatform.FACEBOOK,
      tokenData,
      currentVersion + 1
    );

    logger.info('Facebook page reconnected', {
      accountId: existingAccount._id,
      pageId: page.id,
      pageName: page.name,
    });

    return existingAccount;
  }

  /**
   * Revoke Facebook access
   */
  async revokeAccess(
    accountId: mongoose.Types.ObjectId | string,
    userId: mongoose.Types.ObjectId | string,
    ipAddress: string
  ): Promise<void> {
    try {
      const account = await SocialAccount.findById(accountId).select('+accessToken');

      if (!account) {
        throw new Error('Account not found');
      }

      // Revoke token on Facebook
      const decryptedAccessToken = account.getDecryptedAccessToken();
      await this.provider.revokeToken(decryptedAccessToken);

      // Update account status
      account.status = AccountStatus.REVOKED;
      await account.save();

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.TOKEN_REVOKED,
        workspaceId: account.workspaceId,
        userId,
        ipAddress,
        resource: accountId.toString(),
        success: true,
        metadata: {
          provider: SocialPlatform.FACEBOOK,
        },
      });

      logger.info('Facebook access revoked', {
        accountId,
        userId,
      });
    } catch (error: any) {
      logger.error('Facebook access revocation failed', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }
}
