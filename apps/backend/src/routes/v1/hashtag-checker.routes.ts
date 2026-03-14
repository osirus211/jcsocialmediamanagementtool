import { Router } from 'express';
import { BannedHashtagChecker } from '../../services/BannedHashtagChecker';
import { requireAuth } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';

const router = Router();

// POST /api/v1/hashtag-checker/check - Check hashtags for banned/problematic content
router.post('/check',
  requireAuth,
  body('hashtags')
    .isArray({ min: 1, max: 100 })
    .withMessage('Hashtags must be an array with 1-100 items'),
  body('hashtags.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each hashtag must be between 1-100 characters'),
  body('platform')
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { hashtags, platform } = req.body;

      const results = BannedHashtagChecker.checkHashtags(hashtags, platform);
      const report = BannedHashtagChecker.getHashtagSafetyReport(hashtags, platform);

      return res.json({
        success: true,
        data: {
          results,
          report
        }
      });
    } catch (error) {
      console.error('Error checking hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check hashtags'
      });
    }
  }
);

// GET /api/v1/hashtag-checker/banned - Get all banned hashtags for a platform
router.get('/banned',
  requireAuth,
  query('platform')
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const platform = req.query.platform as string;
      const bannedHashtags = BannedHashtagChecker.getBannedHashtagsForPlatform(platform);

      return res.json({
        success: true,
        data: bannedHashtags
      });
    } catch (error) {
      console.error('Error fetching banned hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch banned hashtags'
      });
    }
  }
);

// POST /api/v1/hashtag-checker/alternatives - Get alternative hashtags for banned ones
router.post('/alternatives',
  requireAuth,
  body('hashtag')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Hashtag must be between 1-100 characters'),
  body('platform')
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { hashtag, platform } = req.body;
      const alternatives = BannedHashtagChecker.getAlternatives(hashtag, platform);

      return res.json({
        success: true,
        data: {
          hashtag,
          alternatives
        }
      });
    } catch (error) {
      console.error('Error getting alternatives:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get alternatives'
      });
    }
  }
);

// POST /api/v1/hashtag-checker/filter - Filter safe hashtags from a list
router.post('/filter',
  requireAuth,
  body('hashtags')
    .isArray({ min: 1, max: 100 })
    .withMessage('Hashtags must be an array with 1-100 items'),
  body('hashtags.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each hashtag must be between 1-100 characters'),
  body('platform')
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { hashtags, platform } = req.body;
      const safeHashtags = BannedHashtagChecker.filterSafeHashtags(hashtags, platform);

      return res.json({
        success: true,
        data: {
          original: hashtags,
          safe: safeHashtags,
          removed: hashtags.filter(h => !safeHashtags.includes(h))
        }
      });
    } catch (error) {
      console.error('Error filtering hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to filter hashtags'
      });
    }
  }
);

export default router;


