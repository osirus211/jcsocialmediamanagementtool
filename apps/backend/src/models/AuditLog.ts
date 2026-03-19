/**
 * Audit Log Model
 * 
 * Lightweight audit logging system for tracking important actions
 * 
 * Features:
 * - Write-only (optimized for fast writes)
 * - Indexed by workspaceId and createdAt
 * - No heavy relations
 * - Simple and fast
 * 
 * Usage:
 * - Track user actions (post.deleted, member.removed, etc.)
 * - Track system events (billing.updated, workspace.created, etc.)
 * - Store metadata for debugging and compliance
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Audit Log Interface
 */
export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Audit Log Model Interface (with static methods)
 */
export interface IAuditLogModel extends Model<IAuditLog> {
  log(data: {
    userId: string | mongoose.Types.ObjectId;
    workspaceId: string | mongoose.Types.ObjectId;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IAuditLog>;

  logBatch(
    entries: Array<{
      userId: string | mongoose.Types.ObjectId;
      workspaceId: string | mongoose.Types.ObjectId;
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }>
  ): Promise<IAuditLog[]>;
}

/**
 * Audit Log Schema
 */
const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      // Examples: "post.created", "post.deleted", "member.added", "member.removed", 
      // "billing.updated", "workspace.created", "workspace.deleted"
    },
    entityType: {
      type: String,
      required: true,
      index: true,
      // Examples: "post", "workspace", "member", "billing", "social_account"
    },
    entityId: {
      type: String,
      required: false,
      index: true,
      // ID of the entity being acted upon (e.g., postId, memberId)
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
      // Additional context about the action (e.g., old values, new values, reason)
    },
    ipAddress: {
      type: String,
      required: false,
      // IP address of the user performing the action
    },
    userAgent: {
      type: String,
      required: false,
      // User agent of the client performing the action
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false, // We only need createdAt, not updatedAt
    collection: 'auditlogs',
  }
);

/**
 * Compound Indexes for efficient querying
 * 
 * Primary use case: Query by workspace and time range
 */
AuditLogSchema.index({ workspaceId: 1, createdAt: -1 });
AuditLogSchema.index({ workspaceId: 1, action: 1, createdAt: -1 });
AuditLogSchema.index({ workspaceId: 1, entityType: 1, createdAt: -1 });
AuditLogSchema.index({ workspaceId: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

/**
 * TTL Index (optional - uncomment to auto-delete old logs)
 * 
 * Automatically delete audit logs older than 90 days
 * Adjust expireAfterSeconds as needed (90 days = 7776000 seconds)
 */
// AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

/**
 * Static Methods
 */
AuditLogSchema.statics = {
  /**
   * Create audit log entry
   * 
   * Fast write-only operation
   */
  async log(data: {
    userId: string | mongoose.Types.ObjectId;
    workspaceId: string | mongoose.Types.ObjectId;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IAuditLog> {
    return this.create({
      userId: data.userId,
      workspaceId: data.workspaceId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      createdAt: new Date(),
    });
  },

  /**
   * Batch create audit log entries
   * 
   * For bulk operations
   */
  async logBatch(
    entries: Array<{
      userId: string | mongoose.Types.ObjectId;
      workspaceId: string | mongoose.Types.ObjectId;
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }>
  ): Promise<IAuditLog[]> {
    const logs = entries.map((entry) => ({
      userId: entry.userId,
      workspaceId: entry.workspaceId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      createdAt: new Date(),
    }));

    return this.insertMany(logs, { ordered: false });
  },
};

/**
 * Instance Methods
 */
AuditLogSchema.methods = {
  /**
   * Convert to plain object for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      userId: obj.userId.toString(),
      workspaceId: obj.workspaceId.toString(),
      action: obj.action,
      entityType: obj.entityType,
      entityId: obj.entityId,
      metadata: obj.metadata,
      ipAddress: obj.ipAddress,
      userAgent: obj.userAgent,
      createdAt: obj.createdAt,
    };
  },
};

/**
 * Export Model
 */
export const AuditLog: IAuditLogModel = mongoose.model<IAuditLog, IAuditLogModel>(
  'AuditLog',
  AuditLogSchema
);

/**
 * Common Action Types (for reference)
 * 
 * Use these constants to ensure consistency across the application
 */
export const AuditActions = {
  // Post actions
  POST_CREATED: 'post.created',
  POST_UPDATED: 'post.updated',
  POST_DELETED: 'post.deleted',
  POST_PUBLISHED: 'post.published',
  POST_SCHEDULED: 'post.scheduled',
  POST_CANCELLED: 'post.cancelled',

  // Workspace actions
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_DELETED: 'workspace.deleted',
  WORKSPACE_SETTINGS_CHANGED: 'workspace.settings_changed',

  // Member actions
  MEMBER_ADDED: 'member.added',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_INVITED: 'member.invited',
  INVITE_SENT: 'invitation.sent',
  INVITE_REVOKED: 'invitation.revoked',

  // Billing actions
  BILLING_UPDATED: 'billing.updated',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_UPGRADED: 'subscription.upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription.downgraded',

  // Social account actions
  SOCIAL_ACCOUNT_CONNECTED: 'social_account.connected',
  SOCIAL_ACCOUNT_DISCONNECTED: 'social_account.disconnected',
  SOCIAL_ACCOUNT_REFRESHED: 'social_account.refreshed',

  // Media actions
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DELETED: 'media.deleted',

  // Auth actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_EMAIL_CHANGED: 'user.email_changed',
} as const;

/**
 * Common Entity Types (for reference)
 */
export const EntityTypes = {
  POST: 'post',
  WORKSPACE: 'workspace',
  MEMBER: 'member',
  BILLING: 'billing',
  SUBSCRIPTION: 'subscription',
  SOCIAL_ACCOUNT: 'social_account',
  MEDIA: 'media',
  USER: 'user',
} as const;
