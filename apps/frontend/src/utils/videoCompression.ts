/**
 * Video Compression Utilities
 * Client-side video compression and optimization
 */

import { PLATFORM_VIDEO_LIMITS, SocialPlatform } from '@/types/composer.types';

export interface CompressionOptions {
  maxSize?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  targetPlatforms?: SocialPlatform[];
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  metadata: {
    width: number;
    height: number;
    duration: number;
  };
}

/**
 * Check if video needs compression for target platforms
 */
export function needsCompression(
  file: File,
  targetPlatforms: SocialPlatform[]
): boolean {
  // Find most restrictive size limit
  let minSize = Infinity;
  
  for (const platform of targetPlatforms) {
    const limits = PLATFORM_VIDEO_LIMITS[platform];
    if (limits) {
      minSize = Math.min(minSize, limits.maxSize);
    }
  }
  
  // Compress if file is within 80% of the limit
  return file.size > minSize * 0.8;
}

/**
 * Get recommended compression settings for platforms
 */
export function getCompressionSettings(
  targetPlatforms: SocialPlatform[]
): CompressionOptions {
  let minSize = Infinity;
  let minWidth = Infinity;
  let minHeight = Infinity;
  
  for (const platform of targetPlatforms) {
    const limits = PLATFORM_VIDEO_LIMITS[platform];
    if (!limits) continue;
    
    minSize = Math.min(minSize, limits.maxSize);
    
    if (limits.maxResolution) {
      const [width, height] = limits.maxResolution.split('x').map(Number);
      minWidth = Math.min(minWidth, width);
      minHeight = Math.min(minHeight, height);
    }
  }
  
  return {
    maxSize: minSize === Infinity ? undefined : Math.floor(minSize * 0.8),
    maxWidth: minWidth === Infinity ? undefined : minWidth,
    maxHeight: minHeight === Infinity ? undefined : minHeight,
    quality: 0.8,
    targetPlatforms,
  };
}