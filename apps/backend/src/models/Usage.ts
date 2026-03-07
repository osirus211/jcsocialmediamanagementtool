/**
 * Usage Model
 * 
 * Tracks workspace resource usage for billing and limits
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUsage extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  
  // Period
  year: number;
  month: number; // 1-12
  
  // Usage counters
  postsScheduled: number;
  postsPublished: number;
  mediaUploads: number;
  mediaStorageUsed: number; // in MB
  analyticsRequests: number;
  teamMembers: number;
  channelsConnected: number;
  
  // API usage (for future API access feature)
  apiRequests: number;
  
  // Timestamps
  periodStart: Date;
  periodEnd: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const UsageSchema = new Schema<IUsage>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    
    // Period
    year: {
      type: Number,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    
    // Usage counters
    postsScheduled: {
      type: Number,
      default: 0,
      min: 0,
    },
    postsPublished: {
      type: Number,
      default: 0,
      min: 0,
    },
    mediaUploads: {
      type: Number,
      default: 0,
      min: 0,
    },
    mediaStorageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    analyticsRequests: {
      type: Number,
      default: 0,
      min: 0,
    },
    teamMembers: {
      type: Number,
      default: 1,
      min: 0,
    },
    channelsConnected: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // API usage
    apiRequests: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Timestamps
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
UsageSchema.index({ workspaceId: 1, year: 1, month: 1 }, { unique: true });
UsageSchema.index({ year: 1, month: 1 });

export const Usage = mongoose.model<IUsage>('Usage', UsageSchema);
