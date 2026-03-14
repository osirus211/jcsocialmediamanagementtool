/**
 * Template Routes
 * 
 * Phase-2: Saved Post Templates
 */

import { Router } from 'express';
import { postTemplateController } from '../../controllers/PostTemplateController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { createTemplateSchema, updateTemplateSchema } from '../../schemas/template.schemas';

const router = Router();

// Apply authentication and workspace middleware
router.use(requireAuth);
router.use(requireWorkspace);

// Template CRUD
router.post('/', validateRequest(createTemplateSchema), postTemplateController.createTemplate.bind(postTemplateController));
router.get('/', postTemplateController.getTemplates.bind(postTemplateController));
router.get('/categories', postTemplateController.getCategories.bind(postTemplateController));
router.get('/tags', postTemplateController.getTags.bind(postTemplateController));
router.get('/:id', postTemplateController.getTemplate.bind(postTemplateController));
router.patch('/:id', validateRequest(updateTemplateSchema), postTemplateController.updateTemplate.bind(postTemplateController));
router.delete('/:id', postTemplateController.deleteTemplate.bind(postTemplateController));

// Template actions
router.post('/:id/apply', postTemplateController.applyTemplate.bind(postTemplateController));
router.post('/:id/duplicate', postTemplateController.duplicateTemplate.bind(postTemplateController));
router.post('/suggestions', postTemplateController.getAISuggestions.bind(postTemplateController));

export default router;

