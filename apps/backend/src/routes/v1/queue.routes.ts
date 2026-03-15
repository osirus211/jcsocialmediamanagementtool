/**
 * Queue Routes
 * 
 * API routes for comprehensive queue management
 */

import { Router } from 'express';
import { queueController } from '../../controllers/QueueController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import {
  getQueueSchema,
  reorderQueueSchema,
  movePostSchema,
  shuffleQueueSchema,
  bulkOperationSchema,
} from '../../schemas/queue.schemas';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @openapi
 * /api/v1/queue:
 *   get:
 *     summary: Get queue with all scheduled posts
 *     description: Retrieve all scheduled posts in chronological order with queue statistics
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *         description: Filter by platform
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 100
 *         description: Number of posts to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of posts to skip
 *     responses:
 *       200:
 *         description: Queue retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/QueuedPost'
 *                     stats:
 *                       $ref: '#/components/schemas/QueueStats'
 *                     total:
 *                       type: integer
 */
router.get('/', validateRequest(getQueueSchema), queueController.getQueue);

export default router;
/**
 * @openapi
 * /api/v1/queue/reorder:
 *   post:
 *     summary: Reorder queue by moving a post to new position
 *     description: Move a post to a specific position in the queue and recalculate scheduled times
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - newPosition
 *             properties:
 *               postId:
 *                 type: string
 *                 description: ID of post to move
 *               newPosition:
 *                 type: integer
 *                 minimum: 1
 *                 description: New position in queue (1-based)
 *     responses:
 *       200:
 *         description: Queue reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QueuedPost'
 */
router.post('/reorder', validateRequest(reorderQueueSchema), queueController.reorderQueue);

/**
 * @openapi
 * /api/v1/queue/move-up:
 *   post:
 *     summary: Move post up one position
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 */
router.post('/move-up', validateRequest(movePostSchema), queueController.movePostUp);

/**
 * @openapi
 * /api/v1/queue/move-down:
 *   post:
 *     summary: Move post down one position
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 */
router.post('/move-down', validateRequest(movePostSchema), queueController.movePostDown);

/**
 * @openapi
 * /api/v1/queue/move-to-top:
 *   post:
 *     summary: Move post to top of queue
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 */
router.post('/move-to-top', validateRequest(movePostSchema), queueController.moveToTop);

/**
 * @openapi
 * /api/v1/queue/move-to-bottom:
 *   post:
 *     summary: Move post to bottom of queue
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 */
router.post('/move-to-bottom', validateRequest(movePostSchema), queueController.moveToBottom);

/**
 * @openapi
 * /api/v1/queue/remove:
 *   post:
 *     summary: Remove post from queue
 *     description: Convert scheduled post back to draft status
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 */
router.post('/remove', validateRequest(movePostSchema), queueController.removeFromQueue);

/**
 * @openapi
 * /api/v1/queue/shuffle:
 *   post:
 *     summary: Shuffle queue with smart distribution
 *     description: Intelligently shuffle queue using advanced algorithms that beat Buffer's basic shuffle
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *                 description: Only shuffle posts for this platform
 *               preserveTimeSlots:
 *                 type: boolean
 *                 default: true
 *                 description: Keep original time slots, just reassign posts
 *               distributionStrategy:
 *                 type: string
 *                 enum: [random, balanced, optimal]
 *                 default: optimal
 *                 description: Shuffle algorithm to use
 */
router.post('/shuffle', validateRequest(shuffleQueueSchema), queueController.shuffleQueue);

/**
 * @openapi
 * /api/v1/queue/bulk:
 *   post:
 *     summary: Bulk operations on queue
 *     description: Perform bulk operations on multiple posts
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operation
 *               - postIds
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [remove, reschedule, move_to_top, move_to_bottom]
 *               postIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 50
 *               options:
 *                 type: object
 *                 properties:
 *                   scheduledAt:
 *                     type: string
 *                     format: date-time
 *                     description: Required for reschedule operation
 */
router.post('/bulk', validateRequest(bulkOperationSchema), queueController.bulkOperation);

/**
 * PAUSE QUEUE ROUTES - Superior to Buffer & Hootsuite
 */

/**
 * @openapi
 * /api/v1/queue/pause:
 *   post:
 *     summary: Pause entire workspace queue or specific account
 *     description: Pause publishing for all accounts or a specific account. Superior to Buffer's basic pause.
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: Pause only this social account (optional)
 *               resumeAt:
 *                 type: string
 *                 format: date-time
 *                 description: Auto-resume at this time (optional)
 *               reason:
 *                 type: string
 *                 maxLength: 200
 *                 description: Reason for pausing (optional)
 *     responses:
 *       200:
 *         description: Queue paused successfully
 */
router.post('/pause', queueController.pauseQueue);

/**
 * @openapi
 * /api/v1/queue/resume:
 *   post:
 *     summary: Resume entire workspace queue or specific account
 *     description: Resume publishing for all accounts or a specific account
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: Resume only this social account (optional)
 *     responses:
 *       200:
 *         description: Queue resumed successfully
 */
router.post('/resume', queueController.resumeQueue);

/**
 * @openapi
 * /api/v1/queue/pause-until:
 *   post:
 *     summary: Pause queue until specific date/time
 *     description: Pause with automatic resume at specified time
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resumeAt
 *             properties:
 *               resumeAt:
 *                 type: string
 *                 format: date-time
 *                 description: When to auto-resume
 *               accountId:
 *                 type: string
 *                 description: Pause only this social account (optional)
 *               reason:
 *                 type: string
 *                 maxLength: 200
 *                 description: Reason for pausing (optional)
 *     responses:
 *       200:
 *         description: Queue paused with auto-resume scheduled
 */
router.post('/pause-until', queueController.pauseUntil);

/**
 * @openapi
 * /api/v1/queue/status:
 *   get:
 *     summary: Get current queue pause status
 *     description: Get detailed pause status for workspace and all accounts
 *     tags:
 *       - Queue
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/QueuePauseStatus'
 */
router.get('/status', queueController.getQueueStatus);