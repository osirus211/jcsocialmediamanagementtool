/**
 * OAuth Controller - HARDENED
 * 
 * Production-hardened OAuth implementation for Twitter (X API v2)
 * 
 * Security Features:
 * - 256-bit state with IP binding
 * - Server-side PKCE storage
 * - Single-use state (deleted after callback)
 * - Rate limiting (10/min authorize, 20/min callback)
 * - OAuth audit logging
 * - Replay attack prevention
 * - State-user-IP validation
 * 
 * Endpoints:
 * - POST /api/v1/oauth/:platform/authorize
 * - GET /api/v1/oauth/:platform/callback
 */

import { Request, Response, NextFunction } from 'express';
import { SocialAccount, SocialPlatform, AccountStatus } from '../models/SocialAccount';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';
import { oauthStateService } from '../services/OAuthStateService';
import { securityAuditService } from '../services/SecurityAuditService';
import { SecurityEventType } from '../models/SecurityEvent';
import { getClientIp, getHashedClientIp } from '../utils/ipHash';
import { encrypt } from '../utils/encryption';
import axios from 'axios';
import crypto from 'crypto';

// Production error codes
enum OAuthErrorCode {
  INVALID_PLATFORM = 'INVALID_PLATFORM',
  PLATFORM_NOT_CONFIGURED = 'PLATFORM_NOT_CONFIGURED',
  STATE_INVALID = 'STATE_INVALID',
  STATE_EXPIRED = 'STATE_EXPIRED',
  STATE_REUSED = 'STATE_REUSED',
  STATE_USER_MISMATCH = 'STATE_USER_MISMATCH',
  STATE_IP_MISMATCH = 'STATE_IP_MISMATCH',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  PROFILE_FETCH_FAILED = 'PROFILE_FETCH_FAILED',
  DUPLICATE_ACCOUNT = 'DUPLICATE_ACCOUNT',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

// Twitter OAuth configuration
interface TwitterOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

// Token response interface
interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string[];
}

// Profile interface
interface UserProfile {
  id: string;
  username: string;
  name: string;
  profileUrl: string;
  avatarUrl?: string;
  followerCount?: number;
}

export class OAuthController {
  private readonly TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
  private readonly TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
  private readonly TWITTER_USER_URL = 'https://api.twitter.com/2/users/me';
  private readonly TWITTER_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

  /**
   * Get Twitter OAuth configuration
   */
  private getTwitterConfig(): TwitterOAuthConfig {
    const clientId = config.oauth?.twitter?.clientId;
    const clientSecret = config.oauth?.twitter?.clientSecret;
    const callbackUrl = config.oauth?.twitter?.callbackUrl;

    if (!clientId || !clientSecret) {
      throw new BadRequestError('Twitter OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/twitter/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: this.TWITTER_SCOPES,
    };
  }

  /**
   * Get Facebook OAuth configuration
   */
  private getFacebookConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.facebook?.appId;
    const clientSecret = config.oauth?.facebook?.appSecret;
    const callbackUrl = config.oauth?.facebook?.callbackUrl;

    if (!clientId || !clientSecret) {
      throw new BadRequestError('Facebook OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/facebook/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['pages_manage_posts', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'],
    };
  }

  /**
   * Get Instagram OAuth configuration
   */
  private getInstagramConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.instagram?.clientId;
    const clientSecret = config.oauth?.instagram?.clientSecret;
    const callbackUrl = config.oauth?.instagram?.callbackUrl;

    if (!clientId || !clientSecret) {
      throw new BadRequestError('Instagram OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/instagram/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'public_profile'],
    };
  }

  /**
   * Get YouTube OAuth configuration
   */
  private getYouTubeConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.youtube?.clientId;
    const clientSecret = config.oauth?.youtube?.clientSecret;
    const callbackUrl = config.oauth?.youtube?.callbackUrl;

    if (!clientId || !clientSecret) {
      throw new BadRequestError('YouTube OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/youtube/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: [
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
    };
  }

  /**
   * Get LinkedIn OAuth configuration
   */
  private getLinkedInConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.linkedin?.clientId;
    const clientSecret = config.oauth?.linkedin?.clientSecret;
    const callbackUrl = config.apiUrl || 'http://localhost:5000';

    if (!clientId || !clientSecret) {
      throw new BadRequestError('LinkedIn OAuth not configured');
    }

    // LinkedIn callback URL
    const redirectUri = `${callbackUrl}/api/v1/oauth/linkedin/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: [
        'openid', 
        'profile', 
        'email', 
        'w_member_social',
        'r_organization_social',
        'w_organization_social',
        'r_basicprofile',
        'rw_organization_admin'
      ],
    };
  }

  /**
   * Get Threads OAuth configuration
   */
  private getThreadsConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.threads?.clientId;
    const clientSecret = config.oauth?.threads?.clientSecret;
    const callbackUrl = config.oauth?.threads?.callbackUrl;

    if (!clientId || !clientSecret) {
      throw new BadRequestError('Threads OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/threads/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['threads_basic', 'threads_content_publish'],
    };
  }

  /**
   * Get Google Business Profile OAuth configuration
   */
  private getGoogleBusinessConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth.googleBusiness.clientId;
    const clientSecret = config.oauth.googleBusiness.clientSecret;
    const redirectUri = config.oauth.googleBusiness.redirectUri;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestError('Google Business Profile OAuth not configured');
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: [
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    };
  }

  /**
   * Get Google OAuth configuration
   */
  private getGoogleConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth.google.clientId;
    const clientSecret = config.oauth.google.clientSecret;
    const redirectUri = config.oauth.google.callbackUrl;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestError('Google OAuth not configured');
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    };
  }

  /**
   * Get GitHub OAuth configuration
   */
  private getGitHubConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.github?.clientId;
    const clientSecret = config.oauth?.github?.clientSecret;
    const callbackUrl = config.oauth?.github?.callbackUrl;

    if (!clientId || !clientSecret) {
      throw new BadRequestError('GitHub OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/github/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['user:email', 'read:user'],
    };
  }

  /**
   * Get Apple OAuth configuration
   */
  private getAppleConfig(): { clientId: string; teamId: string; keyId: string; privateKey: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.apple?.clientId;
    const teamId = config.oauth?.apple?.teamId;
    const keyId = config.oauth?.apple?.keyId;
    const privateKey = config.oauth?.apple?.privateKey;
    const callbackUrl = config.oauth?.apple?.callbackUrl;

    if (!clientId || !teamId || !keyId || !privateKey) {
      throw new BadRequestError('Apple OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/apple/callback`;

