import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedCaption extends Document {
  workspaceId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  title: string;
  text: string;
  category?: string;
  platforms?: string[];
  tags?: string[];
  usageCount: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavedCaptionSchema = new Schema<ISavedCaption>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
      maxlength: 50,
      index: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    platforms: {
      type: [String],
      default: [],
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'tiktok', 'youtube', ''],
    },
    tags: {
      type: [String],
      default: [],
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
SavedCaptionSchema.index({ workspaceId: 1, platforms: 1 });
SavedCaptionSchema.index({ workspaceId: 1, deletedAt: 1 });

export const SavedCaption = mongoose.model<ISavedCaption>('SavedCaption', SavedCaptionSchema);
