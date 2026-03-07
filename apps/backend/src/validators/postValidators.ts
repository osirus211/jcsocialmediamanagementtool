/**
 * Post Validators
 * 
 * Input validation for post management endpoints
 */

import { body, param, query, ValidationChain } from 'express-validator';
import { SocialPlatform, PostStatus } from '../models/ScheduledPost';

/**
 * Platform-specific content limits
 */
const CONTENT_LIMITS: Record<SocialPlatform, number> = {
  [SocialPlatform.TWITTER]: 280,
  [SocialPlatform.FACEBOOK]: 63206,
  [SocialPlatform.INSTAGRAM]: 2200,
  [SocialPlatform.LINKEDIN]: 3000,
  [SocialPlatform.TIKTOK]: 2200,
  [SocialPlatform.YOUTUBE]: 5000,
  [SocialPlatform.THREADS]: 500,
};

/**
 * Platform-specific media limits
 */
const MEDIA_LIMITS: Record<SocialPlatform, number> = {
  [SocialPlatform.TWITTER]: 4,
  [SocialPlatform.FACEBOOK]: 10,
  [SocialPlatform.INSTAGRAM]: 10,
  [SocialPlatform.LINKEDIN]: 9,
  [SocialPlatform.TIKTOK]: 1,
  [SocialPlatform.YOUTUBE]: 1,
  [SocialPlatform.THREADS]: 10,
};

/**
 * Validate create post request
 */
export const validateCreatePost: ValidationChain[] = [
  body('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),

  body('socialAccountId')
    .notEmpty()
    .withMessage('Social account ID is required')
    .isMongoId()
    .withMessage('Invalid social account ID'),

  body('platform')
    .notEmpty()
    .withMessage('Platform is required')
    .isIn(Object.values(SocialPlatform))
    .withMessage('Invalid platform'),

  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isString()
    .withMessage('Content must be a string')
    .custom((value, { req }) => {
      const platform = req.body.platform as SocialPlatform;
      const limit = CONTENT_LIMITS[platform];
      
      if (value.length > limit) {
        throw new Error(`Content exceeds ${limit} character limit for ${platform}`);
      }
      
      return true;
    }),

  body('mediaUrls')
    .optional()
    .isArray()
    .withMessage('Media URLs must be an array')
    .custom((value, { req }) => {
      const platform = req.body.platform as SocialPlatform;
      const limit = MEDIA_LIMITS[platform];

      if (value.length > limit) {
        throw new Error(`Cannot attach more than ${limit} media files for ${platform}`);
      }

      return true;
    }),

  body('mediaIds')
    .optional()
    .isArray()
    .withMessage('Media IDs must be an array')
    .custom((value, { req }) => {
      const platform = req.body.platform as SocialPlatform;
      const limit = MEDIA_LIMITS[platform];

      if (value.length > limit) {
        throw new Error(`Cannot attach more than ${limit} media files for ${platform}`);
      }

      // Validate each ID is a valid MongoDB ObjectId
      for (const id of value) {
        if (!/^[0-9a-fA-F]{24}$/.test(id)) {
          throw new Error(`Invalid media ID: ${id}`);
        }
      }

      return true;
    }),

  body('mediaUrls.*')
    .optional()
    .isURL()
    .withMessage('Each media URL must be a valid URL'),

  body('scheduledAt')
    .notEmpty()
    .withMessage('Scheduled time is required')
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .custom((value) => {
      const scheduledDate = new Date(value);
      const now = new Date();
      
      if (scheduledDate <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      
      return true;
    }),
];

/**
 * Validate update post request
 */
export const validateUpdatePost: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Post ID is required')
    .isMongoId()
    .withMessage('Invalid post ID'),

  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string')
    .isLength({ min: 1 })
    .withMessage('Content cannot be empty'),

  body('mediaUrls')
    .optional()
    .isArray()
    .withMessage('Media URLs must be an array'),

  body('mediaUrls.*')
    .optional()
    .isURL()
    .withMessage('Each media URL must be a valid URL'),

  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .custom((value) => {
      const scheduledDate = new Date(value);
      const now = new Date();
      
      if (scheduledDate <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      
      return true;
    }),
];

/**
 * Validate get posts query
 */
export const validateGetPosts: ValidationChain[] = [
  query('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),

  query('status')
    .optional()
    .isIn(Object.values(PostStatus))
    .withMessage('Invalid status'),

  query('platform')
    .optional()
    .isIn(Object.values(SocialPlatform))
    .withMessage('Invalid platform'),

  query('socialAccountId')
    .optional()
    .isMongoId()
    .withMessage('Invalid social account ID'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

/**
 * Validate post ID parameter
 */
export const validatePostId: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Post ID is required')
    .isMongoId()
    .withMessage('Invalid post ID'),
];

/**
 * Validate workspace ID query
 */
export const validateWorkspaceId: ValidationChain[] = [
  query('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
];

/**
 * Validate bulk delete request
 */
export const validateBulkDelete: ValidationChain[] = [
  body('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),

  body('postIds')
    .notEmpty()
    .withMessage('Post IDs are required')
    .isArray({ min: 1, max: 100 })
    .withMessage('Post IDs must be an array with 1-100 items'),

  body('postIds.*')
    .isMongoId()
    .withMessage('Each post ID must be a valid MongoDB ObjectId'),
];

/**
 * Validate bulk reschedule request
 */
export const validateBulkReschedule: ValidationChain[] = [
  body('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),

  body('postIds')
    .notEmpty()
    .withMessage('Post IDs are required')
    .isArray({ min: 1, max: 100 })
    .withMessage('Post IDs must be an array with 1-100 items'),

  body('postIds.*')
    .isMongoId()
    .withMessage('Each post ID must be a valid MongoDB ObjectId'),

  body('scheduledAt')
    .notEmpty()
    .withMessage('Scheduled time is required')
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .custom((value) => {
      const scheduledDate = new Date(value);
      const now = new Date();
      
      if (scheduledDate <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      
      return true;
    }),
];

/**
 * Validate bulk update request
 */
export const validateBulkUpdate: ValidationChain[] = [
  body('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),

  body('postIds')
    .notEmpty()
    .withMessage('Post IDs are required')
    .isArray({ min: 1, max: 100 })
    .withMessage('Post IDs must be an array with 1-100 items'),

  body('postIds.*')
    .isMongoId()
    .withMessage('Each post ID must be a valid MongoDB ObjectId'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(Object.values(PostStatus))
    .withMessage('Invalid status'),
];

/**
 * Validate duplicate post request
 */
export const validateDuplicatePost: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Post ID is required')
    .isMongoId()
    .withMessage('Invalid post ID'),

  body('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),

  body('platforms')
    .notEmpty()
    .withMessage('Platforms are required')
    .isArray({ min: 1, max: 7 })
    .withMessage('Platforms must be an array with 1-7 items'),

  body('platforms.*')
    .isIn(Object.values(SocialPlatform))
    .withMessage('Each platform must be a valid social platform'),

  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .custom((value) => {
      if (value) {
        const scheduledDate = new Date(value);
        const now = new Date();
        
        if (scheduledDate <= now) {
          throw new Error('Scheduled time must be in the future');
        }
      }
      
      return true;
    }),
];
