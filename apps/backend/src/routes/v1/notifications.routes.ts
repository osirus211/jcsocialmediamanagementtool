import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { notificationController } from '../../controllers/NotificationController';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Notification Routes
 * Base: /api/v1/notifications
 */

// Get reconnect notifications
router.get('/reconnect', notificationController.getReconnectNotifications.bind(notificationController));

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead.bind(notificationController));

// Dismiss notification
router.delete('/:id', notificationController.dismissNotification.bind(notificationController));

// Create notification (internal use)
router.post('/', notificationController.createNotification.bind(notificationController));

export default router;