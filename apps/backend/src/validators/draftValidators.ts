/**
 * Draft Validators
 * 
 * Request validation for draft endpoints
 */

import Joi from 'joi';
import { SocialPlatform } from '../models/ScheduledPost';

export const validateCreateDraft = [
  (req: any, res: any, next: any) => {
    const schema = Joi.object({
      title: Joi.string().max(200).optional(),
      content: Joi.string().max(10000).required(),
      platforms: Joi.array()
        .items(Joi.string().valid(...Object.values(SocialPlatform)))
        .optional(),
      socialAccountIds: Joi.array().items(Joi.string()).optional(),
      mediaUrls: Joi.array().items(Joi.string().uri()).optional(),
      mediaIds: Joi.array().items(Joi.string()).optional(),
      scheduledAt: Joi.date().iso().optional(),
      metadata: Joi.object().optional(),
    });

    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    next();
  },
];

export const validateUpdateDraft = [
  (req: any, res: any, next: any) => {
    const schema = Joi.object({
      title: Joi.string().max(200).optional(),
      content: Joi.string().max(10000).optional(),
      platforms: Joi.array()
        .items(Joi.string().valid(...Object.values(SocialPlatform)))
        .optional(),
      socialAccountIds: Joi.array().items(Joi.string()).optional(),
      mediaUrls: Joi.array().items(Joi.string().uri()).optional(),
      mediaIds: Joi.array().items(Joi.string()).optional(),
      scheduledAt: Joi.date().iso().optional(),
      metadata: Joi.object().optional(),
    });

    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    next();
  },
];

export const validateGetDrafts = [
  (req: any, res: any, next: any) => {
    const schema = Joi.object({
      userId: Joi.string().optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      sortBy: Joi.string().valid('createdAt', 'updatedAt').optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
    });

    const { error } = schema.validate(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    next();
  },
];

export const validateScheduleFromDraft = [
  (req: any, res: any, next: any) => {
    const schema = Joi.object({
      scheduledAt: Joi.date().iso().greater('now').required(),
    });

    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
      });
    }

    next();
  },
];
