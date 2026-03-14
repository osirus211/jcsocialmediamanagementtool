import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/NotificationService';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Notification Controller
 * 
 * Handles in-app notifications for reconnect events
 */
export class NotificationController {
  /**
   * Get reconnect notifications for workspace
   * GET /api/v1/notifications/reconnect
   */
  async getReconnectNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace!.workspaceId.toString();
      const { limit = 20, offset = 0 } = req.query;

      const notifications = await notificationService.getReconnectNotifications(
        workspaceId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        notifications,
        count: notifications.length
      });

      logger.debug('Reconnect notifications retrieved', {
        workspaceId,
        count: notifications.length
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/v1/notifications/:id/read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace!.workspaceId.toString();

      await notificationService.markAsRead(id, workspaceId);

      res.json({
        success: true,
        message: 'Notification marked as read'
      });

      logger.debug('Notification marked as read', { notificationId: id, workspaceId });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Dismiss notification
   * DELETE /api/v1/notifications/:id
   */
  async dismissNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace!.workspaceId.toString();

      await notificationService.dismissNotification(id, workspaceId);

      res.json({
        success: true,
        message: 'Notification dismissed'
      });

      logger.debug('Notification dismissed', { notificationId: id, workspaceId });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Create notification (internal use)
   * POST /api/v1/notifications
   */
  async createNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace!.workspaceId.toString();
      const { type, accountId, platform, accountName, message } = req.body;

      if (!type || !accountId || !platform || !accountName || !message) {
        throw new BadRequestError('Missing required notification fields');
      }

      const notification = await notificationService.createNotification({
        workspaceId,
        type,
        accountId,
        platform,
        accountName,
        message
      });

      res.status(201).json({
        success: true,
        notification,
        message: 'Notification created'
      });

      logger.info('Notification created', {
        notificationId: notification.id,
        type,
        workspaceId
      });

    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();