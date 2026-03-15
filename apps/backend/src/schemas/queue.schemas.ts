/**
 * Queue Validation Schemas
 */

import { z } from 'zod';

export const getQueueSchema = z.object({
  query: z.object({
    platform: z.enum([
      'twitter', 'facebook', 'instagram', 'linkedin', 
      'youtube', 'threads', 'tiktok', 'google-business'
    ]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

export const reorderQueueSchema = z.object({
  body: z.object({
    postId: z.string(),
    newPosition: z.number().int().min(1),
  }),
});

export const movePostSchema = z.object({
  body: z.object({
    postId: z.string(),
  }),
});

export const shuffleQueueSchema = z.object({
  body: z.object({
    platform: z.enum([
      'twitter', 'facebook', 'instagram', 'linkedin', 
      'youtube', 'threads', 'tiktok', 'google-business'
    ]).optional(),
    preserveTimeSlots: z.boolean().default(true),
    distributionStrategy: z.enum(['random', 'balanced', 'optimal']).default('optimal'),
  }),
});

export const bulkOperationSchema = z.object({
  body: z.object({
    operation: z.enum(['remove', 'reschedule', 'move_to_top', 'move_to_bottom']),
    postIds: z.array(z.string()).min(1).max(50),
    options: z.object({
      scheduledAt: z.string().datetime().optional(),
    }).optional(),
  }).refine((data) => {
    if (data.operation === 'reschedule' && !data.options?.scheduledAt) {
      return false;
    }
    return true;
  }, {
    message: 'scheduledAt is required for reschedule operation',
  }),
});