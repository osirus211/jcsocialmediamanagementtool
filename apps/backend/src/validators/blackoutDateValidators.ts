import { body, param, query } from 'express-validator';

export const createBlackoutDateValidator = [
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (endDate <= req.body.startDate) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Reason must be between 1 and 200 characters'),
  
  body('recurring')
    .optional()
    .isBoolean()
    .withMessage('Recurring must be a boolean'),
  
  body('recurringPattern')
    .optional()
    .isObject()
    .withMessage('Recurring pattern must be an object'),
  
  body('recurringPattern.type')
    .if(body('recurring').equals('true'))
    .isIn(['daily', 'weekly', 'monthly', 'custom'])
    .withMessage('Recurring pattern type must be daily, weekly, monthly, or custom'),
  
  body('recurringPattern.interval')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Interval must be between 1 and 365'),
  
  body('recurringPattern.daysOfWeek')
    .optional()
    .isArray()
    .withMessage('Days of week must be an array')
    .custom((daysOfWeek) => {
      if (!Array.isArray(daysOfWeek)) return true;
      return daysOfWeek.every((day: any) => 
        Number.isInteger(day) && day >= 0 && day <= 6
      );
    })
    .withMessage('Days of week must be integers between 0 and 6'),
  
  body('recurringPattern.dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('Day of month must be between 1 and 31'),
  
  body('recurringPattern.customDates')
    .optional()
    .isArray()
    .withMessage('Custom dates must be an array'),
  
  body('recurringPattern.endRecurrence')
    .optional()
    .isISO8601()
    .withMessage('End recurrence must be a valid ISO 8601 date')
    .toDate(),
  
  body('action')
    .optional()
    .isIn(['hold', 'reschedule', 'cancel'])
    .withMessage('Action must be hold, reschedule, or cancel'),
];

export const updateBlackoutDateValidator = [
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.body.startDate && endDate <= req.body.startDate) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Reason must be between 1 and 200 characters'),
  
  body('recurring')
    .optional()
    .isBoolean()
    .withMessage('Recurring must be a boolean'),
  
  body('recurringPattern')
    .optional()
    .isObject()
    .withMessage('Recurring pattern must be an object'),
  
  body('recurringPattern.type')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'custom'])
    .withMessage('Recurring pattern type must be daily, weekly, monthly, or custom'),
  
  body('recurringPattern.interval')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Interval must be between 1 and 365'),
  
  body('recurringPattern.daysOfWeek')
    .optional()
    .isArray()
    .withMessage('Days of week must be an array')
    .custom((daysOfWeek) => {
      if (!Array.isArray(daysOfWeek)) return true;
      return daysOfWeek.every((day: any) => 
        Number.isInteger(day) && day >= 0 && day <= 6
      );
    })
    .withMessage('Days of week must be integers between 0 and 6'),
  
  body('recurringPattern.dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('Day of month must be between 1 and 31'),
  
  body('recurringPattern.customDates')
    .optional()
    .isArray()
    .withMessage('Custom dates must be an array'),
  
  body('recurringPattern.endRecurrence')
    .optional()
    .isISO8601()
    .withMessage('End recurrence must be a valid ISO 8601 date')
    .toDate(),
  
  body('action')
    .optional()
    .isIn(['hold', 'reschedule', 'cancel'])
    .withMessage('Action must be hold, reschedule, or cancel'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const blackoutDateParamsValidator = [
  param('workspaceId')
    .isMongoId()
    .withMessage('Workspace ID must be a valid MongoDB ObjectId'),
  
  param('id')
    .optional()
    .isMongoId()
    .withMessage('Blackout date ID must be a valid MongoDB ObjectId'),
];

export const blackoutDateQueryValidator = [
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip must be a non-negative integer'),
  
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
];