import { Router } from 'express';
import { billingController } from '../controllers/BillingController';
import { stripeWebhookController } from '../controllers/StripeWebhookController';
import { requireAuth } from '../middleware/auth';
import { requireOwner } from '../middleware/rbac';

const router = Router();

/**
 * Stripe Webhook
 * 
 * IMPORTANT: This route must NOT use JSON body parser
 * It needs raw body for signature verification
 */
router.post(
  '/webhook',
  stripeWebhookController.handleWebhook.bind(stripeWebhookController)
);

/**
 * Protected billing routes (owner only)
 * All billing operations require workspace ownership
 */
router.post('/checkout', requireAuth, requireOwner, billingController.createCheckout.bind(billingController));
router.post('/portal', requireAuth, requireOwner, billingController.createPortal.bind(billingController));
router.get('/', requireAuth, requireOwner, billingController.getBilling.bind(billingController));
router.post('/cancel', requireAuth, requireOwner, billingController.cancelSubscription.bind(billingController));

export default router;
