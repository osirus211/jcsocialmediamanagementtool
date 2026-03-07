import mongoose, { Schema, Document } from 'mongoose';

/**
 * Security Event Model
 * 
 * FOUNDATION LAYER for security audit logging
 * 
 * Stores security-relevant events for:
 * - Authentication events (login, logout, password change)
 * - Authorization events (role change, permission denied)
 * - Token events (refresh, revocation, corruption)
 * - Rate limit events (throttled, blocked)
 * - Admin actions (workspace deletion, user suspension)
 */

export enum SecurityEventType {
  // Authentication
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_COMPLETE = 'password_reset_complete',
  EMAIL_VERIFICATION = 'email_verification',
  
  // Authorization
  PERMISSION_DENIED = 'permission_denied',
  ROLE_CHANGE = 'role_change',
  
  // Token Security
  TOKEN_REFRESH_SUCCESS = 'token_refresh_success',
  TOKEN_REFRESH_FAILURE = 'token_refresh_failure',
  TOKEN_CORRUPTION_DETECTED = 'token_corruption_detected',
  TOKEN_REVOKED = 'token_revoked',
  CONCURRENT_REFRESH_BLOCKED = 'concurrent_refresh_blocked',
  
  // Rate Limiting
  RATE_LIMIT_WARNING = 'rate_limit_warning',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  IP_THROTTLED = 'ip_throttled',
  IP_BLOCKED = 'ip_blocked',
  
  // Admin Actions
  WORKSPACE_DELETED = 'workspace_deleted',
  USER_SUSPENDED = 'user_suspended',
  USER_UNSUSPENDED = 'user_unsuspended',
  
  // OAuth
  OAUTH_INITIATED = 'oauth_initiated',
  OAUTH_CONNECT_SUCCESS = 'oauth_connect_success',
  OAUTH_CONNECT_FAILURE = 'oauth_connect_failure',
  OAUTH_DISCONNECT = 'oauth_disconnect',
  OAUTH_TOKEN_EXPIRED = 'oauth_token_expired',
  OAUTH_TOKEN_REVOKED = 'oauth_token_revoked',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
}

export enum SecurityEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface ISecurityEvent extends Document {
  _id: mongoose.Types.ObjectId;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: mongoose.Types.ObjectId;
  workspaceId?: mongoose.Types.ObjectId;
  ipAddress: string; // Hashed for privacy
  userAgent?: string;
  resource?: string; // e.g., endpoint path, social account ID
  action?: string; // e.g., "POST /api/posts"
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
}

const SecurityEventSchema = new Schema<ISecurityEvent>(
  {
    type: {
      type: String,
      enum: Object.values(SecurityEventType),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(SecurityEventSeverity),
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
    },
    resource: {
      type: String,
      index: true,
    },
    action: {
      type: String,
    },
    success: {
      type: Boolean,
      required: true,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
SecurityEventSchema.index({ userId: 1, timestamp: -1 });
SecurityEventSchema.index({ workspaceId: 1, timestamp: -1 });
SecurityEventSchema.index({ type: 1, timestamp: -1 });
SecurityEventSchema.index({ severity: 1, timestamp: -1 });
SecurityEventSchema.index({ success: 1, timestamp: -1 });

// TTL index for automatic cleanup (365 days retention)
SecurityEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const SecurityEvent = mongoose.model<ISecurityEvent>('SecurityEvent', SecurityEventSchema);
