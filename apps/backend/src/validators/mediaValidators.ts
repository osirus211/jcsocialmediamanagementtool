/**
 * Media Validators
 * 
 * Input validation for media upload endpoints
 */

import { body, param, query } from 'express-validator';
import { SUPPORTED_IMAGE_TYPES, SUPPORTED_VIDEO_TYPES, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } from '../services/MediaUploadService';

/**
 * Validate generate upload URL request
 */
export const validateGenerateUploadUrl = [
  body('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  
  body('filename')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Filename is required')
    .isLength({ max: 255 })
    .withMessage('Filename must be less than 255 characters'),
  
  body('mimeType')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('MIME type is required')
    .custom((value) => {
      const allSupportedTypes = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES];
      if (!allSupportedTypes.includes(value)) {
        throw new Error(`Unsupported MIME type. Supported types: ${allSupportedTypes.join(', ')}`);
      }
      return true;
    }),
  
  body('size')
    .isInt({ min: 1 })
    .withMessage('Size must be a positive integer')
    .custom((value, { req }) => {
      const mimeType = req.body.mimeType;
      
      if (SUPPORTED_IMAGE_TYPES.includes(mimeType) && value > MAX_IMAGE_SIZE) {
        throw new Error(`Image size must not exceed ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
      }
      
      if (SUPPORTED_VIDEO_TYPES.includes(mimeType) && value > MAX_VIDEO_SIZE) {
        throw new Error(`Video size must not exceed ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
      }
      
      return true;
    }),
];

/**
 * Validate confirm upload request
 */
export const validateConfirmUpload = [
  param('id')
    .isMongoId()
    .withMessage('Invalid media ID'),
  
  body('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  
  body('width')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Width must be a positive integer'),
  
  body('height')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Height must be a positive integer'),
  
  body('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
];

/**
 * Validate mark upload failed request
 */
export const validateMarkUploadFailed = [
  param('id')
    .isMongoId()
    .withMessage('Invalid media ID'),
  
  body('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  
  body('error')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Error message is required')
    .isLength({ max: 500 })
    .withMessage('Error message must be less than 500 characters'),
];

/**
 * Validate get media by ID request
 */
export const validateGetMediaById = [
  param('id')
    .isMongoId()
    .withMessage('Invalid media ID'),
  
  query('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
];

/**
 * Validate get media list request
 */
export const validateGetMediaList = [
  query('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  
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

/**
 * Validate delete media request
 */
export const validateDeleteMedia = [
  param('id')
    .isMongoId()
    .withMessage('Invalid media ID'),
  
  query('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
];
