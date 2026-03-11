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
}

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
      const {
        maxWidth = 2048,
        maxHeight = 2048,
        quality = 80,
        format = 'webp',
        progressive = true,
      } = options;

      let pipeline = sharp(inputBuffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .rotate(); // Auto-rotate based on EXIF

      // Apply format-specific compression
      switch (format) {
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: quality + 5, progressive }); // Slightly higher quality for JPEG
          break;
        case 'png':
          pipeline = pipeline.png({ progressive, compressionLevel: 9 });
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