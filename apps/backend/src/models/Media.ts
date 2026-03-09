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

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  FAILED = 'failed',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface IMedia extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId; // Alias for userId for clarity
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  storageProvider: string; // 's3', 'gcs', 'local'
  storageKey: string;
  storageUrl: string;
  originalUrl?: string; // Original upload URL (before processing)
  cdnUrl?: string; // CDN URL for optimized delivery
  thumbnailUrl?: string;
  status: MediaStatus; // Legacy combined status
  uploadStatus: UploadStatus; // Upload lifecycle status
  processingStatus: ProcessingStatus; // Processing lifecycle status
  uploadedAt?: Date;
  platformMediaIds?: Array<{
    platform: string;
    mediaId: string;
    uploadedAt?: Date;
  }>;
  folderId?: mongoose.Types.ObjectId; // Phase-2: Folder organization
  tags?: string[]; // Phase-2: Tagging system
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
    uploadedBy: {
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
    storageProvider: {
      type: String,
      required: true,
      default: 's3',
      enum: ['s3', 'gcs', 'local'],
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
    originalUrl: {
      type: String,
    },
    cdnUrl: {
      type: String,
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
    uploadStatus: {
      type: String,
      enum: Object.values(UploadStatus),
      default: UploadStatus.PENDING,
      required: true,
      index: true,
    },
    processingStatus: {
      type: String,
      enum: Object.values(ProcessingStatus),
      default: ProcessingStatus.PENDING,
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
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'MediaFolder',
      default: null,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
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
MediaSchema.index({ workspaceId: 1, uploadStatus: 1 });
MediaSchema.index({ workspaceId: 1, processingStatus: 1 });
MediaSchema.index({ workspaceId: 1, mediaType: 1 });
MediaSchema.index({ workspaceId: 1, createdAt: -1 });
MediaSchema.index({ uploadStatus: 1, processingStatus: 1 }); // For finding completed media
MediaSchema.index({ workspaceId: 1, folderId: 1 }); // Phase-2: Folder filtering
MediaSchema.index({ workspaceId: 1, tags: 1 }); // Phase-2: Tag filtering

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
      uploadedBy: obj.uploadedBy?.toString() || obj.userId.toString(),
      filename: obj.filename,
      originalFilename: obj.originalFilename,
      mimeType: obj.mimeType,
      mediaType: obj.mediaType,
      size: obj.size,
      width: obj.width,
      height: obj.height,
      duration: obj.duration,
      storageProvider: obj.storageProvider,
      storageUrl: obj.storageUrl,
      originalUrl: obj.originalUrl,
      cdnUrl: obj.cdnUrl,
      thumbnailUrl: obj.thumbnailUrl,
      status: obj.status,
      uploadStatus: obj.uploadStatus,
      processingStatus: obj.processingStatus,
      uploadedAt: obj.uploadedAt,
      folderId: obj.folderId?.toString() || null,
      tags: obj.tags || [],
      metadata: obj.metadata,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const Media = mongoose.model<IMedia>('Media', MediaSchema);
