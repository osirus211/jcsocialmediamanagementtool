/**
 * Client Portal Routes
 * 
 * Handles client approval portals and branding management
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { ClientPortalService } from '../../services/ClientPortalService';
import { ClientReviewStatus, ClientPortalStatus, PostApprovalStatus } from '../../models/ClientReview';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { sendSuccess, sendValidationError, sendError } from '../../utils/apiResponse';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

const router = Router();
const clientPortalService = new ClientPortalService();

// Rate limiting for public endpoints
const publicRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware for new portal system
const validateCreatePortal = [
  body('name')
    .notEmpty()
    .withMessage('Portal name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  
  body('clientEmail')
    .isEmail()
    .withMessage('Valid client email is required'),
  
  body('clientName')
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ max: 100 })
    .withMessage('Client name must be less than 100 characters'),
  
  body('clientCompany')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Client company must be less than 100 characters'),
  
  body('postIds')
    .isArray({ min: 1 })
    .withMessage('At least one post is required'),
  
  body('postIds.*')
    .isMongoId()
    .withMessage('Invalid post ID'),
  
  body('allowedActions.view')
    .optional()
    .isBoolean()
    .withMessage('View permission must be boolean'),
  
  body('allowedActions.approve')
    .optional()
    .isBoolean()
    .withMessage('Approve permission must be boolean'),
  
  body('allowedActions.reject')
    .optional()
    .isBoolean()
    .withMessage('Reject permission must be boolean'),
  
  body('allowedActions.comment')
    .optional()
    .isBoolean()
    .withMessage('Comment permission must be boolean'),
  
  body('branding.primaryColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Primary color must be a valid hex color'),
  
  body('branding.accentColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Accent color must be a valid hex color'),
  
  body('branding.companyName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Company name must be less than 100 characters'),
  
  body('branding.customMessage')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Custom message must be less than 500 characters'),
  
  body('expiresInDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Expiration must be between 1 and 365 days'),
  
  body('passwordProtected')
    .optional()
    .isBoolean()
    .withMessage('Password protected must be boolean'),
  
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('notifyOnAction')
    .optional()
    .isBoolean()
    .withMessage('Notify on action must be boolean'),
];

const validateUpdatePortal = [
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  
  body('clientEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
  
  body('clientName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Client name must be less than 100 characters'),
  
  body('clientCompany')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Client company must be less than 100 characters'),
  
  body('status')
    .optional()
    .isIn(Object.values(ClientPortalStatus))
    .withMessage('Invalid status'),
];

const validatePostAction = [
  body('status')
    .isIn([PostApprovalStatus.APPROVED, PostApprovalStatus.REJECTED])
    .withMessage('Invalid status'),
  
  body('feedback')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters'),
];

const validateComment = [
  body('text')
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ max: 1000 })
    .withMessage('Comment must be less than 1000 characters'),
];

const validatePassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Legacy validation middleware (keep for backward compatibility)
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

// NEW CLIENT PORTAL ENDPOINTS

/**
 * @swagger
 * /api/v1/client-portals:
 *   post:
 *     summary: Create client portal
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', requireAuth, requireWorkspace, validateCreatePortal, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const workspaceId = req.workspace!.workspaceId;
    const createdBy = (req.user as any).userId;

    const portal = await clientPortalService.createPortal({
      workspaceId,
      createdBy,
      ...req.body,
      postIds: req.body.postIds.map((id: string) => new mongoose.Types.ObjectId(id)),
    });

    const portalUrl = clientPortalService.getPortalUrl(portal.slug);

    sendSuccess(res, {
      portal: portal.toJSON(),
      portalUrl,
    }, 201);
  } catch (error: any) {
    logger.error('Create portal error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals:
 *   get:
 *     summary: List client portals
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const workspaceId = req.workspace!.workspaceId;

    const result = await clientPortalService.getWorkspacePortals({
      workspaceId,
      status: status as ClientPortalStatus,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('List portals error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals/{id}:
 *   get:
 *     summary: Get client portal by ID
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const portalId = new mongoose.Types.ObjectId(req.params.id);
    const workspaceId = req.workspace!.workspaceId;

    const portal = await clientPortalService.getPortalById(portalId, workspaceId);

    sendSuccess(res, { portal: portal.toJSON() });
  } catch (error: any) {
    logger.error('Get portal error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals/{id}:
 *   patch:
 *     summary: Update client portal
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id', requireAuth, requireWorkspace, validateUpdatePortal, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const portalId = new mongoose.Types.ObjectId(req.params.id);
    const workspaceId = req.workspace!.workspaceId;

    const portal = await clientPortalService.updatePortal({
      portalId,
      workspaceId,
      ...req.body,
    });

    sendSuccess(res, { portal: portal.toJSON() });
  } catch (error: any) {
    logger.error('Update portal error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals/{id}:
 *   delete:
 *     summary: Delete client portal
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const portalId = new mongoose.Types.ObjectId(req.params.id);
    const workspaceId = req.workspace!.workspaceId;

    await clientPortalService.deletePortal({ portalId, workspaceId });

    sendSuccess(res, { message: 'Portal deleted successfully' });
  } catch (error: any) {
    logger.error('Delete portal error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals/{id}/posts:
 *   post:
 *     summary: Add posts to portal
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/posts', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const portalId = new mongoose.Types.ObjectId(req.params.id);
    const workspaceId = req.workspace!.workspaceId;
    const { postIds } = req.body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return sendError(res, 'VALIDATION_ERROR', 'Post IDs are required', 400);
    }

    const portal = await clientPortalService.addPostsToPortal(
      portalId,
      workspaceId,
      postIds.map((id: string) => new mongoose.Types.ObjectId(id))
    );

    sendSuccess(res, { portal: portal.toJSON() });
  } catch (error: any) {
    logger.error('Add posts to portal error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals/{id}/posts/{postId}:
 *   delete:
 *     summary: Remove post from portal
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id/posts/:postId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const portalId = new mongoose.Types.ObjectId(req.params.id);
    const postId = new mongoose.Types.ObjectId(req.params.postId);
    const workspaceId = req.workspace!.workspaceId;

    const portal = await clientPortalService.removePostFromPortal(portalId, workspaceId, postId);

    sendSuccess(res, { portal: portal.toJSON() });
  } catch (error: any) {
    logger.error('Remove post from portal error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals/{id}/regenerate-token:
 *   post:
 *     summary: Regenerate portal access token
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/regenerate-token', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const portalId = new mongoose.Types.ObjectId(req.params.id);
    const workspaceId = req.workspace!.workspaceId;

    const portal = await clientPortalService.regenerateAccessToken(portalId, workspaceId);

    sendSuccess(res, { 
      portal: portal.toJSON(),
      portalUrl: clientPortalService.getPortalUrl(portal.slug),
    });
  } catch (error: any) {
    logger.error('Regenerate token error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/client-portals/{id}/activity:
 *   get:
 *     summary: Get portal activity and analytics
 *     tags: [Client Portal]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/activity', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const portalId = new mongoose.Types.ObjectId(req.params.id);
    const workspaceId = req.workspace!.workspaceId;

    const result = await clientPortalService.getPortalActivity(portalId, workspaceId);

    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('Get portal activity error:', error);
    next(error);
  }
});

// PUBLIC PORTAL ENDPOINTS (no authentication required)

/**
 * @swagger
 * /api/public/portal/{slug}:
 *   get:
 *     summary: Get client portal (public)
 *     tags: [Public Portal]
 */
