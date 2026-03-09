import { Request, Response } from 'express';
import { config } from '../config';
import { stripeService } from '../services/StripeService';
import { Billing } from '../models/Billing';
import { logger } from '../utils/logger';
import { logAudit } from '../utils/auditLogger';

/**
 * Billing Controller
 * 
 * Handles billing operations:
 * - Create checkout session
 * - Create customer portal session
 * - Get billing info
 */

export class BillingController {
  /**
   * Create Stripe Checkout session
   * 
   * POST /api/billing/checkout
   * Body: { priceId: string }
   */
  async createCheckout(req: Request, res: Response): Promise<void> {
    try {
      const { priceId } = req.body;
      const workspaceId = (req.user as any)?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!priceId) {
        res.status(400).json({ error: 'priceId is required' });
        return;
      }

      // Get or create billing
      let billing = await Billing.findOne({ workspaceId });

      if (!billing) {
        // Create Stripe customer first
        const customerId = await stripeService.createCustomer({
          email: req.user!.email,
          name: (req.user as any)!.name,
          metadata: {
            workspaceId: workspaceId.toString(),
          },
        });

        // Create billing record
        billing = await Billing.create({
          workspaceId,
          stripeCustomerId: customerId,
        });
      }

      // Create checkout session
      const successUrl = `${config.frontend.url}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${config.frontend.url}/billing`;

      const checkoutUrl = await stripeService.createCheckoutSession(
        billing.stripeCustomerId,
        priceId,
        workspaceId.toString(),
        successUrl,
        cancelUrl
      );

      logger.info('Checkout session created', {
        workspaceId,
        priceId,
      });

      // Audit log: Billing checkout initiated
      logAudit({
        userId: req.user?.userId,
        workspaceId,
        action: 'billing.updated',
        entityType: 'billing',
        metadata: {
          operation: 'checkout',
          priceId,
        },
        req,
      });

      res.json({ url: checkoutUrl });
    } catch (error: any) {
      logger.error('Failed to create checkout session', {
        error: error.message,
        workspaceId: (req.user as any)?.workspaceId,
      });
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  /**
   * Create Stripe Customer Portal session
   * 
   * POST /api/billing/portal
   */
  async createPortal(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req.user as any)?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const billing = await Billing.findOne({ workspaceId });

      if (!billing) {
        res.status(404).json({ error: 'Billing not found' });
        return;
      }

      // Create portal session
      const returnUrl = `${config.frontend.url}/billing`;
      const portalUrl = await stripeService.createPortalSession(
        billing.stripeCustomerId,
        returnUrl
      );

      logger.info('Portal session created', {
        workspaceId,
      });

      res.json({ url: portalUrl });
    } catch (error: any) {
      logger.error('Failed to create portal session', {
        error: error.message,
        workspaceId: (req.user as any)?.workspaceId,
      });
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  }

  /**
   * Get billing information
   * 
   * GET /api/billing
   */
  async getBilling(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req.user as any)?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const billing = await Billing.findOne({ workspaceId });

      if (!billing) {
        res.status(404).json({ error: 'Billing not found' });
        return;
      }

      res.json({
        plan: billing.plan,
        status: billing.status,
        currentPeriodEnd: billing.currentPeriodEnd,
        cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
        usageSnapshot: billing.usageSnapshot,
      });
    } catch (error: any) {
      logger.error('Failed to get billing', {
        error: error.message,
        workspaceId: (req.user as any)?.workspaceId,
      });
      res.status(500).json({ error: 'Failed to get billing' });
    }
  }

  /**
   * Cancel subscription
   * 
   * POST /api/billing/cancel
   */
  async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = (req.user as any)?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const billing = await Billing.findOne({ workspaceId });

      if (!billing || !billing.stripeSubscriptionId) {
        res.status(404).json({ error: 'No active subscription' });
        return;
      }

      // Cancel at period end (don't cancel immediately)
      await stripeService.cancelSubscription(billing.stripeSubscriptionId, true);

      logger.info('Subscription cancelled', {
        workspaceId,
        subscriptionId: billing.stripeSubscriptionId,
      });

      // Audit log: Billing subscription cancelled
      logAudit({
        userId: req.user?.userId,
        workspaceId,
        action: 'billing.updated',
        entityType: 'billing',
        metadata: {
          operation: 'cancel_subscription',
          subscriptionId: billing.stripeSubscriptionId,
        },
        req,
      });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Failed to cancel subscription', {
        error: error.message,
        workspaceId: (req.user as any)?.workspaceId,
      });
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }
}

export const billingController = new BillingController();
