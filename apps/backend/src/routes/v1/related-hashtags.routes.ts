import { Router } from 'express';
import { RelatedHashtagsService } from '../../services/RelatedHashtagsService';
import { requireAuth } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';

const router = Router();

// GET /api/v1/related-hashtags/discover - Get related hashtags for a single hashtag
router.get('/discover',
  requireAuth,
  query('hashtag')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Hashtag must be between 1-100 characters'),
  query('platform')
    .optional()
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

      const hashtag = req.query.hashtag as string;
      const platform = (req.query.platform as string) || 'instagram';

      const relatedHashtags = RelatedHashtagsService.getRelatedHashtags(hashtag, platform);

      return res.json({
        success: true,
        data: relatedHashtags
      });
    } catch (error) {
      console.error('Error discovering related hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to discover related hashtags'
      });
    }
  }
);

// POST /api/v1/related-hashtags/batch - Get related hashtags for multiple hashtags
router.post('/batch',
  requireAuth,
  body('hashtags')
    .isArray({ min: 1, max: 10 })
    .withMessage('Hashtags must be an array with 1-10 items'),
  body('hashtags.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each hashtag must be between 1-100 characters'),
  body('platform')
    .optional()
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

      const { hashtags, platform = 'instagram' } = req.body;

      const relatedHashtags = RelatedHashtagsService.getRelatedHashtagsForMultiple(hashtags, platform);

      return res.json({
        success: true,
        data: relatedHashtags
      });
    } catch (error) {
      console.error('Error getting batch related hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get related hashtags'
      });
    }
  }
);

// GET /api/v1/related-hashtags/search - Search for hashtags by keyword
router.get('/search',
  requireAuth,
  query('keyword')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Keyword must be between 1-50 characters'),
  query('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1-50'),
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

      const keyword = req.query.keyword as string;
      const platform = (req.query.platform as string) || 'instagram';
      const limit = parseInt(req.query.limit as string) || 10;

      const searchResults = RelatedHashtagsService.searchRelatedHashtags(keyword, platform, limit);

      return res.json({
        success: true,
        data: {
          keyword,
          platform,
          results: searchResults,
          total: searchResults.length
        }
      });
    } catch (error) {
      console.error('Error searching hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search hashtags'
      });
    }
  }
);

// GET /api/v1/related-hashtags/category - Get hashtags by category
router.get('/category',
  requireAuth,
  query('category')
    .isIn(['niche', 'size', 'theme', 'trending'])
    .withMessage('Invalid category'),
  query('baseHashtag')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Base hashtag must be between 1-100 characters'),
  query('platform')
    .optional()
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

      const category = req.query.category as 'niche' | 'size' | 'theme' | 'trending';
      const baseHashtag = req.query.baseHashtag as string;
      const platform = (req.query.platform as string) || 'instagram';

      const relatedHashtags = RelatedHashtagsService.getRelatedHashtags(baseHashtag, platform);
      const categoryGroup = relatedHashtags.groups.find(group => group.category === category);

      return res.json({
        success: true,
        data: {
          category,
          baseHashtag,
          group: categoryGroup || { category, title: '', description: '', hashtags: [] }
        }
      });
    } catch (error) {
      console.error('Error getting category hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get category hashtags'
      });
    }
  }
);

export default router;


