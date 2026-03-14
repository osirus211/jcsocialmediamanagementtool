/**
 * Link Preview Routes
 * 
 * Link preview and metadata endpoints
 */

import { Router } from 'express';
import { linkPreviewController } from '../../controllers/LinkPreviewController';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

// Validation schemas
const previewSchema = z.object({
  url: z.string().url('Valid URL with protocol is required'),
});

const batchPreviewSchema = z.object({
  urls: z.array(z.string().url('Each URL must be valid with protocol')).min(1).max(10),
});

const extractSchema = z.object({
  content: z.string().min(1).max(10000),
});

// Get single link preview
router.post('/', validateRequest(previewSchema), linkPreviewController.getPreview.bind(linkPreviewController));

// Get batch link previews
router.post('/batch', validateRequest(batchPreviewSchema), linkPreviewController.getBatchPreviews.bind(linkPreviewController));

// Extract URLs from content
router.post('/extract', validateRequest(extractSchema), linkPreviewController.extractUrls.bind(linkPreviewController));

// Clear cache
router.delete('/cache', linkPreviewController.clearCache.bind(linkPreviewController));

export default router;