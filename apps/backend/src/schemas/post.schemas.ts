/**
 * Post Request Validation Schemas
 */

import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  platforms: z.array(z.string()).min(1, 'At least one platform required'),
  scheduledFor: z.string().datetime().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  accountIds: z.array(z.string()).min(1, 'At least one account required'),
});

export const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
});

export const bulkScheduleSchema = z.object({
  posts: z.array(createPostSchema).min(1, 'At least one post required'),
});
