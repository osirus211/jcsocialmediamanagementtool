/**
 * Evergreen Routes
 * 
 * API routes for managing evergreen content republishing rules
 */

import { Router, Request, Response, NextFunction } from 'express';
import { evergreenController } from '../../controllers/EvergreenController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for evergreen APIs
const evergreenLimit = new SlidingWindowRateLimiter({ maxRequests: 100, windowMs: 15 * 60 * 1000, keyPrefix: 'rateLimit:evergreen' });
const evergreenRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await evergreenLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many evergreen requests.' });
      return;
    }
    next();
  } catch {
    next();
  }
};

router.use(evergreenRateLimit);

/**
 * @openapi
 * /api/v1/evergreen-rules:
 *   post:
 *     summary: Create evergreen rule
 *     description: Create a rule to automatically republish evergreen content
 *     tags:
 *       - Evergreen
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
 *               - postId
 *               - repostInterval
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               postId:
 *                 type: string
 *                 description: Original post ID to republish
 *               repostInterval:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 description: Repost interval in days
 *               maxReposts:
 *                 type: integer
 *                 minimum: -1
 *                 default: -1
 *                 description: Maximum number of reposts (-1 for unlimited)
 *               contentModification:
 *                 type: object
 *                 description: Content modification settings
 *                 properties:
 *                   prefix:
 *                     type: string
 *                     description: Text to prepend to content
 *                   suffix:
 *                     type: string
 *                     description: Text to append to content
 *                   hashtagReplacement:
 *                     type: object
 *                     description: Hashtag replacement map
 *               enabled:
 *                 type: boolean
 *                 default: true
 *                 description: Whether rule is enabled
 *     responses:
 *       201:
 *         description: Evergreen rule created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', (req, res, next) => {
  evergreenController.createEvergreenRule(req, res, next);
});

/**
 * @openapi
 * /api/v1/evergreen-rules:
 *   get:
 *     summary: Get evergreen rules
 *     description: Retrieve evergreen rules with pagination
 *     tags:
 *       - Evergreen
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
 *         description: Evergreen rules retrieved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', (req, res, next) => {
  evergreenController.getEvergreenRules(req, res, next);
});

/**
 * @openapi
 * /api/v1/evergreen-rules/{id}:
 *   get:
 *     summary: Get evergreen rule by ID
 *     description: Retrieve a specific evergreen rule
 *     tags:
 *       - Evergreen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Evergreen rule ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Evergreen rule retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Evergreen rule not found
 */
router.get('/:id', (req, res, next) => {
  evergreenController.getEvergreenRuleById(req, res, next);
});

/**
 * @openapi
 * /api/v1/evergreen-rules/{id}:
 *   put:
 *     summary: Update evergreen rule
 *     description: Update an existing evergreen rule
 *     tags:
 *       - Evergreen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Evergreen rule ID
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
 *               repostInterval:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 description: Repost interval in days
 *               maxReposts:
 *                 type: integer
 *                 minimum: -1
 *                 description: Maximum number of reposts (-1 for unlimited)
 *               contentModification:
 *                 type: object
 *                 description: Content modification settings
 *               enabled:
 *                 type: boolean
 *                 description: Whether rule is enabled
 *     responses:
 *       200:
 *         description: Evergreen rule updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Evergreen rule not found
 */
router.put('/:id', (req, res, next) => {
  evergreenController.updateEvergreenRule(req, res, next);
});

/**
 * @openapi
 * /api/v1/evergreen-rules/{id}:
 *   delete:
 *     summary: Delete evergreen rule
 *     description: Delete an evergreen rule and cancel pending reposts
 *     tags:
 *       - Evergreen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Evergreen rule ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Evergreen rule deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Evergreen rule not found
 */
router.delete('/:id', (req, res, next) => {
  evergreenController.deleteEvergreenRule(req, res, next);
});

export default router;

