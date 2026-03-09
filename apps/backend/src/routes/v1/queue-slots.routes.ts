/**
 * Queue Slots Routes
 * 
 * Phase-2: Queue-based scheduling
 */

import { Router } from 'express';
import { queueSlotController } from '../../controllers/QueueSlotController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateBody } from '../../middleware/validate';
import {
  createQueueSlotSchema,
  updateQueueSlotSchema,
  addToQueueSchema,
} from '../../schemas/queueSlot.schemas';

const router = Router();

// Apply authentication and workspace middleware
router.use(requireAuth);
router.use(requireWorkspace);

// Queue slot CRUD
router.get('/', queueSlotController.getSlots.bind(queueSlotController));
router.post('/', validateBody(createQueueSlotSchema), queueSlotController.createSlot.bind(queueSlotController));
router.put('/:id', validateBody(updateQueueSlotSchema), queueSlotController.updateSlot.bind(queueSlotController));
router.delete('/:id', queueSlotController.deleteSlot.bind(queueSlotController));

// Add to queue
router.post('/add-to-queue', validateBody(addToQueueSchema), queueSlotController.addToQueue.bind(queueSlotController));

export default router;
