/**
 * OAuth Failure Log Model
 * 
 * Tracks failed OAuth attempts for security monitoring and suspicious activity detection
 * 
 * Features:
 * - Write-only (optimized for fast writes)
 * - Indexed by IP and timestamp for suspicious activity detection
 * - TTL index for automatic cleanup after 30 days
 * 
 * Usage:
 * - Track OAuth failures (invalid state, replay attacks, signature mismatches)
 * - Detect suspicious patterns (multiple failures from same IP)
 * - Security monitoring and alerting
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type OAuthErrorType =
  | 'invalid_state'
  | 'replay_attack'
  | 'signature_mismatch'
  | 'expired_state'
  | 'ip_mismatch'
  | 'user_agent_mismatch'
  | 'rate_limit_exceeded'
  | 'unknown_error';

/**
 * OAuth Failure Log Interface
 */
export interface IOAuthFailureLog extends Document {
  provider: string;
  ip: string;
  userAgent: string;
  errorType: OAuthErrorType;
  timestamp: Date;
  workspaceId?: mongoose.Types.ObjectId;
  state?: string;
  metadata?: Record<string, any>;
}

/**
 * OAuth Failure Log Model Interface (with static methods)
 */
export interface IOAuthFailureLogModel extends Model<IOAuthFailureLog> {
  logFailure(data: {
    provider: string;
    ip: string;
    userAgent: string;
    errorType: OAuthErrorType;
    workspaceId?: string | mongoose.Types.ObjectId;
    state?: string;
    metadata?: Record<string, any>;
  }): Promise<IOAuthFailureLog>;

  getRecentFailures(ip: string, minutes: number): Promise<IOAuthFailureLog[]>;

  getFailureCount(ip: string, minutes: number): Promise<number>;
}

/**
 * OAuth Failure Log Schema
 */
const OAuthFailureLogSchema = new Schema<IOAuthFailureLog>(
  {
    provider: {
      type: String,
      required: true,
      index: true,
      // Examples: "facebook", "twitter", "linkedin", "instagram"
    },
    ip: {
      type: String,
      required: true,
      index: true,
      // IP address of the client
    },
    userAgent: {
      type: String,
      required: true,
      // User agent of the client
    },
    errorType: {
      type: String,
      required: true,
      enum: [
        'invalid_state',
        'replay_attack',
        'signature_mismatch',
        'expired_state',
        'ip_mismatch',
        'user_agent_mismatch',
        'rate_limit_exceeded',
        'unknown_error',
      ],
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: false,
      index: true,
    },
    state: {
      type: String,
      required: false,
      // OAuth state parameter (if available)
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
      // Additional context about the failure
    },
  },
  {
    timestamps: false,
    collection: 'oauthfailurelogs',
  }
);

/**
 * Compound Indexes for efficient querying
 */
OAuthFailureLogSchema.index({ ip: 1, timestamp: -1 });
OAuthFailureLogSchema.index({ provider: 1, timestamp: -1 });
OAuthFailureLogSchema.index({ errorType: 1, timestamp: -1 });
OAuthFailureLogSchema.index({ workspaceId: 1, timestamp: -1 });

/**
 * TTL Index - Automatically delete logs older than 30 days
 * 30 days = 2592000 seconds
 */
OAuthFailureLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

/**
 * Static Methods
 */
OAuthFailureLogSchema.statics = {
  /**
   * Log OAuth failure
   */
  async logFailure(data: {
    provider: string;
    ip: string;
    userAgent: string;
    errorType: OAuthErrorType;
    workspaceId?: string | mongoose.Types.ObjectId;
    state?: string;
    metadata?: Record<string, any>;
  }): Promise<IOAuthFailureLog> {
    return this.create({
      provider: data.provider,
      ip: data.ip,
      userAgent: data.userAgent,
      errorType: data.errorType,
      workspaceId: data.workspaceId,
      state: data.state,
      metadata: data.metadata,
      timestamp: new Date(),
    });
  },

  /**
   * Get recent failures from IP
   */
  async getRecentFailures(ip: string, minutes: number): Promise<IOAuthFailureLog[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.find({
      ip,
      timestamp: { $gte: cutoff },
    }).sort({ timestamp: -1 });
  },

  /**
   * Get failure count from IP in time window
   */
  async getFailureCount(ip: string, minutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.countDocuments({
      ip,
      timestamp: { $gte: cutoff },
    });
  },
};

/**
 * Instance Methods
 */
OAuthFailureLogSchema.methods = {
  /**
   * Convert to plain object for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      provider: obj.provider,
      ip: obj.ip,
      userAgent: obj.userAgent,
      errorType: obj.errorType,
      timestamp: obj.timestamp,
      workspaceId: obj.workspaceId?.toString(),
      state: obj.state,
      metadata: obj.metadata,
    };
  },
};

/**
 * Export Model
 */
export const OAuthFailureLog: IOAuthFailureLogModel = mongoose.model<
  IOAuthFailureLog,
  IOAuthFailureLogModel
>('OAuthFailureLog', OAuthFailureLogSchema);

/**
 * Error Type Constants (for reference)
 */
export const OAuthErrorTypes = {
  INVALID_STATE: 'invalid_state' as OAuthErrorType,
  REPLAY_ATTACK: 'replay_attack' as OAuthErrorType,
  SIGNATURE_MISMATCH: 'signature_mismatch' as OAuthErrorType,
  EXPIRED_STATE: 'expired_state' as OAuthErrorType,
  IP_MISMATCH: 'ip_mismatch' as OAuthErrorType,
  USER_AGENT_MISMATCH: 'user_agent_mismatch' as OAuthErrorType,
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded' as OAuthErrorType,
  UNKNOWN_ERROR: 'unknown_error' as OAuthErrorType,
} as const;
