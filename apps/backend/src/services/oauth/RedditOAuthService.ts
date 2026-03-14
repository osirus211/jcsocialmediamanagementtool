import { ISocialAccount, SocialAccount, SocialPlatform } from '../../models/SocialAccount';
import { OAuthStateService } from './OAuthStateService';
import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';

export interface RedditUser {
  id: string;
  name: string;
  icon_img?: string;
  total_karma: number;
  link_karma: number;
  comment_karma: number;
  verified: boolean;
  is_gold: boolean;
  created_utc: number;
}

export interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface Subreddit {
  display_name: string;
  title: string;
  subscribers: number;
  over18: boolean;
  icon_img?: string;
  description: string;
  submit_text?: string;
  submission_type: string;
  link_flair_enabled: boolean;
}

export interface RedditConnectParams {
  code: string;
  state: string;
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
}

export interface RedditRefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

export class RedditOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private userAgent: string;
  private oauthStateService: OAuthStateService;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    userAgent: string
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.userAgent = userAgent;
    this.oauthStateService = new OAuthStateService();
  }

  /**
   * Generate Reddit OAuth authorization URL
   */
  async getAuthorizationUrl(userId: string, workspaceId: string): Promise<{ url: string; state: string }> {
    const state = await this.oauthStateService.createState({
      platform: SocialPlatform.REDDIT,
      userId,
      workspaceId,
      ipAddress: 'unknown', // Will be set by the route handler
      userAgent: 'unknown'  // Will be set by the route handler
    });
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      state,
      redirect_uri: this.redirectUri,
      duration: 'permanent',
      scope: 'submit,read,identity,mysubreddits,flair'
    });

    const url = `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
    
    return { url, state };
  }

  /**
   * Handle OAuth callback and connect Reddit account
   */
  async handleCallback(params: RedditConnectParams): Promise<ISocialAccount> {
    try {
      // Verify state
      const stateData = await this.oauthStateService.validateState(params.state);
      if (!stateData) {
        throw new Error('Invalid OAuth state');
      }

      // Exchange code for token
      const tokenData = await this.exchangeCodeForToken(params.code);
      
      // Get user identity
      const user = await this.getUserIdentity(tokenData.access_token);
      
      // Save account
      const account = await this.saveAccount(
        params.userId,
        params.workspaceId,
        tokenData,
        user
      );

      logger.info('Reddit account connected successfully', {
        userId: params.userId,
        workspaceId: params.workspaceId,
        redditUsername: user.name
      });

      return account;
    } catch (error) {
      logger.error('Failed to handle Reddit OAuth callback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: params.userId,
        workspaceId: params.workspaceId
      });
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<RedditTokenResponse> {
    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to exchange Reddit code for token', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(accountId: mongoose.Types.ObjectId | string): Promise<RedditRefreshResult> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account || account.provider !== SocialPlatform.REDDIT) {
        throw new Error('Reddit account not found');
      }

      const refreshToken = account.getDecryptedRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent
          }
        }
      );

      const tokenData: RedditTokenResponse = response.data;

      // Update account with new token
      account.accessToken = tokenData.access_token;
      account.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      
      if (tokenData.refresh_token) {
        account.refreshToken = tokenData.refresh_token;
      }

      await account.save();

      logger.info('Reddit token refreshed successfully', {
        accountId: account._id,
        accountName: account.accountName
      });

      return {
        success: true,
        accessToken: tokenData.access_token
      };
    } catch (error) {
      logger.error('Failed to refresh Reddit token', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get Reddit user identity
   */
  async getUserIdentity(accessToken: string): Promise<RedditUser> {
    try {
      const response = await axios.get('https://oauth.reddit.com/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': this.userAgent
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get Reddit user identity', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to get user identity');
    }
  }

  /**
   * Get user's subscribed subreddits
   */
  async getSubscribedSubreddits(accessToken: string): Promise<Subreddit[]> {
    try {
      const response = await axios.get(
        'https://oauth.reddit.com/subreddits/mine/subscriber?limit=100',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': this.userAgent
          }
        }
      );

      return response.data.data.children.map((child: any) => child.data);
    } catch (error) {
      logger.error('Failed to get subscribed subreddits', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to get subscribed subreddits');
    }
  }

  /**
   * Save Reddit account to database
   */
  private async saveAccount(
    userId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId,
    tokenData: RedditTokenResponse,
    user: RedditUser
  ): Promise<ISocialAccount> {
    // Check if account already exists
    const existingAccount = await SocialAccount.findOne({
      workspaceId,
      provider: SocialPlatform.REDDIT,
      providerUserId: user.id
    });

    if (existingAccount) {
      // Update existing account
      existingAccount.accessToken = tokenData.access_token;
      existingAccount.refreshToken = tokenData.refresh_token;
      existingAccount.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      existingAccount.accountName = user.name;
      existingAccount.metadata = {
        ...existingAccount.metadata,
        avatarUrl: user.icon_img,
        total_karma: user.total_karma,
        link_karma: user.link_karma,
        comment_karma: user.comment_karma,
        verified: user.verified,
        is_gold: user.is_gold,
        created_utc: user.created_utc
      };

      await existingAccount.save();
      return existingAccount;
    }

    // Create new account
    const account = new SocialAccount({
      workspaceId,
      provider: SocialPlatform.REDDIT,
      providerUserId: user.id,
      accountName: user.name,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      scopes: tokenData.scope.split(' '),
      status: 'active',
      metadata: {
        avatarUrl: user.icon_img,
        total_karma: user.total_karma,
        link_karma: user.link_karma,
        comment_karma: user.comment_karma,
        verified: user.verified,
        is_gold: user.is_gold,
        created_utc: user.created_utc
      }
    });

    await account.save();
    return account;
  }

  /**
   * Disconnect Reddit account
   */
  async disconnectAccount(accountId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account || account.provider !== SocialPlatform.REDDIT) {
        throw new Error('Reddit account not found');
      }

      // Revoke access token
      const accessToken = account.getDecryptedAccessToken();
      if (accessToken) {
        try {
          const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
          
          await axios.post(
            'https://www.reddit.com/api/v1/revoke_token',
            new URLSearchParams({
              token: accessToken,
              token_type_hint: 'access_token'
            }),
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': this.userAgent
              }
            }
          );
        } catch (revokeError) {
          logger.warn('Failed to revoke Reddit access token', {
            accountId,
            error: revokeError instanceof Error ? revokeError.message : 'Unknown error'
          });
        }
      }

      // Delete account from database
      await SocialAccount.findByIdAndDelete(accountId);

      logger.info('Reddit account disconnected successfully', {
        accountId,
        accountName: account.accountName
      });
    } catch (error) {
      logger.error('Failed to disconnect Reddit account', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if token needs refresh
   */
  async needsRefresh(accountId: mongoose.Types.ObjectId | string): Promise<boolean> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account || account.provider !== SocialPlatform.REDDIT) {
        return false;
      }

      if (!account.tokenExpiresAt) {
        return true;
      }

      // Refresh if token expires within 5 minutes
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      return account.tokenExpiresAt <= fiveMinutesFromNow;
    } catch (error) {
      logger.error('Failed to check if Reddit token needs refresh', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return true;
    }
  }
}