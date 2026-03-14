import { Router } from 'express';
import { CompetitorHashtagAnalysisService } from '../../services/CompetitorHashtagAnalysisService';
import { requireAuth } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';

const router = Router();

// POST /api/v1/competitor-hashtag-analysis/analyze - Analyze a competitor's hashtag strategy
router.post('/analyze',
  requireAuth,
  body('competitorHandle')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Competitor handle must be between 1-50 characters'),
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

      const { competitorHandle, platform = 'instagram' } = req.body;

      const analysis = await CompetitorHashtagAnalysisService.analyzeCompetitor(
        competitorHandle,
        platform
      );

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Competitor not found or analysis failed'
        });
      }

      return res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error analyzing competitor hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze competitor hashtags'
      });
    }
  }
);

// POST /api/v1/competitor-hashtag-analysis/compare - Compare your hashtags with competitor's
router.post('/compare',
  requireAuth,
  body('yourHashtags')
    .isArray({ min: 1, max: 50 })
    .withMessage('Your hashtags must be an array with 1-50 items'),
  body('yourHashtags.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each hashtag must be between 1-100 characters'),
  body('competitorHandle')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Competitor handle must be between 1-50 characters'),
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

      const { yourHashtags, competitorHandle, platform = 'instagram' } = req.body;

      const comparison = CompetitorHashtagAnalysisService.compareHashtagStrategies(
        yourHashtags,
        competitorHandle,
        platform
      );

      return res.json({
        success: true,
        data: {
          yourHashtags,
          competitorHandle,
          platform,
          comparison
        }
      });
    } catch (error) {
      console.error('Error comparing hashtag strategies:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to compare hashtag strategies'
      });
    }
  }
);

// POST /api/v1/competitor-hashtag-analysis/recommendations - Get hashtag recommendations based on competitor
router.post('/recommendations',
  requireAuth,
  body('competitorHandle')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Competitor handle must be between 1-50 characters'),
  body('yourHashtags')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Your hashtags must be an array with max 50 items'),
  body('yourHashtags.*')
    .optional()
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

      const { competitorHandle, yourHashtags = [], platform = 'instagram' } = req.body;

      const recommendations = CompetitorHashtagAnalysisService.getHashtagRecommendations(
        competitorHandle,
        yourHashtags,
        platform
      );

      return res.json({
        success: true,
        data: {
          competitorHandle,
          platform,
          ...recommendations
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

// GET /api/v1/competitor-hashtag-analysis/categories - Get competitor's hashtags by category
router.get('/categories',
  requireAuth,
  query('competitorHandle')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Competitor handle must be between 1-50 characters'),
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

      const competitorHandle = req.query.competitorHandle as string;
      const platform = (req.query.platform as string) || 'instagram';

      const categories = CompetitorHashtagAnalysisService.getCompetitorHashtagsByCategory(
        competitorHandle,
        platform
      );

      return res.json({
        success: true,
        data: {
          competitorHandle,
          platform,
          categories
        }
      });
    } catch (error) {
      console.error('Error fetching competitor hashtag categories:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch competitor hashtag categories'
      });
    }
  }
);

// POST /api/v1/competitor-hashtag-analysis/batch - Analyze multiple competitors
router.post('/batch',
  requireAuth,
  body('competitorHandles')
    .isArray({ min: 1, max: 10 })
    .withMessage('Competitor handles must be an array with 1-10 items'),
  body('competitorHandles.*')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each competitor handle must be between 1-50 characters'),
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

      const { competitorHandles, platform = 'instagram' } = req.body;

      const analyses = await CompetitorHashtagAnalysisService.analyzeMultipleCompetitors(
        competitorHandles,
        platform
      );

      const aggregatedInsights = CompetitorHashtagAnalysisService.getAggregatedInsights(analyses);

      return res.json({
        success: true,
        data: {
          platform,
          competitors: analyses,
          aggregatedInsights
        }
      });
    } catch (error) {
      console.error('Error analyzing multiple competitors:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze multiple competitors'
      });
    }
  }
);

// POST /api/v1/competitor-hashtag-analysis/insights - Get aggregated insights from competitors
router.post('/insights',
  requireAuth,
  body('competitorHandles')
    .isArray({ min: 2, max: 10 })
    .withMessage('Competitor handles must be an array with 2-10 items'),
  body('competitorHandles.*')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each competitor handle must be between 1-50 characters'),
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

      const { competitorHandles, platform = 'instagram' } = req.body;

      const analyses = await CompetitorHashtagAnalysisService.analyzeMultipleCompetitors(
        competitorHandles,
        platform
      );

      const insights = CompetitorHashtagAnalysisService.getAggregatedInsights(analyses);

      return res.json({
        success: true,
        data: {
          platform,
          competitorCount: analyses.length,
          ...insights
        }
      });
    } catch (error) {
      console.error('Error getting aggregated insights:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get aggregated insights'
      });
    }
  }
);

export default router;


