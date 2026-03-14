import { Router } from 'express';
import { HashtagDifficultyService } from '../../services/HashtagDifficultyService';
import { requireAuth } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';

const router = Router();

// POST /api/v1/hashtag-difficulty/analyze - Analyze hashtag difficulty scores
router.post('/analyze',
  requireAuth,
  body('hashtags')
    .isArray({ min: 1, max: 50 })
    .withMessage('Hashtags must be an array with 1-50 items'),
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

      const difficulties = HashtagDifficultyService.getHashtagsDifficulty(hashtags, platform);
      const mixRecommendations = HashtagDifficultyService.getHashtagMixRecommendations(hashtags, platform);

      return res.json({
        success: true,
        data: {
          hashtags: difficulties,
          analysis: mixRecommendations
        }
      });
    } catch (error) {
      console.error('Error analyzing hashtag difficulty:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze hashtag difficulty'
      });
    }
  }
);

// GET /api/v1/hashtag-difficulty/single - Get difficulty for a single hashtag
router.get('/single',
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

      const difficulty = HashtagDifficultyService.getHashtagDifficulty(hashtag, platform);
      const alternatives = HashtagDifficultyService.suggestAlternatives(hashtag, platform);

      return res.json({
        success: true,
        data: {
          difficulty,
          alternatives
        }
      });
    } catch (error) {
      console.error('Error getting hashtag difficulty:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get hashtag difficulty'
      });
    }
  }
);

// POST /api/v1/hashtag-difficulty/alternatives - Get alternative hashtags
router.post('/alternatives',
  requireAuth,
  body('hashtag')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Hashtag must be between 1-100 characters'),
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

      const { hashtag, platform = 'instagram' } = req.body;

      const alternatives = HashtagDifficultyService.suggestAlternatives(hashtag, platform);
      const alternativeDifficulties = HashtagDifficultyService.getHashtagsDifficulty(alternatives, platform);

      return res.json({
        success: true,
        data: {
          original: hashtag,
          alternatives: alternativeDifficulties
        }
      });
    } catch (error) {
      console.error('Error getting hashtag alternatives:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get hashtag alternatives'
      });
    }
  }
);

// POST /api/v1/hashtag-difficulty/optimize - Optimize hashtag mix for better performance
router.post('/optimize',
  requireAuth,
  body('hashtags')
    .isArray({ min: 1, max: 50 })
    .withMessage('Hashtags must be an array with 1-50 items'),
  body('hashtags.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each hashtag must be between 1-100 characters'),
  body('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  body('targetMix')
    .optional()
    .isObject()
    .withMessage('Target mix must be an object'),
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

      const { hashtags, platform = 'instagram', targetMix } = req.body;

      const currentAnalysis = HashtagDifficultyService.getHashtagMixRecommendations(hashtags, platform);
      
      // Generate optimized suggestions
      const optimizedSuggestions: string[] = [];
      
      // If too many hard hashtags, suggest easier alternatives
      if (currentAnalysis.current.hard > currentAnalysis.ideal.hard) {
        const hardHashtags = currentAnalysis.difficulties.filter(h => h.difficulty === 'hard');
        hardHashtags.slice(currentAnalysis.ideal.hard).forEach(hardHashtag => {
          const alternatives = HashtagDifficultyService.suggestAlternatives(hardHashtag.hashtag, platform);
          if (alternatives.length > 0) {
            optimizedSuggestions.push(`Replace ${hardHashtag.hashtag} with ${alternatives[0]} for better reach`);
          }
        });
      }

      // If not enough easy hashtags, suggest some
      if (currentAnalysis.current.easy < currentAnalysis.ideal.easy) {
        optimizedSuggestions.push('Add more niche/specific hashtags to improve discoverability');
      }

      return res.json({
        success: true,
        data: {
          current: currentAnalysis,
          optimizedSuggestions,
          performanceScore: Math.round(100 - currentAnalysis.averageScore * 0.5) // Higher score = better performance potential
        }
      });
    } catch (error) {
      console.error('Error optimizing hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to optimize hashtags'
      });
    }
  }
);

export default router;


