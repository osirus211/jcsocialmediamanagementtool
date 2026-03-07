/**
 * Platform Permissions Service
 * 
 * Provides platform-specific OAuth permission information
 */

import { SocialPlatform } from '../models/ScheduledPost';

export interface PlatformPermission {
  platform: SocialPlatform;
  permissions: string[];
  explanation: string;
  documentationLink: string;
  requiredScopes: string[];
  optionalScopes?: string[];
}

const PLATFORM_PERMISSIONS: Record<SocialPlatform, PlatformPermission> = {
  [SocialPlatform.TWITTER]: {
    platform: SocialPlatform.TWITTER,
    permissions: [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
    ],
    explanation: 'We need permission to read your profile, create tweets on your behalf, and maintain access when you\'re offline.',
    documentationLink: 'https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code',
    requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },

  [SocialPlatform.FACEBOOK]: {
    platform: SocialPlatform.FACEBOOK,
    permissions: [
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_show_list',
    ],
    explanation: 'We need permission to manage posts on your Facebook Pages, read engagement metrics, and access your list of Pages.',
    documentationLink: 'https://developers.facebook.com/docs/permissions/reference',
    requiredScopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
  },

  [SocialPlatform.INSTAGRAM]: {
    platform: SocialPlatform.INSTAGRAM,
    permissions: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
    ],
    explanation: 'We need permission to access your Instagram Business account, publish content, and read engagement metrics. Instagram requires connection through Facebook.',
    documentationLink: 'https://developers.facebook.com/docs/instagram-api/overview',
    requiredScopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'],
  },

  [SocialPlatform.LINKEDIN]: {
    platform: SocialPlatform.LINKEDIN,
    permissions: [
      'w_member_social',
      'r_liteprofile',
      'r_basicprofile',
    ],
    explanation: 'We need permission to post on your behalf and read your basic profile information.',
    documentationLink: 'https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication',
    requiredScopes: ['w_member_social', 'r_liteprofile'],
    optionalScopes: ['r_basicprofile'],
  },

  [SocialPlatform.TIKTOK]: {
    platform: SocialPlatform.TIKTOK,
    permissions: [
      'user.info.basic',
      'video.upload',
      'video.publish',
    ],
    explanation: 'We need permission to access your basic profile information and publish videos to your TikTok account.',
    documentationLink: 'https://developers.tiktok.com/doc/login-kit-web',
    requiredScopes: ['user.info.basic', 'video.upload', 'video.publish'],
  },

  [SocialPlatform.YOUTUBE]: {
    platform: SocialPlatform.YOUTUBE,
    permissions: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    explanation: 'We need permission to upload videos to your YouTube channel and read your channel information.',
    documentationLink: 'https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps',
    requiredScopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  },

  [SocialPlatform.THREADS]: {
    platform: SocialPlatform.THREADS,
    permissions: [
      'threads_basic',
      'threads_content_publish',
      'threads_manage_insights',
    ],
    explanation: 'We need permission to access your Threads account, publish content, and read insights.',
    documentationLink: 'https://developers.facebook.com/docs/threads',
    requiredScopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
  },
};

export class PlatformPermissionsService {
  /**
   * Get permissions for a specific platform
   */
  getPermissions(platform: SocialPlatform): PlatformPermission {
    return PLATFORM_PERMISSIONS[platform];
  }

  /**
   * Get permissions for all platforms
   */
  getAllPermissions(): PlatformPermission[] {
    return Object.values(PLATFORM_PERMISSIONS);
  }

  /**
   * Get required scopes for OAuth
   */
  getRequiredScopes(platform: SocialPlatform): string[] {
    return PLATFORM_PERMISSIONS[platform].requiredScopes;
  }

  /**
   * Get optional scopes for OAuth
   */
  getOptionalScopes(platform: SocialPlatform): string[] {
    return PLATFORM_PERMISSIONS[platform].optionalScopes || [];
  }

  /**
   * Get all scopes (required + optional)
   */
  getAllScopes(platform: SocialPlatform): string[] {
    const permissions = PLATFORM_PERMISSIONS[platform];
    return [...permissions.requiredScopes, ...(permissions.optionalScopes || [])];
  }
}

// Export singleton instance
export const platformPermissionsService = new PlatformPermissionsService();
