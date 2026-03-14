/**
 * Template Zod Schemas
 * Phase 2: Post Templates validation with competitive features
 */

import { z } from 'zod';
import { SocialPlatform } from '../models/ScheduledPost';

const industryEnum = z.enum([
  'ecommerce', 'saas', 'agency', 'healthcare', 'education', 
  'finance', 'real-estate', 'restaurant', 'fitness', 'beauty', 
  'travel', 'nonprofit', 'general'
]);

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or less'),
  hashtags: z.array(z.string()).optional(),
  platforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  mediaIds: z.array(z.string()).optional(),
  // New competitive features
  category: z.string().max(100).optional(),
  variables: z.array(z.string()).optional(),
  isPrebuilt: z.boolean().optional(),
  industry: industryEnum.optional(),
  rating: z.number().min(0).max(5).optional(),
  isFavorite: z.boolean().optional(),
  isPersonal: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  previewImage: z.string().url().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  hashtags: z.array(z.string()).optional(),
  platforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  mediaIds: z.array(z.string()).optional(),
  // New competitive features
  category: z.string().max(100).optional(),
  rating: z.number().min(0).max(5).optional(),
  isFavorite: z.boolean().optional(),
  isPersonal: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  previewImage: z.string().url().optional(),
});

export const duplicateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
});

export const aiSuggestionsSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  limit: z.number().min(1).max(20).optional(),
});

export const applyTemplateSchema = z.object({
  variables: z.record(z.string(), z.string()).optional(),
});
