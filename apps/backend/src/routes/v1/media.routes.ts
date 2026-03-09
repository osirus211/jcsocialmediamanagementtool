/**
 * Media Routes
 * 
 * Handles media upload and management endpoints
 */

import { Router } from 'express';
import { uploadController } from '../../controllers/UploadController';
import { mediaFolderController } from '../../controllers/MediaFolderController';
import { authenticate } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';

const router = Router();

// All media routes require authentication and workspace context
router.use(authenticate);
router.use(requireWorkspace);

// Generate presigned upload URL
router.post('/upload-url', uploadController.generateUploadUrl.bind(uploadController));

// Complete upload and create media record
router.post('/complete', uploadController.completeUpload.bind(uploadController));

// Folder management (Phase-2)
router.post('/folders', mediaFolderController.createFolder.bind(mediaFolderController));
router.get('/folders', mediaFolderController.getFolders.bind(mediaFolderController));
router.patch('/folders/:id', mediaFolderController.updateFolder.bind(mediaFolderController));
router.delete('/folders/:id', mediaFolderController.deleteFolder.bind(mediaFolderController));

// Media organization (Phase-2)
router.patch('/:id/folder', mediaFolderController.moveMediaToFolder.bind(mediaFolderController));
router.patch('/:id/tags', mediaFolderController.updateMediaTags.bind(mediaFolderController));

// Get media statistics
router.get('/stats', uploadController.getMediaStats.bind(uploadController));

// List media
router.get('/', uploadController.listMedia.bind(uploadController));

// Get media by ID
router.get('/:id', uploadController.getMedia.bind(uploadController));

// Delete media
router.delete('/:id', uploadController.deleteMedia.bind(uploadController));

export default router;
