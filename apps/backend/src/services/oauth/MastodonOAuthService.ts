/**
 * Mastodon OAuth Service
 * 
 * Handles OAuth 2.0 flow for Mastodon instances
 * Mastodon is federated - each instance has its own OAuth endpoints
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { SocialAccount, SocialPlatform } from '../../models/SocialAccount';
import { securityAuditService } from '../SecurityAuditService';
import { SecurityEventType } from '../../models/SecurityEvent';
import { OAuthStateService } from './OAuthStateService';
import { TokenEncryptionService } from '../TokenEncryptionService';

export interface MastodonAppCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  vapid_key?: string;
}

export interface MastodonTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  created_at: number;
}

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  header: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  verified: boolean;
  bot: boolean;
  locked: boolean;
  url: string;
}

export interface MastodonConnectParams {
  code: string;
  state: string;
  instanceUrl: string;
  userId: string;
  workspaceId: string;
}

export interface MastodonConnectResult {
  success: boolean;
  account?: any;
  error?: string;
}

export class MastodonOAuthService {
  private readonly appName: string;
  private readonly redirectUri: string;
  private readonly website: string;
  private readonly scopes: string;
  private readonly oauthStateService: OAuthStateService;
  private readonly tokenEncryption: TokenEncryptionService;

  constructor() {
    this.appName = process.env.MASTODON_APP_NAME || 'Social Media Manager';
    this.redirectUri = process.env.MASTODON_REDIRECT_URI || 'http://localhost:3000/api/v1/oauth/mastodon/callback';
    this.website = process.env.MASTODON_APP_WEBSITE || 'https://yourapp.com';
    this.scopes = 'read write push';
    this.oauthStateService = new OAuthStateService();
    this.tokenEncryption = new TokenEncryptionService();
  }

  /**
   * Register app on Mastodon instance
   */
  async registerApp(instanceUrl: string): Promise<MastodonAppCredentials> {
    try {
      const normalizedUrl = this.normalizeInstanceUrl(instanceUrl);
      
      const response = await axios.post(`${normalizedUrl}/api/v1/apps`, {
        client_name: this.appName,
        redirect_uris: this.redirectUri,
        scopes: this.scopes,
        website: this.website
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SocialMediaScheduler/1.0'
        },
        timeout: 10000
      });

      logger.info('Mastodon app registered successfully', {
        instanceUrl: normalizedUrl,
        clientId: response.data.client_id
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to register Mastodon app', {
        instanceUrl,
        error: error.message,
        status: error.response?.status
      });
      throw new Error(`Failed to register app on ${instanceUrl}: ${error.message}`);
    }
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(instanceUrl: string, clientId: string, state: string): string {
    const normalizedUrl = this.normalizeInstanceUrl(instanceUrl);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes,
      state: state
    });

    return `${normalizedUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and connect account
   */
  async connectAccount(params: MastodonConnectParams): Promise<MastodonConnectResult> {
    try {
      // Validate state
      const stateData = await this.oauthStateService.validateState(params.state);
      if (!stateData || stateData.platform !== SocialPlatform.MASTODON) {
        throw new Error('Invalid OAuth state');
      }

      const instanceUrl = params.instanceUrl;
      const appCredentials = await this.getAppCredentials(instanceUrl);
      
      // Exchange code for token
      const tokenData = await this.exchangeCodeForToken(
        params.code,
        instanceUrl,
        appCredentials.client_id,
        appCredentials.client_secret
      );

      // Get account info
      const accountInfo = await this.getAccount(instanceUrl, tokenData.access_token);

      // Save account
      const account = await this.saveAccount(
        params.userId,
        params.workspaceId,
        instanceUrl,
        tokenData,
        accountInfo
      );

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: '0.0.0.0',
        resource: accountInfo.id,
        success: true,
        metadata: {
          provider: SocialPlatform.MASTODON,
          userId: accountInfo.id,
          username: accountInfo.username,
          instanceUrl: instanceUrl,
        },
      });

      return {
        success: true,
        account
      };
    } catch (error: any) {
      logger.error('Failed to connect Mastodon account', {
        error: error.message,
        instanceUrl: params.instanceUrl
      });

      // Log security event
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        workspaceId: params.workspaceId,
        userId: params.userId,
        ipAddress: '0.0.0.0',
        resource: 'mastodon',
        success: false,
        errorMessage: error.message,
        metadata: {
          provider: SocialPlatform.MASTODON,
          instanceUrl: params.instanceUrl,
        },
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    instanceUrl: string,
    clientId: string,
    clientSecret: string
  ): Promise<MastodonTokenResponse> {
    try {
      const normalizedUrl = this.normalizeInstanceUrl(instanceUrl);
      
      const response = await axios.post(`${normalizedUrl}/oauth/token`, {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code: code,
        scope: this.scopes
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SocialMediaScheduler/1.0'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to exchange code for token', {
        instanceUrl,
        error: error.message,
        status: error.response?.status
      });
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Get account information from Mastodon
   */
  async getAccount(instanceUrl: string, accessToken: string): Promise<MastodonAccount> {
    try {
      const normalizedUrl = this.normalizeInstanceUrl(instanceUrl);
      
      const response = await axios.get(`${normalizedUrl}/api/v1/accounts/verify_credentials`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'SocialMediaScheduler/1.0'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to get Mastodon account info', {
        instanceUrl,
        error: error.message,
        status: error.response?.status
      });
      throw new Error(`Failed to get account info: ${error.message}`);
    }
  }

  /**
   * Save Mastodon account to database
   */
  async saveAccount(
    userId: string,
    workspaceId: string,
    instanceUrl: string,
    tokenData: MastodonTokenResponse,
    accountInfo: MastodonAccount
  ): Promise<any> {
    try {
      // Check if account already exists
      const existingAccount = await SocialAccount.findOne({
        platformUserId: accountInfo.id,
        platform: 'mastodon',
        workspaceId
      });

      const accountData = {
        userId,
        workspaceId,
        platform: 'mastodon',
        platformUserId: accountInfo.id,
        username: accountInfo.username,
        displayName: accountInfo.display_name,
        profilePicture: accountInfo.avatar,
        accessToken: await this.tokenEncryption.encryptToken(tokenData.access_token),
        refreshToken: null, // Mastodon doesn't use refresh tokens
        tokenExpiresAt: null, // Mastodon tokens don't expire
        isActive: true,
        metadata: {
          instanceUrl: this.normalizeInstanceUrl(instanceUrl),
          acct: accountInfo.acct,
          note: accountInfo.note,
          header: accountInfo.header,
          followersCount: accountInfo.followers_count,
          followingCount: accountInfo.following_count,
          statusesCount: accountInfo.statuses_count,
          verified: accountInfo.verified,
          bot: accountInfo.bot,
          locked: accountInfo.locked,
          url: accountInfo.url,
          scopes: tokenData.scope,
          tokenCreatedAt: tokenData.created_at
        }
      };

      if (existingAccount) {
        // Update existing account
        Object.assign(existingAccount, accountData);
        await existingAccount.save();
        return existingAccount;
      } else {
        // Create new account
        const newAccount = new SocialAccount(accountData);
        await newAccount.save();
        return newAccount;
      }
    } catch (error: any) {
      logger.error('Failed to save Mastodon account', {
        error: error.message,
        userId,
        workspaceId,
        instanceUrl
      });
      throw new Error(`Failed to save account: ${error.message}`);
    }
  }

  /**
   * Get or refresh app credentials for instance
   */
  async getAppCredentials(instanceUrl: string): Promise<MastodonAppCredentials> {
    // In a real implementation, you'd cache these credentials
    // For now, we'll register the app each time
    return await this.registerApp(instanceUrl);
  }

  /**
   * Disconnect Mastodon account
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Revoke token on Mastodon instance
      try {
        const instanceUrl = account.metadata?.instanceUrl;
        const accessToken = await this.tokenEncryption.decryptToken(account.accessToken);
        
        if (instanceUrl && accessToken) {
          await this.revokeToken(instanceUrl, accessToken);
        }
      } catch (error) {
        logger.warn('Failed to revoke Mastodon token', { error });
        // Continue with local deletion even if revocation fails
      }

      // Delete account from database
      await SocialAccount.findByIdAndDelete(accountId);
      
      logger.info('Mastodon account disconnected', { accountId });
    } catch (error: any) {
      logger.error('Failed to disconnect Mastodon account', {
        accountId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Revoke access token on Mastodon instance
   */
  async revokeToken(instanceUrl: string, accessToken: string): Promise<void> {
    try {
      const normalizedUrl = this.normalizeInstanceUrl(instanceUrl);
      
      await axios.post(`${normalizedUrl}/oauth/revoke`, {
        token: accessToken
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SocialMediaScheduler/1.0'
        },
        timeout: 10000
      });
    } catch (error: any) {
      logger.error('Failed to revoke Mastodon token', {
        instanceUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate if URL is a valid Mastodon instance
   */
  async validateInstance(instanceUrl: string): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeInstanceUrl(instanceUrl);
      
      const response = await axios.get(`${normalizedUrl}/api/v1/instance`, {
        headers: {
          'User-Agent': 'SocialMediaScheduler/1.0'
        },
        timeout: 10000
      });

      return response.status === 200 && response.data.uri;
    } catch (error) {
      return false;
    }
  }

  /**
   * Normalize instance URL (ensure https and remove trailing slash)
   */
  private normalizeInstanceUrl(instanceUrl: string): string {
    let url = instanceUrl.trim();
    
    // Add https if no protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    
    return url;
  }

  /**
   * Get popular Mastodon instances
   */
  getPopularInstances(): Array<{ name: string; url: string; description: string }> {
    return [
      {
        name: 'mastodon.social',
        url: 'https://mastodon.social',
        description: 'The original Mastodon instance'
      },
      {
        name: 'fosstodon.org',
        url: 'https://fosstodon.org',
        description: 'For free and open source software enthusiasts'
      },
      {
        name: 'infosec.exchange',
        url: 'https://infosec.exchange',
        description: 'Information security community'
      },
      {
        name: 'hachyderm.io',
        url: 'https://hachyderm.io',
        description: 'Tech and security focused community'
      },
      {
        name: 'techhub.social',
        url: 'https://techhub.social',
        description: 'Technology professionals and enthusiasts'
      }
    ];
  }
}