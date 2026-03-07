import { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripeService } from '../services/StripeService';
import { Billing, BillingPlan, BillingStatus } from '../models/Billing';
import { Workspace } from '../models/Workspace';
import { WebhookEvent } from '../models/WebhookEvent';
import { usageService } from '../services/UsageService';
import { logger } from '../utils/logger';

/**
 * Stripe Webhook Controller
 * 
 * Handles Stripe webhook events to sync subscription state
 * Implements idempotency to prevent duplicate processing
 */

export class StripeWebhookController {
  /**
   * Handle Stripe webhook
   * 
   * IMPORTANT: This endpoint must use raw body (not JSON parsed)
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      logger.error('Missing Stripe signature header');
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    try {
      // Verify webhook signature
      const event = stripeService.verifyWebhookSignature(
        req.body, // Raw body
        signature
      );

      logger.info('Stripe webhook received', {
        eventType: event.type,
        eventId: event.id,
      });

      // Check if event already processed (idempotency)
      const existingEvent = await WebhookEvent.findOne({ stripeEventId: event.id });
      
      if (existingEvent) {
        logger.info('Webhook event already processed (idempotent skip)', {
          eventId: event.id,
          eventType: event.type,
          processedAt: existingEvent.processedAt,
        });
        res.json({ received: true, alreadyProcessed: true });
        return;
      }

      // Process event
      await this.processWebhookEvent(event);

      // Mark event as processed
      await WebhookEvent.create({
        stripeEventId: event.id,
        eventType: event.type,
        processedAt: new Date(),
        metadata: {
          workspaceId: this.extractWorkspaceId(event),
        },
      });

      res.json({ received: true });
    } catch (error: any) {
      logger.error('Stripe webhook processing failed', {
        error: error.message,
        stack: error.stack,
      });
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Extract workspaceId from event metadata
   */
  private extractWorkspaceId(event: Stripe.Event): string | undefined {
    const data = event.data.object as any;
    return data.metadata?.workspaceId;
  }

