/**
 * Template Routes
 * 
 * Phase-2: Saved Post Templates
 */

import { Router } from 'express';
import { postTemplateController } from '../../controllers/PostTemplateController';
import { authenticate } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateBody } from '../../middleware/validate';
import { createTemplateSchema, updateTemplateSchema } from '../../schemas/template.schemas';

const router = Router();

// Apply authentication and workspace middleware
router.use(authenticate);
router.use(requireWorkspace);

// Template CRUD
router.post('/', validateBody(createTemplateSchema), postTemplateController.createTemplate.bind(postTemplateController));
router.get('/', postTemplateController.getTemplates.bind(postTemplateController));
router.get('/:id', postTemplateController.getTemplate.bind(postTemplateController));
router.patch('/:id', validateBody(updateTemplateSchema), postTemplateController.updateTemplate.bind(postTemplateController));
router.delete('/:id', postTemplateController.deleteTemplate.bind(postTemplateController));

// Apply template (increment usage count)
router.post('/:id/apply', postTemplateController.applyTemplate.bind(postTemplateController));

export default router;
