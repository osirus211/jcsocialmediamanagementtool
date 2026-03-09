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
  contentModification?: ContentModification;
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

// One rule per post per workspace
EvergreenRuleSchema.index({ workspaceId: 1, postId: 1 }, { unique: true });

// Evaluation scheduler - find rules that need evaluation
EvergreenRuleSchema.index({ enabled: 1, lastRepostedAt: 1 });

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

  next();
});

/**
 * EvergreenRule Model
 */
export const EvergreenRule: Model<IEvergreenRule> = mongoose.model<IEvergreenRule>('EvergreenRule', EvergreenRuleSchema);
