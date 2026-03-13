/**
 * Google Business Profile OAuth Service
 * 
 * Handles Google Business Profile account connection and lifecycle management
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Business location fetching and storage
 * - Secure token storage with encryption
 * - Security audit logging
 * - Duplicate account prevention
 * - Token refresh management
 * - Location synchronization
 * 
 * Scope: business.manage (full business profile management)
 * 
 * Flow:
 * 1. User initiates OAuth
 * 2. User authorizes via Google
 * 3. Exchange code for tokens (access + refresh)
 * 4. Fetch Google account information
 * 5. Fetch all business locations (with pagination)
 * 6. Save account and locations to database with encryption
 * 7. Log security audit event
 */

import { GoogleBusinessProvider, BusinessLocation as ProviderBusinessLocation } from './GoogleBusinessProvider';
import {
  SocialAccount,
  ISocialAccount,
  AccountStatus,
  SocialPlatform,
  ConnectionMetadata,
} from '../../models/SocialAccount';
import { BusinessLocation, IBusinessLocation } from '../../models/BusinessLocation';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';
import { assertNoDuplicateAccount } from '../../utils/duplicateAccountPrevention';
import { validateTokenExpiration } from '../../utils/expirationGuard';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export interface GBPConnectParams {
  workspaceId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  code: string;
  state: string;
  ipAddress: string;
}

export interface GBPConnectResult {
  account: ISocialAccount;
  locations: IBusinessLocation[];
}

