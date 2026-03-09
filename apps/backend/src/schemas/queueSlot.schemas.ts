/**
 * QueueSlot Zod Schemas
 * Validation for queue slot operations
 */

import { z } from 'zod';

export const createQueueSlotSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'threads', 'google-business']),
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format (24-hour)'),
  timezone: z.string().min(1, 'Timezone is required'),
});

export const updateQueueSlotSchema = z.object({
  time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format (24-hour)').optional(),
  timezone: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const addToQueueSchema = z.object({
  postId: z.string().min(1, 'Post ID is required'),
  platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'threads', 'google-business']),
});
