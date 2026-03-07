/**
 * Notification Service
 * 
 * Manages in-app notifications
 */

import mongoose from 'mongoose';
import { Notification, NotificationType, NotificationPriority, INotification } from '../models/Notification';
import { SystemEvent } from './EventService';
import { logger } from '../utils/logger';

export class NotificationService {
  /**
   * Create notification from event
   */
  async createNotification(params: {
    eventType: SystemEvent;
    workspaceId: string;
    userId?: string;
    payload: Record<string, any>;
  }): Promise<INotification | null> {
    const { eventType, workspaceId, userId, payload } = params;

    // Get notification details based on event type
    const details = this.getNotificationDetails(eventType, payload);
    if (!details) {
      logger.warn(`No notification details for event: ${eventType}`);
      return null;
    }

    // Determine recipients
    const recipients = await this.getRecipients(workspaceId, userId, eventType);

    // Create notifications for each recipient
    const notifications: INotification[] = [];
    for (const recipientId of recipients) {
      const notification = new Notification({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: recipientId,
        type: this.mapEventToNotificationType(eventType),
        priority: details.priority,
        title: details.title,
        message: details.message,
        data: payload,
        actionUrl: details.actionUrl,
        actionText: details.actionText,
        expiresAt: details.expiresAt,
      });

      await notification.save();
      notifications.push(notification);
    }

    logger.info(`Created ${notifications.length} notifications for event: ${eventType}`);
    return notifications[0] || null;
  }