router.get('/public/portal/:slug', publicRateLimit, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await clientPortalService.getPortalBySlug(slug);

    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('Get public portal error:', error);
    if (error.message === 'Portal not found' || error.message === 'Portal has expired' || error.message === 'Portal is not active') {
      return sendError(res, 'PORTAL_ERROR', error.message, 404);
    }
    next(error);
  }
});

/**
 * @swagger
 * /api/public/portal/{slug}/verify-password:
 *   post:
 *     summary: Verify portal password (public)
 *     tags: [Public Portal]
 */
router.post('/public/portal/:slug/verify-password', publicRateLimit, validatePassword, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const { slug } = req.params;
    const { password } = req.body;

    const isValid = await clientPortalService.validatePortalAccess(slug, password);

    sendSuccess(res, { valid: isValid });
  } catch (error: any) {
    logger.error('Verify portal password error:', error);
    if (error.message === 'Portal not found') {
      return sendError(res, 'PORTAL_ERROR', error.message, 404);
    }
    next(error);
  }
});

/**
 * @swagger
 * /api/public/portal/{slug}/posts/{postId}/approve:
 *   post:
 *     summary: Approve post (public)
 *     tags: [Public Portal]
 */
router.post('/public/portal/:slug/posts/:postId/approve', publicRateLimit, async (req, res, next) => {
  try {
    const { slug, postId } = req.params;
    const { feedback } = req.body;
    const workspaceId = req.headers['x-workspace-id'] as string;

    const portal = await clientPortalService.clientApprovePost({
      slug,
      postId: new mongoose.Types.ObjectId(postId),
      status: PostApprovalStatus.APPROVED,
      feedback,
      workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined,
    });

    sendSuccess(res, { message: 'Post approved successfully' });
  } catch (error: any) {
    logger.error('Approve post error:', error);
    if (error.message.includes('not found') || error.message.includes('expired') || error.message.includes('not active')) {
      return sendError(res, 'PORTAL_ERROR', error.message, 404);
    }
    if (error.message.includes('not allowed') || error.code === 'PORTAL_WORKSPACE_MISMATCH') {
      return sendError(res, 'PERMISSION_ERROR', error.message, 403);
    }
    next(error);
  }
});

