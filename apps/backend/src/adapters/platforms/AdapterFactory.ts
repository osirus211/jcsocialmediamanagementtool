/**
 * Adapter Factory
 * 
 * Factory for creating platform-specific OAuth adapters
 * Provides dynamic resolution of adapters based on platform name
 */

import { PlatformAdapter, SocialPlatform } from './PlatformAdapter';
import { FacebookOAuthProvider } from '../../services/oauth/FacebookOAuthProvider';
import { InstagramBusinessProvider } from '../../services/oauth/InstagramBusinessProvider';
import { TwitterOAuthProvider } from '../../services/oauth/TwitterOAuthProvider';
import { LinkedInOAuthProvider } from '../../services/oauth/LinkedInOAuthProvider';
import { TikTokProvider } from '../../services/oauth/TikTokProvider';
import { ThreadsAdapter } from './ThreadsAdapter';
import { BlueskyAdapter } from './BlueskyAdapter';
import { YouTubeAdapter } from './YouTubeAdapter';
import { PinterestAdapter } from './PinterestAdapter';
import { GoogleBusinessAdapter } from './GoogleBusinessAdapter';
import { config } from '../../config';

export class AdapterFactory {
  /**
   * Get platform adapter by platform name
   * @param platform - Platform name (facebook, instagram, twitter, linkedin, tiktok)
   * @returns Platform adapter instance
   * @throws Error if platform is not supported
   */
  static getAdapter(platform: SocialPlatform): PlatformAdapter {
    const clientId = this.getClientId(platform);
    const clientSecret = this.getClientSecret(platform);
    const redirectUri = this.getRedirectUri(platform);

    switch (platform) {
      case 'facebook':
        return new FacebookOAuthProvider(clientId, clientSecret, redirectUri);
      
      case 'instagram':
        return new InstagramBusinessProvider(clientId, clientSecret, redirectUri);
      
      case 'twitter':
        return new TwitterOAuthProvider(clientId, clientSecret, redirectUri);
      
      case 'linkedin':
        return new LinkedInOAuthProvider(clientId, clientSecret, redirectUri);
      
      case 'tiktok':
        return new TikTokProvider(clientId, clientSecret, redirectUri);
      
      case 'threads':
        return new ThreadsAdapter(clientId, clientSecret) as any;
      
      case 'bluesky':
        return new BlueskyAdapter() as any;
      
      case 'youtube':
        return new YouTubeAdapter() as any;
      
      case 'pinterest':
        return new PinterestAdapter(clientId, clientSecret, redirectUri) as any;
      
      case 'google-business':
        return new GoogleBusinessAdapter(clientId, clientSecret, redirectUri) as any;
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get client ID for platform from environment variables
   */
  private static getClientId(platform: SocialPlatform): string {
    const configMap: Record<SocialPlatform, string | undefined> = {
      facebook: config.oauth.facebook.appId,
      instagram: config.oauth.facebook.appId, // Instagram uses Facebook OAuth
      twitter: config.oauth.twitter.clientId,
      linkedin: config.oauth.linkedin.clientId,
      tiktok: config.oauth.tiktok.clientKey,
      threads: config.oauth.facebook.appId, // Threads uses Facebook OAuth
      bluesky: undefined, // No OAuth config needed
      youtube: undefined, // No OAuth config needed
      pinterest: config.oauth.pinterest.appId,
      'google-business': undefined, // No OAuth config needed
    };

    const value = configMap[platform];

    if (!value) {
      throw new Error(`Missing configuration for platform: ${platform}`);
    }

    return value;
  }

  /**
   * Get client secret for platform from environment variables
   */
  private static getClientSecret(platform: SocialPlatform): string {
    const configMap: Record<SocialPlatform, string | undefined> = {
      facebook: config.oauth.facebook.appSecret,
      instagram: config.oauth.facebook.appSecret, // Instagram uses Facebook OAuth
      twitter: config.oauth.twitter.clientSecret,
      linkedin: config.oauth.linkedin.clientSecret,
      tiktok: config.oauth.tiktok.clientSecret,
      threads: config.oauth.facebook.appSecret, // Threads uses Facebook OAuth
      bluesky: undefined, // No OAuth config needed
      youtube: undefined, // No OAuth config needed
      pinterest: config.oauth.pinterest.appSecret,
      'google-business': undefined, // No OAuth config needed
    };

    const value = configMap[platform];

    if (!value) {
      throw new Error(`Missing configuration for platform: ${platform}`);
    }

    return value;
  }

  /**
   * Get redirect URI for platform from environment variables
   */
  private static getRedirectUri(platform: SocialPlatform): string {
    const baseUrl = config.frontend.url;
    return `${baseUrl}/api/v1/channels/oauth/callback/${platform}`;
  }

  /**
   * Check if platform is supported
   */
  static isSupportedPlatform(platform: string): platform is SocialPlatform {
    return ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'threads', 'bluesky', 'youtube', 'pinterest', 'google-business'].includes(platform);
  }

  /**
   * Get all supported platforms
   */
  static getSupportedPlatforms(): SocialPlatform[] {
    return [
      'facebook', 
      'instagram', 
      'twitter', 
      'linkedin', 
      'tiktok', 
      'threads', 
      'bluesky', 
      'youtube', 
      'pinterest',
      'google-business'
    ];
  }
}
