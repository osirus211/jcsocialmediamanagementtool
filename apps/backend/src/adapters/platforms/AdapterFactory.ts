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
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get client ID for platform from environment variables
   */
  private static getClientId(platform: SocialPlatform): string {
    const envVarMap: Record<SocialPlatform, string> = {
      facebook: 'FACEBOOK_APP_ID',
      instagram: 'FACEBOOK_APP_ID', // Instagram uses Facebook OAuth
      twitter: 'TWITTER_CLIENT_ID',
      linkedin: 'LINKEDIN_CLIENT_ID',
      tiktok: 'TIKTOK_CLIENT_KEY',
    };

    const envVar = envVarMap[platform];
    const value = process.env[envVar];

    if (!value) {
      throw new Error(`Missing environment variable: ${envVar}`);
    }

    return value;
  }

  /**
   * Get client secret for platform from environment variables
   */
  private static getClientSecret(platform: SocialPlatform): string {
    const envVarMap: Record<SocialPlatform, string> = {
      facebook: 'FACEBOOK_APP_SECRET',
      instagram: 'FACEBOOK_APP_SECRET', // Instagram uses Facebook OAuth
      twitter: 'TWITTER_CLIENT_SECRET',
      linkedin: 'LINKEDIN_CLIENT_SECRET',
      tiktok: 'TIKTOK_CLIENT_SECRET',
    };

    const envVar = envVarMap[platform];
    const value = process.env[envVar];

    if (!value) {
      throw new Error(`Missing environment variable: ${envVar}`);
    }

    return value;
  }

  /**
   * Get redirect URI for platform from environment variables
   */
  private static getRedirectUri(platform: SocialPlatform): string {
    const baseUrl = process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/v1/channels/oauth/callback/${platform}`;
  }

  /**
   * Check if platform is supported
   */
  static isSupportedPlatform(platform: string): platform is SocialPlatform {
    return ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'].includes(platform);
  }

  /**
   * Get all supported platforms
   */
  static getSupportedPlatforms(): SocialPlatform[] {
    return ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'];
  }
}
