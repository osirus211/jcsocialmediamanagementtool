/**
 * Draft Version Model
 * 
 * Stores version history for draft posts with content snapshots
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IDraftVersion extends Document {
  _id: mongoose.Types.ObjectId;
  draftId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  version: number;
  content: string;
  platformContent?: Array<{
    platform: string;
    text?: string;
    mediaIds?: string[];
    enabled: boolean;
  }>;
  changedBy: mongoose.Types.ObjectId;
  changedByName: string;
  changedAt: Date;
  changeDescription: string;
  changeType: 'manual' | 'auto' | 'approval' | 'restore';
  contentDiff?: {
    added: string[];
    removed: string[];
    modified: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }>;
  };
  metadata?: {
    characterCount?: number;
    wordCount?: number;
    hashtags?: string[];
    mentions?: string[];
    mediaCount?: number;
  };
}

const DraftVersionSchema = new Schema<IDraftVersion>({
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
  version: {
    type: Number,
    required: true,
    min: 1
  },
  content: {
    type: String,
    required: true
  },
  platformContent: [{
    platform: {
      type: String,
      required: true
    },
    text: String,
    mediaIds: [String],
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  changedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedByName: {
    type: String,
    required: true
  },
  changedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  changeDescription: {
    type: String,
    required: true,
    maxlength: 500
  },
  changeType: {
    type: String,
    enum: ['manual', 'auto', 'approval', 'restore'],
    default: 'manual'
  },
  contentDiff: {
    added: [String],
    removed: [String],
    modified: [{
      field: String,
      oldValue: String,
      newValue: String
    }]
  },
  metadata: {
    characterCount: Number,
    wordCount: Number,
    hashtags: [String],
    mentions: [String],
    mediaCount: Number
  }
}, {
  timestamps: false, // We use changedAt instead
  toJSON: {
    transform: (doc, ret) => {
      return {
        ...ret,
        _id: ret._id.toString(),
        draftId: ret.draftId.toString(),
        workspaceId: ret.workspaceId.toString(),
        changedBy: ret.changedBy.toString()
      };
    }
  }
});

// Compound indexes for performance
DraftVersionSchema.index({ draftId: 1, version: -1 });
DraftVersionSchema.index({ draftId: 1, changedAt: -1 });
DraftVersionSchema.index({ workspaceId: 1, changedAt: -1 });

// Ensure unique version per draft
DraftVersionSchema.index({ draftId: 1, version: 1 }, { unique: true });

export const DraftVersion = mongoose.model<IDraftVersion>('DraftVersion', DraftVersionSchema);