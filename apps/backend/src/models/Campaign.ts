import mongoose, { Schema, Document } from 'mongoose';

/**
 * Campaign Model
 * 
 * Represents marketing campaigns for organizing posts
 */

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export interface ICampaign extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  color: string;
  status: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
  goals?: string;
  postCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
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
    description: {
      type: String,
      maxlength: 500,
    },
    color: {
      type: String,
      default: '#8b5cf6',
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
      index: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    goals: {
      type: String,
      maxlength: 1000,
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

// Index for workspace + status queries
CampaignSchema.index({ workspaceId: 1, status: 1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);