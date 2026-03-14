import { SocialAccount, SocialPlatform, AccountStatus } from '../models/SocialAccount';
import { config } from '../config';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/encryption';
import crypto from 'crypto';

/**
 * OAuth Service
 * 
 * Handles OAuth connection flow for social platforms
 * 
 * Features:
 * - OAuth URL generation
 * - Authorization code exchange
 * - Account creation/update
 * - State parameter validation
 */

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

interface TokenExchangeResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  error?: string;
}

interface UserProfileResult {
  success: boolean;
  userId?: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  error?: string;
}

export class OAuthService {
  private readonly configs: Partial<Record<SocialPlatform, OAuthConfig>> = {
    [SocialPlatform.TWITTER]: {
      clientId: config.oauth.twitter.clientId || 'mock_twitter_client_id',
      clientSecret: config.oauth.twitter.clientSecret || 'mock_twitter_secret',
      redirectUri: config.oauth.twitter.redirectUri || 'http://localhost:3000/auth/twitter/callback',
      scopes: ['tweet.read', 'tweet.write', 'users.read'],
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    },
    [SocialPlatform.LINKEDIN]: {
      clientId: config.oauth.linkedin.clientId || 'mock_linkedin_client_id',
      clientSecret: config.oauth.linkedin.clientSecret || 'mock_linkedin_secret',
      redirectUri: config.oauth.linkedin.redirectUri || 'http://localhost:3000/auth/linkedin/callback',
      scopes: ['w_member_social', 'r_liteprofile'],
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    },
    [SocialPlatform.FACEBOOK]: {
      clientId: config.oauth.facebook.clientId || 'mock_facebook_client_id',
      clientSecret: config.oauth.facebook.clientSecret || 'mock_facebook_secret',
      redirectUri: config.oauth.facebook.redirectUri || 'http://localhost:3000/auth/facebook/callback',
      scopes: ['pages_manage_posts', 'pages_read_engagement'],
      authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    },
  };

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(provider: SocialPlatform, workspaceId: string): string {
    try {
      const config = this.configs[provider];
      if (!config) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Generate state parameter for CSRF protection
      const state = this.generateState(workspaceId, provider);

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        response_type: 'code',
        state,
      });

      // Add provider-specific parameters
      if (provider === SocialPlatform.TWITTER) {
        params.append('code_challenge_method', 'S256');
        params.append('code_challenge', this.generateCodeChallenge());
      }

      const authUrl = `${config.authUrl}?${params.toString()}`;

      logger.info('Generated OAuth URL', {
        provider,
        workspaceId,
        state,
      });

