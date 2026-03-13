/**
 * Media Processing Worker
 * 
 * Processes media files asynchronously:
 * - Fetches media file
 * - Resizes images
 * - Generates thumbnails
 * - Extracts video metadata
 * - Uploads to platform if required
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { Media, MediaStatus } from '../models/Media';
import { MediaProcessingJobData } from '../queue/MediaProcessingQueue';
import { FacebookMediaAdapter } from '../adapters/media/FacebookMediaAdapter';
import { InstagramMediaAdapter } from '../adapters/media/InstagramMediaAdapter';
import { TwitterMediaAdapter } from '../adapters/media/TwitterMediaAdapter';
import { LinkedInMediaAdapter } from '../adapters/media/LinkedInMediaAdapter';
import { TikTokMediaAdapter } from '../adapters/media/TikTokMediaAdapter';
import { IMediaAdapter } from '../adapters/media/IMediaAdapter';
import { logger } from '../utils/logger';
import axios from 'axios';
import sharp from 'sharp';

const QUEUE_NAME = 'media_processing_queue';

export class MediaProcessingWorker {
  private worker: Worker<MediaProcessingJobData> | null = null;
  private adapters: Map<string, IMediaAdapter>;

  constructor() {
    this.adapters = new Map();
    this.adapters.set('facebook', new FacebookMediaAdapter());
    this.adapters.set('instagram', new InstagramMediaAdapter());
    this.adapters.set('twitter', new TwitterMediaAdapter());
    this.adapters.set('linkedin', new LinkedInMediaAdapter());
    this.adapters.set('tiktok', new TikTokMediaAdapter());
  }

  start(): void {
    if (this.worker) {
      logger.warn('Media processing worker already running');
      return;
    }

    const redis = getRedisClient();

    this.worker = new Worker<MediaProcessingJobData>(
      QUEUE_NAME,
      async (job: Job<MediaProcessingJobData>) => {
        await this.process(job);
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Media processing job completed', {
        jobId: job.id,
        mediaId: job.data.mediaId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Media processing job failed', {
        jobId: job?.id,
        mediaId: job?.data.mediaId,
        error: error.message,
      });
    });

    logger.info('Media processing worker started', {
      queue: QUEUE_NAME,
      concurrency: 5,
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Media processing worker stopped');
    }
  }

  private async process(job: Job<MediaProcessingJobData>): Promise<void> {
    const { mediaId, platform, mediaType, fileUrl, workspaceId } = job.data;
    const jobType = job.name; // Get job type from job name
    const startTime = Date.now();

    try {
      // Import MediaService dynamically to avoid circular dependencies
      const { mediaService } = await import('../services/MediaService');

      // Handle different job types
      switch (jobType) {
        case 'compress-image':
          await this.processCompressImage(job);
          return;
        case 'generate-thumbnails':
          await this.processGenerateThumbnails(job);
          return;
        case 'process-media':
        default:
          // Original processing logic
          break;
      }

      // Mark processing as started
      await mediaService.markProcessingStarted(mediaId);

      logger.info('Processing media', {
        mediaId,
        platform,
        mediaType,
      });

      // Fetch media file
      const mediaBuffer = await this.fetchMediaFile(fileUrl);

      // Process based on media type
      let processedData: Record<string, unknown> = {};

      if (mediaType === 'image' || mediaType === 'gif') {
        processedData = await this.processImage(mediaBuffer);
      } else if (mediaType === 'video') {
        processedData = await this.processVideo(mediaBuffer);
      }

      // Upload to platform if required
      const adapter = this.adapters.get(platform.toLowerCase());
      let platformMediaId: string | undefined;

      if (adapter && adapter.requiresPreUpload()) {
        // Note: This is a placeholder - actual platform upload would need account info
        // In production, this would be done during publishing with account credentials
        logger.info('Platform requires pre-upload', {
          platform,
          mediaId,
        });
      }

      // Mark processing as completed with processed data
      await mediaService.markProcessingCompleted(mediaId, {
        width: (processedData.width as number) || 0,
        height: (processedData.height as number) || 0,
        duration: (processedData.duration as number) || 0,
        thumbnailUrl: (processedData.thumbnailUrl as string) || '',
        metadata: {
          ...(processedData.metadata as Record<string, any> || {}),
          processedAt: new Date(),
          processingDuration: Date.now() - startTime,
        },
      });

      const duration = Date.now() - startTime;

      logger.info('Media processing completed', {
        mediaId,
        platform,
        mediaType,
        duration,
      });
    } catch (error: unknown) {
      logger.error('Media processing failed', {
        mediaId,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Import MediaService dynamically
      const { mediaService } = await import('../services/MediaService');

      // Mark processing as failed
      await mediaService.markProcessingFailed(mediaId, error instanceof Error ? error.message : 'Unknown error');

      throw error;
    }
  }

  private async fetchMediaFile(fileUrl: string): Promise<Buffer> {
    try {
      // Check if this is a storage key (not a full URL)
      // If it's a storage key, generate a presigned download URL
      let downloadUrl = fileUrl;
      
      if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
        // This is a storage key, generate presigned URL
        const { mediaStorageService } = await import('../services/MediaStorageService');
        downloadUrl = await mediaStorageService.generatePresignedDownloadUrl(fileUrl);
        
        logger.debug('Generated presigned download URL for media processing', {
          storageKey: fileUrl,
        });
      }

      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      return Buffer.from(response.data);
    } catch (error: unknown) {
      logger.error('Failed to fetch media file', {
        fileUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to fetch media file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processImage(buffer: Buffer): Promise<any> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Resize if too large (max 2048x2048)
      let processedImage = image;
      if (metadata.width && metadata.width > 2048) {
        processedImage = image.resize(2048, 2048, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Generate thumbnail (200x200)
      const thumbnailBuffer = await sharp(buffer)
        .resize(200, 200, {
          fit: 'cover',
        })
        .toBuffer();

      logger.info('Image processed', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      });

      return {
        width: metadata.width,
        height: metadata.height,
        thumbnailUrl: undefined, // Would upload thumbnail to S3 here
        metadata: {
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
        },
      };
    } catch (error: unknown) {
      logger.error('Image processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async processVideo(buffer: Buffer): Promise<any> {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const { extractVideoMetadata, generateThumbnail } = require('../utils/ffmpeg');
      
      // Create temporary file for video processing
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempVideoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
      const tempThumbnailPath = path.join(tempDir, `thumb_${Date.now()}.jpg`);
      
      try {
        // Write buffer to temporary file
        await fs.writeFile(tempVideoPath, buffer);
        
        // Extract video metadata
        const metadata = await extractVideoMetadata(tempVideoPath);
        
        // Generate thumbnail at 1 second
        await generateThumbnail(tempVideoPath, tempThumbnailPath, 1);
        
        // Read thumbnail buffer for upload
        const thumbnailBuffer = await fs.readFile(tempThumbnailPath);
        
        // TODO: Upload thumbnail to S3/storage and get URL
        // For now, we'll return undefined and let the upload happen later
        const thumbnailUrl = undefined; // Would upload thumbnail to S3 here
        
        logger.info('Video processing completed', {
          size: buffer.length,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
        });

        return {
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          thumbnailUrl,
          metadata: {
            size: buffer.length,
            fps: metadata.fps,
            processed: true,
          },
        };
      } finally {
        // Clean up temporary files
        try {
          await fs.unlink(tempVideoPath);
          await fs.unlink(tempThumbnailPath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up temporary files', { cleanupError });
        }
      }
    } catch (error: unknown) {
      logger.error('Video processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process image compression job
   */
  private async processCompressImage(job: Job<MediaProcessingJobData>): Promise<void> {
    const { mediaId } = job.data;
    
    try {
      const { mediaService } = await import('../services/MediaService');
      const { MediaStorageService } = await import('../services/MediaStorageService');
      const { ImageCompressionService } = await import('../services/ImageCompressionService');

      // Get media record
      const media = await mediaService.getMediaById(mediaId, job.data.workspaceId);
      if (!media) {
        throw new Error(`Media not found: ${mediaId}`);
      }

      // Download original file
      const storageService = MediaStorageService.getInstance();
      const originalBuffer = await this.fetchMediaFile(media.storageKey);
      const originalSize = originalBuffer.length;

      // Compress image
      const compressionResult = await ImageCompressionService.compressImage(originalBuffer, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 80,
        format: 'webp',
      });

      // Upload compressed version (overwrite original)
      await storageService.uploadBuffer(media.storageKey, compressionResult.buffer, 'image/webp');

      // Calculate compression ratio
      const compressionRatio = originalSize / compressionResult.size;

      // Update media record
      await mediaService.markProcessingCompleted(mediaId, {
        width: compressionResult.width,
        height: compressionResult.height,
        metadata: {
          ...media.metadata,
          compressionRatio,
          originalSize,
          compressedSize: compressionResult.size,
        },
      });

      logger.info('Image compression completed', {
        mediaId,
        originalSize,
        compressedSize: compressionResult.size,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
      });
    } catch (error) {
      logger.error('Image compression failed', { mediaId, error });
      throw error;
    }
  }

  /**
   * Process thumbnail generation job
   */
  private async processGenerateThumbnails(job: Job<MediaProcessingJobData>): Promise<void> {
    const { mediaId } = job.data;
    
    try {
      const { mediaService } = await import('../services/MediaService');
      const { MediaStorageService } = await import('../services/MediaStorageService');
      const { ImageCompressionService } = await import('../services/ImageCompressionService');

      // Get media record
      const media = await mediaService.getMediaById(mediaId, job.data.workspaceId);
      if (!media) {
        throw new Error(`Media not found: ${mediaId}`);
      }

      // Download original file
      const originalBuffer = await this.fetchMediaFile(media.storageKey);

      // Generate thumbnails
      const thumbnails = await ImageCompressionService.generateThumbnails(originalBuffer, media.storageKey);

      // Upload all thumbnails
      const storageService = MediaStorageService.getInstance();
      const thumbnailUrls: Record<string, string> = {};

      for (const [size, thumbnail] of Object.entries(thumbnails)) {
        await storageService.uploadBuffer(thumbnail.key, thumbnail.buffer, 'image/webp');
        thumbnailUrls[size] = storageService.getPublicUrl(thumbnail.key);
      }

      // Update media record with medium thumbnail URL (main thumbnail)
      await mediaService.markProcessingCompleted(mediaId, {
        thumbnailUrl: thumbnailUrls.medium,
        metadata: {
          ...media.metadata,
          thumbnails: thumbnailUrls,
        },
      });

      logger.info('Thumbnail generation completed', {
        mediaId,
        thumbnailSizes: Object.keys(thumbnails),
      });
    } catch (error) {
      logger.error('Thumbnail generation failed', { mediaId, error });
      throw error;
    }
  }
}
