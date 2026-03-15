/**
 * ENHANCED Scheduling Routes
 * 
 * SUPERIOR API endpoints for scheduling that beat competitors:
 * ✅ 1-minute precision scheduling
 * ✅ Timezone-aware operations
 * ✅ Real-time analytics and monitoring
 * ✅ AI-powered recommendations
 * ✅ Bulk operations with validation
 * ✅ Advanced failure analysis
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { enhancedSchedulingController } from '../../controllers/EnhancedSchedulingController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/v1/scheduling/analytics
 * Get comprehensive scheduling analytics
 */
router.get('/analytics', [
  query('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
], enhancedSchedulingController.getSchedulingAnalytics);

/**
 * GET /api/v1/scheduling/optimal-timing
 * Get AI-powered optimal timing recommendations
 */
router.get('/optimal-timing', [
  query('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  query('platform')
    .optional()
    .isString()
    .withMessage('Platform must be a string'),
], enhancedSchedulingController.getOptimalTiming);

/**
 * GET /api/v1/scheduling/failure-analysis
 * Get comprehensive failure analysis
 */
router.get('/failure-analysis', [
  query('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
], enhancedSchedulingController.getFailureAnalysis);

/**
 * GET /api/v1/scheduling/status
 * Get real-time scheduling status
 */
router.get('/status', [
  query('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
], enhancedSchedulingController.getRealtimeStatus);

/**
 * GET /api/v1/scheduling/timezones
 * Get supported timezones
 */
router.get('/timezones', enhancedSchedulingController.getSupportedTimezones);

/**
 * POST /api/v1/scheduling/timezone/convert
 * Convert time between timezones
 */
router.post('/timezone/convert', [
  body('time')
    .notEmpty()
    .withMessage('Time is required')
    .isISO8601()
    .withMessage('Time must be a valid ISO 8601 date'),
  body('fromTimezone')
    .notEmpty()
    .withMessage('From timezone is required')
    .isString()
    .withMessage('From timezone must be a string'),
  body('toTimezone')
    .notEmpty()
    .withMessage('To timezone is required')
    .isString()
    .withMessage('To timezone must be a string'),
], enhancedSchedulingController.convertTimezone);

/**
 * POST /api/v1/scheduling/optimal-windows
 * Get optimal scheduling windows for audience
 */
router.post('/optimal-windows', [
  body('audienceTimezones')
    .isArray({ min: 1 })
    .withMessage('Audience timezones must be a non-empty array'),
  body('audienceTimezones.*.timezone')
    .notEmpty()
    .withMessage('Each audience timezone must have a timezone'),
  body('audienceTimezones.*.percentage')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Each audience timezone percentage must be between 0 and 100'),
  body('audienceTimezones.*.optimalHours')
    .isArray()
    .withMessage('Optimal hours must be an array'),
  body('contentType')
    .optional()
    .isIn(['post', 'story', 'video'])
    .withMessage('Content type must be post, story, or video'),
], enhancedSchedulingController.getOptimalWindows);

/**
 * POST /api/v1/scheduling/bulk-schedule
 * Bulk schedule posts with timezone conversion
 */
router.post('/bulk-schedule', [
  body('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  body('posts')
    .isArray({ min: 1, max: 100 })
    .withMessage('Posts must be an array with 1-100 items'),
  body('posts.*.content')
    .notEmpty()
    .withMessage('Each post must have content'),
  body('posts.*.scheduledAt')
    .notEmpty()
    .withMessage('Each post must have a scheduled time')
    .isISO8601()
    .withMessage('Each scheduled time must be a valid ISO 8601 date'),
  body('posts.*.socialAccountId')
    .notEmpty()
    .withMessage('Each post must have a social account ID')
    .isMongoId()
    .withMessage('Each social account ID must be valid'),
  body('posts.*.platform')
    .notEmpty()
    .withMessage('Each post must have a platform'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
], enhancedSchedulingController.bulkSchedule);

/**
 * POST /api/v1/scheduling/validate-schedule
 * Validate scheduling request
 */
router.post('/validate-schedule', [
  body('scheduledAt')
    .notEmpty()
    .withMessage('Scheduled time is required')
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('platforms')
    .optional()
    .isArray()
    .withMessage('Platforms must be an array'),
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string'),
], enhancedSchedulingController.validateSchedule);

/**
 * POST /api/v1/scheduling/force-recovery
 * Force missed post recovery run (admin only)
 */
router.post('/force-recovery', enhancedSchedulingController.forceRecovery);

export default router;