      return authUrl;

    } catch (error: any) {
      logger.error('Failed to generate OAuth URL', {
        provider,
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(
    provider: SocialPlatform,
    code: string,
    state: string,
    workspaceId: string
  ): Promise<{ success: boolean; account?: any; error?: string }> {
    try {
      // Validate state parameter
      if (!this.validateState(state, workspaceId, provider)) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      logger.info('Processing OAuth callback', {
        provider,
        workspaceId,
        codeLength: code.length,
      });

      // Exchange authorization code for tokens
      const tokenResult = await this.exchangeCodeForTokens(provider, code);
      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Token exchange failed');
      }

      // Get user profile information
      const profileResult = await this.getUserProfile(provider, tokenResult.accessToken!);
      if (!profileResult.success) {
        throw new Error(profileResult.error || 'Failed to get user profile');
      }

      // Create or update social account
      const account = await this.createOrUpdateAccount({
        workspaceId,
        provider,
        providerUserId: profileResult.userId!,
        accountName: profileResult.username || profileResult.displayName!,
        accessToken: tokenResult.accessToken!,
        refreshToken: tokenResult.refreshToken,
        expiresIn: tokenResult.expiresIn,
        scopes: tokenResult.scope?.split(' ') || this.configs[provider].scopes,
        profileData: {
          displayName: profileResult.displayName,
          profileUrl: profileResult.profileUrl,
          avatarUrl: profileResult.avatarUrl,
        },
      });

      logger.info('OAuth connection successful', {
        provider,
        workspaceId,
        accountId: account._id,
        providerUserId: profileResult.userId,
      });

      return { success: true, account };

    } catch (error: any) {
      logger.error('OAuth callback failed', {
        provider,
        workspaceId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * PLACEHOLDER: Exchange authorization code for tokens
   * In production, this would call the actual OAuth provider APIs
   */
  private async exchangeCodeForTokens(provider: SocialPlatform, code: string): Promise<TokenExchangeResult> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock successful token exchange
    const expiresIn = 3600; // 1 hour
    
    return {
      success: true,
      accessToken: `mock_access_token_${provider}_${Date.now()}`,
      refreshToken: `mock_refresh_token_${provider}_${Date.now()}`,
      expiresIn,
      scope: this.configs[provider].scopes.join(' '),
    };

    // Production implementation would look like:
    /*
    const config = this.configs[provider];
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error_description || 'Token exchange failed' };
    }
    
    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
    */
  }

  /**
   * PLACEHOLDER: Get user profile from provider
   * In production, this would call the actual provider APIs
   */
  private async getUserProfile(provider: SocialPlatform, accessToken: string): Promise<UserProfileResult> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock user profile data
    const mockUserId = `mock_user_${provider}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      userId: mockUserId,
      username: `user_${mockUserId}`,
      displayName: `Mock ${provider} User`,
      profileUrl: `https://${provider}.com/${mockUserId}`,
      avatarUrl: `https://example.com/avatar_${mockUserId}.jpg`,
    };

    // Production implementation would make API calls to get real profile data
  }

  /**
   * Create or update social account
   */
  private async createOrUpdateAccount(data: {
    workspaceId: string;
    provider: SocialPlatform;
    providerUserId: string;
    accountName: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    scopes: string[];
    profileData: any;
  }): Promise<any> {
    try {
      const expiresAt = data.expiresIn 
        ? new Date(Date.now() + data.expiresIn * 1000)
        : undefined;

      // Try to find existing account
      let account = await SocialAccount.findOne({
        workspaceId: data.workspaceId,
        provider: data.provider,
        providerUserId: data.providerUserId,
      });

      if (account) {
        // Update existing account
        account.accountName = data.accountName;
        account.accessToken = encrypt(data.accessToken);
        if (data.refreshToken) {
          account.refreshToken = encrypt(data.refreshToken);
        }
        account.tokenExpiresAt = expiresAt;
        account.scopes = data.scopes;
        account.status = AccountStatus.ACTIVE;
        account.lastRefreshedAt = new Date();
        account.metadata = {
          ...account.metadata,
          ...data.profileData,
        };

        await account.save();

        logger.info('Updated existing social account', {
          accountId: account._id,
          provider: data.provider,
          providerUserId: data.providerUserId,
        });
      } else {
        // Create new account
        account = new SocialAccount({
          workspaceId: data.workspaceId,
          provider: data.provider,
          providerUserId: data.providerUserId,
          accountName: data.accountName,
          accessToken: encrypt(data.accessToken),
          refreshToken: data.refreshToken ? encrypt(data.refreshToken) : undefined,
          tokenExpiresAt: expiresAt,
          scopes: data.scopes,
          status: AccountStatus.ACTIVE,
          lastRefreshedAt: new Date(),
          metadata: data.profileData,
        });

        await account.save();

        logger.info('Created new social account', {
          accountId: account._id,
          provider: data.provider,
          providerUserId: data.providerUserId,
        });
      }

      return account;

    } catch (error: any) {
      logger.error('Failed to create/update social account', {
        provider: data.provider,
        providerUserId: data.providerUserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate state parameter for CSRF protection
   */
  private generateState(workspaceId: string, provider: SocialPlatform): string {
    const data = {
      workspaceId,
      provider,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  /**
   * Validate state parameter
   */
  private validateState(state: string, workspaceId: string, provider: SocialPlatform): boolean {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      
      // Check required fields
      if (decoded.workspaceId !== workspaceId || decoded.provider !== provider) {
        return false;
      }
      
      // Check timestamp (valid for 10 minutes)
      const age = Date.now() - decoded.timestamp;
      if (age > 10 * 60 * 1000) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate PKCE code challenge for Twitter OAuth 2.0
   */
  private generateCodeChallenge(): string {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  /**
   * Revoke account access
   */
  async revokeAccount(accountId: string): Promise<void> {
    try {
      await SocialAccount.findByIdAndUpdate(accountId, {
        status: AccountStatus.REVOKED,
        'metadata.revokedAt': new Date(),
      });

      logger.info('Account access revoked', { accountId });

    } catch (error: any) {
      logger.error('Failed to revoke account', {
        accountId,
        error: error.message,
      });
      throw error;
    }
  }
}

export const oauthService = new OAuthService();
