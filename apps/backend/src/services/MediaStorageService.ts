/**
 * Media Storage Service
 * 
 * Handles media file storage operations using AWS S3
 * 
 * Features:
 * - Generate presigned upload URLs
 * - Delete media from storage
 * - Build CDN URLs
 * - Support for multiple storage providers (S3, GCS)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export enum StorageProvider {
  S3 = 's3',
  GCS = 'gcs',
  LOCAL = 'local',
}

export interface PresignedUploadUrl {
  uploadUrl: string;
  storageKey: string;
  storageProvider: StorageProvider;
  expiresIn: number;
}

export interface MediaStorageConfig {
  provider: StorageProvider;
  bucket: string;
  region: string;
  cdnBaseUrl?: string;
}

export class MediaStorageService {
  private static instance: MediaStorageService;
  private s3Client: S3Client | null = null;
  private storageConfig: MediaStorageConfig;

  private constructor() {
    // Initialize storage configuration
    this.storageConfig = {
      provider: StorageProvider.S3,
      bucket: config.aws.s3Bucket || '',
      region: config.aws.region,
      cdnBaseUrl: config.storage.cdn.baseUrl,
    };

    // Initialize S3 client if AWS credentials are available
    if (config.aws.accessKeyId && config.aws.secretAccessKey && config.aws.s3Bucket) {
      this.s3Client = new S3Client({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
      });

      logger.info('MediaStorageService initialized with S3', {
        region: config.aws.region,
        bucket: config.aws.s3Bucket,
      });
    } else {
      logger.warn('MediaStorageService initialized without S3 credentials', {
        message: 'Media upload will not work without AWS credentials',
      });
    }
  }

  static getInstance(): MediaStorageService {
    if (!MediaStorageService.instance) {
      MediaStorageService.instance = new MediaStorageService();
    }
    return MediaStorageService.instance;
  }

  /**
   * Generate a presigned upload URL for direct client upload
   * 
   * @param workspaceId - Workspace ID
   * @param filename - Original filename
   * @param mimeType - MIME type of the file
   * @param expiresIn - URL expiration time in seconds (default: 15 minutes)
   * @returns Presigned upload URL and storage key
   */
  async generatePresignedUploadUrl(
    workspaceId: string,
    filename: string,
    mimeType: string,
    expiresIn: number = 900 // 15 minutes
  ): Promise<PresignedUploadUrl> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized. AWS credentials are required.');
    }

    try {
      // Generate unique storage key
      const storageKey = this.generateStorageKey(workspaceId, filename);

      // Create PutObject command
      const command = new PutObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: storageKey,
        ContentType: mimeType,
        // Add metadata
        Metadata: {
          workspaceId,
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Generate presigned URL
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      logger.info('Generated presigned upload URL', {
        workspaceId,
        filename,
        storageKey,
        expiresIn,
      });

      return {
        uploadUrl,
        storageKey,
        storageProvider: this.storageConfig.provider,
        expiresIn,
      };
    } catch (error: any) {
      logger.error('Failed to generate presigned upload URL', {
        workspaceId,
        filename,
        error: error.message,
      });
      throw new Error(`Failed to generate presigned upload URL: ${error.message}`);
    }
  }

  /**
   * Generate a presigned download URL for accessing media
   * 
   * @param storageKey - Storage key of the media
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Presigned download URL
   */
  async generatePresignedDownloadUrl(
    storageKey: string,
    expiresIn: number = 3600 // 1 hour
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized. AWS credentials are required.');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: storageKey,
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      logger.debug('Generated presigned download URL', {
        storageKey,
        expiresIn,
      });

      return downloadUrl;
    } catch (error: any) {
      logger.error('Failed to generate presigned download URL', {
        storageKey,
        error: error.message,
      });
      throw new Error(`Failed to generate presigned download URL: ${error.message}`);
    }
  }

  /**
   * Delete media from storage
   * 
   * @param storageKey - Storage key of the media to delete
   */
  async deleteMedia(storageKey: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized. AWS credentials are required.');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: storageKey,
      });

      await this.s3Client.send(command);

      logger.info('Media deleted from storage', {
        storageKey,
      });
    } catch (error: any) {
      logger.error('Failed to delete media from storage', {
        storageKey,
        error: error.message,
      });
      throw new Error(`Failed to delete media: ${error.message}`);
    }
  }

  /**
   * Build CDN URL for media
   * 
   * @param storageKey - Storage key of the media
   * @returns CDN URL or S3 URL if CDN is not configured
   */
  buildCdnUrl(storageKey: string): string {
    if (this.storageConfig.cdnBaseUrl) {
      // Use CDN URL if configured
      return `${this.storageConfig.cdnBaseUrl}/${storageKey}`;
    }

    // Fallback to S3 URL
    return `https://${this.storageConfig.bucket}.s3.${this.storageConfig.region}.amazonaws.com/${storageKey}`;
  }

  /**
   * Build storage URL (direct S3 URL)
   * 
   * @param storageKey - Storage key of the media
   * @returns S3 URL
   */
  buildStorageUrl(storageKey: string): string {
    return `https://${this.storageConfig.bucket}.s3.${this.storageConfig.region}.amazonaws.com/${storageKey}`;
  }

  /**
   * Generate unique storage key for media
   * 
   * Format: media/{workspaceId}/{year}/{month}/{uuid}.{ext}
   * 
   * @param workspaceId - Workspace ID
   * @param filename - Original filename
   * @returns Storage key
   */
  private generateStorageKey(workspaceId: string, filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = uuidv4();
    const ext = path.extname(filename).toLowerCase();

    return `media/${workspaceId}/${year}/${month}/${uuid}${ext}`;
  }

  /**
   * Get storage configuration
   */
  getStorageConfig(): MediaStorageConfig {
    return { ...this.storageConfig };
  }

  /**
   * Check if storage is configured
   */
  isConfigured(): boolean {
    return this.s3Client !== null;
  }
}

// Export singleton instance
export const mediaStorageService = MediaStorageService.getInstance();

