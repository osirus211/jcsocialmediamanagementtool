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
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';
import moment from 'moment-timezone';

interface CSVRow {
  platform: string;
  text: string;
  scheduled_time: string;
  media_url?: string;
  timezone?: string;
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
      const processedPosts = new Set<string>(); // For duplicate detection

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

          // Parse scheduled time with timezone support
          const timezone = row.timezone || 'UTC';
          let scheduledAt: Date;
          
          try {
            // Use moment-timezone for proper timezone handling
            const momentDate = moment.tz(row.scheduled_time, 'YYYY-MM-DD HH:mm', timezone);
            if (!momentDate.isValid()) {
              throw new Error('Invalid date format');
            }
            scheduledAt = momentDate.utc().toDate();
          } catch (err) {
            errors.push({
              row: rowNumber,
              error: `Invalid scheduled_time format or timezone. Use YYYY-MM-DD HH:mm format and valid timezone (e.g., America/New_York, UTC)`,
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

          // Duplicate detection - create unique key for content + platforms + time
          const duplicateKey = `${row.text.trim()}-${platforms.sort().join(',')}-${scheduledAt.getTime()}`;
          if (processedPosts.has(duplicateKey)) {
            errors.push({
              row: rowNumber,
              error: 'Duplicate post detected (same content, platforms, and time)',
              data: row,
            });
            failureCount++;
            continue;
          }
          processedPosts.add(duplicateKey);

          // Resolve media IDs from URLs if provided
          let mediaIds: string[] = [];
          if (row.media_url) {
            try {
              const mediaUrls = row.media_url.split(',').map(url => url.trim()).filter(url => url);
              mediaIds = await this.resolveMediaUrls(mediaUrls, workspaceId);
            } catch (err: any) {
              errors.push({
                row: rowNumber,
                error: `Media processing error: ${err.message}`,
                data: row,
              });
              failureCount++;
              continue;
            }
          }

          // Get appropriate social accounts for each platform
          const socialAccounts = await this.getSocialAccountsForPlatforms(platforms, workspaceId);

          // Create post for each platform
          for (const platform of platforms) {
            const socialAccount = socialAccounts.find(acc => acc.platform === platform);
            if (!socialAccount) {
              errors.push({
                row: rowNumber,
                error: `No connected ${platform} account found`,
                data: row,
              });
              failureCount++;
              continue;
            }

            await postService.createPost({
              workspaceId,
              socialAccountId: socialAccount._id.toString(),
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

    // Validate timezone if provided
    if (row.timezone) {
      try {
        if (!moment.tz.zone(row.timezone)) {
          return {
            row: rowNumber,
            error: `Invalid timezone: ${row.timezone}. Use valid timezone names like America/New_York, Europe/London, UTC`,
            data: row,
          };
        }
      } catch (err) {
        return {
          row: rowNumber,
          error: `Invalid timezone: ${row.timezone}`,
          data: row,
        };
      }
    }

    // Validate media URLs format if provided
    if (row.media_url) {
      const mediaUrls = row.media_url.split(',').map(url => url.trim()).filter(url => url);
      for (const url of mediaUrls) {
        try {
          new URL(url);
        } catch (err) {
          return {
            row: rowNumber,
            error: `Invalid media URL format: ${url}`,
            data: row,
          };
        }
      }
    }

    return null;
  }

  /**
   * Resolve media URLs to media IDs
   */
  private async resolveMediaUrls(mediaUrls: string[], workspaceId: string): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const url of mediaUrls) {
      if (!url) continue;

      try {
        // Try to find media by filename, original filename, or storage URL
        const media = await Media.findOne({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          $or: [
            { originalFilename: { $regex: url.split('/').pop(), $options: 'i' } },
            { filename: { $regex: url.split('/').pop(), $options: 'i' } },
            { storageUrl: url },
            { publicUrl: url },
          ],
        });

        if (media) {
          mediaIds.push(media._id.toString());
        } else {
          // If media not found, log warning but don't fail the entire upload
          logger.warn('Media not found for URL', { url, workspaceId });
          // Could potentially download and create media here in the future
        }
      } catch (err: any) {
        logger.error('Error resolving media URL', { url, workspaceId, error: err.message });
        throw new Error(`Failed to resolve media URL: ${url}`);
      }
    }

    return mediaIds;
  }

  /**
   * Get social accounts for platforms
   */
  private async getSocialAccountsForPlatforms(
    platforms: SocialPlatform[],
    workspaceId: string
  ): Promise<Array<{ _id: mongoose.Types.ObjectId; platform: SocialPlatform }>> {
    try {
      const socialAccounts = await SocialAccount.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        provider: { $in: platforms },
        status: 'active',
      }).select('_id provider').lean();

      return socialAccounts.map(acc => ({
        _id: acc._id,
        platform: acc.provider as SocialPlatform,
      }));
    } catch (error: any) {
      logger.error('Failed to get social accounts', {
        workspaceId,
        platforms,
        error: error.message,
      });
      return [];
    }
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
