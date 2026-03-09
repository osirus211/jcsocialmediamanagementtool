/**
 * Link Zod Schemas
 * Validation for link shortening operations
 */

import { z } from 'zod';

export const shortenUrlSchema = z.object({
  originalUrl: z.string().url('Invalid URL format'),
  postId: z.string().optional(),
  platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'threads', 'google-business']).optional(),
  expiresAt: z.string().datetime().optional(),
});
