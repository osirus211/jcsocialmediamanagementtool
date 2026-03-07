/**
 * Media Model
 * 
 * Stores metadata for uploaded media files (images, videos)
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum MediaStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export interface IMedia extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  storageKey: string;
  storageUrl: string;
  thumbnailUrl?: string;
  status: MediaStatus;
  uploadedAt?: Date;
  platformMediaIds?: Array<{
    platform: string;
    mediaId: string;
    uploadedAt?: Date;
  }>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: Object.values(MediaType),
      required: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    duration: {
      type: Number,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },
    storageUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(MediaStatus),
      default: MediaStatus.PENDING,
      required: true,
      index: true,
    },
    uploadedAt: {
      type: Date,
    },
    platformMediaIds: {
      type: [
        {
          platform: { type: String, required: true },
          mediaId: { type: String, required: true },
          uploadedAt: { type: Date },
        },
      ],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
MediaSchema.index({ workspaceId: 1, status: 1 });
MediaSchema.index({ workspaceId: 1, mediaType: 1 });
MediaSchema.index({ workspaceId: 1, createdAt: -1 });

/**
 * Instance Methods
 */
MediaSchema.methods = {
  /**
   * Convert to safe object for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      workspaceId: obj.workspaceId.toString(),
      userId: obj.userId.toString(),
      filename: obj.filename,
      originalFilename: obj.originalFilename,
      mimeType: obj.mimeType,
      mediaType: obj.mediaType,
      size: obj.size,
      width: obj.width,
      height: obj.height,
      duration: obj.duration,
      storageUrl: obj.storageUrl,
      thumbnailUrl: obj.thumbnailUrl,
      status: obj.status,
      uploadedAt: obj.uploadedAt,
      metadata: obj.metadata,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const Media = mongoose.model<IMedia>('Media', MediaSchema);
