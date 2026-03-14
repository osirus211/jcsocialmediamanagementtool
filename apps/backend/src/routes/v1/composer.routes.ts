/**
 * Composer Routes
 * 
 * Handles composer-specific post operations
 * Base: /api/v1/composer
 */

import { Router } from 'express';
import multer from 'multer';
import { composerController } from '../../controllers/ComposerController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { checkPostLimit } from '../../middleware/planLimit';
import { requireFeature } from '../../middleware/featureAuthorization';
import { Feature } from '../../services/FeatureAuthorizationService';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
});

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Draft Management
 */

// Create draft
router.post('/drafts', checkPostLimit, composerController.createDraft.bind(composerController));

// Update draft
router.patch('/drafts/:id', composerController.updateDraft.bind(composerController));

/**
 * Publishing
 */

// Publish post (NOW, SCHEDULE, or QUEUE)
router.post('/posts/:id/publish', requireFeature(Feature.PUBLISH), composerController.publishPost.bind(composerController));

// Duplicate post
router.post('/posts/:id/duplicate', checkPostLimit, composerController.duplicatePost.bind(composerController));

// Cancel post
router.post('/posts/:id/cancel', composerController.cancelPost.bind(composerController));

// Delete post
router.delete('/posts/:id', composerController.deletePost.bind(composerController));

/**
 * Media Management
 */

// Upload media
router.post('/media/upload', upload.single('file'), composerController.uploadMedia.bind(composerController));

// Get media library
router.get('/media', composerController.getMedia.bind(composerController));

// Delete media
router.delete('/media/:id', composerController.deleteMedia.bind(composerController));

// Get queue slots
router.get('/queue-slots', composerController.getQueueSlots.bind(composerController));

export default router;


