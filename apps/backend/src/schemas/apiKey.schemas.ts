/**
 * API Key Request Validation Schemas
 */

import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).optional(),
});

export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});