  /**
   * Process webhook event
   */
  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.debug('Unhandled webhook event type', {
          eventType: event.type,
        });
    }
  }

  /**
   * Handle checkout.session.completed
   * Activate subscription after successful checkout
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const workspaceId = session.metadata?.workspaceId;
    const subscriptionId = session.subscription as string;

    if (!workspaceId || !subscriptionId) {
      logger.error('Missing metadata in checkout session', {
        sessionId: session.id,
      });
      return;
    }

    logger.info('Processing checkout completion', {
      sessionId: session.id,
      workspaceId,
      subscriptionId,
    });

    // Get subscription details
    const subscription = await stripeService.getSubscription(subscriptionId);

    // Update billing
    await this.updateBillingFromSubscription(workspaceId, subscription);

    logger.info('Checkout completed and subscription activated', {
      workspaceId,
      subscriptionId,
    });
  }

  /**
   * Handle customer.subscription.updated
   * Sync subscription changes
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const workspaceId = subscription.metadata?.workspaceId;

    if (!workspaceId) {
      logger.error('Missing workspaceId in subscription metadata', {
        subscriptionId: subscription.id,
      });
      return;
    }

    logger.info('Processing subscription update', {
      subscriptionId: subscription.id,
      workspaceId,
      status: subscription.status,
    });

    await this.updateBillingFromSubscription(workspaceId, subscription);

    logger.info('Subscription updated', {
      workspaceId,
      subscriptionId: subscription.id,
    });
  }

  /**
   * Handle customer.subscription.deleted
   * Cancel subscription
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const workspaceId = subscription.metadata?.workspaceId;

    if (!workspaceId) {
      logger.error('Missing workspaceId in subscription metadata', {
        subscriptionId: subscription.id,
      });
      return;
    }

    logger.info('Processing subscription deletion', {
      subscriptionId: subscription.id,
      workspaceId,
    });

    const billing = await Billing.findOne({ workspaceId });

    if (!billing) {
      logger.error('Billing not found for workspace', { workspaceId });
      return;
    }

    // Downgrade to free plan
    billing.plan = BillingPlan.FREE;
    billing.status = BillingStatus.CANCELED;
    billing.stripeSubscriptionId = undefined;
    billing.currentPeriodEnd = undefined;
    billing.cancelAtPeriodEnd = false;
    await billing.save();

    // Update workspace plan
    await Workspace.findByIdAndUpdate(workspaceId, {
      plan: BillingPlan.FREE,
    });

    logger.info('Subscription deleted and downgraded to free', {
      workspaceId,
      subscriptionId: subscription.id,
    });
  }

  /**
   * Handle invoice.payment_failed
   * Mark subscription as past due and track first failure time
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // @ts-ignore - subscription exists on Invoice but not in type definition
    const subscriptionId = invoice.subscription as string | undefined;

    if (!subscriptionId) {
      return;
    }

    const billing = await Billing.findOne({ stripeSubscriptionId: subscriptionId });

    if (!billing) {
      logger.error('Billing not found for subscription', { subscriptionId });
      return;
    }

    logger.info('Processing payment failure', {
      subscriptionId,
      workspaceId: billing.workspaceId,
    });

    billing.status = BillingStatus.PAST_DUE;
    
    // Track first payment failure time (for grace period)
    if (!billing.metadata.paymentFailedAt) {
      billing.metadata.paymentFailedAt = new Date();
      billing.markModified('metadata');
    }
    
    await billing.save();

    logger.warn('Subscription marked as past due', {
      workspaceId: billing.workspaceId,
      subscriptionId,
      paymentFailedAt: billing.metadata.paymentFailedAt,
    });
  }

  /**
   * Handle invoice.payment_succeeded
   * Reactivate subscription after successful payment and clear failure timestamp
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // @ts-ignore - subscription exists on Invoice but not in type definition
    const subscriptionId = invoice.subscription as string | undefined;

    if (!subscriptionId) {
      return;
    }

    const billing = await Billing.findOne({ stripeSubscriptionId: subscriptionId });

    if (!billing) {
      logger.error('Billing not found for subscription', { subscriptionId });
      return;
    }

    logger.info('Processing payment success', {
      subscriptionId,
      workspaceId: billing.workspaceId,
    });

    // If was past due, reactivate
    if (billing.status === BillingStatus.PAST_DUE) {
      billing.status = BillingStatus.ACTIVE;
      
      // Clear payment failure timestamp
      if (billing.metadata.paymentFailedAt) {
        delete billing.metadata.paymentFailedAt;
        billing.markModified('metadata');
      }
      
      await billing.save();

      logger.info('Subscription reactivated after payment', {
        workspaceId: billing.workspaceId,
        subscriptionId,
      });
    }
  }

  /**
   * Update billing from Stripe subscription (atomic with MongoDB transaction)
   */
  private async updateBillingFromSubscription(
    workspaceId: string,
    subscription: Stripe.Subscription
  ): Promise<void> {
    const session = await Billing.startSession();
    session.startTransaction();

    try {
      const billing = await Billing.findOne({ workspaceId }).session(session);

      if (!billing) {
        logger.error('Billing not found for workspace', { workspaceId });
        await session.abortTransaction();
        return;
      }

      // Determine plan from price ID
      const priceId = subscription.items.data[0]?.price.id;
      const plan = this.getPlanFromPriceId(priceId);

      if (!plan) {
        logger.error('Cannot update billing: unknown price ID', {
          workspaceId,
          priceId,
          subscriptionId: subscription.id,
        });
        await session.abortTransaction();
        return;
      }

      // Map Stripe status to our status
      const status = this.mapStripeStatus(subscription.status);

      // Check if new billing period (reset usage)
      const isNewPeriod = billing.currentPeriodStart && 
        new Date((subscription as any).current_period_start * 1000).getTime() !== billing.currentPeriodStart.getTime();

      const newPeriodStart = new Date((subscription as any).current_period_start * 1000);
      const newPeriodEnd = new Date((subscription as any).current_period_end * 1000);

      // Update billing
      billing.stripeSubscriptionId = subscription.id;
      billing.plan = plan;
      billing.status = status;
      billing.currentPeriodStart = newPeriodStart;
      billing.currentPeriodEnd = newPeriodEnd;
      billing.cancelAtPeriodEnd = subscription.cancel_at_period_end;

      // Reset usage if new period
      if (isNewPeriod) {
        billing.resetUsage();
        
        // Create new usage record for new period
        await usageService.resetUsageForNewPeriod(
          workspaceId,
          newPeriodStart,
          newPeriodEnd
        );
        
        logger.info('Usage reset for new billing period', {
          workspaceId,
          periodStart: newPeriodStart,
          periodEnd: newPeriodEnd,
        });
      }

      await billing.save({ session });

      // Update workspace plan
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { plan: plan },
        { session }
      );

      await session.commitTransaction();

      logger.info('Billing updated from subscription (atomic)', {
        workspaceId,
        plan,
        status,
        subscriptionId: subscription.id,
      });
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Failed to update billing atomically', {
        error: error.message,
        workspaceId,
        subscriptionId: subscription.id,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Map Stripe subscription status to our status
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): BillingStatus {
    switch (stripeStatus) {
      case 'active':
        return BillingStatus.ACTIVE;
      case 'trialing':
        return BillingStatus.TRIALING;
      case 'past_due':
        return BillingStatus.PAST_DUE;
      case 'canceled':
      case 'unpaid':
        return BillingStatus.CANCELED;
      case 'incomplete':
      case 'incomplete_expired':
        return BillingStatus.INCOMPLETE;
      default:
        return BillingStatus.CANCELED;
    }
  }

  /**
   * Determine plan from Stripe price ID (safe mapping)
   * 
   * Returns null if price ID is unknown (prevents wrong plan assignment)
   */
  private getPlanFromPriceId(priceId?: string): BillingPlan | null {
    if (!priceId) {
      return null;
    }

    // Map price IDs to plans
    // TODO: Replace with your actual Stripe product price IDs
    const priceMap: Record<string, BillingPlan> = {
      'price_pro_monthly': BillingPlan.PRO,
      'price_pro_yearly': BillingPlan.PRO,
      'price_team_monthly': BillingPlan.TEAM,
      'price_team_yearly': BillingPlan.TEAM,
      'price_enterprise_monthly': BillingPlan.ENTERPRISE,
      'price_enterprise_yearly': BillingPlan.ENTERPRISE,
    };

    const plan = priceMap[priceId];

    if (!plan) {
      logger.warn('Unknown Stripe price ID', {
        priceId,
        availablePrices: Object.keys(priceMap),
      });
      return null;
    }

    return plan;
  }
}

export const stripeWebhookController = new StripeWebhookController();
