import { Router } from 'express';
import { platformSettingsController } from '../controllers/PlatformSettingsController';
import { requireAuth } from '../middleware/auth';
import { requireWorkspace } from '../middleware/tenant';

const router = Router();

// Apply authentication and workspace validation to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// GET /api/v1/platform-settings - Get all platform settings for workspace
router.get('/', platformSettingsController.getAllSettings.bind(platformSettingsController));

// GET /api/v1/platform-settings/:platform - Get settings for specific platform
router.get('/:platform', platformSettingsController.getSettings.bind(platformSettingsController));

// PUT /api/v1/platform-settings/:platform - Update settings for specific platform
router.put('/:platform', platformSettingsController.updateSettings.bind(platformSettingsController));

// DELETE /api/v1/platform-settings/:platform - Reset settings to defaults
router.delete('/:platform', platformSettingsController.resetSettings.bind(platformSettingsController));

// POST /api/v1/platform-settings/apply-defaults - Apply defaults to a post
router.post('/apply-defaults', platformSettingsController.applyDefaults.bind(platformSettingsController));

// GET /api/v1/platform-settings/:platform/template - Get default template
router.get('/:platform/template', platformSettingsController.getDefaultTemplate.bind(platformSettingsController));

export default router;