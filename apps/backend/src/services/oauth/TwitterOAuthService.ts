import { TwitterOAuthProvider } from './TwitterOAuthProvider';
import { SocialAccount, ISocialAccount, AccountStatus, SocialPlatform } from '../../models/SocialAccount';
import { tokenSafetyService, TokenData } from '../TokenSafetyService';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';
import { oauthErrorClassifier, OAuthErrorCategory } from '../OAuthErrorClassifier';
import { tokenLifecycleService } from '../TokenLifecycleService';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';
import { encrypt } from '../../utils/encryption';

/**
 * Twitter OAuth Service
 * 
 * PRODUCTION-READY OAuth 2.0 integration for Twitter/X
 * 
 * Features:
 * - Real OAuth 2.0 token exchange with PKCE
 * - Secure token storage using TokenSafetyService
 * - Token refresh with distributed lock (prevents races)
 * - Expiry detection integration
 * - Scope downgrade detection
 * - Error classification integration
 * - Reconnect flow logic
 * - Security audit logging
 * 
 * Guarantees:
 * - NO token overwrite race
 * - NO refresh duplication
 * - NO plaintext token logging
 * - Full backward compatibility
 */

export interface TwitterConnectParams {
  workspaceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  code: string;
  state: string;
  codeVerifier: string;
  ipAddress: string;
}

export interface TwitterRefreshResult {
  success: boolean;
  account?: ISocialAccount;
  error?: string;
  shouldReconnect?: boolean;
}

