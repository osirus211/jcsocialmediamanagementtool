/**
 * Billing Service
 * Manages Stripe integration and subscription billing
 */

import Stripe from 'stripe';
import { Subscription, SubscriptionStatus } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { Workspace } from '../models/Workspace';
import { config } from '../config';
import { logger } from '../utils/logger';

export class BillingService {
  private static stripe: Stripe;

  /**
   * Initialize Stripe client
   */
  static initialize() {
    if (!config.stripe.secretKey) {
      logger.warn('Stripe secret key not configured');
      return;
    }

    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2026-02-25.clover',
    });

    logger.info('Stripe client initialized');
  }

  /**
   * Get Stripe client
   */
  private static getStripe(): Stripe {
    if (!this.stripe) {
      this.initialize();
    }
    return this.stripe;
  }

  /**
   * Create or get Stripe customer for workspace
   */
  static async getOrCreateCustomer(workspaceId: string, email: string): Promise<string> {
    try {
      const subscription = await Subscription.findOne({ workspaceId });

      // Return existing customer ID if available
      if (subscription?.stripeCustomerId) {
        return subscription.stripeCustomerId;
      }

      // Create new Stripe customer
      const workspace = await Workspace.findById(workspaceId);
      const stripe = this.getStripe();

      const customer = await stripe.customers.create({
        email,
        metadata: {
          workspaceId: workspaceId.toString(),
          workspaceName: workspace?.name || 'Unknown',
        },
      });

      // Update subscription with customer ID
      if (subscription) {
        subscription.stripeCustomerId = customer.id;
        await subscription.save();
      }

      logger.info('Stripe customer created', { workspaceId, customerId: customer.id });
      return customer.id;
    } catch (error) {
      logger.error('Error creating Stripe customer', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   */
  static async createCheckoutSession(
    workspaceId: string,
    planName: string,
    billingPeriod: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string,
    customerEmail: string
  ): Promise<string> {
    try {
      const stripe = this.getStripe();

      // Get plan
      const plan = await Plan.findOne({ name: planName, isActive: true });
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get price ID based on billing period
      const priceId = billingPeriod === 'monthly' 
        ? plan.stripePriceIdMonthly 
        : plan.stripePriceIdYearly;

      if (!priceId) {
        throw new Error('Stripe price ID not configured for this plan');
      }

      // Get or create customer
      const customerId = await this.getOrCreateCustomer(workspaceId, customerEmail);

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          workspaceId: workspaceId.toString(),
          planName,
          billingPeriod,
        },
      });

      logger.info('Checkout session created', { 
        workspaceId, 
        planName, 
        sessionId: session.id 
      });

      return session.url!;
    } catch (error) {
      logger.error('Error creating checkout session', { workspaceId, planName, error });
      throw error;
    }
  }

  /**
   * Create subscription after successful checkout
   */
  static async createSubscription(
    workspaceId: string,
    planName: string,
    stripeSubscriptionId: string,
    stripeCustomerId: string
  ): Promise<void> {
    try {
      const stripe = this.getStripe();

      // Get plan
      const plan = await Plan.findOne({ name: planName, isActive: true });
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get Stripe subscription details
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      // Create or update subscription
      await Subscription.findOneAndUpdate(
        { workspaceId },
        {
          workspaceId,
          planId: plan._id,
          stripeCustomerId,
          stripeSubscriptionId,
          status: stripeSubscription.status as any,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
        { upsert: true, new: true }
      );

      // Send subscription created email (non-blocking)
      this.sendSubscriptionCreatedEmail(workspaceId, planName).catch(err => {
        logger.warn('Failed to send subscription created email', { workspaceId, error: err.message });
      });

      logger.info('Subscription created', { workspaceId, planName, stripeSubscriptionId });
    } catch (error) {
      logger.error('Error creating subscription', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Upgrade subscription to a higher plan
   */
  static async upgradeSubscription(
    workspaceId: string,
    newPlanName: string,
    billingPeriod: 'monthly' | 'yearly'
  ): Promise<void> {
    try {
      const stripe = this.getStripe();

      // Get current subscription
      const subscription = await Subscription.findOne({ workspaceId });
      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Active subscription not found');
      }

      // Get new plan
      const newPlan = await Plan.findOne({ name: newPlanName, isActive: true });
      if (!newPlan) {
        throw new Error('Plan not found');
      }

      // Get price ID
      const priceId = billingPeriod === 'monthly'
        ? newPlan.stripePriceIdMonthly
        : newPlan.stripePriceIdYearly;

      if (!priceId) {
        throw new Error('Stripe price ID not configured for this plan');
      }

      // Get Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      // Update subscription
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });

      // Update local subscription
      subscription.planId = newPlan._id as any;
      await subscription.save();

      logger.info('Subscription upgraded', { workspaceId, newPlanName });
    } catch (error) {
      logger.error('Error upgrading subscription', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Downgrade subscription to a lower plan
   */
  static async downgradeSubscription(
    workspaceId: string,
    newPlanName: string,
    billingPeriod: 'monthly' | 'yearly'
  ): Promise<void> {
    try {
      const stripe = this.getStripe();

      // Get current subscription
      const subscription = await Subscription.findOne({ workspaceId });
      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Active subscription not found');
      }

      // Get new plan
      const newPlan = await Plan.findOne({ name: newPlanName, isActive: true });
      if (!newPlan) {
        throw new Error('Plan not found');
      }

      // Get price ID
      const priceId = billingPeriod === 'monthly'
        ? newPlan.stripePriceIdMonthly
        : newPlan.stripePriceIdYearly;

      if (!priceId) {
        throw new Error('Stripe price ID not configured for this plan');
      }

      // Get Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      // Schedule downgrade at period end
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: 'none',
        billing_cycle_anchor: 'unchanged',
      });

      logger.info('Subscription downgrade scheduled', { workspaceId, newPlanName });
    } catch (error) {
      logger.error('Error downgrading subscription', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Cancel subscription at period end
   */
  static async cancelSubscription(workspaceId: string): Promise<void> {
    try {
      const stripe = this.getStripe();

      // Get current subscription
      const subscription = await Subscription.findOne({ workspaceId });
      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Active subscription not found');
      }

      // Cancel at period end
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update local subscription
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      // Send subscription cancelled email (non-blocking)
      this.sendSubscriptionCancelledEmail(workspaceId, subscription.currentPeriodEnd).catch(err => {
        logger.warn('Failed to send subscription cancelled email', { workspaceId, error: err.message });
      });

      logger.info('Subscription cancelled', { workspaceId });
    } catch (error) {
      logger.error('Error cancelling subscription', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Reactivate cancelled subscription
   */
  static async reactivateSubscription(workspaceId: string): Promise<void> {
    try {
      const stripe = this.getStripe();

      // Get current subscription
      const subscription = await Subscription.findOne({ workspaceId });
      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('Subscription not found');
      }

      // Reactivate subscription
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      // Update local subscription
      subscription.cancelAtPeriodEnd = false;
      subscription.status = SubscriptionStatus.ACTIVE;
      await subscription.save();

      logger.info('Subscription reactivated', { workspaceId });
    } catch (error) {
      logger.error('Error reactivating subscription', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  static async getSubscription(workspaceId: string) {
    try {
      const subscription = await Subscription.findOne({ workspaceId }).populate('planId');
      
      if (!subscription) {
        // Return free plan if no subscription exists
        const freePlan = await Plan.findOne({ name: 'free' });
        return {
          plan: freePlan,
          status: 'active',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }

      return {
        plan: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEnd: subscription.trialEnd,
      };
    } catch (error) {
      logger.error('Error getting subscription', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      logger.info('Processing Stripe webhook', { type: event.type });

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const { workspaceId, planName } = session.metadata || {};

          if (workspaceId && planName && session.subscription) {
            await this.createSubscription(
              workspaceId,
              planName,
              session.subscription as string,
              session.customer as string
            );
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.updateSubscriptionFromStripe(subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionDeleted(subscription);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handlePaymentFailed(invoice);
          break;
        }

        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }
    } catch (error) {
      logger.error('Error handling webhook event', { event: event.type, error });
      throw error;
    }
  }

  /**
   * Update subscription from Stripe data
   */
  private static async updateSubscriptionFromStripe(stripeSubscription: Stripe.Subscription): Promise<void> {
    try {
      const subscription = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id,
      });

      if (!subscription) {
        logger.warn('Subscription not found for Stripe subscription', {
          stripeSubscriptionId: stripeSubscription.id,
        });
        return;
      }

      subscription.status = stripeSubscription.status as any;
      subscription.currentPeriodStart = new Date((stripeSubscription as any).current_period_start * 1000);
      subscription.currentPeriodEnd = new Date((stripeSubscription as any).current_period_end * 1000);
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

      await subscription.save();

      logger.info('Subscription updated from Stripe', {
        workspaceId: subscription.workspaceId,
        status: subscription.status,
      });
    } catch (error) {
      logger.error('Error updating subscription from Stripe', { error });
      throw error;
    }
  }

  /**
   * Handle subscription deletion
   */
  private static async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    try {
      const subscription = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id,
      });

      if (!subscription) {
        return;
      }

      // Move to free plan
      const freePlan = await Plan.findOne({ name: 'free' });
      if (freePlan) {
        subscription.planId = freePlan._id as any;
        subscription.status = SubscriptionStatus.CANCELED;
        await subscription.save();

        logger.info('Subscription moved to free plan', {
          workspaceId: subscription.workspaceId,
        });
      }
    } catch (error) {
      logger.error('Error handling subscription deletion', { error });
      throw error;
    }
  }

  /**
   * Handle payment failure
   */
  private static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      const subscription = await Subscription.findOne({
        stripeSubscriptionId: (invoice as any).subscription as string,
      });

      if (!subscription) {
        return;
      }

      subscription.status = SubscriptionStatus.PAST_DUE;
      await subscription.save();

      logger.warn('Payment failed for subscription', {
        workspaceId: subscription.workspaceId,
        invoiceId: invoice.id,
      });

      // Send payment failed email (non-blocking)
      this.sendPaymentFailedEmail(subscription.workspaceId.toString(), invoice).catch(err => {
        logger.warn('Failed to send payment failed email', { workspaceId: subscription.workspaceId, error: err.message });
      });
    } catch (error) {
      logger.error('Error handling payment failure', { error });
      throw error;
    }
  }

  /**
   * Send subscription created email
   */
  private static async sendSubscriptionCreatedEmail(workspaceId: string, planName: string): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');
      const { User } = await import('../models/User');

      // Get workspace owner
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) return;

      const owner = await User.findById(workspace.ownerId);
      if (!owner) return;

      // Use generic notification instead of specific method
      await emailNotificationService.sendNotification({
        eventType: 'subscription_created' as any,
        workspaceId,
        userId: owner._id.toString(),
        payload: {
          to: owner.email,
          planName,
          billingPeriod: 'monthly',
        },
      });
    } catch (error: any) {
      logger.error('Error sending subscription created email', { error: error.message });
    }
  }

  /**
   * Send subscription cancelled email
   */
  private static async sendSubscriptionCancelledEmail(workspaceId: string, endDate: Date): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');
      const { User } = await import('../models/User');

      // Get workspace owner
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) return;

      const owner = await User.findById(workspace.ownerId);
      if (!owner) return;

      // Use generic notification instead of specific method
      await emailNotificationService.sendNotification({
        eventType: 'subscription_cancelled' as any,
        workspaceId,
        userId: owner._id.toString(),
        payload: {
          to: owner.email,
          endDate: endDate.toLocaleDateString(),
        },
      });
    } catch (error: any) {
      logger.error('Error sending subscription cancelled email', { error: error.message });
    }
  }

  /**
   * Send payment failed email
   */
  private static async sendPaymentFailedEmail(workspaceId: string, invoice: Stripe.Invoice): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');
      const { User } = await import('../models/User');

      // Get workspace owner
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) return;

      const owner = await User.findById(workspace.ownerId);
      if (!owner) return;

      const amount = invoice.amount_due ? `$${(invoice.amount_due / 100).toFixed(2)}` : 'your subscription';

      // Use generic notification instead of specific method
      await emailNotificationService.sendNotification({
        eventType: 'payment_failed' as any,
        workspaceId,
        userId: owner._id.toString(),
        payload: {
          to: owner.email,
          amount,
          updatePaymentUrl: `${config.frontend.url}/workspace/${workspaceId}/billing`,
        },
      });
    } catch (error: any) {
      logger.error('Error sending payment failed email', { error: error.message });
    }
  }
}

// Initialize Stripe on module load
BillingService.initialize();
