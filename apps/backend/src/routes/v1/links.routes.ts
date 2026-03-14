/**
 * Links Routes
 * 
 * Link shortening and tracking endpoints
 */

import { Router } from 'express';
import { shortLinkController } from '../../controllers/ShortLinkController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { shortenUrlSchema, updateLinkSchema, bulkShortenSchema } from '../../schemas/link.schemas';

const router = Router();

// Apply authentication and workspace middleware
router.use(requireAuth);
router.use(requireWorkspace);

// Get workspace links (paginated)
router.get('/', shortLinkController.getLinks.bind(shortLinkController));

// Shorten URL
router.post('/shorten', validateRequest(shortenUrlSchema), shortLinkController.shortenUrl.bind(shortLinkController));

// Bulk shorten URLs
router.post('/bulk', validateRequest(bulkShortenSchema), shortLinkController.bulkShortenUrls.bind(shortLinkController));

// Get link stats
router.get('/:shortCode/stats', shortLinkController.getLinkStats.bind(shortLinkController));

// Get link analytics
router.get('/:shortCode/analytics', shortLinkController.getLinkAnalytics.bind(shortLinkController));

// Get QR code for link
router.get('/:shortCode/qr-code', shortLinkController.getQRCode.bind(shortLinkController));

// Update link
router.patch('/:shortCode', validateRequest(updateLinkSchema), shortLinkController.updateLink.bind(shortLinkController));

// Toggle link status
router.patch('/:shortCode/toggle', shortLinkController.toggleLink.bind(shortLinkController));

// Delete link
router.delete('/:shortCode', shortLinkController.deleteLink.bind(shortLinkController));

export default router;

