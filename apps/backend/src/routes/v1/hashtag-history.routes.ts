import { Router } from 'express';
import { HashtagHistoryService } from '../../services/HashtagHistoryService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { body, query, param, validationResult } from 'express-validator';

const router = Router();

// GET /api/v1/hashtag-history/recent - Get recent hashtags
router.get('/recent',
  requireAuth,
  requireWorkspace,
  query('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook', 'all'])
    .withMessage('Invalid platform'),
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const platform = req.query.platform as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const recentHashtags = await HashtagHistoryService.getRecentHashtags(
        workspaceId,
        platform,
        limit
      );

      return res.json({
        success: true,
        data: recentHashtags
      });
    } catch (error) {
      console.error('Error fetching recent hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch recent hashtags'
      });
    }
  }
);

// GET /api/v1/hashtag-history/top - Get most used hashtags
router.get('/top',
  requireAuth,
  requireWorkspace,
  query('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook', 'all'])
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const platform = req.query.platform as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const topHashtags = await HashtagHistoryService.getTopHashtags(
        workspaceId,
        platform,
        limit
      );

      return res.json({
        success: true,
        data: topHashtags
      });
    } catch (error) {
      console.error('Error fetching top hashtags:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch top hashtags'
      });
    }
  }
);

// GET /api/v1/hashtag-history/stats - Get hashtag usage statistics
router.get('/stats',
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    try {
      const workspaceId = req.workspace!.workspaceId.toString();

      const stats = await HashtagHistoryService.getHashtagStats(workspaceId);

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching hashtag stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch hashtag statistics'
      });
    }
  }
);

// POST /api/v1/hashtag-history/record - Record hashtag usage
router.post('/record',
  requireAuth,
  requireWorkspace,
  body('hashtags')
    .isArray({ min: 1, max: 50 })
    .withMessage('Hashtags must be an array with 1-50 items'),
  body('hashtags.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each hashtag must be between 1-100 characters'),
  body('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook', 'all'])
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const userId = req.user!.userId.toString();
      const { hashtags, platform = 'all' } = req.body;

      await HashtagHistoryService.recordHashtagUsage(
        hashtags,
        workspaceId,
        userId,
        platform
      );

      return res.json({
        success: true,
        message: 'Hashtag usage recorded successfully'
      });
    } catch (error) {
      console.error('Error recording hashtag usage:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to record hashtag usage'
      });
    }
  }
);

// GET /api/v1/hashtag-history/search - Search hashtag history
router.get('/search',
  requireAuth,
  requireWorkspace,
  query('q')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Search query must be between 1-50 characters'),
  query('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook', 'all'])
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const searchTerm = req.query.q as string;
      const platform = req.query.platform as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const results = await HashtagHistoryService.searchHashtagHistory(
        workspaceId,
        searchTerm,
        platform,
        limit
      );

      return res.json({
        success: true,
        data: {
          query: searchTerm,
          results,
          total: results.length
        }
      });
    } catch (error) {
      console.error('Error searching hashtag history:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search hashtag history'
      });
    }
  }
);

// GET /api/v1/hashtag-history/trends - Get hashtag usage trends
router.get('/trends',
  requireAuth,
  requireWorkspace,
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1-365'),
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const days = parseInt(req.query.days as string) || 30;

      const trends = await HashtagHistoryService.getHashtagTrends(workspaceId, days);

      return res.json({
        success: true,
        data: {
          period: `${days} days`,
          trends
        }
      });
    } catch (error) {
      console.error('Error fetching hashtag trends:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch hashtag trends'
      });
    }
  }
);

// DELETE /api/v1/hashtag-history/clear - Clear hashtag history
router.delete('/clear',
  requireAuth,
  requireWorkspace,
  query('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook', 'all'])
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const platform = req.query.platform as string;

      const deletedCount = await HashtagHistoryService.clearHashtagHistory(
        workspaceId,
        platform
      );

      return res.json({
        success: true,
        message: `Cleared ${deletedCount} hashtag history entries`,
        data: { deletedCount }
      });
    } catch (error) {
      console.error('Error clearing hashtag history:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to clear hashtag history'
      });
    }
  }
);

// DELETE /api/v1/hashtag-history/:hashtag - Remove specific hashtag from history
router.delete('/:hashtag',
  requireAuth,
  requireWorkspace,
  param('hashtag')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Hashtag must be between 1-100 characters'),
  query('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'x', 'tiktok', 'linkedin', 'facebook', 'all'])
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const hashtag = decodeURIComponent(req.params.hashtag);
      const platform = req.query.platform as string;

      const removed = await HashtagHistoryService.removeHashtagFromHistory(
        workspaceId,
        hashtag,
        platform
      );

      if (!removed) {
        return res.status(404).json({
          success: false,
          message: 'Hashtag not found in history'
        });
      }

      return res.json({
        success: true,
        message: 'Hashtag removed from history successfully'
      });
    } catch (error) {
      console.error('Error removing hashtag from history:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove hashtag from history'
      });
    }
  }
);

// GET /api/v1/hashtag-history/user/:userId - Get user-specific hashtag history
router.get('/user/:userId',
  requireAuth,
  requireWorkspace,
  param('userId').isMongoId().withMessage('Invalid user ID'),
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

      const workspaceId = req.workspace!.workspaceId.toString();
      const userId = req.params.userId;
      const limit = parseInt(req.query.limit as string) || 30;

      const userHashtags = await HashtagHistoryService.getUserHashtagHistory(
        userId,
        workspaceId,
        limit
      );

      return res.json({
        success: true,
        data: userHashtags
      });
    } catch (error) {
      console.error('Error fetching user hashtag history:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user hashtag history'
      });
    }
  }
);

export default router;


