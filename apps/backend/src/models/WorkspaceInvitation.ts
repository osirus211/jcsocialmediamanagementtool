/**
 * WorkspaceInvitation Model
 * 
 * Manages email-based workspace invitations for both existing and new users
 */

import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

export interface IWorkspaceInvitation extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  invitedEmail: string;
  invitedBy: mongoose.Types.ObjectId;
  role: 'admin' | 'member' | 'viewer';
  
  // Token and Security
  token: string;
  tokenHash: string; // SHA-256 hash for database storage
  
  // Status and Lifecycle
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  
  // Metadata
  inviterName: string;
  workspaceName: string;
  
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  markAsAccepted(): Promise<IWorkspaceInvitation>;
  markAsRevoked(): Promise<IWorkspaceInvitation>;
  isValid(): boolean;
}

const WorkspaceInvitationSchema = new Schema<IWorkspaceInvitation>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    invitedEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'viewer'],
      required: true,
      default: 'member',
    },
    
    // Token and Security
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // Status and Lifecycle
    status: {
      type: String,
      enum: Object.values(InvitationStatus),
      default: InvitationStatus.PENDING,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
    
    // Metadata
    inviterName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    workspaceName: {
      type: String,
      required: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performance
WorkspaceInvitationSchema.index({ workspaceId: 1, status: 1 });
WorkspaceInvitationSchema.index({ invitedEmail: 1, workspaceId: 1 });
WorkspaceInvitationSchema.index({ invitedBy: 1, createdAt: -1 });

// TTL index for automatic expiry cleanup
WorkspaceInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static methods interface
interface IWorkspaceInvitationModel extends mongoose.Model<IWorkspaceInvitation> {
  generateToken(): string;
  hashToken(token: string): string;
  validateToken(providedToken: string, storedHash: string): boolean;
}

// Generate cryptographically secure token
WorkspaceInvitationSchema.statics.generateToken = function(): string {
  return crypto.randomBytes(32).toString('hex'); // 256-bit entropy
};

// Hash token for database storage
WorkspaceInvitationSchema.statics.hashToken = function(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Validate token timing-attack safe
WorkspaceInvitationSchema.statics.validateToken = function(providedToken: string, storedHash: string): boolean {
  const providedHash = (this as IWorkspaceInvitationModel).hashToken(providedToken);
  return crypto.timingSafeEqual(
    Buffer.from(providedHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
};

// Pre-save middleware to set expiry date (72 hours from creation)
WorkspaceInvitationSchema.pre('save', function(next) {
  if (this.isNew) {
    this.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
  }
  next();
});

// Mark as accepted
WorkspaceInvitationSchema.methods.markAsAccepted = function(): Promise<IWorkspaceInvitation> {
  this.status = InvitationStatus.ACCEPTED;
  this.acceptedAt = new Date();
  return this.save();
};

// Mark as revoked
WorkspaceInvitationSchema.methods.markAsRevoked = function(): Promise<IWorkspaceInvitation> {
  this.status = InvitationStatus.REVOKED;
  this.revokedAt = new Date();
  return this.save();
};

// Check if invitation is valid
WorkspaceInvitationSchema.methods.isValid = function(): boolean {
  return this.status === InvitationStatus.PENDING && this.expiresAt > new Date();
};

export const WorkspaceInvitation = mongoose.model<IWorkspaceInvitation, IWorkspaceInvitationModel>('WorkspaceInvitation', WorkspaceInvitationSchema);