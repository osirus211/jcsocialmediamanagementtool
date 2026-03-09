/**
 * Posts Routes
 * 
 * API routes for managing scheduled posts
 */

import { Router } from 'express';
import { postController } from '../../controllers/PostController';
import { bulkUploadController } from '../../controllers/BulkUploadController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import {
  validateCreatePost,
  validateUpdatePost,
  validateGetPosts,
  validatePostId,
  validateWorkspaceId,
  validateBulkDelete,
  validateBulkReschedule,
  validateBulkUpdate,
  validateDuplicatePost,
} from '../../validators/postValidators';
import {
  validateCalendar,
  validateHistory,
} from '../../validators/uiValidators';

const router = Router();

// Configure multer for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for post APIs
const postRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(postRateLimiter);

/**
 * @openapi
 * /api/v1/posts:
 *   post:
 *     summary: Create a scheduled post
 *     description: Schedule a new post for publishing to a social media platform
 *     tags:
 *       - Posts
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
 *               - socialAccountId
 *               - platform
 *               - content
 *               - scheduledAt
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *                 example: "507f1f77bcf86cd799439012"
 *               socialAccountId:
 *                 type: string
 *                 description: Social account ID
 *                 example: "507f1f77bcf86cd799439013"
 *               platform:
 *                 type: string
 *                 enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *                 description: Social media platform
 *                 example: twitter
 *               content:
 *                 type: string
 *                 description: Post content
 *                 example: "Check out our new product launch!"
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Media URLs to attach
 *                 example: ["https://example.com/image.jpg"]
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Scheduled publish time (must be in future)
 *                 example: "2026-03-04T15:00:00Z"
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/', validateCreatePost, (req, res, next) => {
  postController.createPost(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts:
 *   get:
 *     summary: Get posts with pagination
 *     description: Retrieve scheduled posts with filtering and pagination
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, queued, publishing, published, failed]
 *         description: Filter by post status
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *         description: Filter by platform
 *       - in: query
 *         name: socialAccountId
 *         schema:
 *           type: string
 *         description: Filter by social account ID
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
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         posts:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Post'
 *                     meta:
 *                       type: object
 *                       properties:
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', validateGetPosts, (req, res, next) => {
  postController.getPosts(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/stats:
 *   get:
 *     summary: Get post statistics
 *     description: Retrieve post statistics for a workspace
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PostStats'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', validateWorkspaceId, (req, res, next) => {
  postController.getPostStats(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/calendar:
 *   get:
 *     summary: Get calendar view of posts
 *     description: Retrieve posts grouped by scheduled date for calendar display
 *     tags:
 *       - Posts
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
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
 *     responses:
 *       200:
 *         description: Calendar data retrieved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/calendar', validateCalendar, (req, res, next) => {
  postController.getCalendar(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/history:
 *   get:
 *     summary: Get post history
 *     description: Retrieve post history with filtering by status, platform, and date range
 *     tags:
 *       - Posts
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, queued, publishing, published, failed]
 *         description: Filter by status
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *         description: Filter by platform
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
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
 *         description: History retrieved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/history', validateHistory, (req, res, next) => {
  postController.getHistory(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/{id}:
 *   get:
 *     summary: Get post by ID
 *     description: Retrieve a specific post with its publish attempts
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         post:
 *                           $ref: '#/components/schemas/Post'
 *                         attempts:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/PostAttempt'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */
