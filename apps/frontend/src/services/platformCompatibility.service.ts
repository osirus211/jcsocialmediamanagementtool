/**
 * Platform Compatibility Service
 * 
 * Manages platform-specific feature compatibility
 */

export interface PlatformFeature {
  platform: string;
  name: string;
  supportsCarousel: boolean;
  maxCarouselItems?: number;
  supportsPDFCarousel?: boolean;
  supportsVideoCarousel?: boolean;
  supportsPerSlideCaption?: boolean;
  notes?: string;
}

export const platformCompatibilityService = {
  /**
   * Get carousel compatibility for all platforms
   */
  getCarouselCompatibility: (): PlatformFeature[] => {
    return [
      {
        platform: 'instagram',
        name: 'Instagram',
        supportsCarousel: true,
        maxCarouselItems: 20,
        supportsVideoCarousel: true,
        supportsPerSlideCaption: false,
        notes: 'Images and videos can be mixed. Up to 20 items total.',
      },
      {
        platform: 'linkedin',
        name: 'LinkedIn',
        supportsCarousel: true,
        maxCarouselItems: 9,
        supportsPDFCarousel: true,
        supportsVideoCarousel: false,
        supportsPerSlideCaption: true,
        notes: 'Images only. PDF documents auto-convert to carousels.',
      },
      {
        platform: 'facebook',
        name: 'Facebook',
        supportsCarousel: true,
        maxCarouselItems: 30,
        supportsVideoCarousel: false,
        supportsPerSlideCaption: true,
        notes: 'Album posts with up to 30 photos.',
      },
      {
        platform: 'tiktok',
        name: 'TikTok',
        supportsCarousel: true,
        maxCarouselItems: 35,
        supportsVideoCarousel: false,
        supportsPerSlideCaption: false,
        notes: 'Photo mode slideshow. Images only.',
      },
      {
        platform: 'twitter',
        name: 'Twitter/X',
        supportsCarousel: false,
        maxCarouselItems: 4,
        supportsVideoCarousel: false,
        supportsPerSlideCaption: false,
        notes: 'Up to 4 images, but not a true carousel.',
      },
      {
        platform: 'pinterest',
        name: 'Pinterest',
        supportsCarousel: false,
        notes: 'No carousel support.',
      },
    ];
  },

  /**
   * Check if platform supports carousels
   */
  supportsCarousel: (platform: string): boolean => {
    const compatibility = platformCompatibilityService.getCarouselCompatibility();
    const platformData = compatibility.find(p => p.platform === platform);
    return platformData?.supportsCarousel || false;
  },

  /**
   * Get max carousel items for platform
   */
  getMaxCarouselItems: (platform: string): number => {
    const compatibility = platformCompatibilityService.getCarouselCompatibility();
    const platformData = compatibility.find(p => p.platform === platform);
    return platformData?.maxCarouselItems || 1;
  },
};