/**
 * Activity Routes
 * 
 * Handles team activity feed endpoints
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { ActivityController } from '../../controllers/ActivityController';
import { ActivityAction } from '../../models/WorkspaceActivityLog';

const router = Router();

// Validation schemas
const activityFeedQuerySchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
  limit: z.string().optional().transform((val) => val ? Math.min(parseInt(val), 100) : 20),
  action: z.nativeEnum(ActivityAction).optional(),
  resourceType: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Apply auth middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * @route   GET /api/v1/activity
 * @desc    Get activity feed for workspace
 * @access  Private
 */
// Create a schema that validates the query parameters
const activityFeedRequestSchema = z.object({
  query: activityFeedQuerySchema,
});

router.get('/', validateRequest(activityFeedRequestSchema), ActivityController.getActivityFeed);

/**
 * @route   GET /api/v1/activity/stats
 * @desc    Get activity statistics for workspace
 * @access  Private
 */
router.get('/stats', ActivityController.getActivityStats);

export default router;