/**
 * Instagram-specific API routes
 * 
 * Provides endpoints for:
 * - Location search
 * - User search for tagging
 * - Hashtag performance analysis
 * - Account insights
 * - Media validation
 */

import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { InstagramPublisher } from '../../providers/publishers/InstagramPublisher';
import { InstagramAnalyticsAdapter } from '../../adapters/analytics/InstagramAnalyticsAdapter';
import { SocialAccount } from '../../models/SocialAccount';
import { requireAuth } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * Search Instagram locations for tagging
 */
router.get('/locations/search',
  [
    query('q').isString().isLength({ min: 1, max: 100 }).withMessage('Query must be 1-100 characters'),
    query('accountId').isMongoId().withMessage('Valid account ID required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { q: query, accountId } = req.query as { q: string; accountId: string };
      const userId = (req as any).user.id;

      // Get Instagram account
      const account = await SocialAccount.findOne({
        _id: accountId,
        userId,
        platform: 'instagram',
        isActive: true,
      });

      if (!account) {
        res.status(404).json({ error: 'Instagram account not found' });
        return;
      }

      const publisher = new InstagramPublisher();
      const locations = await publisher.searchLocations(account, query);

      res.json({ locations });
    } catch (error: any) {
      logger.error('Failed to search Instagram locations', {
        error: error.message,
        query: req.query,
      });
      next(error);
    }
  }
);

/**
 * Search Instagram users for tagging
 */
router.get('/users/search',
  [
    query('q').isString().isLength({ min: 1, max: 50 }).withMessage('Query must be 1-50 characters'),
    query('accountId').isMongoId().withMessage('Valid account ID required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { q: query, accountId } = req.query as { q: string; accountId: string };
      const userId = (req as any).user.id;

      // Get Instagram account
      const account = await SocialAccount.findOne({
        _id: accountId,
        userId,
        platform: 'instagram',
        isActive: true,
      });

      if (!account) {
        res.status(404).json({ error: 'Instagram account not found' });
        return;
      }

      const publisher = new InstagramPublisher();
      const users = await publisher.searchUsers(account, query);

      res.json({ users });
    } catch (error: any) {
      logger.error('Failed to search Instagram users', {
        error: error.message,
        query: req.query,
      });
      next(error);
    }
  }
);

/**
 * Validate media for Instagram posting
 */
router.post('/media/validate',
  [
    body('mediaUrls').isArray({ min: 1, max: 10 }).withMessage('1-10 media URLs required'),
    body('mediaUrls.*').isURL().withMessage('Valid URLs required'),
    body('contentType').isIn(['feed', 'story', 'reel', 'carousel']).withMessage('Valid content type required'),
    body('aspectRatio').optional().isString().withMessage('Valid aspect ratio required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { mediaUrls, contentType, aspectRatio } = req.body;
      const publisher = new InstagramPublisher();

      const validation = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      // Validate media count
      const limits = publisher.getLimits();
      if (mediaUrls.length > limits.maxMediaCount) {
        validation.isValid = false;
        validation.errors.push(`Maximum ${limits.maxMediaCount} media items allowed`);
      }

      // Validate aspect ratio
      if (aspectRatio && !publisher.validateAspectRatio(aspectRatio, contentType)) {
        validation.isValid = false;
        validation.errors.push(`Aspect ratio ${aspectRatio} not supported for ${contentType}`);
      }

      // Validate content type specific rules
      if (contentType === 'carousel' && mediaUrls.length < 2) {
        validation.isValid = false;
        validation.errors.push('Carousel posts require at least 2 media items');
      }

      if (contentType === 'reel' && mediaUrls.length > 1) {
        validation.isValid = false;
        validation.errors.push('Reel posts support only 1 video');
      }

      if (contentType === 'story' && mediaUrls.length > 1) {
        validation.isValid = false;
        validation.errors.push('Story posts support only 1 media item');
      }

      // Add warnings for best practices
      if (contentType === 'feed' && aspectRatio !== '1:1') {
        validation.warnings.push('Square (1:1) aspect ratio recommended for feed posts');
      }

      res.json(validation);
    } catch (error: any) {
      logger.error('Failed to validate Instagram media', {
        error: error.message,
        body: req.body,
      });
      next(error);
    }
  }
);

/**
 * Analyze hashtag performance
 */
