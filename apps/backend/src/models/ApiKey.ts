/**
 * API Key Model
 * 
 * Represents an API key for external developer access to the Public API
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum ApiKeyStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export interface IApiKey extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Ownership
  workspaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId; // User who created the key
  
  // Key identification
  name: string; // Human-readable name (e.g., "Production Server")
  prefix: string; // First 15 chars for display (e.g., "sk_live_a7f3k9m")
  keyHash: string; // SHA-256 hash of full key
  
  // Permissions
  scopes: string[]; // e.g., ['posts:read', 'posts:write', 'analytics:read']
  
  // Rate limiting
  rateLimit: {
    maxRequests: number; // Requests per hour
    windowMs: number; // Time window in milliseconds
  };
  
  // Security
  status: ApiKeyStatus;
  revokedAt?: Date;
  revokedBy?: mongoose.Types.ObjectId;
  expiresAt?: Date; // Optional expiration
  
  // IP restrictions (optional)
  allowedIps?: string[]; // IP allowlist
  
  // Usage tracking
  lastUsedAt?: Date;
  lastUsedIp?: string;
  requestCount: number; // Total requests made
  
  // Rotation
  rotatedFrom?: mongoose.Types.ObjectId; // Previous key ID if rotated
  rotatedTo?: mongoose.Types.ObjectId; // New key ID if rotated
  rotationGracePeriodEnds?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}


const ApiKeySchema = new Schema<IApiKey>(
  {
    // Ownership
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Key identification
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    prefix: {
      type: String,
      required: true,
      length: 15,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // Permissions
    scopes: {
      type: [String],
      required: true,
      validate: {
        validator: function(scopes: string[]) {
          return scopes.length > 0;
        },
        message: 'At least one scope is required',
      },
    },
    
    // Rate limiting
    rateLimit: {
      maxRequests: {
        type: Number,
        required: true,
        default: 1000,
        min: 100,
        max: 10000,
      },
      windowMs: {
        type: Number,
        required: true,
        default: 3600000, // 1 hour
      },
    },
    
    // Security
    status: {
      type: String,
      enum: Object.values(ApiKeyStatus),
      default: ApiKeyStatus.ACTIVE,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    
    // IP restrictions
    allowedIps: {
      type: [String],
      default: [],
    },
    
    // Usage tracking
    lastUsedAt: {
      type: Date,
    },
    lastUsedIp: {
      type: String,
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Rotation
    rotatedFrom: {
      type: Schema.Types.ObjectId,
      ref: 'ApiKey',
    },
    rotatedTo: {
      type: Schema.Types.ObjectId,
      ref: 'ApiKey',
    },
    rotationGracePeriodEnds: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performance
ApiKeySchema.index({ workspaceId: 1, status: 1 }); // List workspace keys
ApiKeySchema.index({ status: 1, expiresAt: 1 }); // Cleanup expired keys
ApiKeySchema.index({ status: 1, rotationGracePeriodEnds: 1 }); // Cleanup rotated keys

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
