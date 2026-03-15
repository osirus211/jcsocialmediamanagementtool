/**
 * Video Validation Utilities
 * Platform-specific video validation and requirements checking
 */

import { PLATFORM_VIDEO_LIMITS, SocialPlatform } from '@/types/composer.types';

export interface VideoValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  platformCompatibility: Record<string, {
    compatible: boolean;
    issues: string[];
    warnings: string[];
  }>;
}

export interface VideoMetadata {
  size: number;
  duration: number;
  width: number;
  height: number;
  mimeType: string;
  fps?: number;
  bitrate?: number;
}

/**
 * Validate video against platform requirements
 */
export function validateVideo(
  videoMetadata: VideoMetadata,
  selectedPlatforms: SocialPlatform[]
): VideoValidationResult {
  const result: VideoValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    platformCompatibility: {},
  };

  // Check each selected platform
  for (const platform of selectedPlatforms) {
    const limits = PLATFORM_VIDEO_LIMITS[platform];
    if (!limits) continue;

    const platformResult = {
      compatible: true,
      issues: [] as string[],
      warnings: [] as string[],
    };

    // Check file size
    if (videoMetadata.size > limits.maxSize) {
      platformResult.compatible = false;
      platformResult.issues.push(
        `File size ${formatFileSize(videoMetadata.size)} exceeds ${platform} limit of ${formatFileSize(limits.maxSize)}`
      );
    }

    // Check duration
    if (videoMetadata.duration > limits.maxDuration) {
      platformResult.compatible = false;
      platformResult.issues.push(
        `Duration ${formatDuration(videoMetadata.duration)} exceeds ${platform} limit of ${formatDuration(limits.maxDuration)}`
      );
    }

    // Check format
    if (!limits.supportedFormats.includes(videoMetadata.mimeType)) {
      platformResult.compatible = false;
      platformResult.issues.push(
        `Format ${videoMetadata.mimeType} not supported by ${platform}. Supported: ${limits.supportedFormats.join(', ')}`
      );
    }

    // Check aspect ratio
    const aspectRatio = calculateAspectRatio(videoMetadata.width, videoMetadata.height);
    if (!limits.aspectRatios.includes(aspectRatio)) {
      platformResult.warnings.push(
        `Aspect ratio ${aspectRatio} not optimal for ${platform}. Recommended: ${limits.aspectRatios.join(', ')}`
      );
    }

    // Check resolution
    if (limits.maxResolution) {
      const [maxWidth, maxHeight] = limits.maxResolution.split('x').map(Number);
      if (videoMetadata.width > maxWidth || videoMetadata.height > maxHeight) {
        platformResult.warnings.push(
          `Resolution ${videoMetadata.width}x${videoMetadata.height} exceeds ${platform} recommendation of ${limits.maxResolution}`
        );
      }
    }

    // Platform-specific warnings
    addPlatformSpecificWarnings(platform, videoMetadata, platformResult);

    result.platformCompatibility[platform] = platformResult;

    // Add to global errors/warnings
    if (!platformResult.compatible) {
      result.isValid = false;
      result.errors.push(...platformResult.issues);
    }
    result.warnings.push(...platformResult.warnings);
  }

  return result;
}

/**
 * Get platform-specific requirements as human-readable text
 */
export function getPlatformRequirements(platform: SocialPlatform): string[] {
  const limits = PLATFORM_VIDEO_LIMITS[platform];
  if (!limits) return [];

  return [
    `Max size: ${formatFileSize(limits.maxSize)}`,
    `Max duration: ${formatDuration(limits.maxDuration)}`,
    `Formats: ${limits.supportedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`,
    `Aspect ratios: ${limits.aspectRatios.join(', ')}`,
    ...(limits.maxResolution ? [`Max resolution: ${limits.maxResolution}`] : []),
  ];
}

/**
 * Check if video needs transcoding for any platform
 */
export function needsTranscoding(
  videoMetadata: VideoMetadata,
  selectedPlatforms: SocialPlatform[]
): boolean {
  return selectedPlatforms.some(platform => {
    const limits = PLATFORM_VIDEO_LIMITS[platform];
    return limits && !limits.supportedFormats.includes(videoMetadata.mimeType);
  });
}

/**
 * Get recommended compression settings for platforms
 */
export function getCompressionRecommendations(
  videoMetadata: VideoMetadata,
  selectedPlatforms: SocialPlatform[]
): {
  shouldCompress: boolean;
  targetSize?: number;
  targetResolution?: string;
  targetBitrate?: number;
} {
  const recommendations = {
    shouldCompress: false,
    targetSize: undefined as number | undefined,
    targetResolution: undefined as string | undefined,
    targetBitrate: undefined as number | undefined,
  };

  // Find the most restrictive limits
  let minSize = Infinity;
  let minWidth = Infinity;
  let minHeight = Infinity;

  for (const platform of selectedPlatforms) {
    const limits = PLATFORM_VIDEO_LIMITS[platform];
    if (!limits) continue;

    minSize = Math.min(minSize, limits.maxSize);
    
    if (limits.maxResolution) {
      const [width, height] = limits.maxResolution.split('x').map(Number);
      minWidth = Math.min(minWidth, width);
      minHeight = Math.min(minHeight, height);
    }
  }

  // Check if compression is needed
  if (videoMetadata.size > minSize * 0.8) { // Compress if within 80% of limit
    recommendations.shouldCompress = true;
    recommendations.targetSize = Math.floor(minSize * 0.7); // Target 70% of limit
  }

  if (videoMetadata.width > minWidth || videoMetadata.height > minHeight) {
    recommendations.shouldCompress = true;
    recommendations.targetResolution = `${minWidth}x${minHeight}`;
  }

  return recommendations;
}

// Helper functions

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const ratioWidth = width / divisor;
  const ratioHeight = height / divisor;

  // Common aspect ratios
  const commonRatios: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:5': '4:5',
    '2:3': '2:3',
    '3:4': '3:4',
    '4:3': '4:3',
  };

  const ratioString = `${ratioWidth}:${ratioHeight}`;
  return commonRatios[ratioString] || ratioString;
}

function addPlatformSpecificWarnings(
  platform: SocialPlatform,
  videoMetadata: VideoMetadata,
  result: { warnings: string[] }
): void {
  switch (platform) {
    case 'instagram':
      if (videoMetadata.duration > 60) {
        result.warnings.push('Videos over 60 seconds will be posted as IGTV');
      }
      break;
    
    case 'tiktok':
      if (videoMetadata.duration < 3) {
        result.warnings.push('TikTok videos should be at least 3 seconds long');
      }
      break;
    
    case 'twitter':
      if (videoMetadata.size > 512 * 1024 * 1024) { // 512MB
        result.warnings.push('Large videos may take longer to process on Twitter');
      }
      break;
    
    case 'youtube':
      if (videoMetadata.duration < 60) {
        result.warnings.push('Consider YouTube Shorts format for videos under 60 seconds');
      }
      break;
  }
}

/**
 * Get video quality label based on resolution
 */
export function getVideoQualityLabel(width: number, height: number): string {
  const maxDimension = Math.max(width, height);
  
  if (maxDimension >= 3840) return '4K';
  if (maxDimension >= 2560) return '1440p';
  if (maxDimension >= 1920) return '1080p';
  if (maxDimension >= 1280) return '720p';
  if (maxDimension >= 854) return '480p';
  if (maxDimension >= 640) return '360p';
  return '240p';
}

/**
 * Check if video is in portrait, landscape, or square format
 */
export function getVideoOrientation(width: number, height: number): 'portrait' | 'landscape' | 'square' {
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
}