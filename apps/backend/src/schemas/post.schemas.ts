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
  contentType: z.enum(['post', 'story', 'reel']).default('post'),
  storyOptions: z.object({
    expiresAt: z.string().datetime().optional(),
    link: z.string().url().optional(),
  }).optional(),
  reelOptions: z.object({
    audioName: z.string().optional(),
    shareToFeed: z.boolean().default(true),
  }).optional(),
}).refine(
  (data) => {
    // Reels require at least 1 video media item
    if (data.contentType === 'reel' && (!data.mediaUrls || data.mediaUrls.length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'Reels require at least 1 video media item',
    path: ['mediaUrls'],
  }
);

export const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
  contentType: z.enum(['post', 'story', 'reel']).optional(),
  storyOptions: z.object({
    expiresAt: z.string().datetime().optional(),
    link: z.string().url().optional(),
  }).optional(),
  reelOptions: z.object({
    audioName: z.string().optional(),
    shareToFeed: z.boolean().optional(),
  }).optional(),
});

export const bulkScheduleSchema = z.object({
  posts: z.array(createPostSchema).min(1, 'At least one post required'),
});
