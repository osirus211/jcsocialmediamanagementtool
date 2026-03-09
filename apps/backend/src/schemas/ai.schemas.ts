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