export class GoogleBusinessOAuthService {
  private provider: GoogleBusinessProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new GoogleBusinessProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Initiate Google Business Profile OAuth flow
   */
  async initiateOAuth(): Promise<{
    url: string;
    state: string;
  }> {
    try {
      const { url, state } = await this.provider.getAuthorizationUrl();

      logger.info('Google Business Profile OAuth flow initiated', {
        state: state.substring(0, 10) + '...',
      });

      return { url, state };
    } catch (error: any) {
      logger.error('Failed to initiate Google Business Profile OAuth', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Connect Google Business Profile account (OAuth callback)
   * 
   * Steps:
   * 1. Exchange authorization code for tokens
   * 2. Validate token expiration
   * 3. Fetch Google account information
   * 4. Fetch all business locations (with pagination)
   * 5. Check for duplicate account
   * 6. Create SocialAccount record with encrypted tokens
   * 7. Store business locations
   * 8. Log security audit event
   */
  async connectAccount(params: GBPConnectParams): Promise<GBPConnectResult> {
    const startTime = Date.now();

    try {
      logger.info('Google Business Profile account connection started', {
        workspaceId: params.workspaceId,
        userId: params.userId,
      });

      // Step 1: Exchange code for tokens
      const tokens = await this.provider.exchangeCodeForTokenLegacy({
        code: params.code,
        state: params.state,
      });

      // Validate token expiration
      validateTokenExpiration(tokens.expiresAt, 'Google Business Profile token exchange');

      if (!tokens.refreshToken) {
        logger.warn('No refresh token received - user may need to re-authorize', {
          workspaceId: params.workspaceId,
        });
      }

      logger.info('Google Business Profile token exchange successful', {
        hasRefreshToken: !!tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });

      // Step 2: Get Google account information
      const profile = await this.provider.getUserProfile(tokens.accessToken);

      logger.info('Google account profile fetched', {
        userId: profile.id,
        email: profile.email,
      });

      // Step 3: Check for duplicate account
      await assertNoDuplicateAccount(
        params.workspaceId,
        SocialPlatform.GOOGLE_BUSINESS,
        profile.id
      );

      // Step 4: Fetch business locations
      // First, we need to get the GBP account ID
      // For now, we'll use a placeholder and fetch locations after account creation
      // The account ID will be stored in metadata
      const accountId = `accounts/${profile.id}`; // Simplified for now

      let locations: ProviderBusinessLocation[] = [];
      try {
        locations = await this.provider.getBusinessLocations(tokens.accessToken, accountId);
        logger.info('Business locations fetched', {
          count: locations.length,
          accountId,
        });
      } catch (error: any) {
        logger.warn('Failed to fetch business locations during connection', {
          error: error.message,
          accountId,
        });
        // Continue with account creation even if location fetch fails
        // User can sync locations later
      }

      // Step 5: Create connection metadata
      const connectionMetadata: ConnectionMetadata = {
        type: 'OTHER',
        providerName: 'GOOGLE_BUSINESS',
        tokenRefreshable: !!tokens.refreshToken,
        lastRefreshAttempt: undefined,
        refreshFailureCount: 0,
      };

      // Step 6: Save account to database
      const account = await SocialAccount.create({
        workspaceId: params.workspaceId,
        provider: SocialPlatform.GOOGLE_BUSINESS,
        providerUserId: profile.id,
        accountName: profile.displayName,
        accountType: 'BUSINESS',
        accessToken: tokens.accessToken, // Encrypted by pre-save hook
        refreshToken: tokens.refreshToken, // Encrypted by pre-save hook
        tokenExpiresAt: tokens.expiresAt,
        scopes: ['https://www.googleapis.com/auth/business.manage'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        connectionMetadata,
        metadata: {
          accountId,
          accountName: profile.displayName,
          accountType: 'PERSONAL', // Will be updated when we fetch actual account info
          locationCount: locations.length,
          email: profile.email,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
        },
        lastSyncAt: new Date(),
      });

      logger.info('Google Business Profile account created', {
        accountId: account._id,
        googleUserId: profile.id,
        locationCount: locations.length,
      });

      // Step 7: Store business locations
      const savedLocations: IBusinessLocation[] = [];
      for (const location of locations) {
        try {
          const businessLocation = await BusinessLocation.create({
            workspaceId: params.workspaceId,
            socialAccountId: account._id,
            locationId: location.locationId,
            accountId: location.accountId,
            name: location.name,
            address: location.address,
            primaryPhone: location.primaryPhone,
            websiteUrl: location.websiteUrl,
            locationState: location.locationState,
            isActive: true,
            metadata: {},
            lastSyncAt: new Date(),
          });
          savedLocations.push(businessLocation);
        } catch (error: any) {
          logger.error('Failed to save business location', {
            locationId: location.locationId,
            error: error.message,
          });
          // Continue with other locations
        }
      }

      logger.info('Business locations saved', {
        count: savedLocations.length,
        accountId: account._id,
      });

      // Step 8: Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        resource: profile.id,
        success: true,
        metadata: {
          provider: SocialPlatform.GOOGLE_BUSINESS,
          googleUserId: profile.id,
          email: profile.email,
          hasRefreshToken: !!tokens.refreshToken,
          locationCount: savedLocations.length,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('Google Business Profile account connection completed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        accountId: account._id,
        locationCount: savedLocations.length,
        duration,
      });

      return { account, locations: savedLocations };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('Google Business Profile account connection failed', {
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
        resource: 'google-business',
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.GOOGLE_BUSINESS,
          duration,
        },
      });

      throw error;
    }
  }

  /**
   * Refresh access token for Google Business Profile account
   * 
   * Uses refresh token to obtain new access token
   * Updates account record with new token and expiration
   */
  async refreshToken(accountId: string): Promise<void> {
    try {
      logger.info('Refreshing Google Business Profile token', { accountId });

      // Fetch account with tokens
      const account = await SocialAccount.findById(accountId)
        .select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Account not found');
      }

      if (account.provider !== SocialPlatform.GOOGLE_BUSINESS) {
        throw new Error('Account is not a Google Business Profile account');
      }

      const refreshToken = account.getDecryptedRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Refresh token
      const tokens = await this.provider.refreshAccessTokenLegacy({
        refreshToken,
      });

      // Update account
      account.accessToken = tokens.accessToken; // Will be encrypted by pre-save hook
      account.tokenExpiresAt = tokens.expiresAt;
      account.lastRefreshedAt = new Date();
      account.status = AccountStatus.ACTIVE;

      await account.save();

      logger.info('Google Business Profile token refreshed', {
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
          provider: SocialPlatform.GOOGLE_BUSINESS,
          accountId,
        },
      });
    } catch (error: any) {
      logger.error('Failed to refresh Google Business Profile token', {
        accountId,
        error: error.message,
      });

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
            provider: SocialPlatform.GOOGLE_BUSINESS,
            accountId,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Disconnect Google Business Profile account
   * 
   * Deletes tokens and associated business locations
   * Marks account as disconnected
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      logger.info('Disconnecting Google Business Profile account', { accountId });

      // Fetch account
      const account = await SocialAccount.findById(accountId)
        .select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Account not found');
      }

      if (account.provider !== SocialPlatform.GOOGLE_BUSINESS) {
        throw new Error('Account is not a Google Business Profile account');
      }

      // Revoke token with Google (optional, best effort)
      try {
        const accessToken = account.getDecryptedAccessToken();
        await this.provider.revokeToken(accessToken);
        logger.info('Google token revoked', { accountId });
      } catch (error: any) {
        logger.warn('Failed to revoke Google token', {
          accountId,
          error: error.message,
        });
        // Continue with disconnection even if revocation fails
      }

      // Delete business locations
      const deleteResult = await BusinessLocation.deleteMany({
        socialAccountId: account._id,
      });

      logger.info('Business locations deleted', {
        accountId,
        deletedCount: deleteResult.deletedCount,
      });

      // Update account status and clear tokens
      account.status = AccountStatus.DISCONNECTED;
      account.disconnectedAt = new Date();
      account.accessToken = ''; // Will be encrypted but effectively cleared
      account.refreshToken = undefined;

      await account.save();

      logger.info('Google Business Profile account disconnected', { accountId });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_DISCONNECT,
        workspaceId: account.workspaceId,
        ipAddress: '0.0.0.0', // System-initiated
        resource: accountId,
        success: true,
        metadata: {
          provider: SocialPlatform.GOOGLE_BUSINESS,
          accountId,
          locationsDeleted: deleteResult.deletedCount,
        },
      });
    } catch (error: any) {
      logger.error('Failed to disconnect Google Business Profile account', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Sync business locations for Google Business Profile account
   * 
   * Re-fetches locations from Google API and updates database
   * Marks removed locations as inactive
   */
  async syncLocations(accountId: string): Promise<IBusinessLocation[]> {
    try {
      logger.info('Syncing business locations', { accountId });

      // Fetch account with tokens
      const account = await SocialAccount.findById(accountId)
        .select('+accessToken +refreshToken');

      if (!account) {
        throw new Error('Account not found');
      }

      if (account.provider !== SocialPlatform.GOOGLE_BUSINESS) {
        throw new Error('Account is not a Google Business Profile account');
      }

      const accessToken = account.getDecryptedAccessToken();
      const gbpAccountId = account.metadata?.accountId || `accounts/${account.providerUserId}`;

      // Fetch locations from Google API
      const locations = await this.provider.getBusinessLocations(accessToken, gbpAccountId);

      logger.info('Fetched locations from Google API', {
        accountId,
        count: locations.length,
      });

      // Get existing locations
      const existingLocations = await BusinessLocation.find({
        socialAccountId: account._id,
      });

      const existingLocationIds = new Set(
        existingLocations.map((loc) => loc.locationId)
      );

      const fetchedLocationIds = new Set(
        locations.map((loc) => loc.locationId)
      );

      // Mark removed locations as inactive
      for (const existing of existingLocations) {
        if (!fetchedLocationIds.has(existing.locationId)) {
          existing.isActive = false;
          await existing.save();
          logger.info('Location marked as inactive', {
            locationId: existing.locationId,
          });
        }
      }

      // Update or create locations
      const savedLocations: IBusinessLocation[] = [];
      for (const location of locations) {
        try {
          const existing = existingLocations.find(
            (loc) => loc.locationId === location.locationId
          );

          if (existing) {
            // Update existing location
            existing.name = location.name;
            existing.address = location.address;
            existing.primaryPhone = location.primaryPhone;
            existing.websiteUrl = location.websiteUrl;
            existing.locationState = location.locationState;
            existing.isActive = true;
            existing.lastSyncAt = new Date();
            await existing.save();
            savedLocations.push(existing);
          } else {
            // Create new location
            const businessLocation = await BusinessLocation.create({
              workspaceId: account.workspaceId,
              socialAccountId: account._id,
              locationId: location.locationId,
              accountId: location.accountId,
              name: location.name,
              address: location.address,
              primaryPhone: location.primaryPhone,
              websiteUrl: location.websiteUrl,
              locationState: location.locationState,
              isActive: true,
              metadata: {},
              lastSyncAt: new Date(),
            });
            savedLocations.push(businessLocation);
          }
        } catch (error: any) {
          logger.error('Failed to sync business location', {
            locationId: location.locationId,
            error: error.message,
          });
          // Continue with other locations
        }
      }

      // Update account metadata
      account.metadata = {
        ...account.metadata,
        locationCount: savedLocations.filter((loc) => loc.isActive).length,
      };
      account.lastSyncAt = new Date();
      await account.save();

      logger.info('Business locations synced', {
        accountId,
        totalLocations: savedLocations.length,
        activeLocations: savedLocations.filter((loc) => loc.isActive).length,
      });

      return savedLocations;
    } catch (error: any) {
      logger.error('Failed to sync business locations', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }
}
