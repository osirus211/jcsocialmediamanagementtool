/**
 * AI Request Validation Schemas
 */

import { z } from 'zod';

export const generateContentSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
  platform: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'friendly', 'formal']).optional(),
  maxLength: z.number().int().positive().optional(),
});

export const improveContentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  instruction: z.string().min(1, 'Instruction is required').max(500, 'Instruction too long'),
});

export const generateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
  size: z.enum(['1024x1024', '1024x1792', '1792x1024']).optional().default('1024x1024'),
  quality: z.enum(['standard', 'hd']).optional().default('standard'),
  style: z.enum(['vivid', 'natural']).optional().default('vivid'),
});

export const generateImageVariationSchema = z.object({
  imageUrl: z.string().url('Valid image URL is required'),
  size: z.enum(['1024x1024', '1024x1792', '1792x1024']).optional().default('1024x1024'),
});

export const generateCalendarSchema = z.object({
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid start date'),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid end date'),
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  postCount: z.number().int().min(1).max(30),
  topic: z.string().max(200).optional(),
  tone: z.enum(['professional', 'casual', 'humorous', 'inspirational']).optional(),
  emptySlots: z.array(z.string()),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff <= 30;
}, 'Date range cannot exceed 30 days');
