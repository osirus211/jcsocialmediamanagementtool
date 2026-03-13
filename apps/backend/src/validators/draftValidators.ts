/**
 * Draft Validators
 * 
 * Request validation for draft endpoints
 */

import { z } from 'zod';
import { SocialPlatform } from '../models/ScheduledPost';

export const createDraftSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(10000),
  platforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  socialAccountIds: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  mediaIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateDraftSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(10000).optional(),
  platforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  socialAccountIds: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  mediaIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export const getDraftsSchema = z.object({
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const scheduleFromDraftSchema = z.object({
  scheduledAt: z.string().datetime().refine((date) => new Date(date) > new Date(), {
    message: "Scheduled date must be in the future"
  }),
});

export const validateCreateDraft = [
  (req: any, res: any, next: any) => {
    try {
      createDraftSchema.parse(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors?.[0]?.message || 'Validation failed',
      });
    }
  },
];

export const validateUpdateDraft = [
  (req: any, res: any, next: any) => {
    try {
      updateDraftSchema.parse(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors?.[0]?.message || 'Validation failed',
      });
    }
  },
];

export const validateGetDrafts = [
  (req: any, res: any, next: any) => {
    try {
      getDraftsSchema.parse(req.query);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors?.[0]?.message || 'Validation failed',
      });
    }
  },
];

export const validateScheduleFromDraft = [
  (req: any, res: any, next: any) => {
    try {
      scheduleFromDraftSchema.parse(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors?.[0]?.message || 'Validation failed',
      });
    }
  },
];
