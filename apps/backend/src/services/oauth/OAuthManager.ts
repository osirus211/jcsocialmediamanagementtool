/**
 * OAuth Manager
 * 
 * Central manager for all OAuth providers
 * Handles provider instantiation, state management, and OAuth flow coordination
 */

import { config } from '../../config';
import { SocialPlatform } from '../../models/SocialAccount';
import { OAuthProvider } from './OAuthProvider';
import { TwitterOAuthProvider } from './TwitterOAuthProvider';
import { LinkedInOAuthProvider } from './LinkedInOAuthProvider';
import { FacebookOAuthProvider } from './FacebookOAuthProvider';
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/errors';

export class OAuthManager {
  private providers: Map<SocialPlatform, OAuthProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize OAuth providers for all platforms
   */
  private initializeProviders(): void {
    const baseUrl = config.apiUrl || 'http://localhost:5000';

    logger.info('OAuth Manager initialized in PRODUCTION MODE');

    // Twitter
    if (config.oauth?.twitter?.clientId && config.oauth?.twitter?.clientSecret) {
      const redirectUri = config.oauth.twitter.callbackUrl || `${baseUrl}/api/v1/oauth/twitter/callback`;
      this.providers.set(
        SocialPlatform.TWITTER,
        new TwitterOAuthProvider(
          config.oauth.twitter.clientId,
          config.oauth.twitter.clientSecret,
          redirectUri
        )
      );
      logger.info('Twitter OAuth provider initialized');
    } else {
      logger.warn('Twitter OAuth credentials not configured');
    }

    // LinkedIn
    if (config.oauth?.linkedin?.clientId && config.oauth?.linkedin?.clientSecret) {
      const redirectUri = `${baseUrl}/api/v1/oauth/linkedin/callback`;
      this.providers.set(
        SocialPlatform.LINKEDIN,
        new LinkedInOAuthProvider(
          config.oauth.linkedin.clientId,
          config.oauth.linkedin.clientSecret,
          redirectUri
        )
      );
      logger.info('LinkedIn OAuth provider initialized');
    } else {
      logger.warn('LinkedIn OAuth credentials not configured');
    }

    // Facebook
    if (config.oauth?.facebook?.appId && config.oauth?.facebook?.appSecret) {
      const redirectUri = `${baseUrl}/api/v1/oauth/facebook/callback`;
      this.providers.set(
        SocialPlatform.FACEBOOK,
        new FacebookOAuthProvider(
          config.oauth.facebook.appId,
          config.oauth.facebook.appSecret,
          redirectUri
        )
      );
      logger.info('Facebook OAuth provider initialized');
    } else {
      logger.warn('Facebook OAuth credentials not configured');
    }

    // Instagram (uses Facebook Login)
    if (config.oauth?.instagram?.clientId && config.oauth?.instagram?.clientSecret) {
      const redirectUri = config.oauth.instagram.callbackUrl || `${baseUrl}/api/v1/oauth/instagram/callback`;
      const { InstagramBusinessProvider } = require('./InstagramBusinessProvider');
      this.providers.set(
        SocialPlatform.INSTAGRAM,
        new InstagramBusinessProvider(
          config.oauth.instagram.clientId,
          config.oauth.instagram.clientSecret,
          redirectUri
        )
      );
      logger.info('Instagram OAuth provider initialized');
    } else {
      logger.warn('Instagram OAuth credentials not configured');
    }

    // YouTube
    if (config.oauth?.youtube?.clientId && config.oauth?.youtube?.clientSecret) {
      const redirectUri = config.oauth.youtube.callbackUrl || `${baseUrl}/api/v1/oauth/youtube/callback`;
      const { YouTubeProvider } = require('./YouTubeProvider');
      this.providers.set(
        SocialPlatform.YOUTUBE,
        new YouTubeProvider(
          config.oauth.youtube.clientId,
          config.oauth.youtube.clientSecret,
          redirectUri
        )
      );
      logger.info('YouTube OAuth provider initialized');
    } else {
      logger.warn('YouTube OAuth credentials not configured');
    }

    // Threads
    if (config.oauth?.threads?.clientId && config.oauth?.threads?.clientSecret) {
      const redirectUri = config.oauth.threads.callbackUrl || `${baseUrl}/api/v1/oauth/threads/callback`;
      const { ThreadsProvider } = require('./ThreadsProvider');
      this.providers.set(
        SocialPlatform.THREADS,
        new ThreadsProvider(
          config.oauth.threads.clientId,
          config.oauth.threads.clientSecret,
          redirectUri
        )
      );
      logger.info('Threads OAuth provider initialized');
    } else {
      logger.warn('Threads OAuth credentials not configured');
    }

    // Google Business Profile
    if (config.oauth?.googleBusiness?.clientId && config.oauth?.googleBusiness?.clientSecret) {
      const redirectUri = config.oauth.googleBusiness.redirectUri || `${baseUrl}/api/v1/oauth/google-business/callback`;
      const { GoogleBusinessProvider } = require('./GoogleBusinessProvider');
      this.providers.set(
        SocialPlatform.GOOGLE_BUSINESS,
        new GoogleBusinessProvider(
          config.oauth.googleBusiness.clientId,
          config.oauth.googleBusiness.clientSecret,
          redirectUri
        )
      );
      logger.info('Google Business Profile OAuth provider initialized');
    } else {
      logger.warn('Google Business Profile OAuth credentials not configured');
    }
  }

  /**
   * Get provider for platform
   */
  getProvider(platform: SocialPlatform): OAuthProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new BadRequestError(`OAuth provider not configured for platform: ${platform}`);
    }
    return provider;
  }

  /**
   * Check if provider is available for platform
   */
  isProviderAvailable(platform: SocialPlatform): boolean {
    return this.providers.has(platform);
  }

  /**
   * Get list of available platforms
   */
  getAvailablePlatforms(): SocialPlatform[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
export const oauthManager = new OAuthManager();

