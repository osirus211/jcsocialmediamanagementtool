/**
 * Workspace Model
 * 
 * Represents a workspace for team collaboration
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum WorkspacePlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export interface IWorkspace extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  ownerId: mongoose.Types.ObjectId;
  plan: WorkspacePlan;
  
  // Settings
  settings: {
    requireApproval: boolean;
    allowedDomains?: string[];
    timezone: string;
    language: string;
  };
  
  // Client Portal (white-label)
  clientPortal: {
    enabled: boolean;
    brandName?: string;
    logoUrl?: string;
    primaryColor?: string;
    customDomain?: string;
    welcomeMessage?: string;
    requirePassword: boolean;
    portalPassword?: string;
  };
  
  // Limits based on plan
  limits: {
    maxMembers: number;
    maxPosts: number;
    maxSocialAccounts: number;
  };
  
  // Usage tracking
  usage: {
    currentMembers: number;
    currentPosts: number;
    currentSocialAccounts: number;
  };
  
  // Billing
  billingEmail?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  
  // Status
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: Object.values(WorkspacePlan),
      default: WorkspacePlan.FREE,
      index: true,
    },
    
    // Settings
    settings: {
      requireApproval: {
        type: Boolean,
        default: false,
      },
      allowedDomains: {
        type: [String],
        default: [],
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      language: {
        type: String,
        default: 'en',
      },
    },
    
    // Client Portal
    clientPortal: {
      enabled: {
        type: Boolean,
        default: false,
      },
      brandName: {
        type: String,
        maxlength: 100,
      },
      logoUrl: {
        type: String,
        maxlength: 500,
      },
      primaryColor: {
        type: String,
        default: '#6366f1',
        match: /^#[0-9A-Fa-f]{6}$/,
      },
      customDomain: {
        type: String,
        maxlength: 100,
      },
      welcomeMessage: {
        type: String,
        maxlength: 500,
      },
      requirePassword: {
        type: Boolean,
        default: false,
      },
      portalPassword: {
        type: String,
      },
    },
    
    // Limits
    limits: {
      maxMembers: {
        type: Number,
        default: 5,
      },
      maxPosts: {
        type: Number,
        default: 100,
      },
      maxSocialAccounts: {
        type: Number,
        default: 3,
      },
    },
    
    // Usage
    usage: {
      currentMembers: {
        type: Number,
        default: 1,
      },
      currentPosts: {
        type: Number,
        default: 0,
      },
      currentSocialAccounts: {
        type: Number,
        default: 0,
      },
    },
    
    // Billing
    billingEmail: {
      type: String,
    },
    subscriptionId: {
      type: String,
    },
    subscriptionStatus: {
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
WorkspaceSchema.index({ ownerId: 1, isActive: 1 });
WorkspaceSchema.index({ plan: 1, isActive: 1 });

// Update plan limits when plan changes
WorkspaceSchema.pre('save', function (next) {
  if (this.isModified('plan')) {
    switch (this.plan) {
      case WorkspacePlan.FREE:
        this.limits.maxMembers = 5;
        this.limits.maxPosts = 100;
        this.limits.maxSocialAccounts = 3;
        break;
      case WorkspacePlan.STARTER:
        this.limits.maxMembers = 10;
        this.limits.maxPosts = 500;
        this.limits.maxSocialAccounts = 10;
        break;
      case WorkspacePlan.PROFESSIONAL:
        this.limits.maxMembers = 25;
        this.limits.maxPosts = 2000;
        this.limits.maxSocialAccounts = 25;
        break;
      case WorkspacePlan.ENTERPRISE:
        this.limits.maxMembers = 100;
        this.limits.maxPosts = 10000;
        this.limits.maxSocialAccounts = 100;
        break;
    }
  }
  next();
});

export const Workspace = mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
