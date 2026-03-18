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
  slug: string;
  description?: string;
  ownerId: mongoose.Types.ObjectId;
  plan: WorkspacePlan;
  
  // Settings
  settings: {
    requireApproval: boolean;
    allowedDomains?: string[];
    timezone: string;
    language: string;
    industry?: string;
  };
  
  // IP Allowlisting (Enterprise feature)
  ipAllowlist: string[];
  ipAllowlistEnabled: boolean;
  
  // Queue Pause Settings (beats Buffer & Hootsuite)
  queuePause: {
    // Global workspace pause
    isPaused: boolean;
    pausedAt?: Date;
    pausedBy?: mongoose.Types.ObjectId;
    resumeAt?: Date; // Auto-resume time
    reason?: string; // Why paused (crisis, maintenance, etc.)
    
    // Per-account pause (superior to competitors)
    accountPauses: Array<{
      socialAccountId: mongoose.Types.ObjectId;
      isPaused: boolean;
      pausedAt: Date;
      pausedBy: mongoose.Types.ObjectId;
      resumeAt?: Date;
      reason?: string;
    }>;
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
  
  // Design Integrations
  integrations: {
    canva: {
      connected: boolean;
      accessToken?: string;
      refreshToken?: string;
      userId?: string;
      displayName?: string;
      connectedAt?: Date;
    };
    figma: {
      connected: boolean;
      accessToken?: string;
      refreshToken?: string;
      userId?: string;
      displayName?: string;
      connectedAt?: Date;
    };
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
  deletedAt?: Date;
  
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
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
      match: /^[a-z0-9-]+$/,
      index: true,
    },
    description: {
      type: String,
      maxlength: 500,
      trim: true,
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
      industry: {
        type: String,
        enum: ['marketing-agency', 'e-commerce', 'saas', 'media', 'non-profit', 'education', 'healthcare', 'real-estate', 'other'],
      },
    },
    
    // Queue Pause Settings
    queuePause: {
      isPaused: {
        type: Boolean,
        default: false,
        index: true,
      },
      pausedAt: {
        type: Date,
      },
      pausedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      resumeAt: {
        type: Date,
        index: true, // For auto-resume queries
      },
      reason: {
        type: String,
        maxlength: 200,
      },
      accountPauses: [{
        socialAccountId: {
          type: Schema.Types.ObjectId,
          ref: 'SocialAccount',
          required: true,
        },
        isPaused: {
          type: Boolean,
          default: false,
        },
        pausedAt: {
          type: Date,
          required: true,
        },
        pausedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        resumeAt: {
          type: Date,
        },
        reason: {
          type: String,
          maxlength: 200,
        },
      }],
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
    
    // Design Integrations
    integrations: {
      canva: {
        connected: {
          type: Boolean,
          default: false,
        },
        accessToken: {
          type: String,
        },
        refreshToken: {
          type: String,
        },
        userId: {
          type: String,
        },
        displayName: {
          type: String,
        },
        connectedAt: {
          type: Date,
        },
      },
      figma: {
        connected: {
          type: Boolean,
          default: false,
        },
        accessToken: {
          type: String,
        },
        refreshToken: {
          type: String,
        },
        userId: {
          type: String,
        },
        displayName: {
          type: String,
        },
        connectedAt: {
          type: Date,
        },
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
    
    // IP Allowlisting (Enterprise feature)
    ipAllowlist: {
      type: [String],
      default: [],
      validate: {
        validator: function(ips: string[]) {
          // Validate each IP is valid IPv4 or IPv6
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ips.every(ip => ipv4Regex.test(ip) || ipv6Regex.test(ip));
        },
        message: 'Invalid IP address format'
      }
    },
    ipAllowlistEnabled: {
      type: Boolean,
      default: false,
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
WorkspaceSchema.index({ ownerId: 1, isActive: 1, deletedAt: 1 });
WorkspaceSchema.index({ plan: 1, isActive: 1, deletedAt: 1 });
WorkspaceSchema.index({ slug: 1, deletedAt: 1 }, { unique: true });

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
