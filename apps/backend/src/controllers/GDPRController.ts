import { Request, Response, NextFunction } from 'express';
import { GDPRService } from '../services/GDPRService';
import { logger } from '../utils/logger';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

export class GDPRController {
  /**
   * Export user data (GDPR Article 20 - Right to Data Portability)
   * GET /api/v1/gdpr/export
   */
  static async exportUserData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const format = (req.query.format as 'json' | 'csv') || 'json';

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      if (!['json', 'csv'].includes(format)) {
        throw new BadRequestError('Invalid format. Must be json or csv');
      }

      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const result = await GDPRService.exportUserData(userId, format, clientIp, userAgent);

      if (format === 'csv') {
        const csvData = GDPRService.convertToCSV(result.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.status(200).send(csvData);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${new Date().toISOString().split('T')[0]}.json"`);
        res.status(200).json(result.data);
      }

      logger.info('User data exported via GDPR endpoint', {
        userId,
        requestId: result.requestId,
        format,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request account deletion (GDPR Article 17 - Right to Erasure)
   * POST /api/v1/gdpr/delete-account
   */
  static async requestAccountDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { 
        password, 
        gracePeriodDays = 30,
        anonymizeAuditLogs = true,
        revokeOAuthTokens = true,
        cancelSubscriptions = true,
      } = req.body;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      if (!password) {
        throw new BadRequestError('Password is required');
      }

      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const result = await GDPRService.requestAccountDeletion(
        userId,
        password,
        {
          gracePeriodDays,
          anonymizeAuditLogs,
          revokeOAuthTokens,
          cancelSubscriptions,
        },
        clientIp,
        userAgent
      );

      res.status(200).json({
        message: 'Account deletion requested successfully',
        requestId: result.requestId,
        gracePeriodUntil: result.gracePeriodUntil,
        gracePeriodDays,
        note: `Your account has been deactivated and will be permanently deleted on ${result.gracePeriodUntil.toISOString().split('T')[0]}. You can cancel this request before that date by logging in.`,
      });

      logger.info('Account deletion requested via GDPR endpoint', {
        userId,
        requestId: result.requestId,
        gracePeriodUntil: result.gracePeriodUntil,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel account deletion request
   * POST /api/v1/gdpr/cancel-deletion
   */
  static async cancelAccountDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { password } = req.body;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      if (!password) {
        throw new BadRequestError('Password is required');
      }

      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const result = await GDPRService.cancelAccountDeletion(userId, password, clientIp, userAgent);

      res.status(200).json({
        message: 'Account deletion cancelled successfully',
        requestId: result.requestId,
        accountRestored: true,
        note: 'Your account has been restored and is now active again.',
      });

      logger.info('Account deletion cancelled via GDPR endpoint', {
        userId,
        requestId: result.requestId,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's GDPR request history
   * GET /api/v1/gdpr/requests
   */
  static async getGDPRRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const requests = await GDPRService.getUserGDPRRequests(userId);

      res.status(200).json({
        requests: requests.map(request => ({
          id: request._id.toString(),
          type: request.requestType,
          status: request.status,
          requestedAt: request.requestedAt,
          completedAt: request.completedAt,
          failedAt: request.failedAt,
          failureReason: request.failureReason,
          retentionUntil: request.retentionUntil,
          processingNotes: request.processingNotes,
        })),
        total: requests.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's data access summary (GDPR Article 15 - Right of Access)
   * GET /api/v1/gdpr/data-summary
   */
  static async getDataSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      // Get user data from database
      const { User } = await import('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Get basic data counts without full export
      const summary = {
        user: {
          accountCreated: user.createdAt,
          lastLogin: user.lastLoginAt,
          emailVerified: user.isEmailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        dataCounts: {
          workspaces: 0,
          posts: 0,
          socialAccounts: 0,
          analytics: 0,
          loginHistory: 0,
          auditLogs: 0,
        },
        dataRetentionPolicy: {
          posts: 'Retained until account deletion',
          analytics: 'Retained for 2 years or until account deletion',
          auditLogs: 'Retained for 7 years for security purposes (anonymized after account deletion)',
          loginHistory: 'Retained for 90 days',
        },
        yourRights: {
          dataPortability: 'You can export all your data at any time',
          rectification: 'You can update your profile information in account settings',
          erasure: 'You can request account deletion with a 30-day grace period',
          restriction: 'You can deactivate your account temporarily',
          objection: 'You can opt out of marketing communications',
        },
      };

      try {
        // Get actual counts (non-blocking)
        const { Workspace } = await import('../models/Workspace');
        const { WorkspaceMember } = await import('../models/WorkspaceMember');
        const { Post } = await import('../models/Post');
        const { SocialAccount } = await import('../models/SocialAccount');

        const [workspaceCount, postCount, socialAccountCount] = await Promise.all([
          WorkspaceMember.countDocuments({ userId }),
          Post.countDocuments({ createdBy: userId }),
          SocialAccount.countDocuments({ userId }),
        ]);

        summary.dataCounts.workspaces = workspaceCount;
        summary.dataCounts.posts = postCount;
        summary.dataCounts.socialAccounts = socialAccountCount;
      } catch (error) {
        logger.warn('Error fetching data counts for GDPR summary', { userId, error });
      }

      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update consent preferences
   * POST /api/v1/gdpr/consent
   */
  static async updateConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { 
        marketingEmails = false,
        analyticsTracking = false,
        functionalCookies = true, // Required for app functionality
      } = req.body;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      // Update user consent preferences
      const { User } = await import('../models/User');
      const user = await User.findById(userId);
      if (!user) {
        throw new BadRequestError('User not found');
      }

      // Update notification preferences to reflect consent
      user.notificationPreferences = {
        ...user.notificationPreferences,
        email: {
          ...user.notificationPreferences.email,
          weeklyReport: marketingEmails,
        },
      };

      await user.save();

      // Log consent change
      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      await GDPRService.createGDPRRequest(
        userId,
        'consent_withdrawal' as any, // Type assertion for consent updates
        {
          marketingEmails,
          analyticsTracking,
          functionalCookies,
          updatedAt: new Date(),
        },
        clientIp,
        userAgent
      );

      res.status(200).json({
        message: 'Consent preferences updated successfully',
        preferences: {
          marketingEmails,
          analyticsTracking,
          functionalCookies,
        },
      });

      logger.info('User consent preferences updated', {
        userId,
        preferences: { marketingEmails, analyticsTracking, functionalCookies },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download exported data
   * GET /api/v1/gdpr/download/:requestId
   */
  static async downloadExportedData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { requestId } = req.params;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      // Verify the request belongs to the user
      const { GDPRRequestLog } = await import('../models/GDPRRequestLog');
      const gdprRequest = await GDPRRequestLog.findOne({
        _id: requestId,
        userId,
        requestType: 'data_export',
        status: 'completed',
      });

      if (!gdprRequest) {
        res.status(404).json({
          success: false,
          message: 'Export request not found or not completed',
        });
        return;
      }

      // Check if export has expired (7 days)
      const expiryDate = new Date(gdprRequest.completedAt!);
      expiryDate.setDate(expiryDate.getDate() + 7);
      
      if (new Date() > expiryDate) {
        res.status(410).json({
          success: false,
          message: 'Export has expired. Please request a new export.',
        });
        return;
      }

      // Re-generate the export data (in production, this would be served from storage)
      const format = gdprRequest.requestData?.format || 'json';
      const exportResult = await GDPRService.exportUserData(userId, format);

      // Set appropriate headers
      const filename = `gdpr-data-export-${new Date().toISOString().split('T')[0]}.${format}`;
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Send the data
      if (format === 'csv') {
        const csvData = GDPRService.convertToCSV(exportResult.data);
        res.send(csvData);
      } else {
        res.json(exportResult.data);
      }

      logger.info('Data export downloaded', {
        userId,
        requestId,
        format,
      });

    } catch (error) {
      logger.error('Error downloading exported data', {
        userId: req.user?.userId,
        requestId: req.params.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
}