  /**
   * Get notifications for user
   */
  async getNotifications(params: {
    userId: mongoose.Types.ObjectId;
    read?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<INotification[]> {
    const { userId, read, limit = 50, skip = 0 } = params;

    const query: any = { userId };
    if (read !== undefined) {
      query.read = read;
    }

    return Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: mongoose.Types.ObjectId): Promise<number> {
    return Notification.countDocuments({ userId, read: false });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: mongoose.Types.ObjectId): Promise<INotification | null> {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return null;
    }

    notification.read = true;
    notification.readAt = new Date();
    return notification.save();
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: mongoose.Types.ObjectId): Promise<number> {
    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    return result.modifiedCount;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: mongoose.Types.ObjectId): Promise<boolean> {
    const result = await Notification.deleteOne({ _id: notificationId });
    return result.deletedCount > 0;
  }

  /**
   * Delete all notifications for user
   */
  async deleteAllNotifications(userId: mongoose.Types.ObjectId): Promise<number> {
    const result = await Notification.deleteMany({ userId });
    return result.deletedCount;
  }

  /**
   * Get notification details based on event type
   */
  private getNotificationDetails(
    eventType: SystemEvent,
    payload: Record<string, any>
  ): {
    title: string;
    message: string;
    priority: NotificationPriority;
    actionUrl?: string;
    actionText?: string;
    expiresAt?: Date;
  } | null {
    const details: Partial<Record<SystemEvent, any>> = {
      [SystemEvent.POST_PUBLISHED]: {
        title: 'Post Published',
        message: `Your post was successfully published to ${payload.platform}`,
        priority: NotificationPriority.LOW,
        actionUrl: `/posts/${payload.postId}`,
        actionText: 'View Post',
      },
      [SystemEvent.POST_FAILED]: {
        title: 'Post Failed',
        message: `Failed to publish post to ${payload.platform}: ${payload.error}`,
        priority: NotificationPriority.HIGH,
        actionUrl: `/posts/${payload.postId}`,
        actionText: 'Retry',
      },
      [SystemEvent.APPROVAL_REQUIRED]: {
        title: 'Approval Required',
        message: `A new post is waiting for your approval`,
        priority: NotificationPriority.MEDIUM,
        actionUrl: `/approvals/${payload.postId}`,
        actionText: 'Review',
      },
      [SystemEvent.POST_APPROVED]: {
        title: 'Post Approved',
        message: 'Your post has been approved and will be published as scheduled',
        priority: NotificationPriority.LOW,
        actionUrl: `/posts/${payload.postId}`,
        actionText: 'View Post',
      },
      [SystemEvent.POST_REJECTED]: {
        title: 'Post Rejected',
        message: `Your post was rejected: ${payload.reason}`,
        priority: NotificationPriority.MEDIUM,
        actionUrl: `/posts/${payload.postId}`,
        actionText: 'Edit Post',
      },
      [SystemEvent.CONNECTION_EXPIRED]: {
        title: 'Connection Expired',
        message: `Your ${payload.platform} connection has expired. Please reconnect.`,
        priority: NotificationPriority.HIGH,
        actionUrl: `/settings/connections`,
        actionText: 'Reconnect',
      },
      [SystemEvent.CONNECTION_DEGRADED]: {
        title: 'Connection Issue',
        message: `Your ${payload.platform} connection is experiencing issues`,
        priority: NotificationPriority.MEDIUM,
        actionUrl: `/settings/connections`,
        actionText: 'Check Connection',
      },
      [SystemEvent.SUBSCRIPTION_FAILED]: {
        title: 'Subscription Payment Failed',
        message: `Payment failed: ${payload.reason}. Please update your payment method.`,
        priority: NotificationPriority.URGENT,
        actionUrl: '/settings/billing',
        actionText: 'Update Payment',
      },
      [SystemEvent.PAYMENT_FAILED]: {
        title: 'Payment Failed',
        message: `Payment of $${(payload.amount / 100).toFixed(2)} failed: ${payload.reason}`,
        priority: NotificationPriority.URGENT,
        actionUrl: '/settings/billing',
        actionText: 'Update Payment',
      },
      [SystemEvent.TRIAL_ENDING]: {
        title: 'Trial Ending Soon',
        message: `Your trial ends in ${payload.daysRemaining} days. Upgrade to continue.`,
        priority: NotificationPriority.MEDIUM,
        actionUrl: '/settings/billing',
        actionText: 'Upgrade Now',
      },
      [SystemEvent.LIMIT_REACHED]: {
        title: 'Limit Reached',
        message: `You've reached your ${payload.limitType} limit (${payload.limit}). Upgrade for more.`,
        priority: NotificationPriority.HIGH,
        actionUrl: '/settings/billing',
        actionText: 'Upgrade Plan',
      },
      [SystemEvent.LIMIT_WARNING]: {
        title: 'Approaching Limit',
        message: `You've used ${payload.percentage}% of your ${payload.limitType} limit`,
        priority: NotificationPriority.LOW,
        actionUrl: '/settings/billing',
        actionText: 'View Usage',
      },
      [SystemEvent.MEMBER_INVITED]: {
        title: 'Team Member Invited',
        message: `${payload.inviterName} invited ${payload.memberEmail} to the workspace`,
        priority: NotificationPriority.LOW,
      },
      [SystemEvent.MEMBER_JOINED]: {
        title: 'Team Member Joined',
        message: `${payload.memberName} joined the workspace`,
        priority: NotificationPriority.LOW,
      },
    };

    return details[eventType] || null;
  }

  /**
   * Map system event to notification type
   */
  private mapEventToNotificationType(eventType: SystemEvent): NotificationType {
    const mapping: Record<SystemEvent, NotificationType> = {
      [SystemEvent.POST_PUBLISHED]: NotificationType.POST_PUBLISHED,
      [SystemEvent.POST_FAILED]: NotificationType.POST_FAILED,
      [SystemEvent.POST_SCHEDULED]: NotificationType.POST_SCHEDULED,
      [SystemEvent.APPROVAL_REQUIRED]: NotificationType.APPROVAL_REQUIRED,
      [SystemEvent.POST_APPROVED]: NotificationType.POST_APPROVED,
      [SystemEvent.POST_REJECTED]: NotificationType.POST_REJECTED,
      [SystemEvent.CONNECTION_EXPIRED]: NotificationType.CONNECTION_EXPIRED,
      [SystemEvent.CONNECTION_DEGRADED]: NotificationType.CONNECTION_DEGRADED,
      [SystemEvent.CONNECTION_RECOVERED]: NotificationType.CONNECTION_RECOVERED,
      [SystemEvent.CONNECTION_DISCONNECTED]: NotificationType.CONNECTION_EXPIRED,
      [SystemEvent.SUBSCRIPTION_CREATED]: NotificationType.SUBSCRIPTION_CREATED,
      [SystemEvent.SUBSCRIPTION_FAILED]: NotificationType.SUBSCRIPTION_FAILED,
      [SystemEvent.SUBSCRIPTION_CANCELED]: NotificationType.SUBSCRIPTION_CANCELED,
      [SystemEvent.SUBSCRIPTION_RENEWED]: NotificationType.SUBSCRIPTION_RENEWED,
      [SystemEvent.TRIAL_ENDING]: NotificationType.TRIAL_ENDING,
      [SystemEvent.PAYMENT_FAILED]: NotificationType.PAYMENT_FAILED,
      [SystemEvent.LIMIT_REACHED]: NotificationType.LIMIT_REACHED,
      [SystemEvent.LIMIT_WARNING]: NotificationType.LIMIT_WARNING,
      [SystemEvent.MEMBER_INVITED]: NotificationType.MEMBER_INVITED,
      [SystemEvent.MEMBER_JOINED]: NotificationType.MEMBER_JOINED,
      [SystemEvent.MEMBER_REMOVED]: NotificationType.MEMBER_REMOVED,
      [SystemEvent.MEDIA_PROCESSED]: NotificationType.MEDIA_PROCESSED,
      [SystemEvent.MEDIA_FAILED]: NotificationType.MEDIA_FAILED,
      [SystemEvent.ANALYTICS_READY]: NotificationType.ANALYTICS_READY,
    };

    return mapping[eventType] || NotificationType.SYSTEM_ANNOUNCEMENT;
  }

  /**
   * Get recipients for notification
   */
  private async getRecipients(
    workspaceId: string,
    userId: string | undefined,
    eventType: SystemEvent
  ): Promise<mongoose.Types.ObjectId[]> {
    // For now, send to the specified user or workspace owner
    // In production, this would query WorkspaceMember based on event type and roles
    
    if (userId) {
      return [new mongoose.Types.ObjectId(userId)];
    }

    // TODO: Get workspace owner or admins based on event type
    // For approval events, notify admins
    // For limit events, notify owner
    // etc.

    return [];
  }
}

export const notificationService = new NotificationService();