router.get('/:id', [...validatePostId, ...validateWorkspaceId], (req, res, next) => {
  postController.getPostById(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/{id}:
 *   patch:
 *     summary: Update scheduled post
 *     description: Update a scheduled post (only allowed for posts with status 'scheduled')
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated post content
 *                 example: "Updated post content"
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated media URLs
 *                 example: ["https://example.com/new-image.jpg"]
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Updated scheduled time
 *                 example: "2026-03-04T16:00:00Z"
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         description: Validation error or invalid operation
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */
router.patch('/:id', [...validateUpdatePost, ...validateWorkspaceId], (req, res, next) => {
  postController.updatePost(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Delete scheduled post
 *     description: Delete a scheduled post (only allowed for posts with status 'scheduled' or 'failed')
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                           example: "Post deleted successfully"
 *       400:
 *         description: Validation error or invalid operation
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */
router.delete('/:id', [...validatePostId, ...validateWorkspaceId], (req, res, next) => {
  postController.deletePost(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/{id}/retry:
 *   post:
 *     summary: Retry failed post
 *     description: Retry publishing a failed post (only allowed for posts with status 'failed')
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Post retry scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Post'
 *                     meta:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                           example: "Post retry scheduled"
 *       400:
 *         description: Validation error or invalid operation
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */
router.post('/:id/retry', [...validatePostId, ...validateWorkspaceId], (req, res, next) => {
  postController.retryPost(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/{id}/duplicate:
 *   post:
 *     summary: Duplicate post to multiple platforms
 *     description: Create copies of a post for multiple social media platforms
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID to duplicate
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - platforms
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *                 example: "507f1f77bcf86cd799439012"
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *                 minItems: 1
 *                 maxItems: 7
 *                 description: Target platforms for duplication
 *                 example: ["twitter", "facebook", "linkedin"]
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional new scheduled time (defaults to original post's time)
 *                 example: "2026-03-05T15:00:00Z"
 *     responses:
 *       201:
 *         description: Post duplication completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         created:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Post'
 *                           description: Successfully created duplicate posts
 *                         failed:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               platform:
 *                                 type: string
 *                               reason:
 *                                 type: string
 *                           description: Platforms that failed to duplicate with reasons
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */
router.post('/:id/duplicate', validateDuplicatePost, (req, res, next) => {
  postController.duplicatePost(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/bulk/delete:
 *   post:
 *     summary: Bulk delete posts
 *     description: Delete multiple scheduled posts at once (only allowed for posts with status 'scheduled' or 'failed')
 *     tags:
 *       - Posts
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
 *               - postIds
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *                 example: "507f1f77bcf86cd799439012"
 *               postIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of post IDs to delete (max 100)
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"]
 *     responses:
 *       200:
 *         description: Bulk delete completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         deleted:
 *                           type: integer
 *                           description: Number of posts successfully deleted
 *                           example: 2
 *                         failed:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               postId:
 *                                 type: string
 *                               reason:
 *                                 type: string
 *                           description: Posts that failed to delete with reasons
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/bulk/delete', validateBulkDelete, (req, res, next) => {
  postController.bulkDelete(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/bulk/reschedule:
 *   post:
 *     summary: Bulk reschedule posts
 *     description: Reschedule multiple posts to a new time (only allowed for posts with status 'scheduled')
 *     tags:
 *       - Posts
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
 *               - postIds
 *               - scheduledAt
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *                 example: "507f1f77bcf86cd799439012"
 *               postIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of post IDs to reschedule (max 100)
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"]
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: New scheduled time (must be in future)
 *                 example: "2026-03-05T15:00:00Z"
 *     responses:
 *       200:
 *         description: Bulk reschedule completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         updated:
 *                           type: integer
 *                           description: Number of posts successfully rescheduled
 *                           example: 2
 *                         failed:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               postId:
 *                                 type: string
 *                               reason:
 *                                 type: string
 *                           description: Posts that failed to reschedule with reasons
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/bulk/reschedule', validateBulkReschedule, (req, res, next) => {
  postController.bulkReschedule(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/bulk/update:
 *   post:
 *     summary: Bulk update post status
 *     description: Update status for multiple posts at once
 *     tags:
 *       - Posts
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
 *               - postIds
 *               - status
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *                 example: "507f1f77bcf86cd799439012"
 *               postIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of post IDs to update (max 100)
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"]
 *               status:
 *                 type: string
 *                 enum: [scheduled, queued, publishing, published, failed]
 *                 description: New status for the posts
 *                 example: "scheduled"
 *     responses:
 *       200:
 *         description: Bulk update completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         updated:
 *                           type: integer
 *                           description: Number of posts successfully updated
 *                           example: 2
 *                         failed:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               postId:
 *                                 type: string
 *                               reason:
 *                                 type: string
 *                           description: Posts that failed to update with reasons
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/bulk/update', validateBulkUpdate, (req, res, next) => {
  postController.bulkUpdate(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/bulk-upload:
 *   post:
 *     summary: Bulk upload posts from CSV
 *     description: Upload a CSV file to create multiple scheduled posts
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file (max 5MB, max 500 rows)
 *     responses:
 *       201:
 *         description: Bulk upload job created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/bulk-upload', upload.single('file'), (req, res, next) => {
  bulkUploadController.uploadCSV(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/bulk-upload/{id}:
 *   get:
 *     summary: Get bulk upload job status
 *     description: Get the status of a bulk upload job
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Upload job ID
 *     responses:
 *       200:
 *         description: Upload job status
 *       404:
 *         description: Job not found
 *       401:
 *         description: Unauthorized
 */
router.get('/bulk-upload/:id', (req, res, next) => {
  bulkUploadController.getUploadStatus(req, res, next);
});

/**
 * @openapi
 * /api/v1/posts/bulk-upload:
 *   get:
 *     summary: List bulk upload jobs
 *     description: List recent bulk upload jobs for the workspace
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of upload jobs
 *       401:
 *         description: Unauthorized
 */
router.get('/bulk-upload', (req, res, next) => {
  bulkUploadController.listUploadJobs(req, res, next);
});

export default router;
