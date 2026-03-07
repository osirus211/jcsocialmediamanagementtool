/**
 * Subscription Model
 * 
 * Manages workspace subscriptions and billing
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  TRIAL = 'trial',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  UNPAID = 'unpaid',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  
  // Status
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  
  // Dates
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  renewalDate: Date;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd: boolean;
  
  // Stripe
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePaymentMethodId?: string;
  
  // Pricing
  amount: number; // in cents
  currency: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true,
    },
    
    // Status
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      required: true,
      default: SubscriptionStatus.ACTIVE,
      index: true,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BillingCycle),
      required: true,
      default: BillingCycle.MONTHLY,
    },
    
    // Dates
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    renewalDate: {
      type: Date,
      required: true,
      index: true,
    },
    trialStart: {
      type: Date,
    },
    trialEnd: {
      type: Date,
    },
    canceledAt: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    
    // Stripe
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripePaymentMethodId: {
      type: String,
    },
    
    // Pricing
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
SubscriptionSchema.index({ workspaceId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, renewalDate: 1 });
SubscriptionSchema.index({ stripeCustomerId: 1, status: 1 });

// Check if subscription is active
SubscriptionSchema.methods.isActive = function (): boolean {
  return this.status === SubscriptionStatus.ACTIVE || this.status === SubscriptionStatus.TRIAL;
};

// Check if subscription is in trial
SubscriptionSchema.methods.isInTrial = function (): boolean {
  if (this.status !== SubscriptionStatus.TRIAL) {
    return false;
  }
  if (!this.trialEnd) {
    return false;
  }
  return new Date() < this.trialEnd;
};

// Get days until renewal
SubscriptionSchema.methods.getDaysUntilRenewal = function (): number {
  const now = new Date();
  const renewal = new Date(this.renewalDate);
  const diff = renewal.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
