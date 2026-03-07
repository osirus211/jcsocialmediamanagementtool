/**
 * Workspace Activity Log Model
 * 
 * Tracks all actions performed in a workspace for audit trail
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum ActivityAction {
  // Post actions
  POST_CREATED = 'post_created',
  POST_UPDATED = 'post_updated',
  POST_DELETED = 'post_deleted',
  POST_SUBMITTED_FOR_APPROVAL = 'post_submitted_for_approval',
  POST_APPROVED = 'post_approved',
  POST_REJECTED = 'post_rejected',
  POST_PUBLISHED = 'post_published',
  POST_FAILED = 'post_failed',
  
  // Member actions
  MEMBER_INVITED = 'member_invited',
  MEMBER_JOINED = 'member_joined',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  
  // Social account actions
  ACCOUNT_CONNECTED = 'account_connected',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
  ACCOUNT_RECONNECTED = 'account_reconnected',
  
  // Workspace actions
  WORKSPACE_CREATED = 'workspace_created',
  WORKSPACE_UPDATED = 'workspace_updated',
  WORKSPACE_DELETED = 'workspace_deleted',
  WORKSPACE_PLAN_CHANGED = 'workspace_plan_changed',
  
  // Media actions
  MEDIA_UPLOADED = 'media_uploaded',
  MEDIA_DELETED = 'media_deleted',
}

export interface IWorkspaceActivityLog extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: ActivityAction;
  
  // Resource details
  resourceType?: string;
  resourceId?: mongoose.Types.ObjectId;
  
  // Action details
  details?: Record<string, any>;
  
  // IP and user agent for security
  ipAddress?: string;
  userAgent?: string;
  
  createdAt: Date;
}

const WorkspaceActivityLogSchema = new Schema<IWorkspaceActivityLog>(
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
    action: {
      type: String,
      enum: Object.values(ActivityAction),
      required: true,
      index: true,
    },
    
    // Resource details
    resourceType: {
      type: String,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
    },
    
    // Action details
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    // Security
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes
WorkspaceActivityLogSchema.index({ workspaceId: 1, createdAt: -1 });
WorkspaceActivityLogSchema.index({ workspaceId: 1, action: 1, createdAt: -1 });
WorkspaceActivityLogSchema.index({ userId: 1, createdAt: -1 });
WorkspaceActivityLogSchema.index({ resourceType: 1, resourceId: 1 });

// TTL index - automatically delete logs older than 90 days
WorkspaceActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const WorkspaceActivityLog = mongoose.model<IWorkspaceActivityLog>(
  'WorkspaceActivityLog',
  WorkspaceActivityLogSchema
);
