/**
 * Media Routes
 * 
 * Handles media upload and management endpoints
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { uploadController } from '../../controllers/UploadController';
import { mediaFolderController } from '../../controllers/MediaFolderController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace, requirePermission } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { Permission } from '../../services/WorkspacePermissionService';

const router = Router();

// All media routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// Generate presigned upload URL
router.post('/upload-url', requirePermission(Permission.UPLOAD_MEDIA), uploadController.generateUploadUrl.bind(uploadController));

// Complete upload and create media record
router.post('/complete', requirePermission(Permission.UPLOAD_MEDIA), uploadController.completeUpload.bind(uploadController));

// Folder management (Phase-2)
router.post('/folders', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.createFolder.bind(mediaFolderController));
router.get('/folders', requirePermission(Permission.VIEW_MEDIA), mediaFolderController.getFolders.bind(mediaFolderController));
router.patch('/folders/:id', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.updateFolder.bind(mediaFolderController));
router.delete('/folders/:id', requirePermission(Permission.DELETE_MEDIA), mediaFolderController.deleteFolder.bind(mediaFolderController));

// Media organization (Phase-2)
router.patch('/:id/folder', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.moveMediaToFolder.bind(mediaFolderController));
router.patch('/:id/tags', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.updateMediaTags.bind(mediaFolderController));

// Get media statistics
router.get('/stats', requirePermission(Permission.VIEW_MEDIA), uploadController.getMediaStats.bind(uploadController));

// List media
router.get('/', requirePermission(Permission.VIEW_MEDIA), uploadController.listMedia.bind(uploadController));

// Get media by ID
router.get('/:id', requirePermission(Permission.VIEW_MEDIA), uploadController.getMedia.bind(uploadController));

// Delete media
router.delete('/:id', requirePermission(Permission.DELETE_MEDIA), uploadController.deleteMedia.bind(uploadController));

// Video processing endpoints
router.post(
  '/:id/trim',
  requirePermission(Permission.UPLOAD_MEDIA),
  [
    param('id').isMongoId().withMessage('Invalid media ID'),
    body('startTime').isNumeric().withMessage('startTime must be a number'),
    body('endTime').isNumeric().withMessage('endTime must be a number'),
  ],
  uploadController.trimVideo.bind(uploadController)
);

router.post(
  '/:id/thumbnail',
  requirePermission(Permission.UPLOAD_MEDIA),
  [
    param('id').isMongoId().withMessage('Invalid media ID'),
    body('timeOffset').optional().isNumeric().withMessage('timeOffset must be a number'),
  ],
  uploadController.generateVideoThumbnail.bind(uploadController)
);

export default router;