    return {
      clientId,
      teamId,
      keyId,
      privateKey,
      redirectUri,
      scopes: ['name', 'email'],
    };
  }

  /**
   * Get TikTok OAuth configuration
   */
  private getTikTokConfig(): { clientKey: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientKey = config.oauth?.tiktok?.clientKey;
    const clientSecret = config.oauth?.tiktok?.clientSecret;
    const callbackUrl = config.oauth?.tiktok?.callbackUrl;

    if (!clientKey || !clientSecret) {
      throw new BadRequestError('TikTok OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/tiktok/callback`;

    return {
      clientKey,
      clientSecret,
      redirectUri,
      scopes: [
        'user.info.basic',
        'user.info.profile', 
        'user.info.stats',
        'video.upload',
        'video.publish',
        'creator.info.basic'
      ],
    };
  }

  /**
   * Get Pinterest OAuth configuration
   */
  private getPinterestConfig(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] } {
    const clientId = config.oauth?.pinterest?.appId;
    const clientSecret = config.oauth?.pinterest?.appSecret;
    const callbackUrl = config.oauth?.pinterest?.callbackUrl;

    if (!clientId || !clientSecret) {
      throw new BadRequestError('Pinterest OAuth not configured');
    }

    // Use explicit callback URL from env, or fallback to constructed URL
    const redirectUri = callbackUrl || `${config.apiUrl || 'http://localhost:5000'}/api/v1/oauth/pinterest/callback`;

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read', 'ads:read'],
    };
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    // Generate 256-bit code verifier
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Compute SHA-256 code challenge
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * POST /api/v1/oauth/twitter/authorize
   * 
   * Initiate Twitter OAuth flow
   * Rate limit: 10 requests/min per user
   */
  async authorize(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { platform } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();
      const clientIp = getClientIp(req);
      const ipHash = getHashedClientIp(req);

      // Validate authentication
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Validate platform
      if (platform !== 'twitter' && platform !== 'facebook' && platform !== 'instagram' && platform !== 'youtube' && platform !== 'linkedin' && platform !== 'threads' && platform !== 'google-business' && platform !== 'google' && platform !== 'github' && platform !== 'apple' && platform !== 'tiktok' && platform !== 'pinterest') {
        throw new BadRequestError('Only Twitter, Facebook, Instagram, YouTube, LinkedIn, Threads, Google Business Profile, Google, GitHub, Apple, TikTok, and Pinterest platforms are supported', {
          code: OAuthErrorCode.INVALID_PLATFORM,
        });
      }

      let authorizationUrl: string;
      let state: string;

      if (platform === 'twitter') {
        // Get Twitter configuration
        const twitterConfig = this.getTwitterConfig();

        // Generate PKCE
        const { codeVerifier, codeChallenge } = this.generatePKCE();

        // Store state in Redis with IP binding and PKCE verifier
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          codeVerifier, // Server-side PKCE storage
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: twitterConfig.clientId,
          redirect_uri: twitterConfig.redirectUri,
          scope: twitterConfig.scopes.join(' '),
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        });

        authorizationUrl = `${this.TWITTER_AUTH_URL}?${params.toString()}`;
      } else if (platform === 'facebook') {
        // Facebook OAuth
        const facebookConfig = this.getFacebookConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: facebookConfig.clientId,
          redirect_uri: facebookConfig.redirectUri,
          scope: facebookConfig.scopes.join(','), // Facebook uses comma-separated scopes
          state,
        });

        authorizationUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
      } else if (platform === 'instagram') {
        // Instagram OAuth (uses Facebook Login)
        const instagramConfig = this.getInstagramConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL (uses Facebook OAuth)
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: instagramConfig.clientId,
          redirect_uri: instagramConfig.redirectUri,
          scope: instagramConfig.scopes.join(','),
          state,
        });

        authorizationUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
      } else if (platform === 'youtube') {
        // YouTube OAuth
        const youtubeConfig = this.getYouTubeConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: youtubeConfig.clientId,
          redirect_uri: youtubeConfig.redirectUri,
          scope: youtubeConfig.scopes.join(' '),
          state,
          access_type: 'offline', // Request refresh token
          prompt: 'consent', // Force consent to get refresh token
        });

        authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      } else if (platform === 'linkedin') {
        // LinkedIn OAuth
        const linkedinConfig = this.getLinkedInConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: linkedinConfig.clientId,
          redirect_uri: linkedinConfig.redirectUri,
          scope: linkedinConfig.scopes.join(' '),
          state,
        });

        authorizationUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
      } else if (platform === 'threads') {
        // Threads OAuth
        const threadsConfig = this.getThreadsConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: threadsConfig.clientId,
          redirect_uri: threadsConfig.redirectUri,
          scope: threadsConfig.scopes.join(','), // Threads uses comma-separated scopes
          state,
        });

        authorizationUrl = `https://threads.net/oauth/authorize?${params.toString()}`;
      } else if (platform === 'google-business') {
        // Google Business Profile OAuth
        const gbpConfig = this.getGoogleBusinessConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: gbpConfig.clientId,
          redirect_uri: gbpConfig.redirectUri,
          scope: gbpConfig.scopes.join(' '),
          state,
          access_type: 'offline', // Request refresh token
          prompt: 'consent', // Force consent to ensure refresh token
        });

        authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      } else if (platform === 'google') {
        // Google OAuth
        const googleConfig = this.getGoogleConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: googleConfig.clientId,
          redirect_uri: googleConfig.redirectUri,
          scope: googleConfig.scopes.join(' '),
          state,
          access_type: 'offline', // Request refresh token
          prompt: 'consent', // Force consent to ensure refresh token
        });

        authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      } else if (platform === 'github') {
        // GitHub OAuth
        const githubConfig = this.getGitHubConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: githubConfig.clientId,
          redirect_uri: githubConfig.redirectUri,
          scope: githubConfig.scopes.join(' '),
          state,
        });

        authorizationUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
      } else if (platform === 'apple') {
        // Apple OAuth with PKCE
        const appleConfig = this.getAppleConfig();

        // Generate PKCE
        const { codeVerifier, codeChallenge } = this.generatePKCE();

        // Store state in Redis with IP binding and PKCE verifier
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          codeVerifier, // Server-side PKCE storage
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: appleConfig.clientId,
          redirect_uri: appleConfig.redirectUri,
          scope: appleConfig.scopes.join(' '),
          response_mode: 'form_post', // Apple requires form_post
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        });

        authorizationUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
      } else if (platform === 'tiktok') {
        // TikTok OAuth with PKCE
        const tiktokConfig = this.getTikTokConfig();

        // Generate PKCE
        const { codeVerifier, codeChallenge } = this.generatePKCE();

        // Store state in Redis with IP binding and PKCE verifier
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          codeVerifier, // Server-side PKCE storage
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          client_key: tiktokConfig.clientKey, // TikTok uses client_key instead of client_id
          redirect_uri: tiktokConfig.redirectUri,
          response_type: 'code',
          scope: tiktokConfig.scopes.join(','), // TikTok uses comma-separated scopes
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        });

        authorizationUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
      } else if (platform === 'pinterest') {
        // Pinterest OAuth
        const pinterestConfig = this.getPinterestConfig();

        // Store state in Redis with IP binding
        state = await oauthStateService.createState(workspaceId, userId, platform, {
          ipHash, // IP binding
          metadata: {
            platform,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
          },
        });

        // Build authorization URL
        const params = new URLSearchParams({
          client_id: pinterestConfig.clientId,
          redirect_uri: pinterestConfig.redirectUri,
          response_type: 'code',
          scope: pinterestConfig.scopes.join(','), // Pinterest uses comma-separated scopes
          state,
        });

        authorizationUrl = `https://www.pinterest.com/oauth/?${params.toString()}`;
      }

      // Log OAuth initiation
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_INITIATED,
        userId,
        workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: platform,
        action: 'authorize',
        success: true,
        metadata: {
          platform,
          state: state.substring(0, 10) + '...',
          ipBound: true,
          duration: Date.now() - startTime,
        },
      });

      logger.info('[OAuth] Authorization initiated', {
        platform,
        workspaceId,
        userId,
        state: state!.substring(0, 10) + '...',
        ipBound: true,
        duration: Date.now() - startTime,
      });

      // Return authorization URL
      res.json({
        success: true,
        authorizationUrl,
        state,
        platform,
      });
      return;
      return;
    } catch (error) {
      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_INITIATED,
        userId: req.user?.userId?.toString(),
        workspaceId: req.workspace?.workspaceId.toString(),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        resource: req.params.platform,
        action: 'authorize',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          duration: Date.now() - startTime,
        },
      });

      next(error);
    }
  }

  /**
   * GET /api/v1/oauth/twitter/callback
   * 
   * Handle Twitter OAuth callback
   * Rate limit: 20 requests/min per IP
   */
  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const clientIp = getClientIp(req);
    const ipHash = getHashedClientIp(req);
    
    // DEBUG REPORT
    const debugReport = {
      callbackHit: true,
      codePresent: false,
      stateValid: false,
      tokenExchangeSuccess: false,
      userFetched: false,
      dbInsertSuccess: false,
      finalResponseStatus: 0,
    };
    
    try {
      const { platform } = req.params;
      const { code, state, error, error_description } = req.query;

      debugReport.codePresent = !!code;

      // Check for OAuth errors from provider
      if (error) {
        logger.error('[OAuth] Provider error', {
          platform,
          error,
          error_description,
        });

        const frontendUrl = config.cors.origin;
        debugReport.finalResponseStatus = 302;
        return res.redirect(
          `${frontendUrl}/social/accounts?error=${error}&message=${encodeURIComponent(error_description as string || 'OAuth failed')}`
        );
      }

      // Validate required parameters
      if (!code || !state) {
        throw new BadRequestError('Missing code or state parameter');
      }

      // Validate platform
      if (platform !== 'twitter' && platform !== 'facebook' && platform !== 'instagram' && platform !== 'youtube' && platform !== 'linkedin' && platform !== 'threads' && platform !== 'google-business' && platform !== 'google' && platform !== 'github' && platform !== 'apple' && platform !== 'tiktok' && platform !== 'pinterest') {
        throw new BadRequestError('Only Twitter, Facebook, Instagram, YouTube, LinkedIn, Threads, Google Business Profile, Google, GitHub, Apple, TikTok, and Pinterest platforms are supported', {
          code: OAuthErrorCode.INVALID_PLATFORM,
        });
      }

      // Step 1: Idempotency Guard (BEFORE state consumption)
      // Prevents duplicate processing from retries, double-clicks, race conditions
      const { oauthIdempotencyService } = await import('../services/OAuthIdempotencyService');
      const correlationId = req.headers['x-correlation-id'] as string || crypto.randomBytes(8).toString('hex');
      
      const isFirstAttempt = await oauthIdempotencyService.checkAndSet(state as string, correlationId);
      
      if (!isFirstAttempt) {
        logger.warn('[OAuth] Duplicate callback detected - idempotency guard triggered', {
          platform,
          state: (state as string).substring(0, 10) + '...',
          correlationId,
          ipHash,
        });

        // Log duplicate attempt
        await securityAuditService.logEvent({
          type: SecurityEventType.OAUTH_CONNECT_FAILURE,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          resource: platform,
          action: 'callback',
          success: false,
          errorMessage: 'Duplicate callback attempt - already processed',
          metadata: {
            errorCode: 'ALREADY_PROCESSED',
            state: (state as string).substring(0, 10) + '...',
            correlationId,
            duplicateAttempt: true,
          },
        });

        // Return 409 Conflict
        res.status(409).json({
          success: false,
          error: 'ALREADY_PROCESSED',
          message: 'This OAuth callback has already been processed',
          correlationId,
        });
        return;
      }

      // Step 2: Validate Redis state
      const stateData = await oauthStateService.consumeState(state as string);
      
      if (stateData) {
        debugReport.stateValid = true;
      }
      
      if (!stateData) {
        logger.warn('[OAuth] Invalid or expired state', {
          platform,
          state: (state as string).substring(0, 10) + '...',
          ipHash,
        });

        // Log replay attempt
        await securityAuditService.logEvent({
          type: SecurityEventType.OAUTH_CONNECT_FAILURE,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          resource: platform,
          action: 'callback',
          success: false,
          errorMessage: 'Invalid or expired state - possible replay attack',
          metadata: {
            errorCode: OAuthErrorCode.STATE_INVALID,
            state: (state as string).substring(0, 10) + '...',
            replayAttempt: true,
          },
        });

        const frontendUrl = config.cors.origin;
        debugReport.finalResponseStatus = 302;
        return res.redirect(
          `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
        );
      }

      // Validate IP binding (skip for Instagram due to ngrok/proxy issues)
      if (platform !== 'instagram' && stateData.ipHash && stateData.ipHash !== ipHash) {
        logger.warn('[OAuth] IP mismatch detected', {
          platform,
          state: (state as string).substring(0, 10) + '...',
          expectedIpHash: stateData.ipHash.substring(0, 10) + '...',
          actualIpHash: ipHash.substring(0, 10) + '...',
        });

        // Log IP mismatch
        await securityAuditService.logEvent({
          type: SecurityEventType.OAUTH_CONNECT_FAILURE,
          userId: stateData.userId,
          workspaceId: stateData.workspaceId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          resource: platform,
          action: 'callback',
          success: false,
          errorMessage: 'IP address mismatch - possible session hijacking',
          metadata: {
            errorCode: OAuthErrorCode.STATE_IP_MISMATCH,
            state: (state as string).substring(0, 10) + '...',
          },
        });

        const frontendUrl = config.cors.origin;
        return res.redirect(
          `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_IP_MISMATCH}&message=${encodeURIComponent('IP address mismatch')}`
        );
      }

      // Log IP mismatch as warning for Instagram (but don't block)
      if (platform === 'instagram' && stateData.ipHash && stateData.ipHash !== ipHash) {
        logger.warn('[OAuth] IP mismatch detected for Instagram (allowing due to ngrok/proxy)', {
          platform,
          state: (state as string).substring(0, 10) + '...',
          expectedIpHash: stateData.ipHash.substring(0, 10) + '...',
          actualIpHash: ipHash.substring(0, 10) + '...',
        });
      }

      // Route to platform-specific handler
      if (platform === 'facebook') {
        return await this.handleFacebookCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'instagram') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleInstagramCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'youtube') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleYouTubeCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'linkedin') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleLinkedInCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'threads') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleThreadsCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'google-business') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleGoogleBusinessCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'google') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleGoogleCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'github') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleGitHubCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'apple') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleAppleCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'tiktok') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handleTikTokCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      if (platform === 'pinterest') {
        // Pass the already-consumed stateData to avoid double-consumption
        return await this.handlePinterestCallback(req, res, next, code as string, state as string, stateData, clientIp, ipHash, debugReport, startTime);
      }

      // Get Twitter configuration
      const twitterConfig = this.getTwitterConfig();

      // Step 3: Exchange code for tokens
      logger.debug('[OAuth] Token exchange initiated', { 
        step: 'token_exchange',
        platform,
        workspaceId: stateData.workspaceId,
      });
      
      let tokens: TokenResponse;
      try {
        const tokenResponse = await axios.post(
          this.TWITTER_TOKEN_URL,
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code as string,
            redirect_uri: twitterConfig.redirectUri,
            code_verifier: stateData.codeVerifier!, // Server-side PKCE
            client_id: twitterConfig.clientId,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            auth: {
              username: twitterConfig.clientId,
              password: twitterConfig.clientSecret,
            },
          }
        );

        if (!tokenResponse.data.access_token) {
          throw new Error('No access_token in response');
        }

        tokens = {
          accessToken: tokenResponse.data.access_token,
          refreshToken: tokenResponse.data.refresh_token,
          expiresIn: tokenResponse.data.expires_in,
          scope: tokenResponse.data.scope?.split(' ') || [],
        };

        debugReport.tokenExchangeSuccess = true;
        logger.info('[OAuth] Token exchange successful', {
          platform,
          workspaceId: stateData.workspaceId,
          expiresIn: tokens.expiresIn,
        });
      } catch (error: any) {
        logger.debug('[OAuth] Token exchange failed', {
          step: 'token_exchange',
          platform,
          statusCode: error.response?.status,
        });
        
        // Check for invalid app secret error
        const errorMessage = error.response?.data?.error?.message || error.response?.data?.error_description || error.message;
        const isInvalidSecret = errorMessage?.toLowerCase().includes('secret') || 
                               errorMessage?.toLowerCase().includes('client') ||
                               error.response?.data?.error === 'invalid_client';
        
        if (isInvalidSecret) {
          logger.error('[OAuth] Token exchange failed - invalid client credentials', {
            platform,
            errorType: 'INVALID_CLIENT_CREDENTIALS',
          });
        } else {
          logger.error('[OAuth] Token exchange failed', {
            platform,
            error: errorMessage,
          });
        }

        // Log failure
        await securityAuditService.logEvent({
          type: SecurityEventType.OAUTH_CONNECT_FAILURE,
          userId: stateData.userId,
          workspaceId: stateData.workspaceId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          resource: platform,
          action: 'token_exchange',
          success: false,
          errorMessage: isInvalidSecret ? 'Invalid OAuth client credentials' : errorMessage,
          metadata: {
            errorCode: OAuthErrorCode.TOKEN_EXCHANGE_FAILED,
          },
        });

        const frontendUrl = config.cors.origin;
        debugReport.finalResponseStatus = 302;
        logger.debug('[OAuth] Token exchange failed', { step: 'token_exchange' });
        
        // Return safe error message (do not expose configuration details)
        const userMessage = isInvalidSecret 
          ? 'OAuth configuration error. Please contact support.'
          : (errorMessage || 'Token exchange failed');
        
        return res.redirect(
          `${frontendUrl}/social/accounts?error=${OAuthErrorCode.TOKEN_EXCHANGE_FAILED}&message=${encodeURIComponent(userMessage)}`
        );
      }

      // Step 4: Fetch user profile
      logger.debug('[OAuth] Profile fetch initiated', {
        step: 'profile_fetch',
        platform,
        workspaceId: stateData.workspaceId,
      });
      
      let profile: UserProfile;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second
      
      while (retryCount <= maxRetries) {
        try {
          const profileResponse = await axios.get(this.TWITTER_USER_URL, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
            params: {
              'user.fields': 'id,name,username,profile_image_url,public_metrics',
            },
          });

          const user = profileResponse.data.data;
          
          if (!user || !user.id) {
            throw new Error('No user data in response');
          }

          profile = {
            id: user.id,
            username: user.username,
            name: user.name,
            profileUrl: `https://twitter.com/${user.username}`,
            avatarUrl: user.profile_image_url,
            followerCount: user.public_metrics?.followers_count,
          };

          debugReport.userFetched = true;
          logger.info('[OAuth] Profile fetched', {
            platform,
            workspaceId: stateData.workspaceId,
            userId: profile.id,
            username: profile.username,
          });
          
          break; // Success, exit retry loop
          
        } catch (error: any) {
          retryCount++;
          
          if (error.response?.status === 503 && retryCount <= maxRetries) {
            logger.debug('[OAuth] Twitter API unavailable, retrying', { 
              step: 'profile_fetch_retry',
              retryCount,
              maxRetries,
              delayMs: retryDelay
            });
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          
          // Max retries reached or non-503 error
          logger.debug('[OAuth] Profile fetch failed', {
            step: 'profile_fetch',
            platform,
            statusCode: error.response?.status,
            retries: retryCount,
          });
          
          // FALLBACK: If Twitter API is down (503), save account with temporary data
          // The profile can be synced later when API is available
          if (error.response?.status === 503 && retryCount > maxRetries) {
            // Generate temporary profile using access token hash as ID
            const tempId = crypto.createHash('sha256').update(tokens.accessToken).digest('hex').substring(0, 16);
            
            profile = {
              id: tempId,
              username: 'twitter_user_' + tempId.substring(0, 8),
              name: 'Twitter User (Pending Sync)',
              profileUrl: 'https://twitter.com',
              avatarUrl: undefined,
              followerCount: undefined,
            };
            
            debugReport.userFetched = true; // Mark as fetched (with fallback)
            
            logger.warn('[OAuth] Profile fetch failed, using fallback data', {
              platform,
              workspaceId: stateData.workspaceId,
              tempId,
              willSyncLater: true,
            });
            
            break; // Exit retry loop with fallback data
          }
          
          // For non-503 errors or if we don't want to use fallback
          logger.error('[OAuth] Profile fetch failed', {
            platform,
            error: error.response?.data || error.message,
            retries: retryCount,
          });

          // Log failure
          await securityAuditService.logEvent({
            type: SecurityEventType.OAUTH_CONNECT_FAILURE,
            userId: stateData.userId,
            workspaceId: stateData.workspaceId,
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'],
            resource: platform,
            action: 'profile_fetch',
            success: false,
            errorMessage: error.response?.data?.error || error.message,
            metadata: {
              errorCode: OAuthErrorCode.PROFILE_FETCH_FAILED,
              retries: retryCount,
            },
          });

          const frontendUrl = config.cors.origin;
          debugReport.finalResponseStatus = 302;
          logger.debug('[OAuth] Profile fetch failed', { step: 'profile_fetch' });
          return res.redirect(
            `${frontendUrl}/social/accounts?error=${OAuthErrorCode.PROFILE_FETCH_FAILED}&message=${encodeURIComponent('Twitter API temporarily unavailable. Please try again later.')}`
          );
        }
      }

      // Step 5: Check for duplicate account
      logger.debug('[OAuth] Checking for duplicate account', {
        step: 'duplicate_check',
        platform,
        workspaceId: stateData.workspaceId,
      });
      
      const existing = await SocialAccount.findOne({
        workspaceId: stateData.workspaceId,
        provider: platform as SocialPlatform,
        providerUserId: profile.id,
      });

      if (existing) {
        logger.warn('[OAuth] Duplicate account detected', {
          platform,
          workspaceId: stateData.workspaceId,
          providerUserId: profile.id,
          existingAccountId: existing._id,
        });

        // Log duplicate attempt
        await securityAuditService.logEvent({
          type: SecurityEventType.OAUTH_CONNECT_FAILURE,
          userId: stateData.userId,
          workspaceId: stateData.workspaceId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          resource: platform,
          action: 'account_creation',
          success: false,
          errorMessage: 'Account already connected',
          metadata: {
            errorCode: OAuthErrorCode.DUPLICATE_ACCOUNT,
            providerUserId: profile.id,
            existingAccountId: existing._id.toString(),
            securityEvent: 'DUPLICATE_ACCOUNT_ATTEMPT', // BLOCKER #4: Structured logging
          },
        });

        logger.warn('[Security] DUPLICATE_ACCOUNT_ATTEMPT detected', {
          event: 'DUPLICATE_ACCOUNT_ATTEMPT',
          platform,
          workspaceId: stateData.workspaceId,
          providerUserId: profile.id,
          existingAccountId: existing._id.toString(),
        });

        const frontendUrl = config.cors.origin;
        debugReport.finalResponseStatus = 302;
        logger.debug('[OAuth] Duplicate account detected', { step: 'duplicate_check' });
        return res.redirect(
          `${frontendUrl}/social/accounts?error=${OAuthErrorCode.DUPLICATE_ACCOUNT}&message=${encodeURIComponent('Account already connected')}`
        );
      }

      // Calculate token expiration
      const tokenExpiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined;

      // Create new account (tokens will be encrypted by pre-save hook)
      try {
        logger.debug('[OAuth] Creating social account', {
          step: 'account_creation',
          platform,
          workspaceId: stateData.workspaceId,
        });
        
        const account = new SocialAccount({
          workspaceId: stateData.workspaceId,
          provider: platform as SocialPlatform,
          providerUserId: profile.id,
          accountName: profile.name,
          accessToken: tokens.accessToken, // Will be encrypted by pre-save hook
          refreshToken: tokens.refreshToken, // Will be encrypted by pre-save hook
          tokenExpiresAt,
          scopes: tokens.scope,
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
          metadata: {
            username: profile.username,
            profileUrl: profile.profileUrl,
            avatarUrl: profile.avatarUrl,
            followerCount: profile.followerCount,
          },
          lastSyncAt: new Date(),
        });

        await account.save();
        debugReport.dbInsertSuccess = true;

      // Log success
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        userId: stateData.userId,
        workspaceId: stateData.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: platform,
        action: 'callback',
        success: true,
        metadata: {
          platform,
          accountId: account._id.toString(),
          providerUserId: profile.id,
          username: profile.username,
          connectionVersion: 'v2',
          duration: Date.now() - startTime,
        },
      });

      logger.info('[OAuth] Account created', {
        platform,
        workspaceId: stateData.workspaceId,
        accountId: account._id,
        providerUserId: profile.id,
        username: profile.username,
        connectionVersion: 'v2',
        duration: Date.now() - startTime,
      });

      // Step 6: Final response
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=${platform}&account=${account._id}`;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Callback completed successfully', { step: 'callback_complete' });
      
      // Redirect to frontend with success
      res.redirect(redirectUrl);
      
      } catch (dbError: any) {
        logger.error('[OAuth] Database insert failed', {
          platform,
          error: dbError.message,
        });
        throw dbError;
      }
    } catch (error: any) {
      logger.error('[OAuth] Callback failed', {
        platform: req.params.platform,
        error: error.message,
        ipHash,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: req.params.platform,
        action: 'callback',
        success: false,
        errorMessage: error.message,
        metadata: {
          duration: Date.now() - startTime,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Callback error handled', { step: 'error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=oauth_failed&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Get available OAuth platforms
   * GET /api/v1/oauth/platforms
   */
  async getPlatforms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const platforms: string[] = [];

      // Check Twitter configuration
      if (config.oauth?.twitter?.clientId && config.oauth?.twitter?.clientSecret) {
        platforms.push('twitter');
      }

      // Check Facebook configuration
      if (config.oauth?.facebook?.appId && config.oauth?.facebook?.appSecret) {
        platforms.push('facebook');
      }

      // Check Instagram configuration
      if (config.oauth?.instagram?.clientId && config.oauth?.instagram?.clientSecret) {
        platforms.push('instagram');
      }

      // Check YouTube configuration
      if (config.oauth?.youtube?.clientId && config.oauth?.youtube?.clientSecret) {
        platforms.push('youtube');
      }

      // Check LinkedIn configuration
      if (config.oauth?.linkedin?.clientId && config.oauth?.linkedin?.clientSecret) {
        platforms.push('linkedin');
      }

      // Check Threads configuration
      if (config.oauth?.threads?.clientId && config.oauth?.threads?.clientSecret) {
        platforms.push('threads');
      }

      // Check Google configuration
      if (config.oauth?.google?.clientId && config.oauth?.google?.clientSecret) {
        platforms.push('google');
      }

      // Check GitHub configuration
      if (config.oauth?.github?.clientId && config.oauth?.github?.clientSecret) {
        platforms.push('github');
      }

      // Check Apple configuration
      if (config.oauth?.apple?.clientId && config.oauth?.apple?.teamId && config.oauth?.apple?.keyId && config.oauth?.apple?.privateKey) {
        platforms.push('apple');
      }

      res.json({
        success: true,
        platforms,
        features: {
          oauth2: true,
          pkce: true,
          refreshTokens: true,
          encryption: 'AES-256-GCM',
          ipBinding: true,
          rateLimiting: true,
          auditLogging: true,
          replayProtection: true,
        },
      });
      return;
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Facebook OAuth callback
   */
  private async handleFacebookCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    stateData: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { FacebookOAuthService } = await import('../services/oauth/FacebookOAuthService');
    
    try {
      logger.debug('[OAuth] Facebook callback initiated', { step: 'facebook_callback' });
      
      // Get Facebook configuration
      const facebookConfig = this.getFacebookConfig();
      
      // Create Facebook OAuth service
      const facebookService = new FacebookOAuthService(
        facebookConfig.clientId,
        facebookConfig.clientSecret,
        facebookConfig.redirectUri
      );

      // Connect account (exchanges code, fetches profile and pages, saves to DB)
      const result = await facebookService.connectAccount({
        workspaceId: stateData.workspaceId,
        userId: stateData.userId,
        code,
        state,
        ipAddress: clientIp,
      });

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = result.saved.length > 0;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] Facebook pages connected', {
        workspaceId: stateData.workspaceId,
        userId: stateData.userId,
        pagesConnected: result.saved.length,
        pagesFailed: result.failed.length,
        duration,
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=facebook&count=${result.saved.length}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Facebook callback completed', { step: 'facebook_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] Facebook callback failed', {
        workspaceId: stateData.workspaceId,
        userId: stateData.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: stateData.userId,
        workspaceId: stateData.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'facebook',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Facebook callback error handled', { step: 'facebook_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=FACEBOOK_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle Instagram OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   */
  private async handleInstagramCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { InstagramOAuthService } = await import('../services/oauth/InstagramOAuthService');
    
    // State already consumed by main callback handler - no need to consume again
    if (!consumedState) {
      logger.warn('[OAuth] Instagram callback - invalid or expired state', {
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      // Log replay attempt
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'instagram',
        action: 'callback',
        success: false,
        errorMessage: 'Invalid or expired state - possible replay attack',
        metadata: {
          errorCode: OAuthErrorCode.STATE_INVALID,
          state: state.substring(0, 10) + '...',
          replayAttempt: true,
          securityEvent: 'OAUTH_REPLAY_ATTEMPT', // BLOCKER #4: Structured logging
        },
      });

      logger.warn('[Security] OAUTH_REPLAY_ATTEMPT detected', {
        event: 'OAUTH_REPLAY_ATTEMPT',
        platform: 'instagram',
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Instagram state validation failed', { step: 'instagram_state_validation' });
      return res.redirect(
        `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }
    
    try {
      logger.debug('[OAuth] Instagram callback initiated', { step: 'instagram_callback' });
      
      // CRITICAL FIX #2: Fail closed - require explicit providerType
      // No default fallback to prevent privilege escalation
      const providerType = consumedState.providerType;
      
      if (!providerType) {
        logger.error('[OAuth] Missing providerType in OAuth state - SECURITY VIOLATION', {
          state: state.substring(0, 10) + '...',
          workspaceId: consumedState.workspaceId,
        });
        
        // BLOCKER #4: Structured logging for provider type mismatch
        logger.error('[Security] OAUTH_PROVIDER_TYPE_MISMATCH detected', {
          event: 'OAUTH_PROVIDER_TYPE_MISMATCH',
          reason: 'missing_provider_type',
          state: state.substring(0, 10) + '...',
          workspaceId: consumedState.workspaceId,
        });
        
        throw new BadRequestError(
          'OAuth state missing provider type. Please reconnect your Instagram account.'
        );
      }
      
      logger.debug('[OAuth] Provider type validated', { step: 'provider_type_validation' });
      
      // Validate providerType value
      if (providerType !== 'INSTAGRAM_BUSINESS' && providerType !== 'INSTAGRAM_BASIC') {
        logger.error('[OAuth] Invalid providerType in OAuth state', {
          state: state.substring(0, 10) + '...',
          providerType,
          workspaceId: consumedState.workspaceId,
        });
        
        // BLOCKER #4: Structured logging for provider type mismatch
        logger.error('[Security] OAUTH_PROVIDER_TYPE_MISMATCH detected', {
          event: 'OAUTH_PROVIDER_TYPE_MISMATCH',
          reason: 'invalid_provider_type',
          providerType,
          state: state.substring(0, 10) + '...',
          workspaceId: consumedState.workspaceId,
        });
        
        throw new BadRequestError(`Invalid provider type: ${providerType}`);
      }
      
      // Get Instagram configuration
      const instagramConfig = this.getInstagramConfig();
      
      // Create Instagram OAuth service
      const instagramService = new InstagramOAuthService(
        instagramConfig.clientId,
        instagramConfig.clientSecret,
        instagramConfig.redirectUri
      );

      // Connect account with providerType
      const result = await instagramService.connectAccount({
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        providerType: consumedState.providerType,
        code,
        state,
        ipAddress: clientIp,
      });

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = result.saved.length > 0;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] Instagram accounts connected', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        providerType: consumedState.providerType,
        accountsConnected: result.saved.length,
        accountsFailed: result.failed.length,
        duration,
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=instagram&count=${result.saved.length}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Instagram callback completed', { step: 'instagram_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] Instagram callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        providerType: consumedState.providerType,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'instagram',
        action: 'callback',
        success: false,
        errorMessage: error.message,
        metadata: {
          providerType: consumedState.providerType,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Instagram callback error handled', { step: 'instagram_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=INSTAGRAM_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle YouTube OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   */
  private async handleYouTubeCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { YouTubeOAuthService } = await import('../services/oauth/YouTubeOAuthService');
    
    // State already consumed by main callback handler - no need to consume again
    if (!consumedState) {
      logger.warn('[OAuth] YouTube callback - invalid or expired state', {
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      // Log replay attempt
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'youtube',
        action: 'callback',
        success: false,
        errorMessage: 'Invalid or expired state - possible replay attack',
        metadata: {
          errorCode: OAuthErrorCode.STATE_INVALID,
          state: state.substring(0, 10) + '...',
          replayAttempt: true,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] YouTube state validation failed', { step: 'youtube_state_validation' });
      return res.redirect(
        `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }
    
    try {
      logger.debug('[OAuth] YouTube callback initiated', { step: 'youtube_callback' });
      
      // Get YouTube configuration
      const youtubeConfig = this.getYouTubeConfig();
      
      // Create YouTube OAuth service
      const youtubeService = new YouTubeOAuthService(
        youtubeConfig.clientId,
        youtubeConfig.clientSecret,
        youtubeConfig.redirectUri
      );

      // Connect account
      const result = await youtubeService.connectAccount({
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        code,
        state,
        ipAddress: clientIp,
      });

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = true;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] YouTube account connected', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: result.account._id,
        duration,
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=youtube&account=${result.account._id}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] YouTube callback completed', { step: 'youtube_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] YouTube callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'youtube',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] YouTube callback error handled', { step: 'youtube_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=YOUTUBE_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle LinkedIn OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   */
  private async handleLinkedInCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { LinkedInOAuthService } = await import('../services/oauth/LinkedInOAuthService');
    
    // State already consumed by main callback handler - no need to consume again
    if (!consumedState) {
      logger.warn('[OAuth] LinkedIn callback - invalid or expired state', {
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      // Log replay attempt
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'linkedin',
        action: 'callback',
        success: false,
        errorMessage: 'Invalid or expired state - possible replay attack',
        metadata: {
          errorCode: OAuthErrorCode.STATE_INVALID,
          state: state.substring(0, 10) + '...',
          replayAttempt: true,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] LinkedIn state validation failed', { step: 'linkedin_state_validation' });
      return res.redirect(
        `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }
    
    try {
      logger.debug('[OAuth] LinkedIn callback initiated', { step: 'linkedin_callback' });
      
      // Get LinkedIn configuration
      const linkedinConfig = this.getLinkedInConfig();
      
      // Create LinkedIn OAuth service
      const linkedinService = new LinkedInOAuthService(
        linkedinConfig.clientId,
        linkedinConfig.clientSecret,
        linkedinConfig.redirectUri
      );

      // Connect account
      const result = await linkedinService.connectAccount({
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        code,
        state,
        ipAddress: clientIp,
      });

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = true;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] LinkedIn account connected', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: result.account._id,
        duration,
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=linkedin&account=${result.account._id}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] LinkedIn callback completed', { step: 'linkedin_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] LinkedIn callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'linkedin',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] LinkedIn callback error handled', { step: 'linkedin_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=LINKEDIN_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle Threads OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   */
  private async handleThreadsCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { ThreadsOAuthService } = await import('../services/oauth/ThreadsOAuthService');
    
    // State already consumed by main callback handler - no need to consume again
    if (!consumedState) {
      logger.warn('[OAuth] Threads callback - invalid or expired state', {
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      // Log replay attempt
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'threads',
        action: 'callback',
        success: false,
        errorMessage: 'Invalid or expired state - possible replay attack',
        metadata: {
          errorCode: OAuthErrorCode.STATE_INVALID,
          state: state.substring(0, 10) + '...',
          replayAttempt: true,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Threads state validation failed', { step: 'threads_state_validation' });
      return res.redirect(
        `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }
    
    try {
      logger.debug('[OAuth] Threads callback initiated', { step: 'threads_callback' });
      
      // Get Threads configuration
      const threadsConfig = this.getThreadsConfig();
      
      // Create Threads OAuth service
      const threadsService = new ThreadsOAuthService(
        threadsConfig.clientId,
        threadsConfig.clientSecret,
        threadsConfig.redirectUri
      );

      // Connect account
      const result = await threadsService.connectAccount({
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        code,
        state,
        ipAddress: clientIp,
      });

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = true;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] Threads account connected', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: result.account._id,
        duration,
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=threads&account=${result.account._id}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Threads callback completed', { step: 'threads_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] Threads callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'threads',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Threads callback error handled', { step: 'threads_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=THREADS_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle Google Business Profile OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   */
  private async handleGoogleBusinessCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { GoogleBusinessOAuthService } = await import('../services/oauth/GoogleBusinessOAuthService');
    
    // State already consumed by main callback handler - no need to consume again
    if (!consumedState) {
      logger.warn('[OAuth] Google Business callback - invalid or expired state', {
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      // Log replay attempt
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'google-business',
        action: 'callback',
        success: false,
        errorMessage: 'Invalid or expired state - possible replay attack',
        metadata: {
          errorCode: OAuthErrorCode.STATE_INVALID,
          state: state.substring(0, 10) + '...',
          replayAttempt: true,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Google Business state validation failed', { step: 'google_business_state_validation' });
      return res.redirect(
        `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }
    
    try {
      logger.debug('[OAuth] Google Business callback initiated', { step: 'google_business_callback' });
      
      // Get Google Business configuration
      const gbpConfig = this.getGoogleBusinessConfig();
      
      // Create Google Business OAuth service
      const gbpService = new GoogleBusinessOAuthService(
        gbpConfig.clientId,
        gbpConfig.clientSecret,
        gbpConfig.redirectUri
      );

      // Connect account
      const result = await gbpService.connectAccount({
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        code,
        state,
        ipAddress: clientIp,
      });

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = true;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] Google Business account connected', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: result.account._id,
        locationCount: result.locations.length,
        duration,
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=google-business&account=${result.account._id}&locations=${result.locations.length}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Google Business callback completed', { step: 'google_business_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] Google Business callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'google-business',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Google Business callback error handled', { step: 'google_business_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=GOOGLE_BUSINESS_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle Google OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   */
  private async handleGoogleCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    stateData: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    try {
      // Get Google configuration
      const googleConfig = this.getGoogleConfig();

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: googleConfig.clientId,
          client_secret: googleConfig.clientSecret,
          redirect_uri: googleConfig.redirectUri,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokens = await tokenResponse.json() as { access_token: string; refresh_token?: string };

      // Get user profile
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error(`Profile fetch failed: ${profileResponse.statusText}`);
      }

      const profile = await profileResponse.json() as { email: string; name: string; id: string };

      // For Google OAuth, we're using it for user authentication, not social account connection
      // So we redirect to a success page or handle login
      const frontendUrl = config.frontend.url;
      
      res.redirect(
        `${frontendUrl}/auth/oauth-success?platform=google&email=${encodeURIComponent(profile.email)}&name=${encodeURIComponent(profile.name)}`
      );
    } catch (error: any) {
      logger.error('Google OAuth callback failed', {
        error: error.message,
        code,
        state: state.substring(0, 10) + '...',
      });
      
      const frontendUrl = config.frontend.url;
      res.redirect(
        `${frontendUrl}/auth/login?error=GOOGLE_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle GitHub OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   */
  private async handleGitHubCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    try {
      logger.debug('[OAuth] GitHub callback handler started', { step: 'github_callback_start' });

      // Get GitHub configuration
      const githubConfig = this.getGitHubConfig();

      // Create GitHub OAuth provider
      const { GitHubOAuthProvider } = await import('../providers/oauth/GitHubOAuthProvider');
      const githubProvider = new GitHubOAuthProvider(
        githubConfig.clientId,
        githubConfig.clientSecret,
        githubConfig.redirectUri
      );

      // Exchange code for tokens
      const tokens = await githubProvider.exchangeCodeForTokenLegacy({ code, state });
      logger.debug('[OAuth] GitHub token exchange successful', { step: 'github_token_exchange' });

      // Get user profile
      const userProfile = await githubProvider.getUserProfile(tokens.accessToken);
      logger.debug('[OAuth] GitHub user profile fetched', { step: 'github_profile_fetch' });

      // Create or update social account
      const socialAccount = await SocialAccount.findOneAndUpdate(
        {
          workspaceId: consumedState.workspaceId,
          platform: SocialPlatform.GITHUB,
          platformUserId: userProfile.id,
        },
        {
          workspaceId: consumedState.workspaceId,
          userId: consumedState.userId,
          platform: SocialPlatform.GITHUB,
          platformUserId: userProfile.id,
          username: userProfile.username,
          displayName: userProfile.displayName,
          email: userProfile.email,
          profileImageUrl: userProfile.avatarUrl,
          profileUrl: userProfile.profileUrl,
          accessToken: encrypt(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
          tokenExpiresAt: tokens.expiresAt,
          status: AccountStatus.ACTIVE,
          isActive: true,
          connectedAt: new Date(),
          lastRefreshedAt: new Date(),
          metadata: {
            ...userProfile.metadata,
            scopes: tokens.scope,
          },
        },
        { upsert: true, new: true }
      );

      logger.info('[OAuth] GitHub account connected successfully', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: socialAccount._id,
        username: userProfile.username,
      });

      // Log success
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'github',
        action: 'callback',
        success: true,
        metadata: {
          accountId: socialAccount._id.toString(),
          username: userProfile.username,
        },
      });

      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=github&account=${socialAccount._id}`;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] GitHub callback success redirect', { step: 'github_success_redirect' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] GitHub callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'github',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] GitHub callback error handled', { step: 'github_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=GITHUB_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle Apple OAuth callback
   * 
   * SECURITY: State already consumed by main callback handler
   * NOTE: Apple uses POST callback, not GET
   */
  private async handleAppleCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    try {
      logger.debug('[OAuth] Apple callback handler started', { step: 'apple_callback_start' });

      // Get Apple configuration
      const appleConfig = this.getAppleConfig();

      // Create Apple OAuth provider
      const { AppleOAuthProvider } = await import('../providers/oauth/AppleOAuthProvider');
      const appleProvider = new AppleOAuthProvider(
        appleConfig.clientId,
        appleConfig.teamId,
        appleConfig.keyId,
        appleConfig.privateKey,
        appleConfig.redirectUri
      );

      // Get PKCE verifier from state
      const codeVerifier = consumedState.codeVerifier;
      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found in state');
      }

      // Exchange code for tokens
      const tokens = await appleProvider.exchangeCodeForTokenLegacy({ code, state, codeVerifier });
      logger.debug('[OAuth] Apple token exchange successful', { step: 'apple_token_exchange' });

      // Get user profile from ID token
      const idToken = (req.body as any).id_token || tokens.accessToken; // Apple sends id_token in callback
      const userProfile = await appleProvider.getUserProfile(tokens.accessToken, idToken);
      logger.debug('[OAuth] Apple user profile extracted', { step: 'apple_profile_extract' });

      // Create or update social account
      const socialAccount = await SocialAccount.findOneAndUpdate(
        {
          workspaceId: consumedState.workspaceId,
          platform: SocialPlatform.APPLE,
          platformUserId: userProfile.id,
        },
        {
          workspaceId: consumedState.workspaceId,
          userId: consumedState.userId,
          platform: SocialPlatform.APPLE,
          platformUserId: userProfile.id,
          username: userProfile.username,
          displayName: userProfile.displayName,
          email: userProfile.email,
          profileImageUrl: userProfile.avatarUrl,
          profileUrl: userProfile.profileUrl,
          accessToken: encrypt(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
          tokenExpiresAt: tokens.expiresAt,
          status: AccountStatus.ACTIVE,
          isActive: true,
          connectedAt: new Date(),
          lastRefreshedAt: new Date(),
          metadata: {
            ...userProfile.metadata,
            scopes: tokens.scope,
          },
        },
        { upsert: true, new: true }
      );

      logger.info('[OAuth] Apple account connected successfully', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: socialAccount._id,
        hasEmail: !!userProfile.email,
      });

      // Log success
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'apple',
        action: 'callback',
        success: true,
        metadata: {
          accountId: socialAccount._id.toString(),
          hasEmail: !!userProfile.email,
        },
      });

      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=apple&account=${socialAccount._id}`;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Apple callback success redirect', { step: 'apple_success_redirect' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] Apple callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'apple',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Apple callback error handled', { step: 'apple_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=APPLE_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle TikTok OAuth callback with PKCE
   */
  private async handleTikTokCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { TikTokOAuthService } = await import('../services/oauth/TikTokOAuthService');
    
    // State already consumed by main callback handler - no need to consume again
    if (!consumedState) {
      logger.warn('[OAuth] TikTok callback - invalid or expired state', {
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      // Log replay attempt
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'tiktok',
        action: 'callback',
        success: false,
        errorMessage: 'Invalid or expired state - possible replay attack',
        metadata: {
          errorCode: OAuthErrorCode.STATE_INVALID,
          state: state.substring(0, 10) + '...',
          replayAttempt: true,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] TikTok state validation failed', { step: 'tiktok_state_validation' });
      return res.redirect(
        `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }
    
    try {
      logger.debug('[OAuth] TikTok callback initiated', { step: 'tiktok_callback' });
      
      // Get TikTok configuration
      const tiktokConfig = this.getTikTokConfig();
      
      // Create TikTok OAuth service
      const tiktokService = new TikTokOAuthService(
        tiktokConfig.clientKey,
        tiktokConfig.clientSecret,
        tiktokConfig.redirectUri
      );

      // Get PKCE verifier from state
      const codeVerifier = consumedState.codeVerifier;
      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found in state');
      }

      // Connect account with PKCE
      const result = await tiktokService.connectAccount({
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        code,
        state,
        codeVerifier,
        ipAddress: clientIp,
      });

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = true;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] TikTok account connected', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: result.account._id,
        duration,
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=tiktok&account=${result.account._id}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] TikTok callback completed', { step: 'tiktok_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] TikTok callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'tiktok',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] TikTok callback error handled', { step: 'tiktok_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=TIKTOK_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * Handle Pinterest OAuth callback
   */
  private async handlePinterestCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    code: string,
    state: string,
    consumedState: any,
    clientIp: string,
    ipHash: string,
    debugReport: any,
    startTime: number
  ): Promise<void> {
    const { PinterestOAuthService } = await import('../services/oauth/PinterestOAuthService');
    
    // State already consumed by main callback handler - no need to consume again
    if (!consumedState) {
      logger.warn('[OAuth] Pinterest callback - invalid or expired state', {
        state: state.substring(0, 10) + '...',
        ipHash,
      });

      // Log replay attempt
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'pinterest',
        action: 'callback',
        success: false,
        errorMessage: 'Invalid or expired state - possible replay attack',
        metadata: {
          errorCode: OAuthErrorCode.STATE_INVALID,
          state: state.substring(0, 10) + '...',
          replayAttempt: true,
        },
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Pinterest state validation failed', { step: 'pinterest_state_validation' });
      return res.redirect(
        `${frontendUrl}/social/accounts?error=${OAuthErrorCode.STATE_INVALID}&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }
    
    try {
      logger.debug('[OAuth] Pinterest callback initiated', { step: 'pinterest_callback' });
      
      // Get Pinterest configuration
      const pinterestConfig = this.getPinterestConfig();
      
      // Create Pinterest OAuth service
      const pinterestService = new PinterestOAuthService(
        pinterestConfig.clientId,
        pinterestConfig.clientSecret,
        pinterestConfig.redirectUri
      );

      // Connect account
      const account = await pinterestService.handleCallback(
        code,
        state,
        consumedState.userId,
        consumedState.workspaceId
      );

      debugReport.tokenExchangeSuccess = true;
      debugReport.userFetched = true;
      debugReport.dbInsertSuccess = true;

      const duration = Date.now() - startTime;
      logger.info('[OAuth] Pinterest account connected', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        accountId: account._id,
        username: account.accountName,
        duration,
      });

      // Log success
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_SUCCESS,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'pinterest',
        action: 'callback',
        success: true,
        metadata: {
          accountId: account._id,
          username: account.accountName,
          duration,
        },
      });

      // Redirect to frontend with success
      const frontendUrl = config.cors.origin;
      const redirectUrl = `${frontendUrl}/social/accounts?success=true&platform=pinterest&account=${account._id}`;
      
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Pinterest callback completed', { step: 'pinterest_callback_complete' });
      
      res.redirect(redirectUrl);
    } catch (error: any) {
      logger.error('[OAuth] Pinterest callback failed', {
        workspaceId: consumedState.workspaceId,
        userId: consumedState.userId,
        error: error.message,
      });

      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_CONNECT_FAILURE,
        userId: consumedState.userId,
        workspaceId: consumedState.workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'pinterest',
        action: 'callback',
        success: false,
        errorMessage: error.message,
      });

      const frontendUrl = config.cors.origin;
      debugReport.finalResponseStatus = 302;
      logger.debug('[OAuth] Pinterest callback error handled', { step: 'pinterest_error_handler' });
      
      res.redirect(
        `${frontendUrl}/social/accounts?error=PINTEREST_OAUTH_FAILED&message=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * GET /api/v1/oauth/instagram/connect-options
   * 
   * Get Instagram connection options (Business vs Basic Display)
   * Rate limit: 100 requests/min per IP
   */
  async getInstagramConnectOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { InstagramOAuthService } = await import('../services/oauth/InstagramOAuthService');
      
      // Get Instagram configuration (just to check if configured)
      const instagramConfig = this.getInstagramConfig();
      
      // Create service instance
      const instagramService = new InstagramOAuthService(
        instagramConfig.clientId,
        instagramConfig.clientSecret,
        instagramConfig.redirectUri
      );

      // Get connection options (static configuration)
      const options = instagramService.getConnectionOptions();

      logger.debug('[OAuth] Instagram connection options requested');

      res.json({
        success: true,
        ...options,
      });
      return;
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/oauth/instagram/connect
   * 
   * Initiate Instagram OAuth flow with provider type selection
   * Rate limit: 10 requests/min per user
   */
  async connectInstagram(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { providerType } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();
      const clientIp = getClientIp(req);
      const ipHash = getHashedClientIp(req);

      // Validate authentication
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Validate providerType
      if (!providerType || (providerType !== 'INSTAGRAM_BUSINESS' && providerType !== 'INSTAGRAM_BASIC')) {
        throw new BadRequestError('Invalid provider type. Must be INSTAGRAM_BUSINESS or INSTAGRAM_BASIC');
      }

      const { InstagramOAuthService } = await import('../services/oauth/InstagramOAuthService');
      
      // Get Instagram configuration
      const instagramConfig = this.getInstagramConfig();
      
      // Create service instance
      const instagramService = new InstagramOAuthService(
        instagramConfig.clientId,
        instagramConfig.clientSecret,
        instagramConfig.redirectUri
      );

      // Generate and store state in Redis (same pattern as Twitter/Facebook)
      const state = await oauthStateService.createState(workspaceId, userId, 'instagram', {
        providerType, // CRITICAL: Store providerType for callback validation
        ipHash,
        metadata: {
          platform: 'instagram',
          providerType,
          timestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
        },
      });

      // Initiate OAuth flow with provider type
      const { url } = await instagramService.initiateOAuth(providerType);

      // DEBUG: Log the state
      console.log('=== OAUTH INITIATION DEBUG ===');
      console.log('State from createState:', state);
      console.log('==============================');

      // Replace the provider's state in the URL with our state
      const urlObj = new URL(url);
      urlObj.searchParams.set('state', state);
      const authorizationUrl = urlObj.toString();

      // Log OAuth initiation
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_INITIATED,
        userId,
        workspaceId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        resource: 'instagram',
        action: 'connect',
        success: true,
        metadata: {
          platform: 'instagram',
          providerType,
          state: state.substring(0, 10) + '...',
          ipBound: true,
          duration: Date.now() - startTime,
        },
      });

      logger.info('[OAuth] Instagram connection initiated', {
        workspaceId,
        userId,
        providerType,
        state: state.substring(0, 10) + '...',
        duration: Date.now() - startTime,
      });

      // Return authorization URL
      res.json({
        success: true,
        authorizationUrl,
        state,
        providerType,
        platform: 'instagram',
      });
    } catch (error) {
      // Log failure
      await securityAuditService.logEvent({
        type: SecurityEventType.OAUTH_INITIATED,
        userId: req.user?.userId?.toString(),
        workspaceId: req.workspace?.workspaceId.toString(),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        resource: 'instagram',
        action: 'connect',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          duration: Date.now() - startTime,
        },
      });

      next(error);
    }
  }

  /**
   * Finalize multi-account connection (stub for future)
   * POST /api/v1/oauth/:platform/finalize
   */
  async finalize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Multi-account finalization not yet implemented',
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Test Twitter publish endpoint
   * POST /api/v1/test/twitter-publish
   *
   * Publishes a test tweet using stored credentials
   */
  async testTwitterPublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();

    try {
      const { text } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();

      // Validate authentication
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Validate request body
      if (!text || typeof text !== 'string') {
        throw new BadRequestError('Tweet text is required');
      }

      if (text.length > 280) {
        throw new BadRequestError('Tweet text exceeds 280 characters');
      }

      // Find active Twitter account for workspace
      const account = await SocialAccount.findOne({
        workspaceId,
        provider: 'twitter' as SocialPlatform,
        status: AccountStatus.ACTIVE,
      }).select('+accessToken');

      if (!account) {
        throw new BadRequestError('No active Twitter account found. Please connect a Twitter account first.');
      }

      // Decrypt access token
      const accessToken = account.getDecryptedAccessToken();

      // Publish tweet via Twitter API
      const tweetResponse = await axios.post(
        'https://api.twitter.com/2/tweets',
        { text },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const duration = Date.now() - startTime;

      logger.info('[OAuth] Test tweet published successfully', {
        workspaceId,
        userId,
        accountId: account._id,
        tweetId: tweetResponse.data.data.id,
        duration,
      });

      // Return success response
      res.json({
        success: true,
        tweet: {
          id: tweetResponse.data.data.id,
          text: tweetResponse.data.data.text,
        },
        account: {
          id: account._id,
          username: account.metadata?.username,
          displayName: account.accountName,
        },
      });
      return;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('[OAuth] Test tweet publish failed', {
        workspaceId: req.workspace?.workspaceId.toString(),
        userId: req.user?.userId.toString(),
        error: error.response?.data || error.message,
        duration,
      });

      // Handle Twitter API errors
      if (error.response?.status === 401) {
        return next(new UnauthorizedError('Twitter access token expired. Please reconnect your account.'));
      }

      if (error.response?.status === 403) {
        return next(new BadRequestError('Twitter access denied. Please check your account permissions.'));
      }

      if (error.response?.status === 429) {
        return next(new BadRequestError('Twitter rate limit exceeded. Please try again later.'));
      }

      if (error.response?.data) {
        return next(new BadRequestError(`Twitter API error: ${error.response.data.detail || error.response.data.title || 'Unknown error'}`));
      }

      next(error);
    }
  }

  /**
   * GET /api/v1/oauth/status/:workspaceId
   * Get OAuth connection status for all platforms in a workspace
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.params;

      // Validate authentication
      if (!req.user?.userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get all social accounts for workspace
      const accounts = await SocialAccount.find({
        workspaceId,
        status: { $ne: AccountStatus.DISCONNECTED },
      }).select('platform accountName status tokenExpiresAt createdAt lastSyncAt metadata');

      // Map to status format
      const connectionStatus = accounts.map((account) => ({
        platform: account.provider,
        accountName: account.accountName,
        status: account.status,
        isConnected: account.status === AccountStatus.ACTIVE,
        connectedAt: account.createdAt,
        lastSync: account.lastSyncAt,
        tokenExpiry: account.tokenExpiresAt,
        username: account.metadata?.username || account.accountName,
        profileImageUrl: account.metadata?.avatarUrl,
      }));

      // Get platforms that are not connected
      const connectedPlatforms = new Set(accounts.map((a) => a.provider));
      const allPlatforms = Object.values(SocialPlatform);
      const notConnected = allPlatforms.filter((p) => !connectedPlatforms.has(p));

      res.json({
        success: true,
        data: {
          connected: connectionStatus,
          notConnected,
          totalConnected: connectionStatus.length,
          totalPlatforms: allPlatforms.length,
        },
      });
      return;

      logger.debug('OAuth status retrieved', {
        workspaceId,
        connectedCount: connectionStatus.length,
      });
    } catch (error: any) {
      logger.error('Failed to get OAuth status', {
        error: error.message,
        workspaceId: req.params.workspaceId,
      });

      next(error);
    }
  }


    /**
     * Get OAuth session status by sessionId
     * GET /api/v1/oauth/:platform/session-status?sessionId=xxx
     */
    async getSessionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { platform } = req.params;
        const { sessionId } = req.query;

        if (!sessionId || typeof sessionId !== 'string') {
          res.status(400).json({
            success: false,
            error: 'MISSING_SESSION_ID',
            message: 'Session ID is required',
          });
          return;
        }

        // Retrieve session from Redis using the state as the key
        // The sessionId is actually the OAuth state parameter
        const stateData = await oauthStateService.validateState(sessionId);

        if (!stateData) {
          res.status(404).json({
            success: false,
            error: 'SESSION_NOT_FOUND',
            message: 'OAuth session not found or expired',
            data: {
              status: 'expired',
              platform,
            },
          });
          return;
        }

        // Check if session has expired
        const now = new Date();
        const expiresAt = new Date(stateData.expiresAt);
        const isExpired = now > expiresAt;

        res.json({
          success: true,
          data: {
            sessionId: stateData.state,
            platform: stateData.platform,
            status: isExpired ? 'expired' : 'pending',
            initiatedAt: stateData.createdAt,
            expiresAt: stateData.expiresAt,
            workspaceId: stateData.workspaceId,
          },
        });
        return;

        logger.debug('OAuth session status retrieved', {
          sessionId: String(sessionId).substring(0, 10) + '...',
          platform: stateData.platform,
          status: isExpired ? 'expired' : 'pending',
        });
      } catch (error: any) {
        logger.error('Failed to get OAuth session status', {
          error: error.message,
          platform: req.params.platform,
          sessionId: req.query.sessionId,
        });

        next(error);
      }
    }

    /**
     * Resume a failed OAuth session
     * POST /api/v1/oauth/:platform/resume
     * Body: { sessionId: string }
     */
    async resumeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { platform } = req.params;
        const { sessionId } = req.body;

        // Validate authentication
        if (!req.user?.userId) {
          throw new UnauthorizedError('Authentication required');
        }

        if (!sessionId || typeof sessionId !== 'string') {
          res.status(400).json({
            success: false,
            error: 'MISSING_SESSION_ID',
            message: 'Session ID is required',
          });
          return;
        }

        // Retrieve session from Redis
        const stateData = await oauthStateService.validateState(sessionId);

        if (!stateData) {
          res.status(404).json({
            success: false,
            error: 'SESSION_NOT_FOUND',
            message: 'OAuth session not found or expired. Please start a new connection.',
          });
          return;
        }

        // Validate session hasn't expired
        const now = new Date();
        const expiresAt = new Date(stateData.expiresAt);

        if (now > expiresAt) {
          res.status(410).json({
            success: false,
            error: 'SESSION_EXPIRED',
            message: 'OAuth session has expired. Please start a new connection.',
            data: {
              expiresAt: stateData.expiresAt,
            },
          });
          return;
        }

        // Validate platform matches
        if (stateData.platform !== platform) {
          res.status(400).json({
            success: false,
            error: 'PLATFORM_MISMATCH',
            message: `Session is for ${stateData.platform}, not ${platform}`,
          });
          return;
        }

        // Validate user owns this session
        if (stateData.userId !== req.user.userId) {
          res.status(403).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'You do not have permission to resume this session',
          });
          return;
        }

        // Regenerate auth URL with the same state parameter
        // This allows the user to retry the OAuth flow
        let authUrl: string;

        switch (platform) {
          case 'twitter': {
            const config = this.getTwitterConfig();
            const params = new URLSearchParams({
              response_type: 'code',
              client_id: config.clientId,
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(' '),
              state: stateData.state,
              code_challenge: stateData.codeVerifier
                ? crypto.createHash('sha256').update(stateData.codeVerifier).digest('base64url')
                : '',
              code_challenge_method: 'S256',
            });
            authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
            break;
          }

          case 'facebook': {
            const config = this.getFacebookConfig();
            const params = new URLSearchParams({
              client_id: config.clientId,
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(','),
              state: stateData.state,
              response_type: 'code',
            });
            authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
            break;
          }

          case 'instagram': {
            const config = this.getInstagramConfig();
            const params = new URLSearchParams({
              client_id: config.clientId,
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(','),
              state: stateData.state,
              response_type: 'code',
            });
            authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
            break;
          }

          case 'youtube': {
            const config = this.getYouTubeConfig();
            const params = new URLSearchParams({
              client_id: config.clientId,
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(' '),
              state: stateData.state,
              response_type: 'code',
              access_type: 'offline',
              prompt: 'consent',
            });
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
            break;
          }

          case 'linkedin': {
            const config = this.getLinkedInConfig();
            const params = new URLSearchParams({
              response_type: 'code',
              client_id: config.clientId,
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(' '),
              state: stateData.state,
            });
            authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
            break;
          }

          case 'threads': {
            const config = this.getThreadsConfig();
            const params = new URLSearchParams({
              client_id: config.clientId,
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(','),
              state: stateData.state,
              response_type: 'code',
            });
            authUrl = `https://threads.net/oauth/authorize?${params.toString()}`;
            break;
          }

          case 'google-business': {
            const config = this.getGoogleBusinessConfig();
            const params = new URLSearchParams({
              client_id: config.clientId,
              redirect_uri: config.redirectUri,
              scope: config.scopes.join(' '),
              state: stateData.state,
              response_type: 'code',
              access_type: 'offline',
              prompt: 'consent',
            });
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
            break;
          }

          default:
            res.status(400).json({
              success: false,
              error: 'UNSUPPORTED_PLATFORM',
              message: `Platform ${platform} is not supported for session resume`,
            });
            return;
        }

        res.json({
          success: true,
          data: {
            authUrl,
            sessionId: stateData.state,
            platform: stateData.platform,
            expiresAt: stateData.expiresAt,
          },
        });
        return;

        logger.info('OAuth session resumed', {
          sessionId: sessionId.substring(0, 10) + '...',
          platform: stateData.platform,
          userId: req.user.userId,
          workspaceId: stateData.workspaceId,
        });
      } catch (error: any) {
        logger.error('Failed to resume OAuth session', {
          error: error.message,
          platform: req.params.platform,
          sessionId: req.body.sessionId,
        });

        next(error);
      }
    }

}

export const oauthController = new OAuthController();

