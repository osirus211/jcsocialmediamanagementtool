import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Content Modification Interface
 */
export interface ContentModification {
  prefix?: string;
  suffix?: string;
  hashtagReplacement?: Record<string, string>;
}

/**
 * Recycling Schedule Interface
 */
export interface RecyclingSchedule {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // days for custom, 1 for daily, 7 for weekly, 30 for monthly
  daysOfWeek?: number[]; // 0-6 for weekly (0=Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  timeOfDay?: string; // HH:MM format
}

/**
 * Recycling History Entry Interface
 */
export interface RecyclingHistoryEntry {
  repostedAt: Date;
  repostId: string;
  performance?: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
    clicks?: number;
    engagement?: number;
  };
}

/**
 * EvergreenRule Document Interface
 */
export interface IEvergreenRule extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  postId: mongoose.Types.ObjectId;
  repostInterval: number; // days (1-365)
  maxReposts: number; // 1-100 or -1 for unlimited
  repostCount: number;
  lastRepostedAt?: Date;
  enabled: boolean;
  paused: boolean; // pause/resume functionality
  recyclingSchedule: RecyclingSchedule;
  minDaysBetweenRecycles: number; // never recycle same post twice in X days
  autoStopAfterPosts?: number; // auto-stop recycling after X posts
  contentModification?: ContentModification;
  recyclingHistory: RecyclingHistoryEntry[]; // recycling history log
  totalPerformance: {
    totalViews: number;
    totalLikes: number;
    totalShares: number;
    totalComments: number;
    totalClicks: number;
    averageEngagement: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
}

/**
 * EvergreenRule Schema
 */
const EvergreenRuleSchema = new Schema<IEvergreenRule>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    repostInterval: {
      type: Number,
      required: true,
      min: 1, // 1 day minimum
      max: 365, // 365 days maximum
    },
    maxReposts: {
      type: Number,
      required: true,
      validate: {
        validator: function (value: number) {
          return value === -1 || (value >= 1 && value <= 100);
        },
        message: 'maxReposts must be -1 (unlimited) or between 1 and 100',
      },
    },
    repostCount: {
      type: Number,
      required: true,
      default: 0,
    },
    lastRepostedAt: {
      type: Date,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    paused: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    recyclingSchedule: {
      type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'custom'],
        required: true,
        default: 'custom',
      },
      interval: {
        type: Number,
        required: true,
        min: 1,
        max: 365,
      },
      daysOfWeek: [{
        type: Number,
        min: 0,
        max: 6,
      }],
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
      },
      timeOfDay: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        default: '09:00',
      },
    },
    minDaysBetweenRecycles: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
      max: 365,
    },
    autoStopAfterPosts: {
      type: Number,
      min: 1,
      max: 1000,
    },
    contentModification: {
      prefix: {
        type: String,
        trim: true,
      },
      suffix: {
        type: String,
        trim: true,
      },
      hashtagReplacement: {
        type: Map,
        of: String,
      },
    },
    recyclingHistory: [{
      repostedAt: {
        type: Date,
        required: true,
      },
      repostId: {
        type: String,
        required: true,
      },
      performance: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        engagement: { type: Number, default: 0 },
      },
    }],
    totalPerformance: {
      totalViews: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      totalShares: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalClicks: { type: Number, default: 0 },
      averageEngagement: { type: Number, default: 0 },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Query enabled rules by workspace
EvergreenRuleSchema.index({ workspaceId: 1, enabled: 1 });

// Query active (enabled and not paused) rules
EvergreenRuleSchema.index({ workspaceId: 1, enabled: 1, paused: 1 });

// One rule per post per workspace
EvergreenRuleSchema.index({ workspaceId: 1, postId: 1 }, { unique: true });

// Evaluation scheduler - find rules that need evaluation
EvergreenRuleSchema.index({ enabled: 1, paused: 1, lastRepostedAt: 1 });

// Performance tracking queries
EvergreenRuleSchema.index({ workspaceId: 1, 'totalPerformance.averageEngagement': -1 });

/**
 * Validation
 */
EvergreenRuleSchema.pre('validate', function (next) {
  // Validate repost interval range
  if (this.repostInterval < 1 || this.repostInterval > 365) {
    return next(new Error('Repost interval must be between 1 and 365 days'));
  }

  // Validate maxReposts range
  if (this.maxReposts !== -1 && (this.maxReposts < 1 || this.maxReposts > 100)) {
    return next(new Error('maxReposts must be -1 (unlimited) or between 1 and 100'));
  }

  // Validate minDaysBetweenRecycles
  if (this.minDaysBetweenRecycles < 1 || this.minDaysBetweenRecycles > 365) {
    return next(new Error('minDaysBetweenRecycles must be between 1 and 365 days'));
  }

  // Validate recycling schedule based on type
  if (this.recyclingSchedule) {
    const schedule = this.recyclingSchedule;
    
    switch (schedule.type) {
      case 'daily':
        if (schedule.interval !== 1) {
          return next(new Error('Daily schedule must have interval of 1'));
        }
        break;
      case 'weekly':
        if (schedule.interval !== 7) {
          return next(new Error('Weekly schedule must have interval of 7'));
        }
        if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
          return next(new Error('Weekly schedule must specify daysOfWeek'));
        }
        break;
      case 'monthly':
        if (schedule.interval !== 30) {
          return next(new Error('Monthly schedule must have interval of 30'));
        }
        if (!schedule.dayOfMonth) {
          return next(new Error('Monthly schedule must specify dayOfMonth'));
        }
        break;
      case 'custom':
        if (schedule.interval < 1 || schedule.interval > 365) {
          return next(new Error('Custom schedule interval must be between 1 and 365 days'));
        }
        break;
    }
  }

  // Validate autoStopAfterPosts
  if (this.autoStopAfterPosts !== undefined && (this.autoStopAfterPosts < 1 || this.autoStopAfterPosts > 1000)) {
    return next(new Error('autoStopAfterPosts must be between 1 and 1000'));
  }

  next();
});

/**
 * EvergreenRule Model
 */
export const EvergreenRule: Model<IEvergreenRule> = mongoose.model<IEvergreenRule>('EvergreenRule', EvergreenRuleSchema);
