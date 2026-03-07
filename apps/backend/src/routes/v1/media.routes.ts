/**
 * Media Routes
 * 
 * API routes for media upload management
 */

import { Router } from 'express';
import { mediaController } from '../../controllers/MediaController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { rateLimit } from 'express-rate-limit';
import {
  validateGenerateUploadUrl,
  validateConfirmUpload,
  validateMarkUploadFailed,
  validateGetMediaById,
  validateGetMediaList,
  validateDeleteMedia,
} from '../../validators/mediaValidators';
import { validateMediaLibrary } from '../../validators/uiValidators';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for media APIs
const mediaRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs (lower than posts due to file uploads)
  message: 'Too many media requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(mediaRateLimiter);

/**
 * @openapi
 * /api/v1/media/upload-url:
 *   post:
 *     summary: Generate signed upload URL
 *     description: Generate a pre-signed URL for direct upload to S3-compatible storage
 *     tags:
 *       - Media
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
 *               - filename
 *               - mimeType
 *               - size
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *                 example: "507f1f77bcf86cd799439012"
 *               filename:
 *                 type: string
 *                 description: Original filename
 *                 example: "product-image.jpg"
 *               mimeType:
 *                 type: string
 *                 description: File MIME type
 *                 enum: [image/jpeg, image/jpg, image/png, image/gif, image/webp, video/mp4, video/mpeg, video/quicktime, video/webm]
 *                 example: "image/jpeg"
 *               size:
 *                 type: integer
 *                 description: File size in bytes
 *                 example: 1048576
 *     responses:
 *       200:
 *         description: Upload URL generated successfully
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
 *                         mediaId:
 *                           type: string
 *                           description: Media record ID
 *                         uploadUrl:
 *                           type: string
 *                           description: Pre-signed upload URL
 *                         storageUrl:
 *                           type: string
 *                           description: Public URL after upload
 *                         expiresIn:
 *                           type: integer
 *                           description: URL expiration time in seconds
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/upload-url', validateGenerateUploadUrl, (req, res, next) => {
  mediaController.generateUploadUrl(req, res, next);
});

/**
 * @openapi
 * /api/v1/media/{id}/confirm:
 *   post:
 *     summary: Confirm upload completion
 *     description: Confirm that file upload to S3 was successful and update media metadata
 *     tags:
 *       - Media
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
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
 *               width:
 *                 type: integer
 *                 description: Image/video width in pixels
 *               height:
 *                 type: integer
 *                 description: Image/video height in pixels
 *               duration:
 *                 type: integer
 *                 description: Video duration in seconds
 *     responses:
 *       200:
 *         description: Upload confirmed successfully
 *       400:
 *         description: Validation error or invalid operation
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Media not found
 */
router.post('/:id/confirm', validateConfirmUpload, (req, res, next) => {
  mediaController.confirmUpload(req, res, next);
});

/**
 * @openapi
 * /api/v1/media/{id}/failed:
 *   post:
 *     summary: Mark upload as failed
 *     description: Mark a media upload as failed with error details
 *     tags:
 *       - Media
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - error
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               error:
 *                 type: string
 *                 description: Error message
 *     responses:
 *       200:
 *         description: Upload marked as failed
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/failed', validateMarkUploadFailed, (req, res, next) => {
  mediaController.markUploadFailed(req, res, next);
});

/**
 * @openapi
 * /api/v1/media:
 *   get:
 *     summary: Get media list
 *     description: Retrieve media files with filtering and pagination
 *     tags:
 *       - Media
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
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [image, video]
 *         description: Filter by media type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, uploaded, failed]
 *         description: Filter by status
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
 *         description: Media list retrieved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', validateGetMediaList, (req, res, next) => {
  mediaController.getMediaList(req, res, next);
});

/**
 * @openapi
 * /api/v1/media/library:
 *   get:
 *     summary: Get media library
 *     description: Retrieve media library with search and advanced filtering
 *     tags:
 *       - Media
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by filename
 *       - in: query
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [image, video]
 *         description: Filter by media type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, uploaded, failed]
 *         description: Filter by status
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
 *         description: Media library retrieved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/library', validateMediaLibrary, (req, res, next) => {
  mediaController.getLibrary(req, res, next);
});

/**
 * @openapi
 * /api/v1/media/{id}:
 *   get:
 *     summary: Get media by ID
 *     description: Retrieve a specific media file by ID
 *     tags:
 *       - Media
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Media retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Media not found
 */
router.get('/:id', validateGetMediaById, (req, res, next) => {
  mediaController.getMediaById(req, res, next);
});

/**
 * @openapi
 * /api/v1/media/{id}:
 *   delete:
 *     summary: Delete media
 *     description: Delete a media file from storage and database
 *     tags:
 *       - Media
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Media deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Media not found
 */
router.delete('/:id', validateDeleteMedia, (req, res, next) => {
  mediaController.deleteMedia(req, res, next);
});

export default router;
