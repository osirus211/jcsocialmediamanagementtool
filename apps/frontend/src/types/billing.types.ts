/**
 * Billing Types
 * Types for subscription plans, billing, and usage
 */

export interface PlanLimits {
  maxSocialAccounts: number;
  maxPostsPerMonth: number;
  maxTeamMembers: number;
  aiCreditsPerMonth: number;
}

export interface Plan {
  _id: string;
  name: 'free' | 'pro' | 'team' | 'enterprise';
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  features: string[];
  isActive: boolean;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

export interface Subscription {
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
}

export interface Usage {
  socialAccounts: number;
  teamMembers: number;
  postsThisMonth: number;
  aiCreditsUsed: number;
}

export interface UsageWithLimits {
  usage: Usage;
  limits: PlanLimits;
}

export type BillingPeriod = 'monthly' | 'yearly';

export interface CheckoutRequest {
  planName: string;
  billingPeriod: BillingPeriod;
}

export interface ChangePlanRequest {
  planName: string;
  billingPeriod: BillingPeriod;
}
