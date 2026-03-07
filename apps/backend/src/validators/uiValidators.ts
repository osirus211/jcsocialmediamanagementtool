/**
 * UI Endpoint Validators
 * 
 * Input validation for UI-focused endpoints
 */

import { query } from 'express-validator';
import { SocialPlatform, PostStatus } from '../models/ScheduledPost';

/**
 * Validate calendar request
 */
export const validateCalendar = [
  query('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  
  query('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(value);
      
      if (endDate < startDate) {
        throw new Error('End date must be after start date');
      }
      
      return true;
    }),
];

/**
 * Validate history request
 */
export const validateHistory = [
  query('workspaceId')
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
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate as string);
        const endDate = new Date(value);
        
        if (endDate < startDate) {
          throw new Error('End date must be after start date');
        }
      }
      
      return true;
    }),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

/**
 * Validate media library request
 */
export const validateMediaLibrary = [
  query('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be less than 100 characters'),
  
  query('mediaType')
    .optional()
    .isIn(['image', 'video'])
    .withMessage('Media type must be either "image" or "video"'),
  
  query('status')
    .optional()
    .isIn(['pending', 'uploaded', 'failed'])
    .withMessage('Status must be one of: pending, uploaded, failed'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
