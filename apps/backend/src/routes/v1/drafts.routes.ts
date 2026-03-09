/**
 * Draft Routes
 * 
 * API routes for draft post management
 */

import { Router } from 'express';
import { draftController } from '../../controllers/DraftController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { rateLimit } from 'express-rate-limit';
import {
  validateCreateDraft,
  validateUpdateDraft,
  validateGetDrafts,
  validateScheduleFromDraft,
} from '../../validators/draftValidators';
import { validateBody } from '../../middleware/validate';
import { createDraftSchema, updateDraftSchema } from '../../schemas/draft.schemas';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for draft APIs
const draftRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(draftRateLimiter);

/**
 * @openapi
 * /api/v1/drafts:
 *   post:
 *     summary: Create a draft post
 *     description: Save a post as draft for later scheduling
 *     tags:
 *       - Drafts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 maxLength: 10000
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *               socialAccountIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *               mediaIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Draft created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', validateCreateDraft, (req, res, next) => {
  draftController.createDraft(req, res, next);
});

/**
 * @openapi
 * /api/v1/drafts:
 *   get:
 *     summary: List drafts
 *     description: Retrieve drafts with pagination
 *     tags:
 *       - Drafts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt]
 *           default: updatedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Drafts retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', validateGetDrafts, (req, res, next) => {
  draftController.getDrafts(req, res, next);
});

/**
 * @openapi
 * /api/v1/drafts/{id}:
 *   get:
 *     summary: Get draft by ID
 *     description: Retrieve a specific draft
 *     tags:
 *       - Drafts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Draft retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft not found
 */
router.get('/:id', (req, res, next) => {
  draftController.getDraftById(req, res, next);
});

/**
 * @openapi
 * /api/v1/drafts/{id}:
 *   patch:
 *     summary: Update draft
 *     description: Update an existing draft
 *     tags:
 *       - Drafts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *               socialAccountIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *               mediaIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Draft updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft not found
 */
router.patch('/:id', validateUpdateDraft, (req, res, next) => {
  draftController.updateDraft(req, res, next);
});

/**
 * @openapi
 * /api/v1/drafts/{id}:
 *   delete:
 *     summary: Delete draft
 *     description: Delete a draft permanently
 *     tags:
 *       - Drafts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Draft deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft not found
 */
router.delete('/:id', (req, res, next) => {
  draftController.deleteDraft(req, res, next);
});

/**
 * @openapi
 * /api/v1/drafts/{id}/schedule:
 *   post:
 *     summary: Schedule draft
 *     description: Convert draft to scheduled post(s)
 *     tags:
 *       - Drafts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduledAt
 *             properties:
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Must be in the future
 *     responses:
 *       201:
 *         description: Draft scheduled successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft not found
 */
router.post('/:id/schedule', validateScheduleFromDraft, (req, res, next) => {
  draftController.scheduleFromDraft(req, res, next);
});

export default router;
