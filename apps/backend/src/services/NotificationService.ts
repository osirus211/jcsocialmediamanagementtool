import { logger } from '../utils/logger';
import mongoose from 'mongoose';

interface NotificationData {
  workspaceId: string;
  type: 'disconnected' | 'reconnect_success' | 'reconnect_failed';
  accountId: string;
  platform: string;
  accountName: string;
  message: string;
}

interface Notification extends NotificationData {
  id: string;
  timestamp: Date;
  isRead: boolean;
}

/**
 * Notification Service
 * 
 * Manages in-app notifications for reconnect events
 * Note: This is a simplified in-memory implementation
 * In production, use MongoDB collection or Redis
 */
export class NotificationService {
  private notifications: Map<string, Notification[]> = new Map();

  /**
   * Create a new notification
   */
  async createNotification(data: NotificationData): Promise<Notification> {
    const notification: Notification = {
      ...data,
      id: new mongoose.Types.ObjectId().toString(),
      timestamp: new Date(),
      isRead: false
    };

    // Get existing notifications for workspace
    const workspaceNotifications = this.notifications.get(data.workspaceId) || [];
    
    // Add new notification at the beginning
    workspaceNotifications.unshift(notification);
    
    // Keep only last 100 notifications per workspace
    if (workspaceNotifications.length > 100) {
      workspaceNotifications.splice(100);
    }
    
    this.notifications.set(data.workspaceId, workspaceNotifications);

    logger.info('Notification created', {
      notificationId: notification.id,
      type: data.type,
      workspaceId: data.workspaceId
    });

    return notification;
  }

  /**
   * Get reconnect notifications for workspace
   */
  async getReconnectNotifications(
    workspaceId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Notification[]> {
    const workspaceNotifications = this.notifications.get(workspaceId) || [];
    
    return workspaceNotifications
      .slice(offset, offset + limit)
      .map(notification => ({
        ...notification,
        // Format for frontend
        timestamp: notification.timestamp.toISOString()
      })) as any;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, workspaceId: string): Promise<void> {
    const workspaceNotifications = this.notifications.get(workspaceId) || [];
    
    const notification = workspaceNotifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      logger.debug('Notification marked as read', { notificationId, workspaceId });
    }
  }

  /**
   * Dismiss notification
   */
  async dismissNotification(notificationId: string, workspaceId: string): Promise<void> {
    const workspaceNotifications = this.notifications.get(workspaceId) || [];
    
    const index = workspaceNotifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      workspaceNotifications.splice(index, 1);
      this.notifications.set(workspaceId, workspaceNotifications);
      logger.debug('Notification dismissed', { notificationId, workspaceId });
    }
  }

  /**
   * Create account disconnected notification
   */
  async notifyAccountDisconnected(
    workspaceId: string,
    accountId: string,
    platform: string,
    accountName: string,
    reason: string
  ): Promise<void> {
    await this.createNotification({
      workspaceId,
      type: 'disconnected',
      accountId,
      platform,
      accountName,
      message: `${accountName} was disconnected: ${reason}`
    });
  }

  /**
   * Create reconnect success notification
   */
  async notifyReconnectSuccess(
    workspaceId: string,
    accountId: string,
    platform: string,
    accountName: string
  ): Promise<void> {
    await this.createNotification({
      workspaceId,
      type: 'reconnect_success',
      accountId,
      platform,
      accountName,
      message: `${accountName} was successfully reconnected`
    });
  }

  /**
   * Create reconnect failed notification
   */
  async notifyReconnectFailed(
    workspaceId: string,
    accountId: string,
    platform: string,
    accountName: string,
    error: string
  ): Promise<void> {
    await this.createNotification({
      workspaceId,
      type: 'reconnect_failed',
      accountId,
      platform,
      accountName,
      message: `Failed to reconnect ${accountName}: ${error}`
    });
  }
}

export const notificationService = new NotificationService();