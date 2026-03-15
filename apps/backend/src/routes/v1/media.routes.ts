/**
 * Media Routes
 * 
 * Handles media upload and management endpoints
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { uploadController } from '../../controllers/UploadController';
import { mediaFolderController } from '../../controllers/MediaFolderController';
import { mediaTagController } from '../../controllers/MediaTagController';
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

// Folder management
router.post('/folders', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.createFolder.bind(mediaFolderController));
router.get('/folders', requirePermission(Permission.VIEW_MEDIA), mediaFolderController.getFolders.bind(mediaFolderController));
router.patch('/folders/:id', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.updateFolder.bind(mediaFolderController));
router.delete('/folders/:id', requirePermission(Permission.DELETE_MEDIA), mediaFolderController.deleteFolder.bind(mediaFolderController));

// Folder media operations
router.get('/folders/:id/media', requirePermission(Permission.VIEW_MEDIA), mediaFolderController.getFolderMedia.bind(mediaFolderController));
router.post('/folders/:id/move', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.bulkMoveToFolder.bind(mediaFolderController));

// Tag management
router.get('/tags/cloud', requirePermission(Permission.VIEW_MEDIA), mediaTagController.getTagCloud.bind(mediaTagController));
router.get('/tags/popular', requirePermission(Permission.VIEW_MEDIA), mediaTagController.getMostUsedTags.bind(mediaTagController));
router.get('/tags/search', requirePermission(Permission.VIEW_MEDIA), mediaTagController.searchTags.bind(mediaTagController));
router.get('/tags/stats', requirePermission(Permission.VIEW_MEDIA), mediaTagController.getTagStats.bind(mediaTagController));
router.get('/tags/:tag/media', requirePermission(Permission.VIEW_MEDIA), mediaTagController.getMediaByTag.bind(mediaTagController));
router.post('/tags/bulk', requirePermission(Permission.UPLOAD_MEDIA), mediaTagController.bulkTagMedia.bind(mediaTagController));

// Media organization
router.patch('/:id/folder', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.moveMediaToFolder.bind(mediaFolderController));
router.patch('/:id/tags', requirePermission(Permission.UPLOAD_MEDIA), mediaFolderController.updateMediaTags.bind(mediaFolderController));
router.post('/:id/tags', requirePermission(Permission.UPLOAD_MEDIA), mediaTagController.addTags.bind(mediaTagController));
router.delete('/:id/tags', requirePermission(Permission.UPLOAD_MEDIA), mediaTagController.removeTags.bind(mediaTagController));

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

