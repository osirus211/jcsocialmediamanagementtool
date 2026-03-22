import { Notification, INotification, NotificationType, NotificationPriority } from '../models/Notification';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

interface NotificationData {
  workspaceId: string;
  userId?: string;
  type: NotificationType | 'disconnected' | 'reconnect_success' | 'reconnect_failed';
  title?: string;
  message: string;
  accountId?: string;
  platform?: string;
  accountName?: string;
  data?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Notification Service
 * 
 * Manages in-app notifications using MongoDB persistence
 */
export class NotificationService {
  async createNotification(data: NotificationData): Promise<INotification> {
    try {
      const typeMap: Record<string, NotificationType> = {
        disconnected: NotificationType.CONNECTION_EXPIRED,
        reconnect_success: NotificationType.CONNECTION_RECOVERED,
        reconnect_failed: NotificationType.CONNECTION_DEGRADED,
      };

      const notifType = (Object.values(NotificationType).includes(data.type as NotificationType)
        ? data.type
        : typeMap[data.type]) as NotificationType;

      const notification = await Notification.create({
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        userId: data.userId ? new mongoose.Types.ObjectId(data.userId) : new mongoose.Types.ObjectId(),
        type: notifType || NotificationType.SYSTEM_ANNOUNCEMENT,
        priority: data.priority || 'medium',
        title: data.title || data.type,
        message: data.message,
        data: data.data || {},
        read: false,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      logger.info('Notification created', {
        notificationId: notification._id.toString(),
        type: data.type,
        workspaceId: data.workspaceId,
      });

      return notification;
    } catch (error: any) {
      logger.error('Failed to create notification', { error: error.message });
      throw error;
    }
  }

  async getReconnectNotifications(
    workspaceId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    return Notification.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      type: {
        $in: [
          NotificationType.CONNECTION_EXPIRED,
          NotificationType.CONNECTION_RECOVERED,
          NotificationType.CONNECTION_DEGRADED,
        ],
      },
    })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async markAsRead(notificationId: string, workspaceId: string): Promise<void> {
    await Notification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      },
      { $set: { read: true, readAt: new Date() } }
    );
  }

  async dismissNotification(notificationId: string, workspaceId: string): Promise<void> {
    await Notification.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(notificationId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
  }

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
      message: `${accountName} was disconnected: ${reason}`,
    });
  }

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
      message: `${accountName} was successfully reconnected`,
    });
  }

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
      message: `Failed to reconnect ${accountName}: ${error}`,
    });
  }
}

export const notificationService = new NotificationService();
