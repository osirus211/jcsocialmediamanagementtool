/**
 * Pinterest OAuth Service
 * Handles Pinterest OAuth 2.0 authentication flow and account management
 */

import { PinterestOAuthProvider, PinterestTokenResponse, PinterestUserProfile, PinterestBoard } from '../../providers/oauth/PinterestOAuthProvider';
import { SocialAccount, SocialPlatform, ISocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import { BadRequestError, UnauthorizedError } from '../../utils/errors';

export class PinterestOAuthService {
  private provider: PinterestOAuthProvider;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new PinterestOAuthProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Get authorization URL for Pinterest OAuth
   */
  async getAuthorizationUrl(state?: string): Promise<{ url: string; state: string }> {
    try {
      const result = await this.provider.getAuthorizationUrl();
      
      logger.info('Pinterest authorization URL generated', {
        state: result.state,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to generate Pinterest authorization URL', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string, userId: string, workspaceId: string): Promise<ISocialAccount> {
    try {
      // Exchange code for tokens
      const tokenData = await this.exchangeCodeForToken(code);
      
      // Get user profile and boards
      const profile = await this.getUserAccount(tokenData.access_token);
      const boards = await this.getUserBoards(tokenData.access_token);

      // Save account
      const account = await this.saveAccount(userId, workspaceId, tokenData, profile, boards);

      logger.info('Pinterest OAuth callback handled successfully', {
        userId,
        workspaceId,
        accountId: account._id,
        username: profile.username,
        boardCount: boards.length,
      });

      return account;
    } catch (error: any) {
      logger.error('Pinterest OAuth callback failed', {
        userId,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<PinterestTokenResponse> {
    try {
      const tokenData = await this.provider.exchangeCodeForTokens(code, '');
      
      logger.info('Pinterest token exchange successful', {
        scope: tokenData.scope,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      });

      return tokenData;
    } catch (error: any) {
      logger.error('Pinterest token exchange failed', {
        error: error.message,
      });
      throw new BadRequestError(`Pinterest token exchange failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(account: ISocialAccount): Promise<string> {
    try {
      if (!account.refreshToken) {
        throw new UnauthorizedError('No refresh token available for Pinterest account');
      }

      const tokenData = await this.provider.refreshAccessToken(account.refreshToken);
      
      // Update account with new tokens
      account.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        account.refreshToken = tokenData.refresh_token;
      }
      if (tokenData.expires_in) {
        account.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      }
      
      await account.save();

      logger.info('Pinterest token refreshed successfully', {
        accountId: account._id,
        expiresIn: tokenData.expires_in,
      });

      return tokenData.access_token;
    } catch (error: any) {
      logger.error('Pinterest token refresh failed', {
        accountId: account._id,
        error: error.message,
      });
      throw new UnauthorizedError(`Pinterest token refresh failed: ${error.message}`);
    }
  }

  /**
   * Get Pinterest user account information
   */
  async getUserAccount(accessToken: string): Promise<PinterestUserProfile> {
    try {
      const profile = await this.provider.getUserProfile(accessToken);
      
      logger.info('Pinterest user profile fetched', {
        username: profile.username,
        accountType: profile.account_type,
        followerCount: profile.follower_count,
      });

      return profile;
    } catch (error: any) {
      logger.error('Failed to fetch Pinterest user profile', {
        error: error.message,
      });
      throw new UnauthorizedError(`Failed to fetch Pinterest user profile: ${error.message}`);
    }
  }

  /**
   * Get Pinterest user boards
   */
  async getUserBoards(accessToken: string): Promise<PinterestBoard[]> {
    try {
      const boards = await this.provider.getUserBoards(accessToken);
      
      logger.info('Pinterest boards fetched', {
        boardCount: boards.length,
      });

      return boards;
    } catch (error: any) {
      logger.error('Failed to fetch Pinterest boards', {
        error: error.message,
      });
      throw new UnauthorizedError(`Failed to fetch Pinterest boards: ${error.message}`);
    }
  }

  /**
   * Save Pinterest account to database
   */
  async saveAccount(
    userId: string, 
    workspaceId: string, 
    tokenData: PinterestTokenResponse, 
    profile: PinterestUserProfile,
    boards: PinterestBoard[]
  ): Promise<ISocialAccount> {
    try {
      // Check if account already exists
      let account = await SocialAccount.findOne({
        workspaceId,
        provider: SocialPlatform.PINTEREST,
        providerUserId: profile.id,
      });

      const accountData = {
        workspaceId,
        provider: SocialPlatform.PINTEREST,
        providerUserId: profile.id,
        accountName: profile.username,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        tokenExpiresAt: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000) 
          : undefined,
        scopes: tokenData.scope ? tokenData.scope.split(',') : [],
        status: 'connected' as any,
        metadata: {
          accountType: profile.account_type,
          followerCount: profile.follower_count || 0,
          followingCount: profile.following_count || 0,
          monthlyViews: profile.monthly_views || 0,
          websiteUrl: profile.website_url || '',
          bio: profile.bio || '',
          avatarUrl: profile.profile_image || '',
          boards: boards.map(board => ({
            id: board.id,
            name: board.name,
            description: board.description || '',
            privacy: board.privacy,
            pinCount: board.pin_count || 0,
            followerCount: board.follower_count || 0,
            coverImageUrl: board.media?.image_cover_url || '',
          })),
        },
        lastSyncAt: new Date(),
      };

      if (account) {
        // Update existing account
        Object.assign(account, accountData);
        await account.save();
      } else {
        // Create new account
        account = new SocialAccount(accountData);
        await account.save();
      }

      logger.info('Pinterest account saved successfully', {
        accountId: account._id,
        workspaceId,
        username: profile.username,
        isNew: !account.isModified(),
      });

      return account;
    } catch (error: any) {
      logger.error('Failed to save Pinterest account', {
        workspaceId,
        username: profile.username,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Disconnect Pinterest account
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new BadRequestError('Pinterest account not found');
      }

      if (account.provider !== SocialPlatform.PINTEREST) {
        throw new BadRequestError('Account is not a Pinterest account');
      }

      // Revoke token (Pinterest doesn't have revocation endpoint, so just deactivate)
      account.status = 'disconnected' as any;
      account.accessToken = '';
      account.refreshToken = '';
      await account.save();

      logger.info('Pinterest account disconnected successfully', {
        accountId,
        username: account.accountName,
      });
    } catch (error: any) {
      logger.error('Failed to disconnect Pinterest account', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate Pinterest account token
   */
  async validateAccount(account: ISocialAccount): Promise<boolean> {
    try {
      const isValid = await this.provider.validateToken(account.accessToken);
      
      if (!isValid && account.refreshToken) {
        // Try to refresh token
        try {
          await this.refreshToken(account);
          return true;
        } catch (refreshError) {
          logger.warn('Pinterest token refresh failed during validation', {
            accountId: account._id,
            error: refreshError instanceof Error ? refreshError.message : 'Unknown error',
          });
          return false;
        }
      }

      return isValid;
    } catch (error: any) {
      logger.error('Pinterest account validation failed', {
        accountId: account._id,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Sync Pinterest account data (boards, profile)
   */
  async syncAccount(account: ISocialAccount): Promise<void> {
    try {
      // Validate token first
      const isValid = await this.validateAccount(account);
      if (!isValid) {
        throw new UnauthorizedError('Pinterest account token is invalid');
      }

      // Fetch updated profile and boards
      const profile = await this.getUserAccount(account.accessToken);
      const boards = await this.getUserBoards(account.accessToken);

      // Update account metadata
      account.metadata = {
        ...account.metadata,
        accountType: profile.account_type,
        followerCount: profile.follower_count || 0,
        followingCount: profile.following_count || 0,
        monthlyViews: profile.monthly_views || 0,
        websiteUrl: profile.website_url || '',
        bio: profile.bio || '',
        boards: boards.map(board => ({
          id: board.id,
          name: board.name,
          description: board.description || '',
          privacy: board.privacy,
          pinCount: board.pin_count || 0,
          followerCount: board.follower_count || 0,
          coverImageUrl: board.media?.image_cover_url || '',
        })),
      };

      account.lastSyncAt = new Date();
      await account.save();

      logger.info('Pinterest account synced successfully', {
        accountId: account._id,
        username: account.accountName,
        boardCount: boards.length,
      });
    } catch (error: any) {
      logger.error('Pinterest account sync failed', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }
}