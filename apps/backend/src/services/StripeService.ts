/**
 * Stripe Service
 * 
 * Handles Stripe payment integration
 */

import Stripe from 'stripe';
import { config } from '../config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Subscription as SubscriptionModel, SubscriptionStatus, BillingCycle, ISubscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { Workspace } from '../models/Workspace';
import { logger } from '../utils/logger';
import {
  recordSubscriptionCreated,
  recordSubscriptionCanceled,
  recordPaymentSucceeded,
  recordPaymentFailed,
} from '../config/billingMetrics';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';

// Only initialize Stripe if we have a real secret key
const isStripeConfigured = config.stripe.secretKey && 
  config.stripe.secretKey !== 'your-stripe-secret-key' && 
  config.stripe.secretKey.startsWith('sk_');

const stripe = isStripeConfigured ? new Stripe(config.stripe.secretKey!, {
  apiVersion: '2024-11-20.acacia' as any,
}) : null;

export class StripeService {
  private ensureStripeConfigured(): void {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }
  }

  /**
   * Create Stripe customer
   */
  async createCustomer(params: {
    workspaceId: mongoose.Types.ObjectId;
    email: string;
    name: string;
  }): Promise<Stripe.Customer> {
    this.ensureStripeConfigured();
    const { workspaceId, email, name } = params;

    try {
      const customer = await stripe!.customers.create({
        email,
        name,
        metadata: {
          workspaceId: workspaceId.toString(),
        },
      }, {
        idempotencyKey: `customer-create-${workspaceId.toString()}-${Date.now()}`,
      });

      logger.info(`Stripe customer created: ${customer.id}`);
      return customer;
    } catch (error: any) {
      logger.error('Failed to create Stripe customer:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(params: {
    workspaceId: mongoose.Types.ObjectId;
    planId: mongoose.Types.ObjectId;
    billingCycle: BillingCycle;
    paymentMethodId: string;
    email: string;
    name: string;
    trialDays?: number;
  }): Promise<ISubscription> {
    this.ensureStripeConfigured();
    const { workspaceId, planId, billingCycle, paymentMethodId, email, name, trialDays } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get plan
      const plan = await Plan.findById(planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get or create Stripe customer
      let stripeCustomerId: string;
      const existingSubscription = await SubscriptionModel.findOne({ workspaceId });

      if (existingSubscription) {
        stripeCustomerId = existingSubscription.stripeCustomerId;
      } else {
        const customer = await this.createCustomer({ workspaceId, email, name });
        stripeCustomerId = customer.id;
      }

      // Attach payment method to customer
      await stripe!.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Set as default payment method
      await stripe!.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Get Stripe price ID
      const stripePriceId =
        billingCycle === BillingCycle.MONTHLY
          ? plan.stripePriceIdMonthly
          : plan.stripePriceIdYearly;

      if (!stripePriceId) {
        throw new Error('Stripe price ID not configured for plan');
      }

      // Create Stripe subscription
      const stripeSubscription = await stripe!.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePriceId }],
        trial_period_days: trialDays,
        metadata: {
          workspaceId: workspaceId.toString(),
          planId: planId.toString(),
        },
      }, {
        idempotencyKey: `sub-create-${workspaceId.toString()}-${planId.toString()}-${Date.now()}`,
      });

      // Calculate dates
      const currentPeriodStart = new Date((stripeSubscription as any).current_period_start * 1000);
      const currentPeriodEnd = new Date((stripeSubscription as any).current_period_end * 1000);
      const renewalDate = currentPeriodEnd;

      // Create or update subscription
      const amount =
        billingCycle === BillingCycle.MONTHLY ? plan.priceMonthly : plan.priceYearly;

      let subscription = await SubscriptionModel.findOne({ workspaceId });

      if (subscription) {
        // Update existing subscription
        subscription.planId = planId;
        subscription.status = stripeSubscription.status as SubscriptionStatus;
        subscription.billingCycle = billingCycle;
        subscription.currentPeriodStart = currentPeriodStart;
        subscription.currentPeriodEnd = currentPeriodEnd;
        subscription.renewalDate = renewalDate;
        subscription.stripeSubscriptionId = stripeSubscription.id;
        subscription.stripePaymentMethodId = paymentMethodId;
        subscription.amount = amount;
        subscription.cancelAtPeriodEnd = false;

        if (trialDays) {
          subscription.trialStart = currentPeriodStart;
          subscription.trialEnd = new Date((stripeSubscription.trial_end as any)! * 1000);
        }
      } else {
        // Create new subscription
        subscription = new SubscriptionModel({
          workspaceId,
          planId,
          status: stripeSubscription.status as SubscriptionStatus,
          billingCycle,
          currentPeriodStart,
          currentPeriodEnd,
          renewalDate,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          stripePaymentMethodId: paymentMethodId,
          amount,
          currency: 'usd',
          cancelAtPeriodEnd: false,
        });

        if (trialDays) {
          subscription.trialStart = currentPeriodStart;
          subscription.trialEnd = new Date((stripeSubscription.trial_end as any)! * 1000);
        }
      }

      await subscription.save({ session });

      // Update workspace plan
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { plan: plan.name },
        { session }
      );

      await session.commitTransaction();

      recordSubscriptionCreated(plan.name, billingCycle);
      logger.info(`Subscription created for workspace ${workspaceId}`);

      // Audit log
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId.toString()),
        action: ActivityAction.SUBSCRIPTION_CREATED,
        metadata: {
          planId: planId.toString(),
          stripeSubscriptionId: stripeSubscription.id,
          billingCycle,
        },
      }).catch(() => {});

      return subscription;
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('Failed to create subscription:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(params: {
    workspaceId: mongoose.Types.ObjectId;
    immediately?: boolean;
  }): Promise<void> {
    this.ensureStripeConfigured();
    const { workspaceId, immediately = false } = params;

    try {
      const subscription = await SubscriptionModel.findOne({ workspaceId });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (immediately) {
        // Cancel immediately
        await stripe!.subscriptions.cancel(subscription.stripeSubscriptionId);
        subscription.status = SubscriptionStatus.CANCELED;
        subscription.canceledAt = new Date();
      } else {
        // Cancel at period end
        await stripe!.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        subscription.cancelAtPeriodEnd = true;
      }

      await subscription.save();

      recordSubscriptionCanceled(subscription.planId.toString(), immediately);
      logger.info(`Subscription canceled for workspace ${workspaceId}`);

      // Audit log
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId.toString()),
        action: ActivityAction.SUBSCRIPTION_CANCELLED,
        metadata: {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          immediately,
        },
      }).catch(() => {});
    } catch (error: any) {
      logger.error('Failed to cancel subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Reactivate canceled subscription
   */
  async reactivateSubscription(workspaceId: mongoose.Types.ObjectId): Promise<void> {
    this.ensureStripeConfigured();
    try {
      const subscription = await SubscriptionModel.findOne({ workspaceId });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!subscription.cancelAtPeriodEnd) {
        throw new Error('Subscription is not scheduled for cancellation');
      }

      // Reactivate in Stripe
      await stripe!.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      subscription.cancelAtPeriodEnd = false;
      await subscription.save();

      logger.info(`Subscription reactivated for workspace ${workspaceId}`);
    } catch (error: any) {
      logger.error('Failed to reactivate subscription:', error);
      throw new Error(`Failed to reactivate subscription: ${error.message}`);
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(params: {
    workspaceId: mongoose.Types.ObjectId;
    newPlanId: mongoose.Types.ObjectId;
    billingCycle: BillingCycle;
  }): Promise<void> {
    this.ensureStripeConfigured();
    const { workspaceId, newPlanId, billingCycle } = params;

    try {
      const subscription = await SubscriptionModel.findOne({ workspaceId });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const newPlan = await Plan.findById(newPlanId);
      if (!newPlan) {
        throw new Error('Plan not found');
      }

      const stripePriceId =
        billingCycle === BillingCycle.MONTHLY
          ? newPlan.stripePriceIdMonthly
          : newPlan.stripePriceIdYearly;

      if (!stripePriceId) {
        throw new Error('Stripe price ID not configured for plan');
      }

      // Update Stripe subscription
      const stripeSubscription = await stripe!.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      await stripe!.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: stripePriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });

      // Update local subscription
      subscription.planId = newPlanId;
      subscription.billingCycle = billingCycle;
      subscription.amount =
        billingCycle === BillingCycle.MONTHLY ? newPlan.priceMonthly : newPlan.priceYearly;
      await subscription.save();

      // Update workspace plan
      await Workspace.findByIdAndUpdate(workspaceId, { plan: newPlan.name });

      logger.info(`Subscription plan updated for workspace ${workspaceId}`);
    } catch (error: any) {
      logger.error('Failed to update subscription plan:', error);
      throw new Error(`Failed to update subscription plan: ${error.message}`);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    this.ensureStripeConfigured();
    logger.info(`Processing Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
          break;

        default:
          logger.debug(`Unhandled webhook event: ${event.type}`);
      }
    } catch (error: any) {
      logger.error(`Failed to process webhook ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle invoice paid event
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) return;

    const subscription = await SubscriptionModel.findOne({ stripeSubscriptionId: subscriptionId });
    if (!subscription) {
      logger.warn(`Subscription not found for invoice: ${invoice.id}`);
      return;
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    await subscription.save();

    recordPaymentSucceeded(subscription.planId.toString(), invoice.amount_paid);
    logger.info(`Invoice paid for subscription: ${subscriptionId}`);
  }

  /**
   * Handle invoice payment failed event
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) return;

    const subscription = await SubscriptionModel.findOne({ stripeSubscriptionId: subscriptionId });
    if (!subscription) {
      logger.warn(`Subscription not found for invoice: ${invoice.id}`);
      return;
    }

    subscription.status = SubscriptionStatus.PAST_DUE;
    await subscription.save();

    recordPaymentFailed(subscription.planId.toString(), invoice.amount_due);
    logger.warn(`Payment failed for subscription: ${subscriptionId}`);

    // TODO: Send notification to workspace owner
  }

  /**
   * Handle subscription updated event
   */
  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await SubscriptionModel.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (!subscription) {
      logger.warn(`Subscription not found: ${stripeSubscription.id}`);
      return;
    }

    subscription.status = stripeSubscription.status as SubscriptionStatus;
    subscription.currentPeriodStart = new Date((stripeSubscription as any).current_period_start * 1000);
    subscription.currentPeriodEnd = new Date((stripeSubscription as any).current_period_end * 1000);
    subscription.renewalDate = new Date((stripeSubscription as any).current_period_end * 1000);
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

    await subscription.save();

    logger.info(`Subscription updated: ${stripeSubscription.id}`);
  }

  /**
   * Handle subscription deleted event
   */
  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await SubscriptionModel.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (!subscription) {
      logger.warn(`Subscription not found: ${stripeSubscription.id}`);
      return;
    }

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    await subscription.save();

    // Downgrade workspace to free plan
    const freePlan = await Plan.findOne({ name: 'free' });
    if (freePlan) {
      await Workspace.findByIdAndUpdate(subscription.workspaceId, { plan: freePlan.name });
    }

    logger.info(`Subscription deleted: ${stripeSubscription.id}`);
  }

  /**
   * Handle trial will end event
   */
  private async handleTrialWillEnd(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await SubscriptionModel.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (!subscription) {
      logger.warn(`Subscription not found: ${stripeSubscription.id}`);
      return;
    }

    logger.info(`Trial ending soon for subscription: ${stripeSubscription.id}`);

    // TODO: Send notification to workspace owner
  }

  /**
   * Construct webhook event from request
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    this.ensureStripeConfigured();
    const webhookSecret = config.stripe.webhookSecret || '';
    return stripe!.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}

export const stripeService = new StripeService();

