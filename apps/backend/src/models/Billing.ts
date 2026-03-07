import mongoose, { Schema, Document } from 'mongoose';

/**
 * Billing Model
 * 
 * Stores subscription and billing information per workspace
 * Synced with Stripe via webhooks
 */

export enum BillingPlan {
  FREE = 'free',
  PRO = 'pro',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
}

export enum BillingStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
}

export interface IBilling extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  plan: BillingPlan;
  status: BillingStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  
  // Usage snapshot (reset monthly)
  usageSnapshot: {
    postsUsed: number;
    accountsUsed: number;
    aiUsed: number;
    resetAt: Date;
  };
  
  // Metadata
  trialEndsAt?: Date;
  metadata: {
    [key: string]: any;
  };
  
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isActive(): boolean;
  canPost(): boolean;
  resetUsage(): void;
}

const BillingSchema = new Schema<IBilling>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
    },
    plan: {
      type: String,
      enum: Object.values(BillingPlan),
      default: BillingPlan.FREE,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BillingStatus),
      default: BillingStatus.ACTIVE,
      required: true,
      index: true,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    usageSnapshot: {
      postsUsed: {
        type: Number,
        default: 0,
      },
      accountsUsed: {
        type: Number,
        default: 0,
      },
      aiUsed: {
        type: Number,
        default: 0,
      },
      resetAt: {
        type: Date,
        default: () => new Date(),
      },
    },
    trialEndsAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BillingSchema.index({ workspaceId: 1, status: 1 });
BillingSchema.index({ stripeCustomerId: 1 });
BillingSchema.index({ stripeSubscriptionId: 1 });

/**
 * Check if billing is active
 */
BillingSchema.methods.isActive = function (): boolean {
  return this.status === BillingStatus.ACTIVE || this.status === BillingStatus.TRIALING;
};

/**
 * Check if workspace can post (active subscription or within limits)
 */
BillingSchema.methods.canPost = function (): boolean {
  // Active paid plans can always post
  if (this.isActive() && this.plan !== BillingPlan.FREE) {
    return true;
  }

  // Free plan has limits (checked elsewhere)
  if (this.plan === BillingPlan.FREE && this.isActive()) {
    return true;
  }

  // Past due or canceled cannot post
  return false;
};

/**
 * Reset monthly usage
 */
BillingSchema.methods.resetUsage = function (): void {
  this.usageSnapshot = {
    postsUsed: 0,
    accountsUsed: 0,
    aiUsed: 0,
    resetAt: new Date(),
  };
};

export const Billing = mongoose.model<IBilling>('Billing', BillingSchema);
