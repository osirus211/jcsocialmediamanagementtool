/**
 * OAuth Routes
 * 
 * Handles OAuth authorization flows for social media platforms
 * Base: /api/v1/oauth
 * 
 * Security:
 * - Rate limiting on authorize and callback endpoints
 * - IP binding and validation
 * - Audit logging
 * - Replay protection
 */

import { Router } from 'express';
import { oauthController } from '../../controllers/OAuthController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { authorizeRateLimit, callbackRateLimit } from '../../middleware/oauthRateLimit';
import rateLimit from 'express-rate-limit';

const router = Router();

// Instagram-specific rate limiters
const instagramConnectOptionsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests to Instagram connect options. Please try again later.',
});

const instagramConnectRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.userId || (req as any).ip || 'unknown',
  message: 'Too many Instagram connection attempts. Please try again later.',
});

/**
 * Public routes (no auth required for callbacks)
 */

// OAuth callback (platform redirects here after authorization)
// Rate limit: 20 requests/min per IP
router.get('/:platform/callback', callbackRateLimit, oauthController.callback.bind(oauthController));

// Apple OAuth callback (POST - Apple uses form_post response mode)
router.post('/apple/callback', callbackRateLimit, oauthController.callback.bind(oauthController));

/**
 * Protected routes (require authentication)
 */
router.use(requireAuth);
router.use(requireWorkspace);

// Get available OAuth platforms
router.get('/platforms', oauthController.getPlatforms.bind(oauthController));

// Instagram OAuth routes
router.get('/instagram/authorize', authorizeRateLimit, oauthController.authorize.bind(oauthController));
router.get('/instagram/callback', callbackRateLimit, oauthController.callback.bind(oauthController));

// TikTok OAuth routes
router.get('/tiktok/authorize', authorizeRateLimit, oauthController.authorize.bind(oauthController));
router.get('/tiktok/callback', callbackRateLimit, oauthController.callback.bind(oauthController));

// Instagram-specific endpoints
router.get('/instagram/connect-options', instagramConnectOptionsRateLimit, oauthController.getInstagramConnectOptions.bind(oauthController));
router.post('/instagram/connect', instagramConnectRateLimit, oauthController.connectInstagram.bind(oauthController));

// Initiate OAuth flow (generic)
// Rate limit: 10 requests/min per user
router.post('/:platform/authorize', authorizeRateLimit, oauthController.authorize.bind(oauthController));

// Finalize multi-account connection
router.post('/:platform/finalize', oauthController.finalize.bind(oauthController));

// Test Twitter publish endpoint
router.post('/test/twitter-publish', oauthController.testTwitterPublish.bind(oauthController));

// Get OAuth connection status for workspace
router.get('/status/:workspaceId', oauthController.getStatus.bind(oauthController));

// Get OAuth session status by sessionId
router.get('/:platform/session-status', oauthController.getSessionStatus.bind(oauthController));

// Resume a failed OAuth session
router.post('/:platform/resume', oauthController.resumeSession.bind(oauthController));

export default router;
