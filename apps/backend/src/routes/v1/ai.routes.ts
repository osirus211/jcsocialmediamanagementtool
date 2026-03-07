/**
 * AI Routes
 * AI-powered content generation endpoints
 */

import { Router } from 'express';
import { AIController } from '../../controllers/AIController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { aiRateLimiter } from '../../middleware/rateLimiter';
import { checkAILimit } from '../../middleware/planLimit';

const router = Router();

/**
 * Apply auth + workspace middleware to all AI routes
 */
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Apply AI rate limiter (already a middleware — DO NOT call it)
 */
router.use(aiRateLimiter);

/**
 * @route   POST /api/v1/ai/caption
 */
router.post('/caption', checkAILimit, AIController.generateCaption);

/**
 * @route   POST /api/v1/ai/hashtags
 */
router.post('/hashtags', checkAILimit, AIController.generateHashtags);

/**
 * @route   POST /api/v1/ai/rewrite
 */
router.post('/rewrite', checkAILimit, AIController.rewriteContent);

/**
 * @route   POST /api/v1/ai/improve
 */
router.post('/improve', checkAILimit, AIController.improveContent);

/**
 * @route   POST /api/v1/ai/suggestions
 */
router.post('/suggestions', checkAILimit, AIController.generateSuggestions);

export default router;
