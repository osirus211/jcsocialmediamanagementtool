/**
 * S3-Compatible Storage Provider
 * 
 * Implements StorageProvider interface using AWS SDK v3
 * Compatible with:
 * - AWS S3
 * - Cloudflare R2
 * - MinIO
 * - Any S3-compatible storage
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { StorageProvider, UploadOptions, UploadResult } from './StorageProvider';
import { logger } from '../utils/logger';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string; // For R2 or other S3-compatible services
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string; // CDN base URL (e.g., https://cdn.example.com)
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private config: S3StorageConfig;

  constructor(config: S3StorageConfig) {
    this.config = config;

    // Initialize S3 client
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint, // For R2: https://[account-id].r2.cloudflarestorage.com
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Force path-style for R2 compatibility
      forcePathStyle: !!config.endpoint,
    });

    logger.info('S3StorageProvider initialized', {
      bucket: config.bucket,
      region: config.region,
      endpoint: config.endpoint ? '[REDACTED]' : undefined,
      hasPublicUrl: !!config.publicUrl,
    });
  }

  /**
   * Upload a file to S3-compatible storage
   */
  async upload(
    buffer: Buffer,
    key: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      const params: PutObjectCommandInput = {
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: options?.contentType || 'application/octet-stream',
        Metadata: options?.metadata,
      };

      const command = new PutObjectCommand(params);
      await this.client.send(command);

      const url = this.getPublicUrl(key);

      logger.info('File uploaded to S3', {
        key,
        size: buffer.length,
        bucket: this.config.bucket,
      });

      return {
        key,
        url,
        size: buffer.length,
      };
    } catch (error: any) {
      logger.error('S3 upload error', {
        error: error.message,
        key,
        bucket: this.config.bucket,
      });
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Delete a file from S3-compatible storage
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);

      logger.info('File deleted from S3', {
        key,
        bucket: this.config.bucket,
      });
    } catch (error: any) {
      logger.error('S3 delete error', {
        error: error.message,
        key,
        bucket: this.config.bucket,
      });
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Get public URL for a file
   * 
   * Uses custom CDN URL if configured, otherwise constructs S3 URL
   */
  getPublicUrl(key: string): string {
    // Use custom public URL (CDN) if configured
    if (this.config.publicUrl) {
      return `${this.config.publicUrl}/${key}`;
    }

    // For R2 with custom domain
    if (this.config.endpoint) {
      // R2 public URL format: https://pub-[hash].r2.dev/[key]
      // This should be configured via publicUrl in production
      return `${this.config.endpoint}/${this.config.bucket}/${key}`;
    }

    // Standard S3 URL format
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Close the S3 client connection
   */
  async close(): Promise<void> {
    this.client.destroy();
    logger.info('S3StorageProvider closed');
  }
}

/**
 * Create S3 storage provider from environment variables
 */
export function createS3StorageFromEnv(): S3StorageProvider {
  const config: S3StorageConfig = {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT, // For R2: https://[account-id].r2.cloudflarestorage.com
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
    publicUrl: process.env.S3_PUBLIC_URL, // CDN URL: https://cdn.example.com
  };

  // Validate required config
  if (!config.bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }
  if (!config.accessKeyId) {
    throw new Error('S3_ACCESS_KEY environment variable is required');
  }
  if (!config.secretAccessKey) {
    throw new Error('S3_SECRET_KEY environment variable is required');
  }

  return new S3StorageProvider(config);
}
