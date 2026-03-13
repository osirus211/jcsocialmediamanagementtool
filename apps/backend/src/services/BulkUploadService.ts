/**
 * BulkUpload Service
 * 
 * Business logic for CSV bulk post upload
 */

import mongoose from 'mongoose';
import Papa from 'papaparse';
import { BulkUploadJob, IBulkUploadJob, BulkUploadStatus, BulkUploadError } from '../models/BulkUploadJob';
import { postService } from './PostService';
import { Media } from '../models/Media';
import { SocialPlatform } from '../models/ScheduledPost';
import { logger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';

interface CSVRow {
  platform: string;
  text: string;
  scheduled_time: string;
  media_url?: string;
}

const MAX_ROWS = 500;
const VALID_PLATFORMS = Object.values(SocialPlatform);

export class BulkUploadService {
  private static instance: BulkUploadService;

  private constructor() {}

  static getInstance(): BulkUploadService {
    if (!BulkUploadService.instance) {
      BulkUploadService.instance = new BulkUploadService();
    }
    return BulkUploadService.instance;
  }

  /**
   * Upload and process CSV file
   */
  async uploadCSV(
    fileBuffer: Buffer,
    filename: string,
    workspaceId: string,
    userId: string
  ): Promise<IBulkUploadJob> {
    try {
      // Parse CSV
      const csvContent = fileBuffer.toString('utf-8');
      const parseResult = Papa.parse<CSVRow>(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
      });

      if (parseResult.errors.length > 0) {
        throw new BadRequestError(`CSV parsing error: ${parseResult.errors[0].message}`);
      }

      const rows = parseResult.data;

      if (rows.length === 0) {
        throw new BadRequestError('CSV file is empty');
      }

      if (rows.length > MAX_ROWS) {
        throw new BadRequestError(`CSV file exceeds maximum of ${MAX_ROWS} rows`);
      }

      // Create job
      const job = await BulkUploadJob.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
        filename,
        totalRows: rows.length,
        processedRows: 0,
        successCount: 0,
        failureCount: 0,
        status: BulkUploadStatus.PENDING,
        errors: [],
      });

      logger.info('Bulk upload job created', {
        jobId: job._id.toString(),
        workspaceId,
        filename,
        totalRows: rows.length,
      });

      // Process rows immediately (could be moved to background job)
      await this.processCSV(job._id.toString(), rows, workspaceId, userId);

      return job;
    } catch (error: any) {
      logger.error('Failed to upload CSV', {
        workspaceId,
        filename,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process CSV rows
   */
  private async processCSV(
    jobId: string,
    rows: CSVRow[],
    workspaceId: string,
    userId: string
  ): Promise<void> {
    try {
      // Update job status to processing
      await BulkUploadJob.findByIdAndUpdate(jobId, {
        status: BulkUploadStatus.PROCESSING,
        startedAt: new Date(),
      });

      const errors: BulkUploadError[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // +2 because row 1 is header, and we're 0-indexed

        try {
          // Validate row
          const validationError = this.validateRow(row, rowNumber);
          if (validationError) {
            errors.push(validationError);
            failureCount++;
            continue;
          }

          // Parse platforms
          const platforms = row.platform
            .split(',')
            .map(p => p.trim() as SocialPlatform)
            .filter(p => VALID_PLATFORMS.includes(p));

          if (platforms.length === 0) {
            errors.push({
              row: rowNumber,
              error: 'No valid platforms specified',
              data: row,
            });
            failureCount++;
            continue;
          }

          // Parse scheduled time
          const scheduledAt = new Date(row.scheduled_time);
          if (isNaN(scheduledAt.getTime())) {
            errors.push({
              row: rowNumber,
              error: 'Invalid scheduled_time format',
              data: row,
            });
            failureCount++;
            continue;
          }

          if (scheduledAt < new Date()) {
            errors.push({
              row: rowNumber,
              error: 'Scheduled time must be in the future',
              data: row,
            });
            failureCount++;
            continue;
          }

          // Resolve media IDs from URLs if provided
          let mediaIds: string[] = [];
          if (row.media_url) {
            const mediaUrls = row.media_url.split(',').map(url => url.trim());
            mediaIds = await this.resolveMediaUrls(mediaUrls, workspaceId);
          }

          // Create post for each platform
          for (const platform of platforms) {
            await postService.createPost({
              workspaceId,
              socialAccountId: '', // TODO: Get appropriate social account ID
              platform,
              content: row.text,
              mediaIds,
              scheduledAt,
            });
          }

          successCount++;
        } catch (error: any) {
          errors.push({
            row: rowNumber,
            error: error.message || 'Unknown error',
            data: row,
          });
          failureCount++;
        }

        // Update progress
        await BulkUploadJob.findByIdAndUpdate(jobId, {
          processedRows: i + 1,
          successCount,
          failureCount,
          errors,
        });
      }

      // Mark job as completed
      await BulkUploadJob.findByIdAndUpdate(jobId, {
        status: BulkUploadStatus.COMPLETED,
        completedAt: new Date(),
        processedRows: rows.length,
        successCount,
        failureCount,
        errors,
      });

      logger.info('Bulk upload job completed', {
        jobId,
        workspaceId,
        totalRows: rows.length,
        successCount,
        failureCount,
      });
    } catch (error: any) {
      logger.error('Failed to process CSV', {
        jobId,
        workspaceId,
        error: error.message,
      });

      // Mark job as failed
      await BulkUploadJob.findByIdAndUpdate(jobId, {
        status: BulkUploadStatus.FAILED,
        completedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Validate CSV row
   */
  private validateRow(row: CSVRow, rowNumber: number): BulkUploadError | null {
    if (!row.platform) {
      return {
        row: rowNumber,
        error: 'Missing required field: platform',
        data: row,
      };
    }

    if (!row.text) {
      return {
        row: rowNumber,
        error: 'Missing required field: text',
        data: row,
      };
    }

    if (!row.scheduled_time) {
      return {
        row: rowNumber,
        error: 'Missing required field: scheduled_time',
        data: row,
      };
    }

    // Validate platforms
    const platforms = row.platform.split(',').map(p => p.trim());
    const invalidPlatforms = platforms.filter(p => !VALID_PLATFORMS.includes(p as SocialPlatform));

    if (invalidPlatforms.length > 0) {
      return {
        row: rowNumber,
        error: `Invalid platform(s): ${invalidPlatforms.join(', ')}. Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
        data: row,
      };
    }

    return null;
  }

  /**
   * Resolve media URLs to media IDs
   */
  private async resolveMediaUrls(mediaUrls: string[], workspaceId: string): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const url of mediaUrls) {
      // Try to find media by filename or storage URL
      const media = await Media.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { originalFilename: url },
          { filename: url },
          { storageUrl: url },
        ],
      });

      if (media) {
        mediaIds.push(media._id.toString());
      } else {
        logger.warn('Media not found for URL', { url, workspaceId });
      }
    }

    return mediaIds;
  }

  /**
   * Get upload job status
   */
  async getUploadStatus(jobId: string, workspaceId: string): Promise<IBulkUploadJob | null> {
    try {
      const job = await BulkUploadJob.findOne({
        _id: jobId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      return job;
    } catch (error: any) {
      logger.error('Failed to get upload status', {
        jobId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get upload status: ${error.message}`);
    }
  }

  /**
   * List upload jobs
   */
  async listUploadJobs(workspaceId: string): Promise<IBulkUploadJob[]> {
    try {
      const jobs = await BulkUploadJob.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return jobs as unknown as IBulkUploadJob[];
    } catch (error: any) {
      logger.error('Failed to list upload jobs', {
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to list upload jobs: ${error.message}`);
    }
  }
}

export const bulkUploadService = BulkUploadService.getInstance();
