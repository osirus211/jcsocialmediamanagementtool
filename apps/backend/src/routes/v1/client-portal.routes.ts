/**
 * Client Portal Routes
 * 
 * Handles client review sessions and branding management
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ClientPortalService } from '../../services/ClientPortalService';
import { ClientReviewStatus } from '../../models/ClientReview';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { sendSuccess, sendValidationError } from '../../utils/apiResponse';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

const router = Router();
const clientPortalService = new ClientPortalService();

// Validation middleware
const validateCreateReview = [
  body('name')
    .notEmpty()
    .withMessage('Review name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  
  body('postIds')
    .isArray({ min: 1 })
    .withMessage('At least one post is required'),
  
  body('postIds.*')
    .isMongoId()
    .withMessage('Invalid post ID'),
  
  body('clientEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
  
  body('clientName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Client name must be less than 100 characters'),
  
  body('expiresInDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Expiration must be between 1 and 30 days'),
];

const validateFeedback = [
  body('status')
    .isIn([ClientReviewStatus.APPROVED, ClientReviewStatus.REJECTED, ClientReviewStatus.CHANGES_REQUESTED])
    .withMessage('Invalid status'),
  
  body('feedback')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Feedback must be less than 2000 characters'),
];

const validateBranding = [
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),
  
  body('brandName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Brand name must be less than 100 characters'),
  
  body('logoUrl')
    .optional()
    .isURL()
    .withMessage('Logo URL must be a valid URL'),
  
  body('primaryColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Primary color must be a valid hex color'),
  
  body('customDomain')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Custom domain must be less than 100 characters'),
  
  body('welcomeMessage')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Welcome message must be less than 500 characters'),
  
  body('requirePassword')
    .optional()
    .isBoolean()
    .withMessage('Require password must be a boolean'),
  
  body('portalPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Portal password must be at least 6 characters'),
];

/**
 * @swagger
 * /api/v1/client-portal/reviews:
 *   post:
 *     summary: Create client review session
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - postIds
 *             properties:
 *               name:
 *                 type: string
 *               postIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               clientEmail:
 *                 type: string
 *               clientName:
 *                 type: string
 *               expiresInDays:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Review created successfully
 */
router.post('/reviews', requireAuth, requireWorkspace, validateCreateReview, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const { name, postIds, clientEmail, clientName, expiresInDays } = req.body;
    const workspaceId = req.workspace!.workspaceId;
    const createdBy = (req.user as any).userId;

    const review = await clientPortalService.createReview({
      workspaceId,
      name,
      postIds: postIds.map((id: string) => new mongoose.Types.ObjectId(id)),
      clientEmail,
      clientName,
      expiresInDays,
      createdBy,
    });

    const portalUrl = clientPortalService.getPortalUrl(review.token);

    sendSuccess(res, {
      review: review.toJSON(),
      portalUrl,
    }, 201);
  } catch (error: any) {
    logger.error('Create review error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portal/reviews:
 *   get:
 *     summary: List client reviews
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, viewed, approved, rejected, changes_requested]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get('/reviews', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const workspaceId = req.workspace!.workspaceId;

    const result = await clientPortalService.listReviews({
      workspaceId,
      status: status as ClientReviewStatus,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('List reviews error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portal/reviews/{id}:
 *   delete:
 *     summary: Delete client review
 *     tags: [Client Portal]
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
 *         description: Review deleted successfully
 */
router.delete('/reviews/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const reviewId = new mongoose.Types.ObjectId(req.params.id);
    const workspaceId = req.workspace!.workspaceId;

    await clientPortalService.deleteReview({ reviewId, workspaceId });

    sendSuccess(res, { message: 'Review deleted successfully' });
  } catch (error: any) {
    logger.error('Delete review error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portal/branding:
 *   get:
 *     summary: Get client portal branding
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Branding retrieved successfully
 */
router.get('/branding', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const workspace = req.workspace!;
    sendSuccess(res, { branding: (workspace as any).clientPortal });
  } catch (error: any) {
    logger.error('Get branding error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portal/branding:
 *   patch:
 *     summary: Update client portal branding
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               brandName:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *               primaryColor:
 *                 type: string
 *               customDomain:
 *                 type: string
 *               welcomeMessage:
 *                 type: string
 *               requirePassword:
 *                 type: boolean
 *               portalPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Branding updated successfully
 */
router.patch('/branding', requireAuth, requireWorkspace, validateBranding, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const workspaceId = req.workspace!.workspaceId;
    const updates = req.body;

    const workspace = await clientPortalService.updateBranding({
      workspaceId,
      ...updates,
    });

    sendSuccess(res, { branding: workspace.clientPortal });
  } catch (error: any) {
    logger.error('Update branding error:', error);
    next(error);
  }
});

// PUBLIC ROUTES (no authentication required)

/**
 * @swagger
 * /api/v1/client-portal/review/{token}:
 *   get:
 *     summary: Get client review (public)
 *     tags: [Client Portal]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review retrieved successfully
 */
router.get('/review/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await clientPortalService.getReview(token);

    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('Get public review error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portal/review/{token}/feedback:
 *   post:
 *     summary: Submit client feedback (public)
 *     tags: [Client Portal]
 *     parameters:
 *       - in: path
 *         name: token
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, changes_requested]
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 */
router.post('/review/:token/feedback', validateFeedback, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const { token } = req.params;
    const { status, feedback } = req.body;

    const review = await clientPortalService.submitFeedback({
      token,
      status,
      feedback,
    });

    sendSuccess(res, { review: review.toJSON() });
  } catch (error: any) {
    logger.error('Submit feedback error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portal/review/{token}/view:
 *   post:
 *     summary: Record review view (public)
 *     tags: [Client Portal]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: View recorded successfully
 */
router.post('/review/:token/view', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // This is handled automatically in getReview, but we provide this endpoint
    // for explicit view tracking if needed
    await clientPortalService.getReview(token);

    sendSuccess(res, { message: 'View recorded' });
  } catch (error: any) {
    logger.error('Record view error:', error);
    next(error);
  }
});

export default router;