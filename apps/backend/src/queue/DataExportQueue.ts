/**
 * Data Export Queue
 * 
 * Handles async data export jobs for large datasets
 */

import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { GDPRService } from '../services/GDPRService';
import { logger } from '../utils/logger';
import { EmailService } from '../services/EmailService';

export const DATA_EXPORT_QUEUE_NAME = 'data-export-queue';

export interface DataExportJobData {
  userId: string;
  format: 'json' | 'csv';
  categories: string[];
  emailNotification: boolean;
  userEmail: string;
  requestId: string;
}

export interface DataExportJobResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
  fileSize?: number;
  expiresAt?: Date;
}

// Create the queue
export const dataExportQueue = new Queue<DataExportJobData, DataExportJobResult>(
  DATA_EXPORT_QUEUE_NAME,
  {
    connection: getRedisClient(),
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }
);

// Create the worker
export const dataExportWorker = new Worker<DataExportJobData, DataExportJobResult>(
  DATA_EXPORT_QUEUE_NAME,
  async (job: Job<DataExportJobData>) => {
    const { userId, format, categories, emailNotification, userEmail, requestId } = job.data;

    try {
      logger.info('Starting data export job', {
        jobId: job.id,
        userId,
        format,
        categories,
        requestId,
      });

      // Update job progress
      await job.updateProgress(10);

      // Export user data
      const exportResult = await GDPRService.exportUserData(userId, format);
      
      await job.updateProgress(60);

      // Generate download URL (in production, this would be a signed S3 URL)
      const downloadUrl = `/api/v1/gdpr/download/${requestId}`;
      
      // Calculate file size (rough estimate)
      const dataString = JSON.stringify(exportResult.data);
      const fileSize = Buffer.byteLength(dataString, 'utf8');
      
      // Set expiry date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await job.updateProgress(80);

      // Send email notification if requested
      if (emailNotification && userEmail) {
        try {
          await EmailService.sendDataExportReady({
            to: userEmail,
            downloadUrl,
            expiresAt,
            fileSize,
            format,
          });
          logger.info('Data export notification email sent', {
            userId,
            requestId,
            email: userEmail,
          });
        } catch (emailError) {
          logger.warn('Failed to send data export notification email', {
            userId,
            requestId,
            error: emailError,
          });
        }
      }

      await job.updateProgress(100);

      logger.info('Data export job completed successfully', {
        jobId: job.id,
        userId,
        requestId,
        fileSize,
      });

      return {
        success: true,
        downloadUrl,
        fileSize,
        expiresAt,
      };

    } catch (error: any) {
      logger.error('Data export job failed', {
        jobId: job.id,
        userId,
        requestId,
        error: error.message,
      });

      // Send failure notification email
      if (emailNotification && userEmail) {
        try {
          await EmailService.sendDataExportFailed({
            to: userEmail,
            error: error.message,
          });
        } catch (emailError) {
          logger.warn('Failed to send data export failure email', {
            userId,
            requestId,
            error: emailError,
          });
        }
      }

      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 2, // Process 2 export jobs at a time
  }
);

// Worker event handlers
dataExportWorker.on('completed', (job) => {
  logger.info('Data export worker completed job', {
    jobId: job.id,
    userId: job.data.userId,
  });
});

dataExportWorker.on('failed', (job, err) => {
  logger.error('Data export worker failed', {
    jobId: job?.id,
    userId: job?.data?.userId,
    error: err.message,
  });
});

/**
 * Add a data export job to the queue
 */
export async function addDataExportJob(data: DataExportJobData): Promise<Job<DataExportJobData>> {
  return dataExportQueue.add('export-user-data', data, {
    jobId: `export-${data.userId}-${Date.now()}`,
    delay: 0,
  });
}

/**
 * Get data export job status
 */
export async function getDataExportJobStatus(jobId: string): Promise<Job<DataExportJobData> | null> {
  return dataExportQueue.getJob(jobId);
}

/**
 * Clean up old export files (should be run daily)
 */
export async function cleanupExpiredExports(): Promise<void> {
  try {
    // This would clean up expired export files from storage
    // In production, this would clean up S3 objects or local files
    logger.info('Cleaning up expired data exports');
    
    // TODO: Implement actual file cleanup logic
    
  } catch (error: any) {
    logger.error('Error cleaning up expired exports', {
      error: error.message,
    });
  }
}