/**
 * Template Zod Schemas
 * Phase 2: Post Templates validation
 */

import { z } from 'zod';
import { SocialPlatform } from '../models/ScheduledPost';

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or less'),
  hashtags: z.array(z.string()).optional(),
  platforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  mediaIds: z.array(z.string()).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  hashtags: z.array(z.string()).optional(),
  platforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  mediaIds: z.array(z.string()).optional(),
});
