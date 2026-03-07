/**
 * Plan Model
 * 
 * Defines subscription plans with pricing and limits
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum PlanName {
  FREE = 'free',
  PRO = 'pro',
  AGENCY = 'agency',
}

export interface IPlan extends Document {
  _id: mongoose.Types.ObjectId;
  name: PlanName;
  displayName: string;
  description: string;
  
  // Pricing
  priceMonthly: number; // in cents
  priceYearly: number; // in cents
  
  // Limits
  maxChannels: number;
  maxPostsPerMonth: number;
  maxTeamMembers: number;
  maxMediaStorage: number; // in MB
  
  // Features
  features: string[];
  
  // Stripe
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  
  // Status
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: {
      type: String,
      enum: Object.values(PlanName),
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    
    // Pricing
    priceMonthly: {
      type: Number,
      required: true,
      default: 0,
    },
    priceYearly: {
      type: Number,
      required: true,
      default: 0,
    },
    
    // Limits
    maxChannels: {
      type: Number,
      required: true,
      default: 3,
    },
    maxPostsPerMonth: {
      type: Number,
      required: true,
      default: 100,
    },
    maxTeamMembers: {
      type: Number,
      required: true,
      default: 1,
    },
    maxMediaStorage: {
      type: Number,
      required: true,
      default: 1024, // 1GB
    },
    
    // Features
    features: {
      type: [String],
      default: [],
    },
    
    // Stripe
    stripePriceIdMonthly: {
      type: String,
    },
    stripePriceIdYearly: {
      type: String,
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PlanSchema.index({ name: 1, isActive: 1 });

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);

// Default plans configuration
export const DEFAULT_PLANS = [
  {
    name: PlanName.FREE,
    displayName: 'Free',
    description: 'Perfect for individuals getting started',
    priceMonthly: 0,
    priceYearly: 0,
    maxChannels: 3,
    maxPostsPerMonth: 100,
    maxTeamMembers: 1,
    maxMediaStorage: 1024, // 1GB
    features: [
      'Up to 3 social channels',
      '100 posts per month',
      'Basic analytics',
      'Post scheduling',
    ],
    isActive: true,
  },
  {
    name: PlanName.PRO,
    displayName: 'Pro',
    description: 'For professionals and small teams',
    priceMonthly: 2900, // $29.00
    priceYearly: 29000, // $290.00 (save ~17%)
    maxChannels: 10,
    maxPostsPerMonth: 500,
    maxTeamMembers: 5,
    maxMediaStorage: 10240, // 10GB
    features: [
      'Up to 10 social channels',
      '500 posts per month',
      'Advanced analytics',
      'Team collaboration',
      'Approval workflow',
      'Priority support',
    ],
    isActive: true,
  },
  {
    name: PlanName.AGENCY,
    displayName: 'Agency',
    description: 'For agencies managing multiple clients',
    priceMonthly: 9900, // $99.00
    priceYearly: 99000, // $990.00 (save ~17%)
    maxChannels: 50,
    maxPostsPerMonth: 2000,
    maxTeamMembers: 25,
    maxMediaStorage: 51200, // 50GB
    features: [
      'Up to 50 social channels',
      '2000 posts per month',
      'Advanced analytics',
      'Unlimited team members',
      'Approval workflow',
      'API access',
      'White-label options',
      'Dedicated support',
    ],
    isActive: true,
  },
];
