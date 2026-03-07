/**
 * Billing Metrics Configuration
 * 
 * Prometheus metrics for billing and subscriptions
 */

import { Counter, Gauge, Histogram, register } from 'prom-client';

// Subscription metrics
export const subscriptionCreatedCounter = new Counter({
  name: 'subscription_created_total',
  help: 'Total number of subscriptions created',
  labelNames: ['plan', 'billing_cycle'],
  registers: [register],
});

export const subscriptionCanceledCounter = new Counter({
  name: 'subscription_canceled_total',
  help: 'Total number of subscriptions canceled',
  labelNames: ['plan', 'immediately'],
  registers: [register],
});

export const activeSubscriptionsGauge = new Gauge({
  name: 'active_subscriptions_total',
  help: 'Total number of active subscriptions',
  labelNames: ['plan'],
  registers: [register],
});

export const trialSubscriptionsGauge = new Gauge({
  name: 'trial_subscriptions_total',
  help: 'Total number of trial subscriptions',
  labelNames: ['plan'],
  registers: [register],
});

// Revenue metrics
export const monthlyRecurringRevenueGauge = new Gauge({
  name: 'monthly_recurring_revenue_cents',
  help: 'Monthly recurring revenue in cents',
  labelNames: ['plan'],
  registers: [register],
});

export const annualRecurringRevenueGauge = new Gauge({
  name: 'annual_recurring_revenue_cents',
  help: 'Annual recurring revenue in cents',
  registers: [register],
});

// Payment metrics
export const paymentSucceededCounter = new Counter({
  name: 'payment_succeeded_total',
  help: 'Total number of successful payments',
  labelNames: ['plan'],
  registers: [register],
});

export const paymentFailedCounter = new Counter({
  name: 'payment_failed_total',
  help: 'Total number of failed payments',
  labelNames: ['plan'],
  registers: [register],
});

export const paymentAmountCounter = new Counter({
  name: 'payment_amount_cents_total',
  help: 'Total payment amount in cents',
  labelNames: ['plan', 'status'],
  registers: [register],
});

// Conversion metrics
export const trialConversionCounter = new Counter({
  name: 'trial_conversion_total',
  help: 'Total number of trial conversions to paid',
  labelNames: ['plan'],
  registers: [register],
});

export const planUpgradeCounter = new Counter({
  name: 'plan_upgrade_total',
  help: 'Total number of plan upgrades',
  labelNames: ['from_plan', 'to_plan'],
  registers: [register],
});

export const planDowngradeCounter = new Counter({
  name: 'plan_downgrade_total',
  help: 'Total number of plan downgrades',
  labelNames: ['from_plan', 'to_plan'],
  registers: [register],
});

// Usage metrics
export const usageLimitReachedCounter = new Counter({
  name: 'usage_limit_reached_total',
  help: 'Total number of times usage limits were reached',
  labelNames: ['workspace_id', 'limit_type', 'plan'],
  registers: [register],
});

export const usagePercentageGauge = new Gauge({
  name: 'usage_percentage',
  help: 'Usage as percentage of limit',
  labelNames: ['workspace_id', 'limit_type', 'plan'],
  registers: [register],
});

// Webhook metrics
export const webhookReceivedCounter = new Counter({
  name: 'stripe_webhook_received_total',
  help: 'Total number of Stripe webhooks received',
  labelNames: ['event_type'],
  registers: [register],
});

export const webhookProcessedCounter = new Counter({
  name: 'stripe_webhook_processed_total',
  help: 'Total number of Stripe webhooks processed successfully',
  labelNames: ['event_type'],
  registers: [register],
});

export const webhookFailedCounter = new Counter({
  name: 'stripe_webhook_failed_total',
  help: 'Total number of Stripe webhooks that failed processing',
  labelNames: ['event_type'],
  registers: [register],
});

export const webhookProcessingDuration = new Histogram({
  name: 'stripe_webhook_processing_duration_seconds',
  help: 'Duration of webhook processing',
  labelNames: ['event_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Churn metrics
export const churnCounter = new Counter({
  name: 'subscription_churn_total',
  help: 'Total number of churned subscriptions',
  labelNames: ['plan', 'reason'],
  registers: [register],
});

export const churnRateGauge = new Gauge({
  name: 'subscription_churn_rate',
  help: 'Subscription churn rate',
  labelNames: ['plan'],
  registers: [register],
});

/**
 * Helper functions to record metrics
 */

export function recordSubscriptionCreated(plan: string, billingCycle: string): void {
  subscriptionCreatedCounter.inc({ plan, billing_cycle: billingCycle });
}

export function recordSubscriptionCanceled(plan: string, immediately: boolean): void {
  subscriptionCanceledCounter.inc({ plan, immediately: immediately.toString() });
}

export function updateActiveSubscriptions(plan: string, count: number): void {
  activeSubscriptionsGauge.set({ plan }, count);
}

export function updateTrialSubscriptions(plan: string, count: number): void {
  trialSubscriptionsGauge.set({ plan }, count);
}

export function updateMonthlyRecurringRevenue(plan: string, amount: number): void {
  monthlyRecurringRevenueGauge.set({ plan }, amount);
}

export function updateAnnualRecurringRevenue(amount: number): void {
  annualRecurringRevenueGauge.set(amount);
}

export function recordPaymentSucceeded(plan: string, amount: number): void {
  paymentSucceededCounter.inc({ plan });
  paymentAmountCounter.inc({ plan, status: 'succeeded' }, amount);
}

export function recordPaymentFailed(plan: string, amount: number): void {
  paymentFailedCounter.inc({ plan });
  paymentAmountCounter.inc({ plan, status: 'failed' }, amount);
}

export function recordTrialConversion(plan: string): void {
  trialConversionCounter.inc({ plan });
}

export function recordPlanUpgrade(fromPlan: string, toPlan: string): void {
  planUpgradeCounter.inc({ from_plan: fromPlan, to_plan: toPlan });
}

export function recordPlanDowngrade(fromPlan: string, toPlan: string): void {
  planDowngradeCounter.inc({ from_plan: fromPlan, to_plan: toPlan });
}

export function recordUsageLimitReached(workspaceId: string, limitType: string, plan: string): void {
  usageLimitReachedCounter.inc({ workspace_id: workspaceId, limit_type: limitType, plan });
}

export function updateUsagePercentage(
  workspaceId: string,
  limitType: string,
  plan: string,
  percentage: number
): void {
  usagePercentageGauge.set({ workspace_id: workspaceId, limit_type: limitType, plan }, percentage);
}

export function recordWebhookReceived(eventType: string): void {
  webhookReceivedCounter.inc({ event_type: eventType });
}

export function recordWebhookProcessed(eventType: string, durationSeconds: number): void {
  webhookProcessedCounter.inc({ event_type: eventType });
  webhookProcessingDuration.observe({ event_type: eventType }, durationSeconds);
}

export function recordWebhookFailed(eventType: string): void {
  webhookFailedCounter.inc({ event_type: eventType });
}

export function recordChurn(plan: string, reason: string): void {
  churnCounter.inc({ plan, reason });
}

export function updateChurnRate(plan: string, rate: number): void {
  churnRateGauge.set({ plan }, rate);
}
