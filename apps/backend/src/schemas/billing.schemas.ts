/**
 * Billing Request Validation Schemas
 */

import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const updateSubscriptionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
});

export const createPortalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});
