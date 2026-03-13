import { User } from '../models/User';
import { GDPRRequestLog, GDPRRequestType, GDPRRequestStatus, IGDPRRequestLog } from '../models/GDPRRequestLog';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import mongoose from 'mongoose';

export interface GDPRExportData {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    bio?: string;
    timezone?: string;
    language?: string;
    createdAt: Date;
    lastLoginAt?: Date;
    isEmailVerified: boolean;
    twoFactorEnabled: boolean;
  };
  workspaces: any[];
  posts: any[];
  socialAccounts: any[];
  analytics: any[];
  loginHistory: any[];
  auditLogs: any[];
  billingHistory: any[];
  exportMetadata: {
    exportedAt: string;
    requestId: string;
    format: 'json' | 'csv';
    dataRetentionPolicy: string;
  };
}

export interface GDPRDeletionOptions {
  gracePeriodDays?: number;
  anonymizeAuditLogs?: boolean;
  revokeOAuthTokens?: boolean;
  cancelSubscriptions?: boolean;
}

export class GDPRService {
  /**
   * Create a GDPR request log entry
   */
  static async createGDPRRequest(
    userId: string,
    requestType: GDPRRequestType,
    requestData?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IGDPRRequestLog> {
    try {
      const request = new GDPRRequestLog({
        userId,
        requestType,
        requestData,
        ipAddress,
        userAgent,
      });

      await request.save();

      logger.info('GDPR request created', {
        requestId: request._id.toString(),
        userId,
        requestType,
      });

      return request;
    } catch (error: any) {
      logger.error('Error creating GDPR request', {
        userId,
        requestType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Export all user data (Right to Data Portability - GDPR Article 20)
   */
  static async exportUserData(
    userId: string,
    format: 'json' | 'csv' = 'json',
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ data: GDPRExportData; requestId: string }> {
    // Create GDPR request log
    const request = await this.createGDPRRequest(
      userId,
      GDPRRequestType.DATA_EXPORT,
      { format },
      ipAddress,
      userAgent
    );

    try {
      await request.markInProgress('Starting data export');

      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        await request.markFailed('User not found');
        throw new NotFoundError('User not found');
      }

      // Gather all user data from various collections
      const [workspaces, posts, socialAccounts, analytics, loginHistory, auditLogs, billingHistory] = await Promise.all([
        this.getUserWorkspaces(userId),
        this.getUserPosts(userId),
        this.getUserSocialAccounts(userId),
        this.getUserAnalytics(userId),
        this.getUserLoginHistory(userId),
        this.getUserAuditLogs(userId),
        this.getUserBillingHistory(userId),
      ]);

      const exportData: GDPRExportData = {
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          timezone: user.timezone,
          language: user.language,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          isEmailVerified: user.isEmailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        workspaces,
        posts,
        socialAccounts,
        analytics,
        loginHistory,
        auditLogs,
        billingHistory,
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          requestId: request._id.toString(),
          format,
          dataRetentionPolicy: 'Data exported under GDPR Article 20 - Right to Data Portability',
        },
      };

      await request.markCompleted({ 
        recordCount: {
          workspaces: workspaces.length,
          posts: posts.length,
          socialAccounts: socialAccounts.length,
          analytics: analytics.length,
          loginHistory: loginHistory.length,
          auditLogs: auditLogs.length,
          billingHistory: billingHistory.length,
        },
        format,
      });

      logger.info('User data exported successfully', {
        userId,
        requestId: request._id.toString(),
        recordCounts: {
          workspaces: workspaces.length,
          posts: posts.length,
          socialAccounts: socialAccounts.length,
        },
      });

      return {
        data: exportData,
        requestId: request._id.toString(),
      };
    } catch (error: any) {
      await request.markFailed(error.message);
      logger.error('Error exporting user data', {
        userId,
        requestId: request._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Request account deletion with grace period (Right to Erasure - GDPR Article 17)
   */
  static async requestAccountDeletion(
    userId: string,
    password: string,
    options: GDPRDeletionOptions = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ requestId: string; gracePeriodUntil: Date }> {
    const {
      gracePeriodDays = 30,
      anonymizeAuditLogs = true,
      revokeOAuthTokens = true,
      cancelSubscriptions = true,
    } = options;

    // Verify user and password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new BadRequestError('Invalid password');
    }

    // Calculate grace period end date
    const gracePeriodUntil = new Date();
    gracePeriodUntil.setDate(gracePeriodUntil.getDate() + gracePeriodDays);

    // Create GDPR request log
    const request = await this.createGDPRRequest(
      userId,
      GDPRRequestType.DATA_DELETION,
      {
        gracePeriodDays,
        anonymizeAuditLogs,
        revokeOAuthTokens,
        cancelSubscriptions,
        gracePeriodUntil,
      },
      ipAddress,
      userAgent
    );

    try {
      await request.markInProgress('Account deletion requested - grace period started');

      // Set retention date for permanent deletion
      request.retentionUntil = gracePeriodUntil;
      await request.save();

      // Soft delete the user account immediately
      user.softDeletedAt = new Date();
      await user.save();

      // Revoke all refresh tokens
      await user.revokeAllTokens();

      // TODO: Cancel subscriptions if enabled
      if (cancelSubscriptions) {
        await this.cancelUserSubscriptions(userId);
      }

      // TODO: Revoke OAuth tokens if enabled
      if (revokeOAuthTokens) {
        await this.revokeUserOAuthTokens(userId);
      }

      await request.markCompleted({
        softDeletedAt: user.softDeletedAt,
        gracePeriodUntil,
        permanentDeletionScheduled: true,
      });

      logger.info('Account deletion requested', {
        userId,
        requestId: request._id.toString(),
        gracePeriodUntil,
      });

      return {
        requestId: request._id.toString(),
        gracePeriodUntil,
      };
    } catch (error: any) {
      await request.markFailed(error.message);
      logger.error('Error requesting account deletion', {
        userId,
        requestId: request._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel account deletion request (restore from soft delete)
   */
  static async cancelAccountDeletion(
    userId: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; requestId: string }> {
    // Find the user (including soft-deleted)
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new BadRequestError('Invalid password');
    }

    // Check if user is soft-deleted
    if (!user.softDeletedAt) {
      throw new BadRequestError('Account is not scheduled for deletion');
    }

    // Find the active deletion request
    const deletionRequest = await GDPRRequestLog.findOne({
      userId,
      requestType: GDPRRequestType.DATA_DELETION,
      status: GDPRRequestStatus.COMPLETED,
      retentionUntil: { $gt: new Date() }, // Still within grace period
    });

    if (!deletionRequest) {
      throw new BadRequestError('No active deletion request found or grace period has expired');
    }

    // Create cancellation request log
    const cancellationRequest = await this.createGDPRRequest(
      userId,
      GDPRRequestType.CONSENT_WITHDRAWAL,
      {
        originalRequestId: deletionRequest._id.toString(),
        action: 'cancel_deletion',
      },
      ipAddress,
      userAgent
    );

    try {
      await cancellationRequest.markInProgress('Cancelling account deletion');

      // Restore the user account
      user.softDeletedAt = undefined;
      await user.save();

      // Cancel the original deletion request
      deletionRequest.status = GDPRRequestStatus.CANCELLED;
      deletionRequest.processingNotes = `Cancelled by user request: ${cancellationRequest._id.toString()}`;
      await deletionRequest.save();

      await cancellationRequest.markCompleted({
        restoredAt: new Date(),
        originalRequestCancelled: deletionRequest._id.toString(),
      });

      logger.info('Account deletion cancelled', {
        userId,
        cancellationRequestId: cancellationRequest._id.toString(),
        originalRequestId: deletionRequest._id.toString(),
      });

      return {
        success: true,
        requestId: cancellationRequest._id.toString(),
      };
    } catch (error: any) {
      await cancellationRequest.markFailed(error.message);
      logger.error('Error cancelling account deletion', {
        userId,
        requestId: cancellationRequest._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Permanently delete user data (called by scheduled job after grace period)
   */
  static async permanentlyDeleteUserData(userId: string): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info('Starting permanent deletion of user data', { userId });

      // Delete user data in order (respecting foreign key constraints)
      await this.deleteUserPosts(userId, session);
      await this.deleteUserAnalytics(userId, session);
      await this.deleteUserSocialAccounts(userId, session);
      await this.deleteUserWorkspaces(userId, session);
      await this.anonymizeUserAuditLogs(userId, session);
      
      // Finally delete the user record
      await User.findByIdAndDelete(userId).session(session);

      await session.commitTransaction();

      logger.info('User data permanently deleted', { userId });
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Error permanently deleting user data', {
        userId,
        error: error.message,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get user's GDPR request history
   */
  static async getUserGDPRRequests(userId: string): Promise<IGDPRRequestLog[]> {
    return GDPRRequestLog.findUserRequests(userId);
  }

  /**
   * Convert export data to CSV format
   */
  static convertToCSV(data: GDPRExportData): string {
    const csvRows: string[] = [];
    
    // Add headers
    csvRows.push('Section,Field,Value');
    
    // User data
    Object.entries(data.user).forEach(([key, value]) => {
      csvRows.push(`User,${key},"${String(value).replace(/"/g, '""')}"`);
    });
    
    // Workspaces
    data.workspaces.forEach((workspace, index) => {
      Object.entries(workspace).forEach(([key, value]) => {
        csvRows.push(`Workspace ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });
    
    // Posts
    data.posts.forEach((post, index) => {
      Object.entries(post).forEach(([key, value]) => {
        csvRows.push(`Post ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });

    // Social Accounts
    data.socialAccounts.forEach((account, index) => {
      Object.entries(account).forEach(([key, value]) => {
        csvRows.push(`Social Account ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });

    // Analytics
    data.analytics.forEach((analytic, index) => {
      Object.entries(analytic).forEach(([key, value]) => {
        csvRows.push(`Analytics ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });

    // Login History
    data.loginHistory.forEach((login, index) => {
      Object.entries(login).forEach(([key, value]) => {
        csvRows.push(`Login ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });

    // Audit Logs
    data.auditLogs.forEach((log, index) => {
      Object.entries(log).forEach(([key, value]) => {
        csvRows.push(`Audit Log ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });

    // Billing History
    if (data.billingHistory && typeof data.billingHistory === 'object') {
      const billing = data.billingHistory as any;
      
      // Subscriptions
      if (billing.subscriptions) {
        billing.subscriptions.forEach((subscription: any, index: number) => {
          Object.entries(subscription).forEach(([key, value]) => {
            csvRows.push(`Subscription ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
          });
        });
      }

      // Invoices
      if (billing.invoices) {
        billing.invoices.forEach((invoice: any, index: number) => {
          Object.entries(invoice).forEach(([key, value]) => {
            csvRows.push(`Invoice ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
          });
        });
      }

      // Payments
      if (billing.payments) {
        billing.payments.forEach((payment: any, index: number) => {
          Object.entries(payment).forEach(([key, value]) => {
            csvRows.push(`Payment ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
          });
        });
      }
    }
    
    return csvRows.join('\n');
  }

  // Private helper methods
  private static async getUserWorkspaces(userId: string): Promise<any[]> {
    try {
      // Import dynamically to avoid circular dependencies
      const { Workspace } = await import('../models/Workspace');
      const { WorkspaceMember } = await import('../models/WorkspaceMember');
      
      const memberships = await WorkspaceMember.find({ userId });
      const workspaceIds = memberships.map(m => m.workspaceId);
      const workspaces = await Workspace.find({ _id: { $in: workspaceIds } });
      
      return memberships.map(membership => {
        const workspace = workspaces.find(w => w._id.toString() === membership.workspaceId.toString());
        return {
          id: membership.workspaceId.toString(),
          name: workspace?.name || 'Unknown Workspace',
          role: membership.role,
          joinedAt: membership.createdAt,
        };
      });
    } catch (error) {
      logger.warn('Error fetching user workspaces for GDPR export', { userId, error });
      return [];
    }
  }

  private static async getUserPosts(userId: string): Promise<any[]> {
    try {
      const { Post } = await import('../models/Post');
      const posts = await Post.find({ createdBy: userId }).select('-__v');
      return posts.map(post => post.toJSON());
    } catch (error) {
      logger.warn('Error fetching user posts for GDPR export', { userId, error });
      return [];
    }
  }

  private static async getUserSocialAccounts(userId: string): Promise<any[]> {
    try {
      const { SocialAccount } = await import('../models/SocialAccount');
      const accounts = await SocialAccount.find({ userId })
        .select('-accessToken -refreshToken -__v'); // Exclude sensitive tokens
      return accounts.map(account => account.toJSON());
    } catch (error) {
      logger.warn('Error fetching user social accounts for GDPR export', { userId, error });
      return [];
    }
  }

  private static async getUserAnalytics(userId: string): Promise<any[]> {
    try {
      // TODO: Implement when analytics models are available
      return [];
    } catch (error) {
      logger.warn('Error fetching user analytics for GDPR export', { userId, error });
      return [];
    }
  }

  private static async getUserLoginHistory(userId: string): Promise<any[]> {
    try {
      // TODO: Implement when login history model is available
      return [];
    } catch (error) {
      logger.warn('Error fetching user login history for GDPR export', { userId, error });
      return [];
    }
  }

  private static async getUserAuditLogs(userId: string): Promise<any[]> {
    try {
      const { AuditLog } = await import('../models/AuditLog');
      const logs = await AuditLog.find({ userId }).select('-__v');
      return logs.map(log => log.toJSON());
    } catch (error) {
      logger.warn('Error fetching user audit logs for GDPR export', { userId, error });
      return [];
    }
  }

  private static async getUserBillingHistory(userId: string): Promise<any> {
    try {
      // Import billing models dynamically to avoid circular dependencies
      const { Subscription } = await import('../models/Subscription');
      const { Invoice } = await import('../models/Invoice');
      const { Payment } = await import('../models/Payment');

      const [subscriptions, invoices, payments] = await Promise.all([
        Subscription.find({ userId }).select('-__v').lean(),
        Invoice.find({ userId }).select('-__v').lean(),
        Payment.find({ userId }).select('-__v').lean(),
      ]);

      return {
        subscriptions: subscriptions || [],
        invoices: invoices || [],
        payments: payments || [],
      };
    } catch (error) {
      logger.warn('Error fetching user billing history for GDPR export', { userId, error });
      return {
        subscriptions: [],
        invoices: [],
        payments: [],
      };
    }
  }

  private static async cancelUserSubscriptions(userId: string): Promise<void> {
    try {
      // TODO: Implement subscription cancellation
      logger.info('User subscriptions cancelled', { userId });
    } catch (error) {
      logger.error('Error cancelling user subscriptions', { userId, error });
    }
  }

  private static async revokeUserOAuthTokens(userId: string): Promise<void> {
    try {
      const { SocialAccount } = await import('../models/SocialAccount');
      await SocialAccount.updateMany(
        { userId },
        { 
          $unset: { 
            accessToken: 1, 
            refreshToken: 1 
          },
          status: 'DISCONNECTED',
          disconnectedAt: new Date(),
        }
      );
      logger.info('User OAuth tokens revoked', { userId });
    } catch (error) {
      logger.error('Error revoking user OAuth tokens', { userId, error });
    }
  }

  private static async deleteUserPosts(userId: string, session: any): Promise<void> {
    try {
      const { Post } = await import('../models/Post');
      await Post.deleteMany({ createdBy: userId }).session(session);
    } catch (error) {
      logger.error('Error deleting user posts', { userId, error });
    }
  }

  private static async deleteUserAnalytics(userId: string, session: any): Promise<void> {
    try {
      // TODO: Implement when analytics models are available
    } catch (error) {
      logger.error('Error deleting user analytics', { userId, error });
    }
  }

  private static async deleteUserSocialAccounts(userId: string, session: any): Promise<void> {
    try {
      const { SocialAccount } = await import('../models/SocialAccount');
      await SocialAccount.deleteMany({ userId }).session(session);
    } catch (error) {
      logger.error('Error deleting user social accounts', { userId, error });
    }
  }

  private static async deleteUserWorkspaces(userId: string, session: any): Promise<void> {
    try {
      const { Workspace } = await import('../models/Workspace');
      const { WorkspaceMember } = await import('../models/WorkspaceMember');
      
      // Remove user from all workspaces
      await WorkspaceMember.deleteMany({ userId }).session(session);
      
      // Delete workspaces owned by the user
      await Workspace.deleteMany({ ownerId: userId }).session(session);
    } catch (error) {
      logger.error('Error deleting user workspaces', { userId, error });
    }
  }

  private static async anonymizeUserAuditLogs(userId: string, session: any): Promise<void> {
    try {
      const { AuditLog } = await import('../models/AuditLog');
      await AuditLog.updateMany(
        { userId },
        { 
          userId: null,
          userEmail: '[ANONYMIZED]',
          details: '[USER DATA ANONYMIZED FOR GDPR COMPLIANCE]',
        }
      ).session(session);
    } catch (error) {
      logger.error('Error anonymizing user audit logs', { userId, error });
    }
  }
}