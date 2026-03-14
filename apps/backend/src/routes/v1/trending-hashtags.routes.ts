import { Router } from 'express';
import { TrendingHashtagsService } from '../../services/TrendingHashtagsService';
import { requireAuth } from '../../middleware/auth';
import { query, body, validationResult } from 'express-validator';

const router = Router();

// GET /api/v1/trending-hashtags - Get trending hashtags for a platform
router.get('/',
  requireAuth,
  query('platform')
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  query('category')
    .optional()
    .isIn(['all', 'general', 'technology', 'business', 'lifestyle', 'health', 'entertainment', 'food', 'travel', 'fashion', 'sports', 'news', 'environment', 'finance'])
    .withMessage('Invalid category'),
  query('region')
    .optional()
    .isIn(['all', 'global', 'north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania'])
    .withMessage('Invalid region'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
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
      const category = req.query.category as string;
      const region = req.query.region as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const trendingHashtags = TrendingHashtagsService.getTrendingHashtags(
        platform,
        category,
        region,
        limit
      );

      return res.json({
        success: true,
        data: trendingHashtags
      });
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch trending hashtags'
      });
    }
  }
);

// GET /api/v1/trending-hashtags/all-platforms - Get trending hashtags across all platforms
router.get('/all-platforms',
  requireAuth,
  query('category')
    .optional()
    .isIn(['all', 'general', 'technology', 'business', 'lifestyle', 'health', 'entertainment', 'food', 'travel', 'fashion', 'sports', 'news', 'environment', 'finance'])
    .withMessage('Invalid category'),
  query('region')
    .optional()
    .isIn(['all', 'global', 'north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania'])
    .withMessage('Invalid region'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
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

      const category = req.query.category as string;
      const region = req.query.region as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const allPlatformTrends = TrendingHashtagsService.getAllPlatformTrends(
        category,
        region,
        limit
      );

      return res.json({
        success: true,
        data: allPlatformTrends
      });
    } catch (error) {
      console.error('Error fetching all platform trends:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch trending hashtags for all platforms'
      });
    }
  }
);

// GET /api/v1/trending-hashtags/search - Search trending hashtags
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
      const platform = req.query.platform as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const searchResults = TrendingHashtagsService.searchTrendingHashtags(
        keyword,
        platform,
        limit
      );

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
      console.error('Error searching trending hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search trending hashtags'
      });
    }
  }
);

// GET /api/v1/trending-hashtags/velocity - Get hashtags by velocity (rising/falling/stable)
router.get('/velocity',
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

      const velocityTrends = TrendingHashtagsService.getVelocityTrends(platform);

      return res.json({
        success: true,
        data: {
          platform,
          ...velocityTrends
        }
      });
    } catch (error) {
      console.error('Error fetching velocity trends:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch velocity trends'
      });
    }
  }
);

// GET /api/v1/trending-hashtags/categories - Get trending hashtags grouped by category
router.get('/categories',
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

      const categorizedTrends = TrendingHashtagsService.getTrendingByCategory(platform);

      return res.json({
        success: true,
        data: {
          platform,
          categories: categorizedTrends
        }
      });
    } catch (error) {
      console.error('Error fetching categorized trends:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch categorized trends'
      });
    }
  }
);

// POST /api/v1/trending-hashtags/recommendations - Get hashtag recommendations based on user's hashtags
router.post('/recommendations',
  requireAuth,
  body('hashtags')
    .isArray({ min: 1, max: 20 })
    .withMessage('Hashtags must be an array with 1-20 items'),
  body('hashtags.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each hashtag must be between 1-100 characters'),
  body('platform')
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1-20'),
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

      const { hashtags, platform, limit = 10 } = req.body;

      const recommendations = TrendingHashtagsService.getHashtagRecommendations(
        hashtags,
        platform,
        limit
      );

      return res.json({
        success: true,
        data: {
          userHashtags: hashtags,
          platform,
          recommendations
        }
      });
    } catch (error) {
      console.error('Error getting hashtag recommendations:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get hashtag recommendations'
      });
    }
  }
);

// GET /api/v1/trending-hashtags/stats - Get trending statistics for a platform
router.get('/stats',
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

      const stats = TrendingHashtagsService.getTrendingStats(platform);

      return res.json({
        success: true,
        data: {
          platform,
          ...stats
        }
      });
    } catch (error) {
      console.error('Error fetching trending stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch trending statistics'
      });
    }
  }
);

// GET /api/v1/trending-hashtags/metadata - Get available categories and regions
router.get('/metadata',
  requireAuth,
  async (req, res) => {
    try {
      const categories = TrendingHashtagsService.getCategories();
      const regions = TrendingHashtagsService.getRegions();

      return res.json({
        success: true,
        data: {
          categories,
          regions,
          platforms: ['instagram', 'twitter', 'tiktok', 'linkedin', 'facebook']
        }
      });
    } catch (error) {
      console.error('Error fetching metadata:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch metadata'
      });
    }
  }
);

export default router;


