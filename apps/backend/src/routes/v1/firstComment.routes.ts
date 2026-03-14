import { Router } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { FirstCommentPublisher } from '../../services/FirstCommentPublisher';
import { Post } from '../../models/Post';
import { logger } from '../../utils/logger';

const router = Router();
const firstCommentPublisher = new FirstCommentPublisher();

/**
 * Update first comment for a post
 * PATCH /api/posts/:id/first-comment
 */
router.patch(
  '/:id/first-comment',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid post ID'),
    body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
    body('content').optional().isString().withMessage('Content must be a string'),
    body('platforms').optional().isArray().withMessage('Platforms must be an array'),
    body('delay').optional().isInt({ min: 0 }).withMessage('Delay must be a non-negative integer'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled, content, platforms, delay } = req.body;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      // Update first comment settings
      post.firstComment = {
        enabled,
        content: content || '',
        platforms: platforms || ['instagram', 'facebook'],
        delay: delay || 0,
      };

      await post.save();

      logger.info('First comment updated', {
        postId: id,
        enabled,
        platforms,
      });

      res.json({
        success: true,
        message: 'First comment updated successfully',
        firstComment: post.firstComment,
      });
    } catch (error: any) {
      logger.error('Failed to update first comment', {
        postId: req.params.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update first comment',
        error: error.message,
      });
    }
  }
);

/**
 * Retry failed first comment
 * POST /api/posts/:id/first-comment/retry
 */
router.post(
  '/:id/first-comment/retry',
  requireAuth,
  [param('id').isMongoId().withMessage('Invalid post ID')],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await firstCommentPublisher.retryFirstComment(id);

      if (result.success) {
        res.json({
          success: true,
          message: 'First comment retry successful',
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'First comment retry failed',
          error: result.error,
        });
      }
    } catch (error: any) {
      logger.error('Failed to retry first comment', {
        postId: req.params.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retry first comment',
        error: error.message,
      });
    }
  }
);

/**
 * Remove first comment from a post
 * DELETE /api/posts/:id/first-comment
 */
router.delete(
  '/:id/first-comment',
  requireAuth,
  [param('id').isMongoId().withMessage('Invalid post ID')],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      // Remove first comment
      post.firstComment = undefined;
      post.firstCommentStatus = undefined;
      post.firstCommentId = undefined;
      post.firstCommentPostedAt = undefined;

      await post.save();

      logger.info('First comment removed', {
        postId: id,
      });

      res.json({
        success: true,
        message: 'First comment removed successfully',
      });
    } catch (error: any) {
      logger.error('Failed to remove first comment', {
        postId: req.params.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to remove first comment',
        error: error.message,
      });
    }
  }
);

export { router as firstCommentRoutes };