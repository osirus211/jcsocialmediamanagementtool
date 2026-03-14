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
  title: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  password: z.string().max(100).optional(),
  useBitly: z.boolean().optional(),
  bitlyAccessToken: z.string().optional(),
  customDomain: z.string().optional(),
  utmParams: z.object({
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    term: z.string().optional(),
    content: z.string().optional(),
  }).optional(),
});

export const updateLinkSchema = z.object({
  originalUrl: z.string().url().optional(),
  title: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  password: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const bulkShortenSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100),
  title: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  useBitly: z.boolean().optional(),
  bitlyAccessToken: z.string().optional(),
  customDomain: z.string().optional(),
  utmParams: z.object({
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    term: z.string().optional(),
    content: z.string().optional(),
  }).optional(),
});
