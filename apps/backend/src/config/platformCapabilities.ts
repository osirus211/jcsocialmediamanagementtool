/**
 * Platform Capabilities Configuration
 * 
 * Defines capabilities and limits for each social media platform
 */

import { SocialPlatform } from '../models/ScheduledPost';

export interface PlatformCapability {
  platform: SocialPlatform;
  displayName: string;
  maxContentLength: number;
  maxMediaItems: number;
  supportedMediaTypes: {
    images: boolean;
    videos: boolean;
    gifs: boolean;
  };
  imageFormats: string[];
  videoFormats: string[];
  maxImageSize: number; // bytes
  maxVideoSize: number; // bytes
  maxVideoDuration?: number; // seconds
  features: {
    scheduling: boolean;
    hashtags: boolean;
    mentions: boolean;
    links: boolean;
    polls: boolean;
    threads: boolean;
  };
}

export const PLATFORM_CAPABILITIES: Record<SocialPlatform, PlatformCapability> = {
  [SocialPlatform.TWITTER]: {
    platform: SocialPlatform.TWITTER,
    displayName: 'Twitter (X)',
    maxContentLength: 280,
    maxMediaItems: 4,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: true,
    },
    imageFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    videoFormats: ['video/mp4'],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxVideoSize: 512 * 1024 * 1024, // 512MB
    maxVideoDuration: 140, // 2:20
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: true,
      polls: true,
      threads: true,
    },
  },

  [SocialPlatform.FACEBOOK]: {
    platform: SocialPlatform.FACEBOOK,
    displayName: 'Facebook',
    maxContentLength: 63206,
    maxMediaItems: 10,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: false,
    },
    imageFormats: ['image/jpeg', 'image/png'],
    videoFormats: ['video/mp4', 'video/quicktime'],
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxVideoSize: 4 * 1024 * 1024 * 1024, // 4GB
    maxVideoDuration: 240 * 60, // 240 minutes
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: true,
      polls: false,
      threads: false,
    },
  },

  [SocialPlatform.INSTAGRAM]: {
    platform: SocialPlatform.INSTAGRAM,
    displayName: 'Instagram',
    maxContentLength: 2200,
    maxMediaItems: 10,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: false,
    },
    imageFormats: ['image/jpeg', 'image/png'],
    videoFormats: ['video/mp4'],
    maxImageSize: 8 * 1024 * 1024, // 8MB
    maxVideoSize: 100 * 1024 * 1024, // 100MB
    maxVideoDuration: 60, // 60 seconds for feed
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: false,
      polls: false,
      threads: false,
    },
  },

  [SocialPlatform.LINKEDIN]: {
    platform: SocialPlatform.LINKEDIN,
    displayName: 'LinkedIn',
    maxContentLength: 3000,
    maxMediaItems: 9,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: false,
    },
    imageFormats: ['image/jpeg', 'image/png', 'image/gif'],
    videoFormats: ['video/mp4'],
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxVideoSize: 5 * 1024 * 1024 * 1024, // 5GB
    maxVideoDuration: 10 * 60, // 10 minutes
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: true,
      polls: true,
      threads: false,
    },
  },

  [SocialPlatform.TIKTOK]: {
    platform: SocialPlatform.TIKTOK,
    displayName: 'TikTok',
    maxContentLength: 2200,
    maxMediaItems: 1,
    supportedMediaTypes: {
      images: false,
      videos: true,
      gifs: false,
    },
    imageFormats: [],
    videoFormats: ['video/mp4'],
    maxImageSize: 0,
    maxVideoSize: 287 * 1024 * 1024, // 287MB
    maxVideoDuration: 10 * 60, // 10 minutes
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: false,
      polls: false,
      threads: false,
    },
  },

  [SocialPlatform.YOUTUBE]: {
    platform: SocialPlatform.YOUTUBE,
    displayName: 'YouTube',
    maxContentLength: 5000,
    maxMediaItems: 1,
    supportedMediaTypes: {
      images: false,
      videos: true,
      gifs: false,
    },
    imageFormats: [],
    videoFormats: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxImageSize: 0,
    maxVideoSize: 256 * 1024 * 1024 * 1024, // 256GB
    maxVideoDuration: 12 * 60 * 60, // 12 hours
    features: {
      scheduling: true,
      hashtags: true,
      mentions: false,
      links: true,
      polls: false,
      threads: false,
    },
  },

  [SocialPlatform.THREADS]: {
    platform: SocialPlatform.THREADS,
    displayName: 'Threads',
    maxContentLength: 500,
    maxMediaItems: 10,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: true,
    },
    imageFormats: ['image/jpeg', 'image/png', 'image/gif'],
    videoFormats: ['video/mp4'],
    maxImageSize: 8 * 1024 * 1024, // 8MB
    maxVideoSize: 100 * 1024 * 1024, // 100MB
    maxVideoDuration: 90, // 90 seconds
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: true,
      polls: false,
      threads: true,
    },
  },
};

/**
 * Get capabilities for a specific platform
 */
export function getPlatformCapabilities(platform: SocialPlatform): PlatformCapability {
  return PLATFORM_CAPABILITIES[platform];
}

/**
 * Get capabilities for all platforms
 */
export function getAllPlatformCapabilities(): PlatformCapability[] {
  return Object.values(PLATFORM_CAPABILITIES);
}
