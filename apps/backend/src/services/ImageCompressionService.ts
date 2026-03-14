/**
 * Image Compression Service
 * 
 * Handles image compression and thumbnail generation using Sharp
 * All methods are static for easy usage across the application
 */

import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
  progressive?: boolean;
  preserveExif?: boolean;
  lossless?: boolean;
  platform?: string; // Allow any string, validate at runtime
}

export interface PlatformSpecs {
  maxSize: number;
  recommendedWidth: number;
  recommendedHeight: number;
  quality: number;
  format: 'jpeg' | 'webp' | 'png';
}

export const PLATFORM_SPECS: Record<string, PlatformSpecs> = {
  instagram: { 
    maxSize: 8 * 1024 * 1024, 
    recommendedWidth: 1080, 
    recommendedHeight: 1080, 
    quality: 95,
    format: 'jpeg'
  },
  twitter: { 
    maxSize: 5 * 1024 * 1024, 
    recommendedWidth: 1200, 
    recommendedHeight: 675, 
    quality: 85,
    format: 'jpeg'
  },
  linkedin: { 
    maxSize: 5 * 1024 * 1024, 
    recommendedWidth: 1200, 
    recommendedHeight: 627, 
    quality: 85,
    format: 'jpeg'
  },
  facebook: { 
    maxSize: 4 * 1024 * 1024, 
    recommendedWidth: 1200, 
    recommendedHeight: 630, 
    quality: 85,
    format: 'jpeg'
  },
  tiktok: { 
    maxSize: 72 * 1024 * 1024, 
    recommendedWidth: 1080, 
    recommendedHeight: 1920, 
    quality: 90,
    format: 'jpeg'
  },
  pinterest: { 
    maxSize: 20 * 1024 * 1024, 
    recommendedWidth: 1000, 
    recommendedHeight: 1500, 
    quality: 90,
    format: 'jpeg'
  },
};

export interface CompressionResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  format: string;
}

export interface ThumbnailSizes {
  small: { w: number; h: number };
  medium: { w: number; h: number };
  large: { w: number; h: number };
}

export const THUMBNAIL_SIZES: ThumbnailSizes = {
  small: { w: 150, h: 150 },
  medium: { w: 400, h: 400 },
  large: { w: 800, h: 800 },
};

export class ImageCompressionService {
  /**
   * Compress an image with specified options
   */
  static async compressImage(
    inputBuffer: Buffer,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    try {
      let {
        maxWidth = 2048,
        maxHeight = 2048,
        quality = 80,
        format = 'webp',
        progressive = true,
        preserveExif = false,
        lossless = false,
        platform,
      } = options;

      // Apply platform-specific optimizations
      if (platform && Object.keys(PLATFORM_SPECS).includes(platform)) {
        const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
        maxWidth = spec.recommendedWidth;
        maxHeight = spec.recommendedHeight;
        quality = spec.quality;
        format = spec.format;
      }

      let pipeline = sharp(inputBuffer);

      // Preserve or strip EXIF data
      if (!preserveExif) {
        pipeline = pipeline.rotate(); // Auto-rotate and strip EXIF
      }

      // Resize image
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Apply format-specific compression
      switch (format) {
        case 'webp':
          pipeline = pipeline.webp({ 
            quality: lossless ? 100 : quality,
            lossless,
          });
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ 
            quality: quality + 5, // Slightly higher quality for JPEG
            progressive,
          });
          break;
        case 'png':
          pipeline = pipeline.png({ 
            progressive, 
            compressionLevel: lossless ? 0 : 9,
          });
          break;
      }

      const outputBuffer = await pipeline.toBuffer();
      const metadata = await sharp(outputBuffer).metadata();

      return {
        buffer: outputBuffer,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: outputBuffer.length,
        format: metadata.format || format,
      };
    } catch (error) {
      logger.error('Failed to compress image', { error });
      throw new Error(`Image compression failed: ${error}`);
    }
  }

  /**
   * Compress image for specific platform
   */
  static async compressForPlatform(
    inputBuffer: Buffer,
    platform: keyof typeof PLATFORM_SPECS,
    customOptions: Partial<CompressionOptions> = {}
  ): Promise<CompressionResult> {
    const platformOptions: CompressionOptions = {
      platform,
      ...customOptions,
    };

    return this.compressImage(inputBuffer, platformOptions);
  }

  /**
   * Batch compress images with different settings
   */
  static async batchCompress(
    inputBuffer: Buffer,
    optionsArray: CompressionOptions[]
  ): Promise<CompressionResult[]> {
    try {
      const results = await Promise.all(
        optionsArray.map(options => this.compressImage(inputBuffer, options))
      );
      return results;
    } catch (error) {
      logger.error('Failed to batch compress images', { error });
      throw new Error(`Batch compression failed: ${error}`);
    }
  }

  /**
   * Generate thumbnails in multiple sizes
   */
  static async generateThumbnails(
    inputBuffer: Buffer,
    originalKey: string
  ): Promise<Record<string, { buffer: Buffer; key: string; width: number; height: number }>> {
    try {
      const results: Record<string, { buffer: Buffer; key: string; width: number; height: number }> = {};
      
      // Extract base key without extension
      const baseKey = originalKey.replace(/\.[^/.]+$/, '');
      
      for (const [sizeName, dimensions] of Object.entries(THUMBNAIL_SIZES)) {
        const thumbnailKey = `${baseKey}_thumb_${sizeName}.webp`;
        
        const pipeline = sharp(inputBuffer)
          .resize(dimensions.w, dimensions.h, {
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality: 85 });

        const buffer = await pipeline.toBuffer();
        const metadata = await sharp(buffer).metadata();

        results[sizeName] = {
          buffer,
          key: thumbnailKey,
          width: metadata.width || dimensions.w,
          height: metadata.height || dimensions.h,
        };
      }

      return results;
    } catch (error) {
      logger.error('Failed to generate thumbnails', { error, originalKey });
      throw new Error(`Thumbnail generation failed: ${error}`);
    }
  }

  /**
   * Get image dimensions without processing
   */
  static async getImageDimensions(inputBuffer: Buffer): Promise<{ width: number; height: number }> {
    try {
      const metadata = await sharp(inputBuffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
      };
    } catch (error) {
      logger.error('Failed to get image dimensions', { error });
      throw new Error(`Failed to get image dimensions: ${error}`);
    }
  }

  /**
   * Check if a MIME type represents an image
   */
  static isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Estimate compressed file size based on original size and format
   */
  static estimateCompressedSize(originalSize: number, mimeType: string): number {
    if (mimeType.includes('webp')) {
      return Math.round(originalSize * 0.6); // WebP ~60% of original
    }
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return Math.round(originalSize * 0.8); // JPEG ~80% with compression
    }
    if (mimeType.includes('png')) {
      return Math.round(originalSize * 0.4); // PNG to WebP ~40% reduction
    }
    return originalSize; // Unknown format, no reduction
  }
}