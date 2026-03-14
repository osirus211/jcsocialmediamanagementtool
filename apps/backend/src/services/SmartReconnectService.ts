import { SocialAccount, AccountStatus } from '../models/SocialAccount';
import { notificationService } from './NotificationService';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

interface ReconnectUrgency {
  level: 'urgent' | 'warning' | 'info';
  message: string;
  daysUntilExpiry?: number;
}

/**
 * Smart Reconnect Service
 * 
 * Monitors account health and provides intelligent reconnect recommendations
 */
export class SmartReconnectService {
  /**
   * Check reconnect status for all accounts in workspace
   */
  async checkReconnectStatus(workspaceId: string): Promise<{
    urgent: any[];
    warning: any[];
    info: any[];
  }> {
    const accounts = await SocialAccount.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    }).select('provider accountName status metadata tokenExpiresAt');

    const urgent: any[] = [];
    const warning: any[] = [];
    const info: any[] = [];

    for (const account of accounts) {
      const urgency = this.getReconnectUrgency(account);
      
      const accountData = {
        id: account._id.toString(),
        platform: account.provider,
        accountName: account.accountName,
        status: account.status,
        urgency: urgency.level,
        message: urgency.message,
        daysUntilExpiry: urgency.daysUntilExpiry
      };

      switch (urgency.level) {
        case 'urgent':
          urgent.push(accountData);
          break;
        case 'warning':
          warning.push(accountData);
          break;
        case 'info':
          info.push(accountData);
          break;
      }
    }

    return { urgent, warning, info };
  }

  /**
   * Monitor accounts and send notifications for status changes
   */
  async monitorAccountHealth(workspaceId: string): Promise<void> {
    try {
      const accounts = await SocialAccount.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      });

      for (const account of accounts) {
        await this.checkAccountForNotifications(account, workspaceId);
      }

      logger.debug('Account health monitoring completed', { workspaceId });

    } catch (error) {
      logger.error('Account health monitoring failed', { error, workspaceId });
    }
  }

  /**
   * Get reconnect urgency level for an account
   */
  private getReconnectUrgency(account: any): ReconnectUrgency {
    const now = new Date();
    
    // Check if account is already disconnected
    if ([
      AccountStatus.EXPIRED,
      AccountStatus.REVOKED,
      AccountStatus.DISCONNECTED,
      AccountStatus.REAUTH_REQUIRED,
      AccountStatus.REFRESH_FAILED
    ].includes(account.status)) {
      return {
        level: 'urgent',
        message: 'Posts will fail - immediate reconnection required'
      };
    }

    // Check token expiration
    if (account.tokenExpiresAt) {
      const expiresAt = new Date(account.tokenExpiresAt);
      const msUntilExpiry = expiresAt.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        return {
          level: 'urgent',
          message: 'Token has expired - posts will fail'
        };
      }

      if (daysUntilExpiry <= 3) {
        return {
          level: 'urgent',
          message: `Token expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
          daysUntilExpiry
        };
      }

      if (daysUntilExpiry <= 7) {
        return {
          level: 'warning',
          message: `Token expires in ${daysUntilExpiry} days`,
          daysUntilExpiry
        };
      }

      if (daysUntilExpiry <= 14) {
        return {
          level: 'info',
          message: `Token expires in ${daysUntilExpiry} days`,
          daysUntilExpiry
        };
      }
    }

    // Check for permission changes or other issues
    if (account.status === AccountStatus.TOKEN_EXPIRING) {
      return {
        level: 'warning',
        message: 'Token expiring soon - refresh recommended'
      };
    }

    // Account is healthy
    return {
      level: 'info',
      message: 'Account is healthy'
    };
  }

  /**
   * Check individual account for notification triggers
   */
  private async checkAccountForNotifications(account: any, workspaceId: string): Promise<void> {
    const lastNotificationKey = `lastNotification_${account._id}`;
    const lastNotification = account.metadata?.[lastNotificationKey];
    const now = new Date();

    // Don't spam notifications - wait at least 4 hours between notifications
    if (lastNotification) {
      const lastNotificationTime = new Date(lastNotification);
      const hoursSinceLastNotification = (now.getTime() - lastNotificationTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastNotification < 4) {
        return;
      }
    }

    const urgency = this.getReconnectUrgency(account);

    // Send notification for urgent issues
    if (urgency.level === 'urgent') {
      await notificationService.notifyAccountDisconnected(
        workspaceId,
        account._id.toString(),
        account.provider,
        account.accountName,
        urgency.message
      );

      // Update last notification timestamp
      await SocialAccount.updateOne(
        { _id: account._id },
        {
          $set: {
            [`metadata.${lastNotificationKey}`]: now
          }
        }
      );
    }
  }

  /**
   * Get platform-specific reconnect instructions
   */
  getPlatformInstructions(platform: string): string[] {
    const instructions: { [key: string]: string[] } = {
      facebook: [
        'Click "Reconnect Now"',
        'Log in to your Facebook account',
        'Review and accept permissions',
        'Select pages to manage'
      ],
      instagram: [
        'Click "Reconnect Now"',
        'Log in to your Instagram Business account',
        'Ensure account is connected to Facebook Page',
        'Grant publishing permissions'
      ],
      twitter: [
        'Click "Reconnect Now"',
        'Log in to your Twitter account',
        'Authorize our application',
        'Grant read and write permissions'
      ],
      linkedin: [
        'Click "Reconnect Now"',
        'Log in to your LinkedIn account',
        'Review company page access',
        'Grant posting permissions'
      ],
      youtube: [
        'Click "Reconnect Now"',
        'Log in to your Google account',
        'Select YouTube channel',
        'Grant upload permissions'
      ]
    };

    return instructions[platform] || [
      'Click "Reconnect Now"',
      'Log in to your account',
      'Grant necessary permissions'
    ];
  }

  /**
   * Start monitoring service (runs every 5 minutes)
   */
  startMonitoring(): void {
    // Run initial check
    this.runGlobalHealthCheck();

    // Set up interval (5 minutes)
    setInterval(() => {
      this.runGlobalHealthCheck();
    }, 5 * 60 * 1000);

    logger.info('Smart reconnect monitoring service started');
  }

  /**
   * Run health check for all workspaces
   */
  private async runGlobalHealthCheck(): Promise<void> {
    try {
      // Get all unique workspace IDs
      const workspaces = await SocialAccount.distinct('workspaceId');

      for (const workspaceId of workspaces) {
        await this.monitorAccountHealth(workspaceId.toString());
      }

      logger.debug('Global health check completed', { workspaceCount: workspaces.length });

    } catch (error) {
      logger.error('Global health check failed', { error });
    }
  }
}

export const smartReconnectService = new SmartReconnectService();