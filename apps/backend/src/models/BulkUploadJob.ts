/**
 * BulkUploadJob Model
 * 
 * Tracks CSV bulk upload jobs
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum BulkUploadStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface BulkUploadError {
  row: number;
  error: string;
  data?: Record<string, any>;
}

export interface IBulkUploadJob {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  filename: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  failureCount: number;
  status: BulkUploadStatus;
  errors: BulkUploadError[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BulkUploadJobSchema = new Schema<IBulkUploadJob>(
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
    totalRows: {
      type: Number,
      required: true,
      default: 0,
    },
    processedRows: {
      type: Number,
      required: true,
      default: 0,
    },
    successCount: {
      type: Number,
      required: true,
      default: 0,
    },
    failureCount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(BulkUploadStatus),
      default: BulkUploadStatus.PENDING,
      required: true,
      index: true,
    },
    errors: {
      type: [
        {
          row: { type: Number, required: true },
          error: { type: String, required: true },
          data: { type: Schema.Types.Mixed },
        },
      ],
      default: [],
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
BulkUploadJobSchema.index({ workspaceId: 1, status: 1 });
BulkUploadJobSchema.index({ workspaceId: 1, createdAt: -1 });

/**
 * Instance Methods
 */
BulkUploadJobSchema.methods = {
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
      totalRows: obj.totalRows,
      processedRows: obj.processedRows,
      successCount: obj.successCount,
      failureCount: obj.failureCount,
      status: obj.status,
      errors: obj.errors,
      startedAt: obj.startedAt,
      completedAt: obj.completedAt,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const BulkUploadJob = mongoose.model<IBulkUploadJob>('BulkUploadJob', BulkUploadJobSchema);
