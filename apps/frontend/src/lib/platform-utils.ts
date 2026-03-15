/**
 * Platform utility functions
 * 
 * Provides platform-specific icons, colors, and metadata
 */

export interface PlatformConfig {
  name: string;
  icon: string;
  color: string;
  displayName: string;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  facebook: {
    name: 'facebook',
    icon: '/icons/facebook.svg',
    color: '#1877F2',
    displayName: 'Facebook',
  },
  instagram: {
    name: 'instagram',
    icon: '/icons/instagram.svg',
    color: '#E4405F',
    displayName: 'Instagram',
  },
  twitter: {
    name: 'twitter',
    icon: '/icons/twitter.svg',
    color: '#1DA1F2',
    displayName: 'Twitter',
  },
  linkedin: {
    name: 'linkedin',
    icon: '/icons/linkedin.svg',
    color: '#0A66C2',
    displayName: 'LinkedIn',
  },
  tiktok: {
    name: 'tiktok',
    icon: '/icons/tiktok.svg',
    color: '#000000',
    displayName: 'TikTok',
  },
  youtube: {
    name: 'youtube',
    icon: '/icons/youtube.svg',
    color: '#FF0000',
    displayName: 'YouTube',
  },
  pinterest: {
    name: 'pinterest',
    icon: '/icons/pinterest.svg',
    color: '#BD081C',
    displayName: 'Pinterest',
  },
};

/**
 * Get platform icon URL
 */
export function getPlatformIcon(platform: string): string | null {
  const config = PLATFORM_CONFIGS[platform.toLowerCase()];
  return config?.icon || null;
}

/**
 * Get platform color
 */
export function getPlatformColor(platform: string): string {
  const config = PLATFORM_CONFIGS[platform.toLowerCase()];
  return config?.color || '#6B7280';
}

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform: string): string {
  const config = PLATFORM_CONFIGS[platform.toLowerCase()];
  return config?.displayName || platform;
}

/**
 * Get platform configuration
 */
export function getPlatformConfig(platform: string): PlatformConfig | null {
  return PLATFORM_CONFIGS[platform.toLowerCase()] || null;
}

/**
 * Get all available platforms
 */
export function getAllPlatforms(): PlatformConfig[] {
  return Object.values(PLATFORM_CONFIGS);
}