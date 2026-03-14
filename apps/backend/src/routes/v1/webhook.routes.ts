/**
 * Webhook Routes
 * 
 * Unified webhook endpoint for all social media platforms
 */

import { Router } from 'express';
import { rawBodyParser } from '../../middleware/rawBodyParser';
import { WebhookController } from '../../controllers/WebhookController';
import { WebhookProviderRegistry } from '../../providers/webhooks/WebhookProviderRegistry';
import { WebhookDeduplicationService } from '../../services/WebhookDeduplicationService';
import { WebhookVerificationCache } from '../../services/WebhookVerificationCache';
import { WebhookOrderingService } from '../../services/WebhookOrderingService';
import { WebhookRateLimiter } from '../../services/WebhookRateLimiter';
import { WebhookReplayProtectionService } from '../../services/WebhookReplayProtectionService';
import { WebhookIngestQueue } from '../../queue/WebhookIngestQueue';
import { getRedisClient } from '../../config/redis';
import {
  FacebookWebhookProvider,
  TwitterWebhookProvider,
  LinkedInWebhookProvider,
  InstagramWebhookProvider,
  YouTubeWebhookProvider,
  TikTokWebhookProvider,
  ThreadsWebhookProvider,
} from '../../providers/webhooks';

const router = Router();

// Initialize services
const redis = getRedisClient();
const providerRegistry = new WebhookProviderRegistry();
const deduplicationService = new WebhookDeduplicationService(redis);
const verificationCache = new WebhookVerificationCache(redis);
const orderingService = new WebhookOrderingService(redis);
const rateLimiter = new WebhookRateLimiter(redis);
const replayProtection = new WebhookReplayProtectionService(redis);
const ingestQueue = new WebhookIngestQueue();

// Register all providers
providerRegistry.register('facebook', new FacebookWebhookProvider());
providerRegistry.register('twitter', new TwitterWebhookProvider());
providerRegistry.register('linkedin', new LinkedInWebhookProvider());
providerRegistry.register('instagram', new InstagramWebhookProvider());
providerRegistry.register('youtube', new YouTubeWebhookProvider());
providerRegistry.register('tiktok', new TikTokWebhookProvider());
providerRegistry.register('threads', new ThreadsWebhookProvider());

// Initialize controller
const webhookController = new WebhookController(
  providerRegistry,
  deduplicationService,
  verificationCache,
  orderingService,
  rateLimiter,
  replayProtection,
  ingestQueue
);

/**
 * Unified webhook endpoint
 * 
 * POST /api/v1/webhooks/:provider
 * 
 * Supported providers:
 * - facebook
 * - twitter
 * - linkedin
 * - instagram
 * - youtube
 * - tiktok
 * - threads
 */
router.post(
  '/:provider',
  rawBodyParser,
  (req, res) => webhookController.handleWebhook(req, res)
);

/**
 * GET endpoint for Twitter CRC challenge
 */
router.get(
  '/:provider',
  (req, res) => webhookController.handleWebhook(req, res)
);

export default router;
export { ingestQueue }; // Export for worker initialization

