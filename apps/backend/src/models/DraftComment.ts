/**
 * Draft Comment Model
 * 
 * Comments specifically for draft posts with threading and positioning
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IDraftComment extends Document {
  _id: mongoose.Types.ObjectId;
  draftId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorAvatar?: string;
  content: string;
  mentions: string[]; // Array of user IDs mentioned in the comment
  parentId?: mongoose.Types.ObjectId; // For threaded replies
  isResolved: boolean;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  position?: {
    field: string; // 'content', 'caption', etc.
    selectionStart: number;
    selectionEnd: number;
    selectedText?: string; // The text that was selected when comment was made
  };
  editedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DraftCommentSchema = new Schema<IDraftComment>({
  draftId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorAvatar: {
    type: String
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  mentions: [{
    type: String // User IDs as strings
  }],
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'DraftComment',
    index: true
  },
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  position: {
    field: {
      type: String,
      required: true
    },
    selectionStart: {
      type: Number,
      required: true
    },
    selectionEnd: {
      type: Number,
      required: true
    },
    selectedText: {
      type: String,
      maxlength: 500
    }
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      return {
        ...ret,
        _id: ret._id.toString(),
        draftId: ret.draftId.toString(),
        workspaceId: ret.workspaceId.toString(),
        authorId: ret.authorId.toString(),
        parentId: ret.parentId ? ret.parentId.toString() : undefined,
        resolvedBy: ret.resolvedBy ? ret.resolvedBy.toString() : undefined
      };
    }
  }
});

// Indexes for performance
DraftCommentSchema.index({ draftId: 1, createdAt: -1 });
DraftCommentSchema.index({ draftId: 1, parentId: 1 });
DraftCommentSchema.index({ draftId: 1, isResolved: 1 });
DraftCommentSchema.index({ workspaceId: 1, createdAt: -1 });
DraftCommentSchema.index({ authorId: 1, createdAt: -1 });

// Virtual for replies
DraftCommentSchema.virtual('replies', {
  ref: 'DraftComment',
  localField: '_id',
  foreignField: 'parentId',
  match: { isDeleted: false }
});

// Ensure virtuals are included in JSON
DraftCommentSchema.set('toJSON', { virtuals: true });

export const DraftComment = mongoose.model<IDraftComment>('DraftComment', DraftCommentSchema);