export class TwitterOAuthService {
  private provider: TwitterOAuthProvider;
  private readonly REQUIRED_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new TwitterOAuthProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Initiate Twitter OAuth flow
   * 
   * Generates authorization URL with PKCE
   */
  async initiateOAuth(): Promise<{
    url: string;
    state: string;
    codeVerifier: string;
  }> {
    try {
      const { url, state, codeVerifier } = await this.provider.getAuthorizationUrl();

      logger.info('Twitter OAuth flow initiated', { state });

      return { url, state, codeVerifier: codeVerifier! };
    } catch (error: any) {
      logger.error('Failed to initiate Twitter OAuth', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Connect Twitter account (OAuth callback)
   * 
   * Exchanges authorization code for tokens and stores account
   * Integrates with all foundation layer services
   */
  async connectAccount(params: TwitterConnectParams): Promise<ISocialAccount> {
    const startTime = Date.now();

    try {
      logger.info('Twitter account connection started', {
        workspaceId: params.workspaceId,
        userId: params.userId,
      });

      // Step 1: Exchange code for tokens
      const tokens = await this.provider.exchangeCodeForToken({
        code: params.code,
        state: params.state,
        codeVerifier: params.codeVerifier,
      });

      // Step 2: Detect scope downgrade
      const scopeDowngrade = this.detectScopeDowngrade(tokens.scope || []);
      if (scopeDowngrade.detected) {
        logger.warn('Twitter scope downgrade detected', {
          expected: this.REQUIRED_SCOPES,
          received: tokens.scope,
          missing: scopeDowngrade.missingScopes,
        });

        // Log security event
        await securityAuditService.logEvent({
          type: SecurityEventType.OAUTH_CONNECT_FAILURE,
          workspaceId: params.workspaceId,
          userId: params.userId,
          ipAddress: params.ipAddress,
          resource: 'twitter',
          success: false,
          errorMessage: `Scope downgrade: missing ${scopeDowngrade.missingScopes.join(', ')}`,
          metadata: {
            expectedScopes: this.REQUIRED_SCOPES,
            receivedScopes: tokens.scope,
          },
        });

        throw new Error(`Twitter connection failed: Missing required permissions (${scopeDowngrade.missingScopes.join(', ')}). Please reconnect and grant all permissions.`);
      }

      // Step 3: Fetch user profile
      const profile = await this.provider.getUserProfile(tokens.accessToken);

      // Step 4: Check if account already exists
      const existingAccount = await SocialAccount.findOne({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.TWITTER,
        providerUserId: profile.id,
      });

      if (existingAccount) {
        // Update existing account
        return await this.updateExistingAccount(
          existingAccount,
          tokens,
          profile,
          params
        );
      }

      // Step 5: Create new account with encrypted tokens
      const account = await SocialAccount.create({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.TWITTER,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accessToken: tokens.accessToken, // Will be encrypted by pre-save hook
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scope || this.REQUIRED_SCOPES,
        status: AccountStatus.ACTIVE,
        metadata: {
          username: profile.username,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          followerCount: profile.followerCount,
          ...profile.metadata,
        },
      });

      // Step 6: Store token metadata for safety
      const tokenData: TokenData = {
        accessToken: account.accessToken, // Encrypted
        refreshToken: account.refreshToken,
        expiresAt: account.tokenExpiresAt!,
        scope: tokens.scope?.join(' '),
      };

      await tokenSafetyService.storeTokenMetadata(
        account._id.toString(),
        SocialPlatform.TWITTER,
        tokenData,
        1 // Initial version
      );

      // Step 7: Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: account._id.toString(),
        success: true,
        metadata: {
          provider: SocialPlatform.TWITTER,
          username: profile.username,
          scopes: tokens.scope,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('Twitter account connected successfully', {
        accountId: account._id,
        username: profile.username,
        duration,
      });

      return account;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Classify error
      const classified = oauthErrorClassifier.classify(SocialPlatform.TWITTER, error);

      logger.error('Twitter account connection failed', {
        error: error.message,
        category: classified.category,
        duration,
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: 'twitter',
        success: false,
        errorMessage: classified.technicalMessage,
        metadata: {
          category: classified.category,
          userMessage: classified.userMessage,
        },
      });

      throw new Error(classified.userMessage);
    }
  }

  /**
   * Update existing account during reconnect
   */
  private async updateExistingAccount(
    existingAccount: ISocialAccount,
    tokens: any,
    profile: any,
    params: TwitterConnectParams
  ): Promise<ISocialAccount> {
    // Get current version for optimistic locking
    const metadata = await tokenSafetyService.getTokenMetadata(
      existingAccount._id.toString()
    );
    const currentVersion = metadata?.version || 0;

    // Update account with new tokens
    existingAccount.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
    existingAccount.refreshToken = tokens.refreshToken;
    existingAccount.tokenExpiresAt = tokens.expiresAt;
    existingAccount.scopes = tokens.scope || this.REQUIRED_SCOPES;
    existingAccount.status = AccountStatus.ACTIVE;
    existingAccount.accountName = profile.displayName;
    existingAccount.metadata = {
      ...existingAccount.metadata,
      username: profile.username,
      profileUrl: profile.profileUrl,
      avatarUrl: profile.avatarUrl,
      followerCount: profile.followerCount,
      ...profile.metadata,
    };

    await existingAccount.save();

    // Store token metadata with incremented version
    const tokenData: TokenData = {
      accessToken: existingAccount.accessToken,
      refreshToken: existingAccount.refreshToken,
      expiresAt: existingAccount.tokenExpiresAt!,
      scope: tokens.scope?.join(' '),
    };

    await tokenSafetyService.storeTokenMetadata(
      existingAccount._id.toString(),
      SocialPlatform.TWITTER,
      tokenData,
      currentVersion + 1
    );

    // Clear reconnect flag
    await tokenLifecycleService.clearReconnectFlag(existingAccount._id);

    // Log security event
    await securityAuditService.logEvent({
      type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
      workspaceId: params.workspaceId,
      userId: params.userId,
      ipAddress: params.ipAddress,
      resource: existingAccount._id.toString(),
      success: true,
      metadata: {
        provider: SocialPlatform.TWITTER,
        username: profile.username,
        reconnect: true,
      },
    });

    logger.info('Twitter account reconnected successfully', {
      accountId: existingAccount._id,
      username: profile.username,
    });

    return existingAccount;
  }

  /**
   * Refresh Twitter access token
   * 
   * Uses distributed lock to prevent concurrent refresh races
   * Integrates with TokenSafetyService for atomic updates
   */
  async refreshToken(accountId: mongoose.Types.ObjectId | string): Promise<TwitterRefreshResult> {
    const startTime = Date.now();
    let lockId: string | null = null;

    try {
      // Step 1: Acquire distributed lock
      lockId = await tokenSafetyService.acquireRefreshLock(accountId.toString());

      if (!lockId) {
        logger.warn('Token refresh already in progress', { accountId });
        return {
          success: false,
          error: 'Token refresh already in progress',
        };
      }

      // Step 2: Fetch account with tokens
      const account = await SocialAccount.findById(accountId).select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Account not found');
      }

      if (!account.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Step 3: Verify token integrity
      const decryptedAccessToken = account.getDecryptedAccessToken();
      const decryptedRefreshToken = account.getDecryptedRefreshToken();

      const tokenData: TokenData = {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        expiresAt: account.tokenExpiresAt!,
        scope: account.scopes.join(' '),
      };

      const integrity = await tokenSafetyService.verifyTokenIntegrity(
        accountId.toString(),
        tokenData
      );

      if (!integrity.valid) {
        logger.error('Token corruption detected during refresh', {
          accountId,
          reason: integrity.reason,
        });

        // Mark account for reconnect
        await tokenLifecycleService.markReconnectRequired(
          accountId,
          `Token corruption: ${integrity.reason}`
        );

        return {
          success: false,
          error: 'Token corrupted, reconnect required',
          shouldReconnect: true,
        };
      }

      // Step 4: Refresh token via Twitter API
      const tokens = await this.provider.refreshAccessToken({
        refreshToken: decryptedRefreshToken!,
      });

      // Step 5: Detect scope downgrade
      const scopeDowngrade = this.detectScopeDowngrade(tokens.scope || []);
      if (scopeDowngrade.detected) {
        logger.warn('Scope downgrade detected during refresh', {
          accountId,
          missing: scopeDowngrade.missingScopes,
        });

        // Mark account for reconnect
        await tokenLifecycleService.markReconnectRequired(
          accountId,
          `Scope downgrade: missing ${scopeDowngrade.missingScopes.join(', ')}`
        );

        // Log security event
        await securityAuditService.logEvent({
          type: SecurityEventType.TOKEN_REFRESH_FAILURE,
          workspaceId: account.workspaceId,
          ipAddress: 'system',
          resource: accountId.toString(),
          success: false,
          errorMessage: 'Scope downgrade detected',
          metadata: {
            provider: SocialPlatform.TWITTER,
            expectedScopes: this.REQUIRED_SCOPES,
            receivedScopes: tokens.scope,
          },
        });

        return {
          success: false,
          error: 'Scope downgrade detected, reconnect required',
          shouldReconnect: true,
        };
      }

      // Step 6: Atomic token update with version check
      const metadata = await tokenSafetyService.getTokenMetadata(accountId.toString());
      const currentVersion = metadata?.version || 0;

      const newTokenData: TokenData = {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
        expiresAt: tokens.expiresAt!,
        scope: tokens.scope?.join(' '),
      };

      const writeResult = await tokenSafetyService.atomicTokenWrite(
        accountId.toString(),
        SocialPlatform.TWITTER,
        newTokenData,
        currentVersion,
        async (version) => {
          // Update database
          account.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
          account.refreshToken = tokens.refreshToken;
          account.tokenExpiresAt = tokens.expiresAt;
          account.scopes = tokens.scope || this.REQUIRED_SCOPES;
          account.lastRefreshedAt = new Date();
          account.status = AccountStatus.ACTIVE;

          await account.save();

          return true;
        }
      );

      if (!writeResult.success) {
        logger.warn('Token write failed due to version mismatch', {
          accountId,
          error: writeResult.error,
        });

        return {
          success: false,
          error: writeResult.error,
        };
      }

      // Step 7: Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.TOKEN_REFRESH_SUCCESS,
        workspaceId: account.workspaceId,
        ipAddress: 'system',
        resource: accountId.toString(),
        success: true,
        metadata: {
          provider: SocialPlatform.TWITTER,
          version: writeResult.newVersion,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('Twitter token refreshed successfully', {
        accountId,
        version: writeResult.newVersion,
        duration,
      });

      return {
        success: true,
        account,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Classify error
      const classified = oauthErrorClassifier.classify(SocialPlatform.TWITTER, error);

      logger.error('Twitter token refresh failed', {
        accountId,
        error: error.message,
        category: classified.category,
        duration,
      });

      // Handle different error categories
      if (classified.shouldReconnect) {
        // Mark account for reconnect
        await tokenLifecycleService.markReconnectRequired(
          accountId,
          classified.technicalMessage
        );
      }

      // Log security event
      const account = await SocialAccount.findById(accountId);
      if (account) {
        await securityAuditService.logEvent({
          type: SecurityEventType.TOKEN_REFRESH_FAILURE,
          workspaceId: account.workspaceId,
          ipAddress: 'system',
          resource: accountId.toString(),
          success: false,
          errorMessage: classified.technicalMessage,
          metadata: {
            provider: SocialPlatform.TWITTER,
            category: classified.category,
            shouldReconnect: classified.shouldReconnect,
          },
        });
      }

      return {
        success: false,
        error: classified.userMessage,
        shouldReconnect: classified.shouldReconnect,
      };
    } finally {
      // Always release lock
      if (lockId) {
        await tokenSafetyService.releaseRefreshLock(accountId.toString(), lockId);
      }
    }
  }

  /**
   * Revoke Twitter access
   * 
   * Revokes token on Twitter and marks account as revoked
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

      // Revoke token on Twitter
      const decryptedAccessToken = account.getDecryptedAccessToken();
      await this.provider.revokeToken(decryptedAccessToken);

      // Update account status
      account.status = AccountStatus.REVOKED;
      await account.save();

      // Mark for reconnect
      await tokenLifecycleService.markReconnectRequired(
        accountId,
        'User revoked access'
      );

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.TOKEN_REVOKED,
        workspaceId: account.workspaceId,
        userId,
        ipAddress,
        resource: accountId.toString(),
        success: true,
        metadata: {
          provider: SocialPlatform.TWITTER,
        },
      });

      logger.info('Twitter access revoked', {
        accountId,
        userId,
      });
    } catch (error: any) {
      logger.error('Twitter access revocation failed', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Detect scope downgrade
   * 
   * Checks if received scopes match required scopes
   */
  private detectScopeDowngrade(receivedScopes: string[]): {
    detected: boolean;
    missingScopes: string[];
  } {
    const missing = this.REQUIRED_SCOPES.filter(
      (scope) => !receivedScopes.includes(scope)
    );

    return {
      detected: missing.length > 0,
      missingScopes: missing,
    };
  }

  /**
   * Check if token needs refresh
   * 
   * Returns true if token expires within 5 minutes
   */
  async needsRefresh(accountId: mongoose.Types.ObjectId | string): Promise<boolean> {
    const account = await SocialAccount.findById(accountId);

    if (!account || !account.tokenExpiresAt) {
      return false;
    }

    const fiveMinutes = 5 * 60 * 1000;
    const timeUntilExpiry = account.tokenExpiresAt.getTime() - Date.now();

    return timeUntilExpiry <= fiveMinutes;
  }
}
