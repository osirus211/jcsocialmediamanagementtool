import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Workflow Run Status
 */
export enum WorkflowRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Action Result Status
 */
export enum ActionResultStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Action Result Interface
 */
export interface ActionResult {
  actionType: string;
  status: ActionResultStatus;
  result?: any;
  error?: string;
  executedAt: Date;
}

/**
 * WorkflowRun Document Interface
 */
export interface IWorkflowRun extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  workflowId: mongoose.Types.ObjectId;
  triggerType: string;
  triggerData: Record<string, any>;
  status: WorkflowRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  actionResults: ActionResult[];
  error?: string;
  createdAt: Date;
}

/**
 * WorkflowRun Schema
 */
const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    triggerType: {
      type: String,
      required: true,
    },
    triggerData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WorkflowRunStatus),
      required: true,
      default: WorkflowRunStatus.PENDING,
      index: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    actionResults: [
      {
        actionType: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: Object.values(ActionResultStatus),
          required: true,
        },
        result: {
          type: Schema.Types.Mixed,
        },
        error: {
          type: String,
        },
        executedAt: {
          type: Date,
          required: true,
        },
      },
    ],
    error: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

/**
 * Indexes
 */
// Query execution history by workspace and workflow
WorkflowRunSchema.index({ workspaceId: 1, workflowId: 1, createdAt: -1 });

// Query by status
WorkflowRunSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

// Pagination
WorkflowRunSchema.index({ createdAt: 1 });

// TTL index - automatically delete workflow runs older than 90 days
WorkflowRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/**
 * WorkflowRun Model
 */
export const WorkflowRun: Model<IWorkflowRun> = mongoose.model<IWorkflowRun>('WorkflowRun', WorkflowRunSchema);
