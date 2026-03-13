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
import { shortenUrlSchema } from '../../schemas/link.schemas';

const router = Router();

// Apply authentication and workspace middleware
router.use(requireAuth);
router.use(requireWorkspace);

// Get workspace links (paginated)
router.get('/', shortLinkController.getLinks.bind(shortLinkController));

// Shorten URL
router.post('/shorten', validateRequest(shortenUrlSchema), shortLinkController.shortenUrl.bind(shortLinkController));

// Get link stats
router.get('/:shortCode/stats', shortLinkController.getLinkStats.bind(shortLinkController));

// Delete link
router.delete('/:shortCode', shortLinkController.deleteLink.bind(shortLinkController));

export default router;
