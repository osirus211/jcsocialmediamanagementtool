import { SocialAccount, AccountStatus, SocialPlatform } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { getRedisClient } from '../config/redis';

/**
 * Reconnect Service
 * 
 * Handles OAuth reconnection flows and account status management
 */
export class ReconnectService {
  private redis = getRedisClient();

  /**
   * Generate OAuth URL for account reconnection
   */
  async generateReconnectOAuthUrl(
    platform: SocialPlatform,
    accountId: string,
    workspaceId: string
  ): Promise<string> {
    // Generate secure state parameter
    const state = this.generateOAuthState(accountId, workspaceId);
    
    // Store state in Redis for validation (expires in 10 minutes)
    await this.redis.setex(
      `oauth_state:${state}`,
      600,
      JSON.stringify({ accountId, workspaceId, platform })
    );

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const redirectUri = `${baseUrl}/api/v1/accounts/reconnect-callback/${platform}`;

    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.generateFacebookOAuthUrl(redirectUri, state);
      
      case SocialPlatform.INSTAGRAM:
        return this.generateInstagramOAuthUrl(redirectUri, state);
      
      case SocialPlatform.TWITTER:
        return await this.generateTwitterOAuthUrl(redirectUri, state);
      
      case SocialPlatform.LINKEDIN:
        return this.generateLinkedInOAuthUrl(redirectUri, state);
      
      case SocialPlatform.YOUTUBE:
        return this.generateYouTubeOAuthUrl(redirectUri, state);
      
      default:
        throw new BadRequestError(`OAuth reconnection not supported for platform: ${platform}`);
    }
  }

  /**
   * Handle OAuth callback and update account tokens
   */
  async handleOAuthCallback(
    platform: string,
    code: string,
    state: string
  ): Promise<{ success: boolean; accountId?: string; error?: string }> {
    try {
      // Validate state parameter
      const stateData = this.validateOAuthState(state);
      if (!stateData) {
        return { success: false, error: 'Invalid or expired OAuth state' };
      }

      const { accountId, workspaceId } = stateData;

      // Exchange code for tokens
      const tokenData = await this.exchangeCodeForTokens(platform, code);
      if (!tokenData) {
        return { success: false, error: 'Failed to exchange OAuth code for tokens' };
      }

      // Update account with new tokens
      await this.updateAccountTokens(accountId, tokenData);

      // Clear any snooze settings
      await this.clearReconnectSnooze(accountId);

      return { success: true, accountId };

    } catch (error: any) {
      logger.error('OAuth callback processing failed', { error: error.message, platform });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get disconnection reason from account status
   */
  getDisconnectionReason(status: AccountStatus, metadata?: any): string {
    switch (status) {
      case AccountStatus.EXPIRED:
        return 'token_expired';
      case AccountStatus.REVOKED:
        return 'permissions_changed';
      case AccountStatus.DISCONNECTED:
        return 'account_disconnected';
      case AccountStatus.REAUTH_REQUIRED:
        return 'connection_lost';
      case AccountStatus.REFRESH_FAILED:
        return 'token_expired';
      default:
        return 'connection_lost';
    }
  }

  /**
   * Get disconnection severity level
   */
  getDisconnectionSeverity(status: AccountStatus): 'warning' | 'error' {
    switch (status) {
      case AccountStatus.TOKEN_EXPIRING:
        return 'warning';
      case AccountStatus.EXPIRED:
      case AccountStatus.REVOKED:
      case AccountStatus.DISCONNECTED:
      case AccountStatus.REAUTH_REQUIRED:
      case AccountStatus.REFRESH_FAILED:
        return 'error';
      default:
        return 'warning';
    }
  }

  /**
   * Log reconnect attempt for analytics
   */
  async logReconnectAttempt(accountId: string, status: 'initiated' | 'completed' | 'failed'): Promise<void> {
    try {
      await SocialAccount.updateOne(
        { _id: new mongoose.Types.ObjectId(accountId) },
        {
          $push: {
            'metadata.reconnectAttempts': {
              timestamp: new Date(),
              status,
              userAgent: 'web-app' // Could be passed from request
            }
          }
        }
      );
    } catch (error) {
      logger.error('Failed to log reconnect attempt', { error, accountId, status });
    }
  }

  /**
   * Clear reconnect snooze settings
   */
  private async clearReconnectSnooze(accountId: string): Promise<void> {
    await SocialAccount.updateOne(
      { _id: new mongoose.Types.ObjectId(accountId) },
      {
        $unset: {
          'metadata.reconnectSnoozeUntil': 1,
          'metadata.lastSnoozeAt': 1
        }
      }
    );
  }

  /**
   * Generate secure OAuth state parameter
   */
  private generateOAuthState(accountId: string, workspaceId: string): string {
    const data = { accountId, workspaceId, timestamp: Date.now() };
    const payload = Buffer.from(JSON.stringify(data)).toString('base64');
    const signature = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret')
      .update(payload)
      .digest('hex');
    
    return `${payload}.${signature}`;
  }

  /**
   * Validate OAuth state parameter
   */
  private validateOAuthState(state: string): { accountId: string; workspaceId: string } | null {
    try {
      const [payload, signature] = state.split('.');
      
      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret')
        .update(payload)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return null;
      }

      // Decode payload
      const data = JSON.parse(Buffer.from(payload, 'base64').toString());
      
      // Check timestamp (expire after 10 minutes)
      if (Date.now() - data.timestamp > 600000) {
        return null;
      }

      return { accountId: data.accountId, workspaceId: data.workspaceId };
    } catch (error) {
      return null;
    }
  }

  /**
   * Platform-specific OAuth URL generators
   */
  private generateFacebookOAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish',
      response_type: 'code'
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  private generateInstagramOAuthUrl(redirectUri: string, state: string): string {
    // Instagram uses Facebook OAuth
    return this.generateFacebookOAuthUrl(redirectUri, state);
  }

  private async generateTwitterOAuthUrl(redirectUri: string, state: string): Promise<string> {
    // Generate PKCE parameters (S256 method)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store code verifier in Redis (same TTL as state: 10 minutes)
    await this.redis.setex(`pkce:${state}`, 600, codeVerifier);

    const params = new URLSearchParams({
      client_id: process.env.TWITTER_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'tweet.read tweet.write users.read offline.access',
      response_type: 'code',
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  private generateLinkedInOAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'w_member_social r_liteprofile r_emailaddress',
      response_type: 'code'
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  private generateYouTubeOAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access tokens
   */
  private async exchangeCodeForTokens(platform: string, code: string): Promise<any> {
    // This would implement the actual token exchange for each platform
    // For now, return mock data
    logger.info('Exchanging OAuth code for tokens', { platform });
    
    return {
      accessToken: 'new_access_token',
      refreshToken: 'new_refresh_token',
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    };
  }

  /**
   * Update account with new tokens
   */
  private async updateAccountTokens(accountId: string, tokenData: any): Promise<void> {
    await SocialAccount.updateOne(
      { _id: new mongoose.Types.ObjectId(accountId) },
      {
        $set: {
          status: AccountStatus.ACTIVE,
          tokenExpiresAt: tokenData.expiresAt,
          'metadata.lastSuccessfulConnection': new Date(),
          'metadata.reconnectedAt': new Date()
        }
      }
    );

    logger.info('Account tokens updated successfully', { accountId });
  }
}

export const reconnectService = new ReconnectService();