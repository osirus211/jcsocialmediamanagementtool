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

  [SocialPlatform.BLUESKY]: {
    platform: SocialPlatform.BLUESKY,
    displayName: 'Bluesky',
    maxContentLength: 300,
    maxMediaItems: 4,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: true,
    },
    imageFormats: ['image/jpeg', 'image/png', 'image/gif'],
    videoFormats: ['video/mp4'],
    maxImageSize: 1 * 1024 * 1024, // 1MB
    maxVideoSize: 50 * 1024 * 1024, // 50MB
    maxVideoDuration: 60, // 60 seconds
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: true,
      polls: false,
      threads: true,
    },
  },

  [SocialPlatform.MASTODON]: {
    platform: SocialPlatform.MASTODON,
    displayName: 'Mastodon',
    maxContentLength: 500,
    maxMediaItems: 4,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: true,
    },
    imageFormats: ['image/jpeg', 'image/png', 'image/gif'],
    videoFormats: ['video/mp4', 'video/webm'],
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxVideoSize: 40 * 1024 * 1024, // 40MB
    maxVideoDuration: 120, // 2 minutes
    features: {
      scheduling: true,
      hashtags: true,
      mentions: true,
      links: true,
      polls: true,
      threads: true,
    },
  },

  [SocialPlatform.REDDIT]: {
    platform: SocialPlatform.REDDIT,
    displayName: 'Reddit',
    maxContentLength: 40000,
    maxMediaItems: 20,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: true,
    },
    imageFormats: ['image/jpeg', 'image/png', 'image/gif'],
    videoFormats: ['video/mp4'],
    maxImageSize: 20 * 1024 * 1024, // 20MB
    maxVideoSize: 1 * 1024 * 1024 * 1024, // 1GB
    maxVideoDuration: 15 * 60, // 15 minutes
    features: {
      scheduling: true,
      hashtags: false,
      mentions: true,
      links: true,
      polls: true,
      threads: false,
    },
  },

  [SocialPlatform.GOOGLE_BUSINESS]: {
    platform: SocialPlatform.GOOGLE_BUSINESS,
    displayName: 'Google Business Profile',
    maxContentLength: 1500,
    maxMediaItems: 10,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: false,
    },
    imageFormats: ['image/jpeg', 'image/png'],
    videoFormats: ['video/mp4'],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxVideoSize: 100 * 1024 * 1024, // 100MB
    maxVideoDuration: 30, // 30 seconds
    features: {
      scheduling: true,
      hashtags: false,
      mentions: false,
      links: true,
      polls: false,
      threads: false,
    },
  },

  [SocialPlatform.PINTEREST]: {
    platform: SocialPlatform.PINTEREST,
    displayName: 'Pinterest',
    maxContentLength: 500,
    maxMediaItems: 1,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: false,
    },
    imageFormats: ['image/jpeg', 'image/png'],
    videoFormats: ['video/mp4'],
    maxImageSize: 32 * 1024 * 1024, // 32MB
    maxVideoSize: 2 * 1024 * 1024 * 1024, // 2GB
    maxVideoDuration: 15 * 60, // 15 minutes
    features: {
      scheduling: true,
      hashtags: true,
      mentions: false,
      links: true,
      polls: false,
      threads: false,
    },
  },

  [SocialPlatform.GITHUB]: {
    platform: SocialPlatform.GITHUB,
    displayName: 'GitHub',
    maxContentLength: 65536,
    maxMediaItems: 10,
    supportedMediaTypes: {
      images: true,
      videos: false,
      gifs: true,
    },
    imageFormats: ['image/jpeg', 'image/png', 'image/gif'],
    videoFormats: [],
    maxImageSize: 25 * 1024 * 1024, // 25MB
    maxVideoSize: 0,
    features: {
      scheduling: true,
      hashtags: false,
      mentions: true,
      links: true,
      polls: false,
      threads: false,
    },
  },

  [SocialPlatform.APPLE]: {
    platform: SocialPlatform.APPLE,
    displayName: 'Apple App Store Connect',
    maxContentLength: 4000,
    maxMediaItems: 10,
    supportedMediaTypes: {
      images: true,
      videos: true,
      gifs: false,
    },
    imageFormats: ['image/jpeg', 'image/png'],
    videoFormats: ['video/mp4'],
    maxImageSize: 8 * 1024 * 1024, // 8MB
    maxVideoSize: 500 * 1024 * 1024, // 500MB
    maxVideoDuration: 30, // 30 seconds
    features: {
      scheduling: true,
      hashtags: false,
      mentions: false,
      links: true,
      polls: false,
      threads: false,
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
