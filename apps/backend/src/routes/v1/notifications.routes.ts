// TODO: Web Push Notifications (VAPID) not yet implemented.
// Required: web-push npm package, VAPID key generation,
// PushSubscription model, /subscribe endpoint,
// push delivery in NotificationWorker.
// This is a known gap vs Buffer/Hootsuite/Sprout Social.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { notificationController } from '../../controllers/NotificationController';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

const notificationLimit = new SlidingWindowRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,
  keyPrefix: 'rateLimit:notifications',
});

const notificationRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await notificationLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many notification requests.',
      });
      return;
    }
    next();
  } catch { next(); }
};

router.use(notificationRateLimit);

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
