/**
 * Billing Routes
 * Routes for subscription and billing management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { billingController } from '../../controllers/BillingController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { requireStripe } from '../../middleware/stripe';
import { validateRequest } from '../../middleware/validate';
import { createCheckoutSessionSchema, updateSubscriptionSchema, createPortalSessionSchema } from '../../schemas/billing.schemas';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';

const router = Router();

// Rate limiters
const billingReadLimit = new SlidingWindowRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000,
  keyPrefix: 'rateLimit:billingRead',
});

const billingMutateLimit = new SlidingWindowRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: 'rateLimit:billingMutate',
});

const billingReadRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await billingReadLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many billing requests.',
      });
      return;
    }
    next();
  } catch {
    next();
  }
};

const billingMutateRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await billingMutateLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many billing mutation requests.',
      });
      return;
    }
    next();
  } catch {
    next();
  }
};

/**
 * Protected routes (require authentication and Stripe configuration)
 */

// Get billing information
router.get('/', requireAuth, requireWorkspace, requireStripe, billingReadRateLimit, billingController.getBilling.bind(billingController));

// Create checkout session
router.post('/checkout', requireAuth, requireWorkspace, requireStripe, billingMutateRateLimit, validateRequest(createCheckoutSessionSchema), billingController.createCheckout.bind(billingController));

// Create customer portal session
router.post('/portal', requireAuth, requireWorkspace, requireStripe, billingMutateRateLimit, validateRequest(createPortalSessionSchema), billingController.createPortal.bind(billingController));

// Cancel subscription
router.post('/cancel', requireAuth, requireWorkspace, requireStripe, billingMutateRateLimit, billingController.cancelSubscription.bind(billingController));

export default router;

