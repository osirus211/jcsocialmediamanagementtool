/**
 * Draft Share Model
 * 
 * Manages shareable links for draft posts with permissions and expiry
 */

import mongoose, { Document, Schema } from 'mongoose';
import { nanoid } from 'nanoid';

export interface IDraftShare extends Document {
  _id: mongoose.Types.ObjectId;
  draftId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  shareToken: string; // Unique token for the share link
  permissions: {
    canView: boolean;
    canComment: boolean;
    canEdit: boolean;
  };
  expiresAt?: Date;
  password?: string; // Hashed password for protected shares
  isActive: boolean;
  accessCount: number; // Track how many times the link was accessed
  lastAccessedAt?: Date;
  lastAccessedBy?: string; // IP address or user agent
  createdAt: Date;
  updatedAt: Date;
}

const DraftShareSchema = new Schema<IDraftShare>({
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
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shareToken: {
    type: String,
    required: true,
    unique: true,
    default: () => nanoid(32) // Generate a 32-character token
  },
  permissions: {
    canView: {
      type: Boolean,
      default: true
    },
    canComment: {
      type: Boolean,
      default: false
    },
    canEdit: {
      type: Boolean,
      default: false
    }
  },
  expiresAt: {
    type: Date,
    index: true
  },
  password: {
    type: String // Hashed password
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  accessCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: {
    type: Date
  },
  lastAccessedBy: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      // Don't expose password hash
      const { password, ...safeRet } = ret;
      return {
        ...safeRet,
        _id: safeRet._id.toString(),
        draftId: safeRet.draftId.toString(),
        workspaceId: safeRet.workspaceId.toString(),
        createdBy: safeRet.createdBy.toString()
      };
    }
  }
});

// Indexes for performance
DraftShareSchema.index({ shareToken: 1 }, { unique: true });
DraftShareSchema.index({ draftId: 1, isActive: 1 });
DraftShareSchema.index({ workspaceId: 1, createdAt: -1 });
DraftShareSchema.index({ expiresAt: 1 }, { sparse: true });

// Method to check if share is valid
DraftShareSchema.methods.isValid = function(): boolean {
  if (!this.isActive) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

// Method to generate share URL
DraftShareSchema.methods.getShareUrl = function(baseUrl: string): string {
  return `${baseUrl}/shared/draft/${this.shareToken}`;
};

export const DraftShare = mongoose.model<IDraftShare>('DraftShare', DraftShareSchema);