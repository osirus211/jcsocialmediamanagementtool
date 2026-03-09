/**
 * RSS Feed Routes
 * 
 * API routes for managing RSS feed subscriptions
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

// Rate limiting for RSS feed APIs
const rssFeedRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(rssFeedRateLimiter);

/**
 * @openapi
 * /api/v1/rss-feeds:
 *   post:
 *     summary: Create RSS feed subscription
 *     description: Subscribe to an RSS feed for automatic content ingestion
 *     tags:
 *       - RSS Feeds
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - name
 *               - url
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               name:
 *                 type: string
 *                 description: Feed name
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: RSS feed URL
 *               pollingInterval:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 1440
 *                 default: 60
 *                 description: Polling interval in minutes
 *               enabled:
 *                 type: boolean
 *                 default: true
 *                 description: Whether feed is enabled
 *     responses:
 *       201:
 *         description: RSS feed created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', (req, res, next) => {
  rssFeedController.createRSSFeed(req, res, next);
});

/**
 * @openapi
 * /api/v1/rss-feeds:
 *   get:
 *     summary: Get RSS feeds
 *     description: Retrieve RSS feed subscriptions with pagination
 *     tags:
 *       - RSS Feeds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: Filter by enabled status
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
 *         description: RSS feeds retrieved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', (req, res, next) => {
  rssFeedController.getRSSFeeds(req, res, next);
});

/**
 * @openapi
 * /api/v1/rss-feeds/{id}:
 *   get:
 *     summary: Get RSS feed by ID
 *     description: Retrieve a specific RSS feed subscription
 *     tags:
 *       - RSS Feeds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RSS feed ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: RSS feed retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: RSS feed not found
 */
router.get('/:id', (req, res, next) => {
  rssFeedController.getRSSFeedById(req, res, next);
});

/**
 * @openapi
 * /api/v1/rss-feeds/{id}:
 *   put:
 *     summary: Update RSS feed
 *     description: Update an existing RSS feed subscription
 *     tags:
 *       - RSS Feeds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RSS feed ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               name:
 *                 type: string
 *                 description: Feed name
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: RSS feed URL
 *               pollingInterval:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 1440
 *                 description: Polling interval in minutes
 *               enabled:
 *                 type: boolean
 *                 description: Whether feed is enabled
 *     responses:
 *       200:
 *         description: RSS feed updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: RSS feed not found
 */
router.put('/:id', (req, res, next) => {
  rssFeedController.updateRSSFeed(req, res, next);
});

/**
 * @openapi
 * /api/v1/rss-feeds/{id}:
 *   delete:
 *     summary: Delete RSS feed
 *     description: Delete an RSS feed subscription and all its items
 *     tags:
 *       - RSS Feeds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RSS feed ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: RSS feed deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: RSS feed not found
 */
router.delete('/:id', (req, res, next) => {
  rssFeedController.deleteRSSFeed(req, res, next);
});

/**
 * @openapi
 * /api/v1/rss-feeds/{id}/items:
 *   get:
 *     summary: Get RSS feed items
 *     description: Retrieve items from an RSS feed with pagination
 *     tags:
 *       - RSS Feeds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RSS feed ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
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
 *         description: RSS feed items retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: RSS feed not found
 */
router.get('/:id/items', (req, res, next) => {
  rssFeedController.getRSSFeedItems(req, res, next);
});

export default router;
