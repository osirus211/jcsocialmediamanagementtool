import { Router } from 'express';
import { socialAccountController } from '../../controllers/SocialAccountController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { checkSocialAccountLimit } from '../../middleware/planLimit';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Social Account Routes
 * Base: /api/v1/social
 */

// Connect account (OAuth placeholder)
router.post('/connect/:platform', checkSocialAccountLimit, socialAccountController.connectAccount.bind(socialAccountController));

// Get all accounts
router.get('/accounts', socialAccountController.getAccounts.bind(socialAccountController));

// Get accounts by platform
router.get('/accounts/platform/:platform', socialAccountController.getAccountsByPlatform.bind(socialAccountController));

// Get single account
router.get('/accounts/:id', socialAccountController.getAccount.bind(socialAccountController));

// Disconnect account
router.delete('/accounts/:id', socialAccountController.disconnectAccount.bind(socialAccountController));

// Refresh token
router.post('/accounts/:id/refresh', socialAccountController.refreshToken.bind(socialAccountController));

// Sync account info
router.post('/accounts/:id/sync', socialAccountController.syncAccount.bind(socialAccountController));

// Get account health dashboard
router.get('/accounts/health', socialAccountController.getHealth.bind(socialAccountController));

export default router;
