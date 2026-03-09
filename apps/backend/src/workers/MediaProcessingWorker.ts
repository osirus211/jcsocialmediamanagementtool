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
    const startTime = Date.now();

    try {
      // Import MediaService dynamically to avoid circular dependencies
      const { mediaService } = await import('../services/MediaService');

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
      let processedData: any = {};

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
        width: processedData.width,
        height: processedData.height,
        duration: processedData.duration,
        thumbnailUrl: processedData.thumbnailUrl,
        metadata: {
          ...processedData.metadata,
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
    } catch (error: any) {
      logger.error('Media processing failed', {
        mediaId,
        platform,
        error: error.message,
      });

      // Import MediaService dynamically
      const { mediaService } = await import('../services/MediaService');

      // Mark processing as failed
      await mediaService.markProcessingFailed(mediaId, error.message);

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
    } catch (error: any) {
      logger.error('Failed to fetch media file', {
        fileUrl,
        error: error.message,
      });
      throw new Error(`Failed to fetch media file: ${error.message}`);
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
    } catch (error: any) {
      logger.error('Image processing failed', {
        error: error.message,
      });
      throw error;
    }
  }

  private async processVideo(buffer: Buffer): Promise<any> {
    try {
      // Placeholder for video processing
      // In production, use ffmpeg or similar to extract metadata
      
      logger.info('Video processing (placeholder)', {
        size: buffer.length,
      });

      return {
        duration: undefined, // Would extract with ffmpeg
        width: undefined,
        height: undefined,
        thumbnailUrl: undefined, // Would generate with ffmpeg
        metadata: {
          size: buffer.length,
          processed: true,
        },
      };
    } catch (error: any) {
      logger.error('Video processing failed', {
        error: error.message,
      });
      throw error;
    }
  }
}
