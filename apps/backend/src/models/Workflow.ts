import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Workflow Trigger Types
 */
export enum WorkflowTriggerType {
  POST_PUBLISHED = 'post_published',
  ANALYTICS_THRESHOLD = 'analytics_threshold',
  SCHEDULE = 'schedule',
  MENTION_DETECTED = 'mention_detected',
  RSS_ITEM_FETCHED = 'rss_item_fetched',
}

/**
 * Workflow Action Types
 */
export enum WorkflowActionType {
  CREATE_POST = 'create_post',
  SCHEDULE_POST = 'schedule_post',
  SEND_NOTIFICATION = 'send_notification',
  UPDATE_POST_STATUS = 'update_post_status',
}

/**
 * Workflow Trigger Interface
 */
export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: Record<string, any>; // Type-specific configuration
}

/**
 * Workflow Action Interface
 */
export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, any>; // Type-specific configuration
}

/**
 * Workflow Document Interface
 */
export interface IWorkflow extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
}

/**
 * Workflow Schema
 */
const WorkflowSchema = new Schema<IWorkflow>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    trigger: {
      type: {
        type: String,
        enum: Object.values(WorkflowTriggerType),
        required: true,
      },
      config: {
        type: Schema.Types.Mixed,
        required: true,
      },
    },
    actions: [
      {
        type: {
          type: String,
          enum: Object.values(WorkflowActionType),
          required: true,
        },
        config: {
          type: Schema.Types.Mixed,
          required: true,
        },
      },
    ],
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
// Query enabled workflows by workspace
WorkflowSchema.index({ workspaceId: 1, enabled: 1 });

// Query workflows by trigger type
WorkflowSchema.index({ workspaceId: 1, 'trigger.type': 1, enabled: 1 });

// Pagination
WorkflowSchema.index({ createdAt: 1 });

/**
 * Validation
 */
WorkflowSchema.pre('validate', function (next) {
  // Validate exactly one trigger (enforced by schema)
  if (!this.trigger) {
    return next(new Error('Workflow must have exactly one trigger'));
  }

  // Validate at least one action
  if (!this.actions || this.actions.length === 0) {
    return next(new Error('Workflow must have at least one action'));
  }

  next();
});

/**
 * Workflow Model
 */
export const Workflow: Model<IWorkflow> = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
