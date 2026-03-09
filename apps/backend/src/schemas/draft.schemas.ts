/**
 * Draft Request Validation Schemas
 */

import { z } from 'zod';

export const createDraftSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  platforms: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateDraftSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  platforms: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
