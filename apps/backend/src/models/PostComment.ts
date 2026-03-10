import { Schema, model, Document, Types } from 'mongoose';

export interface IPostComment extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  mentions: Types.ObjectId[];
  parentId?: Types.ObjectId;
  isResolved: boolean;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  editedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

export const PostComment = model<IPostComment>('PostComment', PostCommentSchema);