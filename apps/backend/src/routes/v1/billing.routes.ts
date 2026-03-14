/**
 * Billing Routes
 * Routes for subscription and billing management
 */

import { Router } from 'express';
import { billingController } from '../../controllers/BillingController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { createCheckoutSessionSchema, updateSubscriptionSchema, createPortalSessionSchema } from '../../schemas/billing.schemas';

const router = Router();

/**
 * Protected routes (require authentication)
 */

// Get billing information
router.get('/', requireAuth, requireWorkspace, billingController.getBilling.bind(billingController));

// Create checkout session
router.post('/checkout', requireAuth, requireWorkspace, validateRequest(createCheckoutSessionSchema), billingController.createCheckout.bind(billingController));

// Create customer portal session
router.post('/portal', requireAuth, requireWorkspace, validateRequest(createPortalSessionSchema), billingController.createPortal.bind(billingController));

// Cancel subscription
router.post('/cancel', requireAuth, requireWorkspace, billingController.cancelSubscription.bind(billingController));

export default router;

