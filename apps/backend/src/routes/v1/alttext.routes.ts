/**
 * Alt Text Routes (v1)
 * 
 * Internal API for alt text generation and validation
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { AltTextService } from '../../services/AltTextService';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

const altTextService = new AltTextService();

/**
 * Generate alt text for an image
 * POST /api/v1/alttext/generate
 */
router.post(
  '/generate',
  [
    body('imageUrl')
      .isURL()
      .withMessage('Valid image URL is required'),
    body('platform')
      .optional()
      .isIn(['instagram', 'twitter', 'linkedin', 'facebook', 'pinterest', 'tiktok'])
      .withMessage('Invalid platform'),
    body('style')
      .optional()
      .isIn(['descriptive', 'seo', 'concise'])
      .withMessage('Invalid style'),
    body('context')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Context must be a string with max 500 characters'),
    body('maxLength')
      .optional()
      .isInt({ min: 10, max: 1000 })
      .withMessage('Max length must be between 10 and 1000 characters'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { imageUrl, platform, style, context, maxLength } = req.body;

      const altText = await altTextService.generateAltText(imageUrl, {
        platform,
        style,
        context,
        maxLength,
      });

      logger.info('Alt text generated', {
        userId: req.user.id,
        workspaceId: req.workspace.id,
        platform,
        style,
        length: altText.length,
      });

      res.json({
        success: true,
        data: {
          altText,
          length: altText.length,
          platform,
          style,
        },
      });
    } catch (error: any) {
      logger.error('Alt text generation failed', {
        userId: req.user.id,
        workspaceId: req.workspace.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate alt text',
        message: error.message,
      });
    }
  }
);

/**
 * Generate multiple alt text suggestions
 * POST /api/v1/alttext/suggestions
 */
router.post(
  '/suggestions',
  [
    body('imageUrl')
      .isURL()
      .withMessage('Valid image URL is required'),
    body('platform')
      .optional()
      .isIn(['instagram', 'twitter', 'linkedin', 'facebook', 'pinterest', 'tiktok'])
      .withMessage('Invalid platform'),
    body('context')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Context must be a string with max 500 characters'),
    body('maxLength')
      .optional()
      .isInt({ min: 10, max: 1000 })
      .withMessage('Max length must be between 10 and 1000 characters'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { imageUrl, platform, context, maxLength } = req.body;

      const suggestions = await altTextService.getAltTextSuggestions(imageUrl, {
        platform,
        context,
        maxLength,
      });

      logger.info('Alt text suggestions generated', {
        userId: req.user.id,
        workspaceId: req.workspace.id,
        platform,
        suggestionCount: suggestions.length,
      });

      res.json({
        success: true,
        data: {
          suggestions: suggestions.map((text, index) => ({
            id: index + 1,
            text,
            length: text.length,
            style: ['descriptive', 'seo', 'concise'][index] || 'descriptive',
          })),
          platform,
        },
      });
    } catch (error: any) {
      logger.error('Alt text suggestions generation failed', {
        userId: req.user.id,
        workspaceId: req.workspace.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate alt text suggestions',
        message: error.message,
      });
    }
  }
);

/**
 * Validate alt text quality
 * POST /api/v1/alttext/validate
 */
router.post(
  '/validate',
  [
    body('text')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Alt text must be between 1 and 1000 characters'),
    body('platform')
      .optional()
      .isIn(['instagram', 'twitter', 'linkedin', 'facebook', 'pinterest', 'tiktok'])
      .withMessage('Invalid platform'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { text, platform } = req.body;

      const validation = altTextService.validateAltText(text, platform);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error: any) {
      logger.error('Alt text validation failed', {
        userId: req.user.id,
        workspaceId: req.workspace.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to validate alt text',
        message: error.message,
      });
    }
  }
);

/**
 * Get platform limits and recommendations
 * GET /api/v1/alttext/platforms/:platform/limits
 */
router.get(
  '/platforms/:platform/limits',
  [
    param('platform')
      .isIn(['instagram', 'twitter', 'linkedin', 'facebook', 'pinterest', 'tiktok'])
      .withMessage('Invalid platform'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { platform } = req.params;

      const limits = altTextService.getPlatformLimits(platform);

      res.json({
        success: true,
        data: {
          platform,
          ...limits,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get platform limits', {
        userId: req.user.id,
        workspaceId: req.workspace.id,
        platform: req.params.platform,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get platform limits',
        message: error.message,
      });
    }
  }
);

/**
 * Get accessibility score for a post
 * POST /api/v1/alttext/accessibility-score
 */
router.post(
  '/accessibility-score',
  [
    body('mediaCount')
      .isInt({ min: 0, max: 20 })
      .withMessage('Media count must be between 0 and 20'),
    body('altTextCount')
      .isInt({ min: 0, max: 20 })
      .withMessage('Alt text count must be between 0 and 20'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { mediaCount, altTextCount } = req.body;

      const accessibilityScore = altTextService.getAccessibilityScore(mediaCount, altTextCount);

      res.json({
        success: true,
        data: accessibilityScore,
      });
    } catch (error: any) {
      logger.error('Failed to calculate accessibility score', {
        userId: req.user.id,
        workspaceId: req.workspace.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to calculate accessibility score',
        message: error.message,
      });
    }
  }
);

export default router;