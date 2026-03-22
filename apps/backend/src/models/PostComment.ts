import { Schema, model, Document, Types } from 'mongoose';

export interface IReaction {
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface IPostComment extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  authorId: Types.ObjectId;
  authorName: string;
  authorAvatar?: string;
  content: string;
  mentions: Types.ObjectId[];
  parentId?: Types.ObjectId;
  isResolved: boolean;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  editedAt?: Date;
  readAt?: Date;
  reactions: IReaction[];
  attachments: Array<{
    url: string;
    type: 'image' | 'file';
    name?: string;
    size?: number;
  }>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema<IReaction>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  emoji: {
    type: String,
    required: true,
    enum: ['👍', '❤️', '😂', '😮', '😢', '😡'],
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

const PostCommentSchema = new Schema<IPostComment>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorAvatar: {
      type: String,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    mentions: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'PostComment',
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    editedAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    reactions: [ReactionSchema],
    attachments: [{
      url: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ['image', 'file'],
        required: true,
      },
      name: String,
      size: Number,
    }],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
PostCommentSchema.index({ postId: 1, createdAt: -1 });
PostCommentSchema.index({ workspaceId: 1, createdAt: -1 });
PostCommentSchema.index({ workspaceId: 1, authorId: 1, createdAt: -1 }); // For user activity
PostCommentSchema.index({ postId: 1, isResolved: 1 }); // For unresolved comment filtering

export const PostComment = model<IPostComment>('PostComment', PostCommentSchema);