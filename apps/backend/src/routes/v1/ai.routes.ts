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
import { validateRequest } from '../../middleware/validate';
import { generateContentSchema, improveContentSchema, generateCalendarSchema, generateImageSchema, generateImageVariationSchema } from '../../schemas/ai.schemas';

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
router.post('/caption', checkAILimit, validateRequest(generateContentSchema), AIController.generateCaption);

/**
 * @route   POST /api/v1/ai/hashtags
 */
router.post('/hashtags', checkAILimit, validateRequest(generateContentSchema), AIController.generateHashtags);

/**
 * @route   POST /api/v1/ai/rewrite
 */
router.post('/rewrite', checkAILimit, validateRequest(improveContentSchema), AIController.rewriteContent);

/**
 * @route   POST /api/v1/ai/improve
 */
router.post('/improve', checkAILimit, validateRequest(improveContentSchema), AIController.improveContent);

/**
 * @route   POST /api/v1/ai/suggestions
 */
router.post('/suggestions', checkAILimit, validateRequest(generateContentSchema), AIController.generateSuggestions);

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
 * @route   POST /api/v1/ai/generate-posts
 */
router.post('/generate-posts', checkAILimit, validateRequest(generateCalendarSchema), AIController.generateCalendarPosts);

/**
 * @route   POST /api/v1/ai/image-caption
 */
router.post('/image-caption', checkAILimit, AIController.generateImageCaption);

/**
 * @route   POST /api/v1/ai/brand-voice
 */
router.post('/brand-voice', checkAILimit, AIController.analyzeBrandVoice);

/**
 * @route   POST /api/v1/ai/templates
 */
router.post('/templates', checkAILimit, AIController.generateTemplates);

/**
 * @route   POST /api/v1/ai/cta
 */
router.post('/cta', checkAILimit, AIController.generateCTAs);

/**
 * @route   POST /api/v1/ai/emojis
 */
router.post('/emojis', checkAILimit, AIController.suggestEmojis);

/**
 * @route   POST /api/v1/ai/generate-image
 */
router.post('/generate-image', checkAILimit, validateRequest(generateImageSchema), AIController.generateImage);

/**
 * @route   POST /api/v1/ai/image-variation
 */
router.post('/image-variation', checkAILimit, validateRequest(generateImageVariationSchema), AIController.generateImageVariation);

/**
 * @route   GET /api/v1/ai/image-history
 */
router.get('/image-history', AIController.getImageHistory);

/**
 * @route   POST /api/v1/ai/moderate-content
 */
router.post('/moderate-content', AIController.moderateContent);

/**
 * @route   POST /api/v1/ai/translate
 */
router.post('/translate', checkAILimit, AIController.translateContent);

export default router;

