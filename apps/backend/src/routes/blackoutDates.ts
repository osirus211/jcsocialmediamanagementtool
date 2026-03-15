import { Router } from 'express';
import { blackoutDateController } from '../controllers/BlackoutDateController';
import { requireAuth } from '../middleware/auth';
import { requireWorkspace } from '../middleware/tenant';
import {
  createBlackoutDateValidator,
  updateBlackoutDateValidator,
  blackoutDateParamsValidator,
  blackoutDateQueryValidator,
} from '../validators/blackoutDateValidators';

const router = Router();

/**
 * @route   POST /api/v1/workspaces/:workspaceId/blackout-dates
 * @desc    Create a new blackout date
 * @access  Private (workspace member)
 */
router.post(
  '/:workspaceId/blackout-dates',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  createBlackoutDateValidator,
  blackoutDateController.createBlackoutDate
);

/**
 * @route   GET /api/v1/workspaces/:workspaceId/blackout-dates
 * @desc    Get all blackout dates for a workspace
 * @access  Private (workspace member)
 */
router.get(
  '/:workspaceId/blackout-dates',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  blackoutDateQueryValidator,
  blackoutDateController.getBlackoutDates
);

/**
 * @route   GET /api/v1/workspaces/:workspaceId/blackout-dates/conflicts
 * @desc    Find posts that conflict with blackout dates
 * @access  Private (workspace member)
 */
router.get(
  '/:workspaceId/blackout-dates/conflicts',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  blackoutDateController.findConflictingPosts
);

/**
 * @route   GET /api/v1/workspaces/:workspaceId/blackout-dates/calendar
 * @desc    Get blackout dates for calendar display
 * @access  Private (workspace member)
 */
router.get(
  '/:workspaceId/blackout-dates/calendar',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  blackoutDateQueryValidator,
  blackoutDateController.getBlackoutDatesInRange
);

/**
 * @route   GET /api/v1/workspaces/:workspaceId/blackout-dates/check
 * @desc    Check if a specific date is blacked out
 * @access  Private (workspace member)
 */
router.get(
  '/:workspaceId/blackout-dates/check',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  blackoutDateQueryValidator,
  blackoutDateController.checkBlackoutDate
);

/**
 * @route   GET /api/v1/workspaces/:workspaceId/blackout-dates/:id
 * @desc    Get a single blackout date by ID
 * @access  Private (workspace member)
 */
router.get(
  '/:workspaceId/blackout-dates/:id',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  blackoutDateController.getBlackoutDateById
);

/**
 * @route   PATCH /api/v1/workspaces/:workspaceId/blackout-dates/:id
 * @desc    Update a blackout date
 * @access  Private (workspace member)
 */
router.patch(
  '/:workspaceId/blackout-dates/:id',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  updateBlackoutDateValidator,
  blackoutDateController.updateBlackoutDate
);

/**
 * @route   DELETE /api/v1/workspaces/:workspaceId/blackout-dates/:id
 * @desc    Delete a blackout date
 * @access  Private (workspace member)
 */
router.delete(
  '/:workspaceId/blackout-dates/:id',
  requireAuth,
  requireWorkspace,
  blackoutDateParamsValidator,
  blackoutDateController.deleteBlackoutDate
);

export default router;