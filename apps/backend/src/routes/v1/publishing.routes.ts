/**
 * Publishing Routes
 * 
 * Multi-platform publishing endpoints with real-time status tracking
 * Superior to Buffer, Hootsuite, Sprout Social, Later
 */

import { Router } from 'express';
import { PublishingController } from '../../controllers/PublishingController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { body, param } from 'express-validator';

const router = Router();

// Apply auth + workspace middleware to all publishing routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   POST /api/v1/publishing/publish-now
 * @desc    Publish to multiple platforms immediately (Publish Now button)
 */
router.post('/publish-now', [
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ max: 10000 })
    .withMessage('Content too long'),
  body('platforms')
    .isArray({ min: 1 })
    .withMessage('At least one platform is required'),
  body('platforms.*')
    .isString()
    .withMessage('Platform must be a string'),
  body('mediaIds')
    .optional()
    .isArray()
    .withMessage('Media IDs must be an array'),
  body('contentType')
    .optional()
    .isIn(['post', 'story', 'reel', 'thread'])
    .withMessage('Invalid content type'),
], validateRequest, PublishingController.publishNow);

/**
 * @route   GET /api/v1/publishing/:postId/status
 * @desc    Get real-time publishing status for a post
 */
router.get('/:postId/status', [
  param('postId')
    .isMongoId()
    .withMessage('Invalid post ID'),
], validateRequest, PublishingController.getPublishStatus);

/**
 * @route   POST /api/v1/publishing/:postId/retry-platform
 * @desc    Retry publishing to a specific platform
 */
router.post('/:postId/retry-platform', [
  param('postId')
    .isMongoId()
    .withMessage('Invalid post ID'),
  body('platform')
    .notEmpty()
    .withMessage('Platform is required')
    .isString()
    .withMessage('Platform must be a string'),
], validateRequest, PublishingController.retryPlatform);

/**
 * @route   POST /api/v1/publishing/:postId/retry-all-failed
 * @desc    Retry all failed platforms for a post
 */
router.post('/:postId/retry-all-failed', [
  param('postId')
    .isMongoId()
    .withMessage('Invalid post ID'),
], validateRequest, PublishingController.retryAllFailed);

/**
 * @route   GET /api/v1/publishing/:postId/platform-urls
 * @desc    Get platform-specific post URLs
 */
router.get('/:postId/platform-urls', [
  param('postId')
    .isMongoId()
    .withMessage('Invalid post ID'),
], validateRequest, PublishingController.getPlatformUrls);

export default router;