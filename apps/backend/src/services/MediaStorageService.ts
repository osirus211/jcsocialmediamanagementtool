/**
 * Media Storage Service
 * 
 * Handles media file storage to S3/R2
 * Generates storage URLs and manages media lifecycle
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export interface UploadToS3Input {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  workspaceId: string;
}

export interface UploadToS3Result {
  mediaId: string;
  storageKey: string;
  storageUrl: string;
  publicUrl: string;
}

export class MediaStorageService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  private publicBaseUrl: string;

  constructor() {
    this.region = config.aws.region || 'us-east-1';
    this.bucket = config.aws.s3Bucket || 'social-media-scheduler-media';
    this.publicBaseUrl = config.aws.s3PublicUrl || `https://${this.bucket}.s3.${this.region}.amazonaws.com`;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId || '',
        secretAccessKey: config.aws.secretAccessKey || '',
      },
    });

    logger.info('Media storage service initialized', {
      bucket: this.bucket,
      region: this.region,
    });
  }

  /**
   * Generate storage key for file
   * Format: workspaceId/yyyy/mm/uuid.ext
   */
  private generateStorageKey(workspaceId: string, filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = path.extname(filename);
    const uuid = uuidv4();
    
    return `${workspaceId}/${year}/${month}/${uuid}${ext}`;
  }

  /**
   * Upload media to S3
   */
  async uploadToS3(input: UploadToS3Input): Promise<UploadToS3Result> {
    const storageKey = this.generateStorageKey(input.workspaceId, input.filename);
    const mediaId = uuidv4();

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType,
        Metadata: {
          workspaceId: input.workspaceId,
          mediaId,
          originalFilename: input.filename,
        },
      });

      await this.s3Client.send(command);

      const publicUrl = `${this.publicBaseUrl}/${storageKey}`;
      const storageUrl = `s3://${this.bucket}/${storageKey}`;

      logger.info('Media uploaded to S3', {
        mediaId,
        storageKey,
        size: input.buffer.length,
        workspaceId: input.workspaceId,
      });

      return {
        mediaId,
        storageKey,
        storageUrl,
        publicUrl,
      };
    } catch (error: any) {
      logger.error('S3 upload failed', {
        error: error.message,
        storageKey,
        workspaceId: input.workspaceId,
      });
      throw new Error(`Failed to upload to S3: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for direct upload (client-side)
   */
  async generateSignedUploadUrl(
    workspaceId: string,
    filename: string,
    mimeType: string,
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; storageKey: string; mediaId: string }> {
    const storageKey = this.generateStorageKey(workspaceId, filename);
    const mediaId = uuidv4();

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: mimeType,
        Metadata: {
          workspaceId,
          mediaId,
          originalFilename: filename,
        },
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.info('Signed upload URL generated', {
        mediaId,
        storageKey,
        expiresIn,
      });

      return {
        uploadUrl,
        storageKey,
        mediaId,
      };
    } catch (error: any) {
      logger.error('Failed to generate signed URL', {
        error: error.message,
        workspaceId,
      });
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Get public URL for storage key
   */
  getPublicUrl(storageKey: string): string {
    return `${this.publicBaseUrl}/${storageKey}`;
  }

  /**
   * Delete media from S3
   */
  async deleteFromS3(storageKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      await this.s3Client.send(command);

      logger.info('Media deleted from S3', {
        storageKey,
      });
    } catch (error: any) {
      logger.error('S3 deletion failed', {
        error: error.message,
        storageKey,
      });
      throw new Error(`Failed to delete from S3: ${error.message}`);
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }
}

export const mediaStorageService = new MediaStorageService();
