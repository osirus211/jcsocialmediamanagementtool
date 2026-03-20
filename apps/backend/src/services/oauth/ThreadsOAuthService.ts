/**
 * Threads OAuth Service
 * 
 * Complete Threads OAuth integration with all API features
 * Handles OAuth flow, token management, user profiles, and account management
 */

import { ThreadsProvider } from './ThreadsProvider';
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
}

interface ThreadsProfile {
  id: string;
  username: string;
  name: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

interface TokenData {
  access_token: string;
  user_id: string;
  expires_in?: number;
  token_type?: string;
}

export class ThreadsOAuthService {
  private provider: ThreadsProvider;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.provider = new ThreadsProvider(clientId, clientSecret, redirectUri);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  async getAuthorizationUrl(state?: string): Promise<{ url: string; state: string }> {
    try {
      const scopes = [
        'threads_basic',
        'threads_content_publish',
        'threads_manage_insights',
        'threads_manage_replies',
        'threads_read_replies'
      ];

      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: scopes.join(','),
        response_type: 'code',
        state: state || Math.random().toString(36).substring(2, 15)
      });

      const url = `https://threads.net/oauth/authorize?${params.toString()}`;
      
      logger.info('[Threads] Generated authorization URL', { state: params.get('state') });
      
      return { url, state: params.get('state')! };
    } catch (error: any) {
      logger.error('[Threads] Failed to generate authorization URL', { error: error.message });
      throw new Error(`Failed to generate Threads authorization URL: ${error.message}`);
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string, userId: string, workspaceId: string, ipAddress: string = '0.0.0.0'): Promise<void> {
    try {
      logger.info('[Threads] Starting OAuth callback', { workspaceId, userId, state });

      // Step 1: Exchange code for short-lived token
      const shortTokenData = await this.exchangeCodeForShortLivedToken(code);
      
      // Step 2: Exchange for long-lived token
      const longTokenData = await this.exchangeForLongLivedToken(shortTokenData.access_token);
      
      // Step 3: Get user profile
      const profile = await this.getUserProfile(longTokenData.access_token, shortTokenData.user_id);
      
      // Step 4: Save account
      await this.saveAccount(userId, workspaceId, longTokenData, profile);
      
      logger.info('[Threads] OAuth callback completed successfully', { workspaceId, userId });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: workspaceId,
        userId: userId,
        ipAddress: ipAddress,
        resource: profile.id,
        success: true,
        metadata: {
          provider: SocialPlatform.THREADS,
          userId: profile.id,
          username: profile.username,
        },
      });
    } catch (error: any) {
      logger.error('[Threads] OAuth callback failed', { workspaceId, userId, error: error.message });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        workspaceId: workspaceId,
        userId: userId,
        ipAddress: ipAddress,
        resource: 'threads',
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.THREADS,
        },
      });

      throw error;
    }
  }

  /**
   * Exchange authorization code for short-lived access token
   */
  async exchangeCodeForShortLivedToken(code: string): Promise<TokenData> {
    try {
      const response = await axios.post('https://graph.threads.net/oauth/access_token', 
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
          code: code
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      logger.info('[Threads] Short-lived token exchange successful');
      return response.data;
    } catch (error: any) {
      logger.error('[Threads] Short-lived token exchange failed', { error: error.response?.data || error.message });
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Exchange short-lived token for long-lived token
   */
  async exchangeForLongLivedToken(shortToken: string): Promise<TokenData> {
    try {
      const params = new URLSearchParams({
        grant_type: 'th_exchange_token',
        client_secret: this.clientSecret,
        access_token: shortToken
      });

      const response = await axios.get(`https://graph.threads.net/access_token?${params.toString()}`);
      
      logger.info('[Threads] Long-lived token exchange successful', { expires_in: response.data.expires_in });
      return response.data;
    } catch (error: any) {
      logger.error('[Threads] Long-lived token exchange failed', { error: error.response?.data || error.message });
      throw new Error(`Failed to exchange for long-lived token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Refresh long-lived access token
   */
  async refreshToken(account: any): Promise<string> {
    try {
      const params = new URLSearchParams({
        grant_type: 'th_refresh_token',
        access_token: account.accessToken
      });

      const response = await axios.get(`https://graph.threads.net/refresh_access_token?${params.toString()}`);
      
      // Update account with new token
      account.accessToken = response.data.access_token;
      account.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in * 1000));
      await account.save();
      
      logger.info('[Threads] Token refreshed successfully', { accountId: account._id });
      return response.data.access_token;
    } catch (error: any) {
      logger.error('[Threads] Token refresh failed', { accountId: account._id, error: error.response?.data || error.message });
      throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(accessToken: string, userId: string): Promise<ThreadsProfile> {
    try {
      const params = new URLSearchParams({
        fields: 'id,username,name,threads_profile_picture_url,threads_biography',
        access_token: accessToken
      });

      const response = await axios.get(`https://graph.threads.net/v1.0/me?${params.toString()}`);
      
      logger.info('[Threads] User profile fetched', { userId: response.data.id, username: response.data.username });
      return response.data;
    } catch (error: any) {
      logger.error('[Threads] Failed to fetch user profile', { error: error.response?.data || error.message });
      throw new Error(`Failed to fetch user profile: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Save Threads account to database
   */
  async saveAccount(userId: string, workspaceId: string, tokenData: TokenData, profile: ThreadsProfile): Promise<any> {
    try {
      // Check for existing account
      const existing = await SocialAccount.findOne({
        workspaceId,
        provider: SocialPlatform.THREADS,
        providerUserId: profile.id,
      });

      if (existing) {
        // Update existing account
        existing.accessToken = tokenData.access_token;
        existing.tokenExpiresAt = tokenData.expires_in ? new Date(Date.now() + (tokenData.expires_in * 1000)) : undefined;
        existing.status = AccountStatus.ACTIVE;
        existing.lastSyncAt = new Date();
        existing.metadata = {
          username: profile.username,
          profileUrl: `https://threads.net/@${profile.username}`,
          avatarUrl: profile.threads_profile_picture_url,
          biography: profile.threads_biography,
        };
        
        await existing.save();
        logger.info('[Threads] Account updated', { accountId: existing._id });
        return existing;
      }

      // Create new account
      const account = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.THREADS,
        providerUserId: profile.id,
        accountName: profile.name || profile.username,
        accessToken: tokenData.access_token,
        tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + (tokenData.expires_in * 1000)) : undefined,
        scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights', 'threads_manage_replies', 'threads_read_replies'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        metadata: {
          username: profile.username,
          profileUrl: `https://threads.net/@${profile.username}`,
          avatarUrl: profile.threads_profile_picture_url,
          biography: profile.threads_biography,
        },
        lastSyncAt: new Date(),
      });

      await account.save();
      logger.info('[Threads] Account created', { accountId: account._id, profileId: profile.id });
      return account;
    } catch (error: any) {
      logger.error('[Threads] Failed to save account', { error: error.message });
      throw error;
    }
  }

  /**
   * Disconnect Threads account
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      account.status = AccountStatus.DISCONNECTED;
      await account.save();
      
      logger.info('[Threads] Account disconnected', { accountId });

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
      logger.error('[Threads] Failed to disconnect account', { accountId, error: error.message });
      throw error;
    }
  }

  /**
   * Connect Threads account (legacy method for backward compatibility)
   */
  async connectAccount(params: ConnectAccountParams): Promise<ConnectAccountResult> {
    const { workspaceId, userId, code, state } = params;
    
    await this.handleCallback(code, state, userId, workspaceId);
    
    const account = await SocialAccount.findOne({
      workspaceId,
      provider: SocialPlatform.THREADS,
    }).sort({ createdAt: -1 });
    
    return { account };
  }

  /**
   * Initiate OAuth flow
   */
  async initiateOAuth(): Promise<{ url: string; state: string }> {
    return await this.getAuthorizationUrl();
  }
}