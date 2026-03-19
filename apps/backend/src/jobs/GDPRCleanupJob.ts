/**
 * GDPR Cleanup Job
 * 
 * Scheduled job to permanently delete user data after grace period expires
 */

import { GDPRRequestLog, GDPRRequestType, GDPRRequestStatus } from '../models/GDPRRequestLog';
import { GDPRService } from '../services/GDPRService';
import { logger } from '../utils/logger';

export class GDPRCleanupJob {
  /**
   * Process pending permanent deletions
   * Should be run daily via cron job
   */
  static async processPendingDeletions(): Promise<void> {
    try {
      logger.info('Starting GDPR cleanup job');

      // Find deletion requests that have passed their retention period
      const pendingDeletions = await GDPRRequestLog.findPendingDeletions();

      logger.info(`Found ${pendingDeletions.length} accounts ready for permanent deletion`);

      for (const request of pendingDeletions) {
        try {
          logger.info('Processing permanent deletion', {
            requestId: request._id.toString(),
            userId: request.userId.toString(),
            retentionUntil: request.retentionUntil,
          });

          // Update request status to in progress
          await request.markInProgress('Starting permanent deletion');

          // Permanently delete all user data
          await GDPRService.permanentlyDeleteUserData(request.userId.toString());

          // Mark request as completed
          await request.markCompleted({
            permanentlyDeletedAt: new Date(),
            dataRemoved: true,
          });

          logger.info('User data permanently deleted', {
            requestId: request._id.toString(),
            userId: request.userId.toString(),
          });

          // Send deletion confirmation email (if email service is available)
          try {
            await this.sendDeletionConfirmationEmail(request);
          } catch (emailError) {
            logger.warn('Failed to send deletion confirmation email', {
              requestId: request._id.toString(),
              error: emailError,
            });
          }
        } catch (error: any) {
          logger.error('Error processing permanent deletion', {
            requestId: request._id.toString(),
            userId: request.userId.toString(),
            error: error.message,
          });

          // Mark request as failed
          await request.markFailed(`Permanent deletion failed: ${error.message}`);
        }
      }

      logger.info('GDPR cleanup job completed', {
        processed: pendingDeletions.length,
      });
    } catch (error: any) {
      logger.error('Error in GDPR cleanup job', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clean up old GDPR request logs (keep for audit purposes but remove sensitive data)
   * Should be run monthly
   */
  static async cleanupOldRequestLogs(): Promise<void> {
    try {
      logger.info('Starting GDPR request log cleanup');

      // Remove sensitive data from request logs older than 2 years
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const result = await GDPRRequestLog.updateMany(
        {
          requestedAt: { $lt: twoYearsAgo },
          requestData: { $exists: true },
        },
        {
          $unset: {
            requestData: 1,
            responseData: 1,
            ipAddress: 1,
            userAgent: 1,
          },
          $set: {
            processingNotes: 'Sensitive data removed for retention compliance',
          },
        }
      );

      logger.info('GDPR request log cleanup completed', {
        updatedRecords: result.modifiedCount,
      });
    } catch (error: any) {
      logger.error('Error in GDPR request log cleanup', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate GDPR compliance report
   * Should be run weekly for monitoring
   */
  static async generateComplianceReport(): Promise<{
    pendingDeletions: number;
    completedDeletions: number;
    failedDeletions: number;
    dataExports: number;
    averageProcessingTime: number;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        pendingDeletions,
        completedDeletions,
        failedDeletions,
        dataExports,
        processingTimes,
      ] = await Promise.all([
        GDPRRequestLog.countDocuments({
          requestType: GDPRRequestType.DATA_DELETION,
          status: GDPRRequestStatus.COMPLETED,
          retentionUntil: { $gt: new Date() },
        }),
        GDPRRequestLog.countDocuments({
          requestType: GDPRRequestType.DATA_DELETION,
          status: GDPRRequestStatus.COMPLETED,
          completedAt: { $gte: thirtyDaysAgo },
          retentionUntil: { $lte: new Date() },
        }),
        GDPRRequestLog.countDocuments({
          requestType: GDPRRequestType.DATA_DELETION,
          status: GDPRRequestStatus.FAILED,
          requestedAt: { $gte: thirtyDaysAgo },
        }),
        GDPRRequestLog.countDocuments({
          requestType: GDPRRequestType.DATA_EXPORT,
          status: GDPRRequestStatus.COMPLETED,
          requestedAt: { $gte: thirtyDaysAgo },
        }),
        GDPRRequestLog.aggregate([
          {
            $match: {
              status: GDPRRequestStatus.COMPLETED,
              requestedAt: { $gte: thirtyDaysAgo },
              completedAt: { $exists: true },
            },
          },
          {
            $project: {
              processingTime: {
                $subtract: ['$completedAt', '$requestedAt'],
              },
            },
          },
          {
            $group: {
              _id: null,
              averageProcessingTime: { $avg: '$processingTime' },
            },
          },
        ]),
      ]);

      const averageProcessingTime = processingTimes[0]?.averageProcessingTime || 0;

      const report = {
        pendingDeletions,
        completedDeletions,
        failedDeletions,
        dataExports,
        averageProcessingTime: Math.round(averageProcessingTime / (1000 * 60 * 60)), // Convert to hours
      };

      logger.info('GDPR compliance report generated', report);

      return report;
    } catch (error: any) {
      logger.error('Error generating GDPR compliance report', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send deletion confirmation email
   */
  private static async sendDeletionConfirmationEmail(request: any): Promise<void> {
    try {
      const { emailNotificationService } = await import('../services/EmailNotificationService');
      
      await emailNotificationService.sendAccountDeletionConfirmation({
        to: request.userEmail || 'user@example.com',
        userName: request.userName || 'User',
        deletedAt: new Date(),
        dataRetentionInfo: 'Your data has been permanently deleted per GDPR Article 17 (Right to Erasure).',
      });
      
      logger.info('Deletion confirmation email sent', {
        requestId: request._id.toString(),
        userId: request.userId.toString(),
        deletedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Error sending deletion confirmation email', {
        requestId: request._id.toString(),
        error: error.message,
      });
    }
  }
}