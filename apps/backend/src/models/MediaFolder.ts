/**
 * MediaFolder Model
 * 
 * Organizes media assets into folders with hierarchy support
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IMediaFolder extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  parentFolderId?: mongoose.Types.ObjectId;
  color?: string; // Hex color code for folder customization
  icon?: string; // Icon name/identifier for folder
  mediaCount?: number; // Virtual field - calculated dynamically
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MediaFolderSchema = new Schema<IMediaFolder>(
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
    parentFolderId: {
      type: Schema.Types.ObjectId,
      ref: 'MediaFolder',
      default: null,
      index: true,
    },
    color: {
      type: String,
      default: '#3B82F6', // Default blue color
      match: /^#[0-9A-F]{6}$/i, // Hex color validation
    },
    icon: {
      type: String,
      default: 'folder', // Default folder icon
      maxlength: 50,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
MediaFolderSchema.index({ workspaceId: 1, name: 1 });
MediaFolderSchema.index({ workspaceId: 1, parentFolderId: 1 });

/**
 * Instance Methods
 */
MediaFolderSchema.methods = {
  /**
   * Convert to safe object for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      workspaceId: obj.workspaceId.toString(),
      name: obj.name,
      parentFolderId: obj.parentFolderId?.toString() || null,
      color: obj.color,
      icon: obj.icon,
      mediaCount: obj.mediaCount || 0,
      createdBy: obj.createdBy.toString(),
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const MediaFolder = mongoose.model<IMediaFolder>('MediaFolder', MediaFolderSchema);