router.post('/hashtags/analyze',
  [
    body('hashtags').isArray({ min: 1, max: 30 }).withMessage('1-30 hashtags required'),
    body('hashtags.*').isString().matches(/^#[\w\u0590-\u05ff]+$/).withMessage('Valid hashtags required'),
    body('accountId').isMongoId().withMessage('Valid account ID required'),
    body('postId').optional().isString().withMessage('Valid post ID required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { hashtags, accountId, postId } = req.body;
      const userId = (req as any).user.id;

      // Get Instagram account
      const account = await SocialAccount.findOne({
        _id: accountId,
        userId,
        platform: 'instagram',
        isActive: true,
      });

      if (!account) {
        res.status(404).json({ error: 'Instagram account not found' });
        return;
      }

      const analyticsAdapter = new InstagramAnalyticsAdapter();
      
      let performance = [];
      if (postId) {
        // Analyze specific post hashtag performance
        performance = await analyticsAdapter.analyzeHashtagPerformance(
          postId,
          hashtags,
          account.accessToken
        );
      } else {
        // Return general hashtag recommendations
        performance = hashtags.map((hashtag: string) => ({
          hashtag,
          reach: 0,
          impressions: 0,
          engagement: 0,
          recommendation: 'No data available - post to analyze performance',
        }));
      }

      res.json({ performance });
    } catch (error: any) {
      logger.error('Failed to analyze Instagram hashtags', {
        error: error.message,
        body: req.body,
      });
      next(error);
    }
  }
);

/**
 * Get account insights and demographics
 */
router.get('/accounts/:accountId/insights',
  [
    param('accountId').isMongoId().withMessage('Valid account ID required'),
    query('period').optional().isIn(['day', 'week', 'days_28']).withMessage('Valid period required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { accountId } = req.params;
      const { period = 'week' } = req.query;
      const userId = (req as any).user.id;

      // Get Instagram account
      const account = await SocialAccount.findOne({
        _id: accountId,
        userId,
        platform: 'instagram',
        isActive: true,
      });

      if (!account) {
        res.status(404).json({ error: 'Instagram account not found' });
        return;
      }

      const analyticsAdapter = new InstagramAnalyticsAdapter();
      
      // Collect comprehensive analytics
      const insights = await analyticsAdapter.collectAnalytics({
        platformPostId: '', // Not needed for account-level insights
        accessToken: account.accessToken,
        account: account,
        accountId: account.providerUserId,
      });

      res.json({ insights });
    } catch (error: any) {
      logger.error('Failed to get Instagram account insights', {
        error: error.message,
        accountId: req.params.accountId,
      });
      next(error);
    }
  }
);

/**
 * Get optimal posting times
 */
router.get('/accounts/:accountId/optimal-times',
  [
    param('accountId').isMongoId().withMessage('Valid account ID required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { accountId } = req.params;
      const userId = (req as any).user.id;

      // Get Instagram account
      const account = await SocialAccount.findOne({
        _id: accountId,
        userId,
        platform: 'instagram',
        isActive: true,
      });

      if (!account) {
        res.status(404).json({ error: 'Instagram account not found' });
        return;
      }

      const analyticsAdapter = new InstagramAnalyticsAdapter();
      
      // Get optimal posting times (this would be part of account metrics)
      const insights = await analyticsAdapter.collectAnalytics({
        platformPostId: '',
        accessToken: account.accessToken,
        account: account,
        accountId: account.providerUserId,
      });

      const optimalTimes = insights.platformData?.optimalPostingTimes || {
        recommendedTimes: [],
        hourlyActivity: {},
      };

      res.json(optimalTimes);
    } catch (error: any) {
      logger.error('Failed to get optimal posting times', {
        error: error.message,
        accountId: req.params.accountId,
      });
      next(error);
    }
  }
);

/**
 * Validate hashtags count and format
 */
router.post('/hashtags/validate',
  [
    body('content').isString().withMessage('Content required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { content } = req.body;
      const publisher = new InstagramPublisher();

      const hashtagCount = publisher.countHashtags(content);
      const limits = publisher.getLimits();

      const validation = {
        hashtagCount,
        maxHashtags: limits.maxHashtags,
        isValid: hashtagCount <= limits.maxHashtags,
        warning: hashtagCount > limits.maxHashtags ? 
          `Too many hashtags. Instagram allows maximum ${limits.maxHashtags} hashtags.` : null,
      };

      res.json(validation);
    } catch (error: any) {
      logger.error('Failed to validate hashtags', {
        error: error.message,
        body: req.body,
      });
      next(error);
    }
  }
);

export default router;
