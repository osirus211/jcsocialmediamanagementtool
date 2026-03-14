import { Schema, model, Document, Types } from 'mongoose';

export enum TaskType {
  POST_CREATION = 'post_creation',
  POST_REVIEW = 'post_review',
  POST_APPROVAL = 'post_approval',
  CONTENT_RESEARCH = 'content_research',
  ACCOUNT_MANAGEMENT = 'account_management',
  CUSTOM = 'custom',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface IChecklistItem {
  _id: Types.ObjectId;
  text: string;
  completed: boolean;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
}

export interface ITaskComment {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface IAttachment {
  url: string;
  name: string;
  type: 'image' | 'document' | 'video' | 'other';
  size?: number;
}

export interface ITask extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: Types.ObjectId[];
  assignedBy: Types.ObjectId;
  relatedPostId?: Types.ObjectId;
  relatedAccountId?: Types.ObjectId;
  dueDate?: Date;
  completedAt?: Date;
  labels: string[];
  attachments: IAttachment[];
  checklist: IChecklistItem[];
  comments: ITaskComment[];
  watchers: Types.ObjectId[];
  estimatedMinutes?: number;
  actualMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistItemSchema = new Schema<IChecklistItem>({
  text: {
    type: String,
    required: true,
    maxlength: 500,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

const TaskCommentSchema = new Schema<ITaskComment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

const AttachmentSchema = new Schema<IAttachment>({
  url: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['image', 'document', 'video', 'other'],
    required: true,
  },
  size: {
    type: Number,
  },
});

const TaskSchema = new Schema<ITask>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: Object.values(TaskType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.TODO,
    },
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },
    assignedTo: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    relatedPostId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    relatedAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SocialAccount',
    },
    dueDate: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    labels: [{
      type: String,
      maxlength: 50,
    }],
    attachments: [AttachmentSchema],
    checklist: [ChecklistItemSchema],
    comments: [TaskCommentSchema],
    watchers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    estimatedMinutes: {
      type: Number,
      min: 0,
    },
    actualMinutes: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
TaskSchema.index({ workspaceId: 1, status: 1 });
TaskSchema.index({ workspaceId: 1, assignedTo: 1 });
TaskSchema.index({ workspaceId: 1, dueDate: 1 });
TaskSchema.index({ workspaceId: 1, priority: 1 });
TaskSchema.index({ workspaceId: 1, type: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ dueDate: 1, status: 1 }); // For overdue tasks

export const Task = model<ITask>('Task', TaskSchema);