import mongoose, { Schema, Document } from 'mongoose';

/**
 * Category Model
 * 
 * Represents content categories for organizing posts
 */

export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  color: string;
  description?: string;
  icon?: string;
  postCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
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
      maxlength: 50,
    },
    color: {
      type: String,
      default: '#6366f1',
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    description: {
      type: String,
      maxlength: 200,
    },
    icon: {
      type: String,
      maxlength: 50,
    },
    postCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Unique index for workspace + name
CategorySchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);