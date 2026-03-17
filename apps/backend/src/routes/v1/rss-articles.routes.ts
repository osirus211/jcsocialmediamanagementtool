/**
 * RSS Articles Routes
 * 
 * API routes for managing RSS article approval/rejection
 */

import { Router } from 'express';
import { rssFeedController } from '../../controllers/RSSFeedController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for RSS article APIs
const rssArticleRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for article operations
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(rssArticleRateLimiter);

/**
 * @openapi
 * /api/v1/rss/articles:
 *   get:
 *     summary: Get pending RSS articles
 *     description: Retrieve pending RSS articles across workspace for approval/rejection
 *     tags:
 *       - RSS Articles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Pending articles retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', (req, res, next) => {
  rssFeedController.getPendingArticles(req, res, next);
});

/**
 * @openapi
 * /api/v1/rss/articles/{id}:
 *   patch:
 *     summary: Update article status
 *     description: Approve or reject an RSS article
 *     tags:
 *       - RSS Articles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RSS article ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: New status for the article
 *     responses:
 *       200:
 *         description: Article status updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Article not found
 */
router.patch('/:id', (req, res, next) => {
  rssFeedController.updateArticleStatus(req, res, next);
});

/**
 * @openapi
 * /api/v1/rss/articles/bulk:
 *   post:
 *     summary: Bulk update article status
 *     description: Approve or reject multiple RSS articles at once
 *     tags:
 *       - RSS Articles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *               - status
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of article IDs
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: New status for all articles
 *     responses:
 *       200:
 *         description: Articles updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/bulk', (req, res, next) => {
  rssFeedController.bulkUpdateArticleStatus(req, res, next);
});

export default router;