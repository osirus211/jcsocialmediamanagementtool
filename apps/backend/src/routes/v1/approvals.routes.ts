/**
 * Approval Routes
 * 
 * Handles post approval workflow endpoints
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { approvalQueueService } from '../../services/ApprovalQueueService';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

const router = Router();

// Validation schemas
const rejectPostSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

// Apply auth middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   GET /api/v1/approvals
 * @desc    Get pending approvals queue for workspace
 * @access  Private
 */
router.get('/', async (req, res, next) => {
  try {
    const workspaceId = new mongoose.Types.ObjectId(req.workspace!.workspaceId);
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    const approvals = await approvalQueueService.getPendingApprovals({
      workspaceId,
      limit,
      skip,
    });

    res.json({
      success: true,
      data: approvals,
    });
  } catch (error: unknown) {
    logger.error('Get pending approvals error:', error);
    next(error);
  }
});

/**
 * @route   GET /api/v1/approvals/count
 * @desc    Get pending approval count for workspace
 * @access  Private
 */
router.get('/count', async (req, res, next) => {
  try {
    const workspaceId = new mongoose.Types.ObjectId(req.workspace!.workspaceId);

    const count = await approvalQueueService.getApprovalQueueCount(workspaceId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: unknown) {
    logger.error('Get approval count error:', error);
    next(error);
  }
});

/**
 * @route   GET /api/v1/approvals/my-posts
 * @desc    Get current user's posts pending approval
 * @access  Private
 */
router.get('/my-posts', async (req, res, next) => {
  try {
    const workspaceId = new mongoose.Types.ObjectId(req.workspace!.workspaceId);
    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    const posts = await approvalQueueService.getUserPendingPosts({
      workspaceId,
      userId,
    });

    res.json({
      success: true,
      data: posts,
    });
  } catch (error: unknown) {
    logger.error('Get user pending posts error:', error);
    next(error);
  }
});

/**
 * @route   POST /api/v1/approvals/:postId/submit
 * @desc    Submit post for approval
 * @access  Private
 */
router.post('/:postId/submit', async (req, res, next) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    await approvalQueueService.submitForApproval({
      postId,
      userId,
    });

    res.json({
      success: true,
      message: 'Post submitted for approval',
    });
  } catch (error: unknown) {
    logger.error('Submit for approval error:', error);
    next(error);
  }
});

/**
 * @route   POST /api/v1/approvals/:postId/approve
 * @desc    Approve post
 * @access  Private
 */
router.post('/:postId/approve', async (req, res, next) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    await approvalQueueService.approvePost({
      postId,
      userId,
    });

    res.json({
      success: true,
      message: 'Post approved successfully',
    });
  } catch (error: unknown) {
    logger.error('Approve post error:', error);
    next(error);
  }
});

/**
 * @route   POST /api/v1/approvals/:postId/reject
 * @desc    Reject post
 * @access  Private
 */
// Create a schema that validates the body
const rejectPostRequestSchema = z.object({
  body: rejectPostSchema,
});

router.post('/:postId/reject', validateRequest(rejectPostRequestSchema), async (req, res, next) => {
  try {
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const { reason } = req.body;

    await approvalQueueService.rejectPost({
      postId,
      userId,
      reason,
    });

    res.json({
      success: true,
      message: 'Post rejected',
    });
  } catch (error: unknown) {
    logger.error('Reject post error:', error);
    next(error);
  }
});

/**
 * @route   POST /api/v1/approvals/bulk-approve
 * @desc    Bulk approve posts
 * @access  Private
 */
router.post('/bulk-approve', async (req, res, next): Promise<any> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const { postIds } = req.body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'postIds array is required',
      });
    }

    const results = [];
    for (const postId of postIds) {
      try {
        await approvalQueueService.approvePost({
          postId: new mongoose.Types.ObjectId(postId),
          userId,
        });
        results.push({ postId, success: true });
      } catch (error) {
        results.push({ postId, success: false, error: (error as Error).message });
      }
    }

    res.json({
      success: true,
      data: { results },
    });
  } catch (error: unknown) {
    logger.error('Bulk approve posts error:', error);
    next(error);
  }
});

/**
 * @route   POST /api/v1/approvals/bulk-reject
 * @desc    Bulk reject posts
 * @access  Private
 */
router.post('/bulk-reject', async (req, res, next): Promise<any> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const { postIds, reason } = req.body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'postIds array is required',
      });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'reason is required',
      });
    }

    const results = [];
    for (const postId of postIds) {
      try {
        await approvalQueueService.rejectPost({
          postId: new mongoose.Types.ObjectId(postId),
          userId,
          reason,
        });
        results.push({ postId, success: true });
      } catch (error) {
        results.push({ postId, success: false, error: (error as Error).message });
      }
    }

    res.json({
      success: true,
      data: { results },
    });
  } catch (error: unknown) {
    logger.error('Bulk reject posts error:', error);
    next(error);
  }
});

export default router;