/**
 * @swagger
 * /api/public/portal/{slug}/posts/{postId}/reject:
 *   post:
 *     summary: Reject post (public)
 *     tags: [Public Portal]
 */
router.post('/public/portal/:slug/posts/:postId/reject', publicRateLimit, validatePostAction, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const { slug, postId } = req.params;
    const { feedback } = req.body;
    const workspaceId = req.headers['x-workspace-id'] as string;

    const portal = await clientPortalService.clientApprovePost({
      slug,
      postId: new mongoose.Types.ObjectId(postId),
      status: PostApprovalStatus.REJECTED,
      feedback,
      workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined,
    });

    sendSuccess(res, { message: 'Post rejected successfully' });
  } catch (error: any) {
    logger.error('Reject post error:', error);
    if (error.message.includes('not found') || error.message.includes('expired') || error.message.includes('not active')) {
      return sendError(res, 'PORTAL_ERROR', error.message, 404);
    }
    if (error.message.includes('not allowed') || error.code === 'PORTAL_WORKSPACE_MISMATCH') {
      return sendError(res, 'PERMISSION_ERROR', error.message, 403);
    }
    next(error);
  }
});

/**
 * @swagger
 * /api/public/portal/{slug}/posts/{postId}/comment:
 *   post:
 *     summary: Comment on post (public)
 *     tags: [Public Portal]
 */
router.post('/public/portal/:slug/posts/:postId/comment', publicRateLimit, validateComment, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array() as any);
    }

    const { slug, postId } = req.params;
    const { text } = req.body;
    const workspaceId = req.headers['x-workspace-id'] as string;

    // Get portal to extract client email
    const { portal } = await clientPortalService.getPortalBySlug(
      slug,
      workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined
    );

    await clientPortalService.clientCommentOnPost({
      slug,
      postId: new mongoose.Types.ObjectId(postId),
      text,
      clientEmail: portal.clientEmail,
    });

    sendSuccess(res, { message: 'Comment added successfully' });
  } catch (error: any) {
    logger.error('Comment on post error:', error);
    if (error.message.includes('not found') || error.message.includes('expired') || error.message.includes('not active')) {
      return sendError(res, 'PORTAL_ERROR', error.message, 404);
    }
    if (error.message.includes('not allowed') || error.code === 'PORTAL_WORKSPACE_MISMATCH') {
      return sendError(res, 'PERMISSION_ERROR', error.message, 403);
    }
    next(error);
  }
});

// LEGACY ENDPOINTS (keep for backward compatibility)

/**
 * @swagger
 * /api/v1/client-portal/reviews:
 *   post:
 *     summary: Create client review session (legacy)
 *     tags: [Client Portal Legacy]
 *     security:
 *       - bearerAuth: []
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
 *     summary: List client reviews (legacy)
 *     tags: [Client Portal Legacy]
 *     security:
 *       - bearerAuth: []
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
 *     summary: Delete client review (legacy)
 *     tags: [Client Portal Legacy]
 *     security:
 *       - bearerAuth: []
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
 *     summary: Get client portal branding (legacy)
 *     tags: [Client Portal Legacy]
 *     security:
 *       - bearerAuth: []
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
 *     summary: Update client portal branding (legacy)
 *     tags: [Client Portal Legacy]
 *     security:
 *       - bearerAuth: []
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

/**
 * @swagger
 * /api/v1/client-portal/review/{token}:
 *   get:
 *     summary: Get client review (public, legacy)
 *     tags: [Client Portal Legacy]
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
 *     summary: Submit client feedback (public, legacy)
 *     tags: [Client Portal Legacy]
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
 *     summary: Record review view (public, legacy)
 *     tags: [Client Portal Legacy]
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
