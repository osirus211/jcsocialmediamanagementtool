/**
 * Workspace Member Model
 * 
 * Represents a team member in a workspace
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  MEMBER = 'member', // Add missing MEMBER role
}

// Alias for compatibility
export const WorkspaceRole = MemberRole;

export interface IWorkspaceMember extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: MemberRole;
  
  // Invitation
  invitedBy?: mongoose.Types.ObjectId;
  invitedAt?: Date;
  joinedAt: Date;
  
  // Status
  isActive: boolean;
  
  // Last activity
  lastActivityAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
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
    role: {
      type: String,
      enum: Object.values(MemberRole),
      required: true,
      default: MemberRole.VIEWER,
      index: true,
    },
    
    // Invitation
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    invitedAt: {
      type: Date,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Last activity
    lastActivityAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMemberSchema.index({ workspaceId: 1, role: 1, isActive: 1 });
WorkspaceMemberSchema.index({ userId: 1, isActive: 1 });

// Update last activity timestamp
WorkspaceMemberSchema.methods.updateActivity = function () {
  this.lastActivityAt = new Date();
  return this.save();
};

export const WorkspaceMember = mongoose.model<IWorkspaceMember>('WorkspaceMember', WorkspaceMemberSchema);
