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

/**
 * @route   POST /api/v1/ai/repurpose
 */
router.post('/repurpose', checkAILimit, AIController.repurposeContent);

/**
 * @route   POST /api/v1/ai/longform-to-social
 */
router.post('/longform-to-social', checkAILimit, AIController.longformToSocial);

/**
 * @route   POST /api/v1/ai/predict-engagement
 */
router.post('/predict-engagement', AIController.predictEngagement);

/**
 * @route   POST /api/v1/ai/score-caption
 */
router.post('/score-caption', AIController.scoreCaption);

/**
 * @route   POST /api/v1/ai/recommend-post-time
 */
router.post('/recommend-post-time', AIController.recommendPostTime);

/**
 * @route   POST /api/v1/ai/suggest-reply
 */
router.post('/suggest-reply', checkAILimit, AIController.suggestReply);

/**
 * @route   POST /api/v1/ai/analyze-sentiment
 */
router.post('/analyze-sentiment', AIController.analyzeSentiment);

/**
 * @route   POST /api/v1/ai/moderate-content
 */
router.post('/moderate-content', AIController.moderateContent);

export default router;
