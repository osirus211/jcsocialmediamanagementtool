import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { reconnectController } from '../../controllers/ReconnectController';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Reconnect Routes
 * Base: /api/v1/accounts
 */

// Get all disconnected accounts
router.get('/disconnected', reconnectController.getDisconnectedAccounts.bind(reconnectController));

// Initiate reconnect OAuth flow
router.post('/:id/reconnect', reconnectController.initiateReconnect.bind(reconnectController));

// Snooze reconnect reminder
router.post('/:id/snooze', reconnectController.snoozeReconnectReminder.bind(reconnectController));

// Get reconnect status for all accounts
router.get('/reconnect-status', reconnectController.getReconnectStatus.bind(reconnectController));

// Webhook endpoint for OAuth callback
router.get('/reconnect-callback/:platform', reconnectController.handleReconnectCallback.bind(reconnectController));

export default router;
