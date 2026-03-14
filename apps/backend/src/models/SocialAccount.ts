import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';

/**
 * Social Account Model
 * 
 * Stores connected social media accounts per workspace
 * 
 * Security:
 * - Tokens encrypted at rest using AES-256-GCM
 * - Never exposed in API responses
 * - Workspace-scoped
 * - OAuth token lifecycle management
 */

export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  THREADS = 'threads',
  BLUESKY = 'bluesky',
  MASTODON = 'mastodon',
  GOOGLE_BUSINESS = 'google-business',
  TIKTOK = 'tiktok',
  PINTEREST = 'pinterest',
  GITHUB = 'github',
  APPLE = 'apple',
}

export enum AccountStatus {
  ACTIVE = 'active',
  TOKEN_EXPIRING = 'token_expiring',
  REAUTH_REQUIRED = 'reauth_required',
  DISCONNECTED = 'disconnected',
  PERMISSION_REVOKED = 'permission_revoked',
  REFRESH_FAILED = 'refresh_failed',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum ProviderType {
  INSTAGRAM_BUSINESS = 'INSTAGRAM_BUSINESS',
  INSTAGRAM_BASIC = 'INSTAGRAM_BASIC',
}

export enum InstagramAccountType {
  PERSONAL = 'PERSONAL',
  BUSINESS = 'BUSINESS',
  CREATOR = 'CREATOR',
}

/**
 * Connection Metadata - Discriminated Union
 * 
 * Type-safe metadata based on provider type
 */
export type ConnectionMetadata =
  | {
      type: 'INSTAGRAM_BUSINESS';
      pageId: string;
      pageName: string;
      tokenRefreshable: true;
      lastRefreshAttempt?: Date;
      refreshFailureCount?: number;
    }
  | {
      type: 'INSTAGRAM_BASIC';
      longLivedTokenExpiresAt: Date;
      tokenRefreshable: boolean;
      lastRefreshAttempt?: Date;
      refreshFailureCount?: number;
    }
  | {
      type: 'OTHER';
      [key: string]: any;
    };

export interface ISocialAccount extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  provider: SocialPlatform;
  providerUserId: string;
  accountName: string;
  accessToken: string; // Encrypted
  refreshToken?: string; // Encrypted, nullable
  tokenExpiresAt?: Date; // Nullable
  encryptionKeyVersion: number; // Key version used for encryption
  scopes: string[];
  status: AccountStatus;
  lastRefreshedAt?: Date;
  lastError?: string;
  lastErrorAt?: Date;
  disconnectedAt?: Date; // Added missing field
  metadata: {
    profileUrl?: string;
    avatarUrl?: string;
    followerCount?: number;
    [key: string]: any;
  };
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  connectionVersion?: 'v1' | 'v2'; // MILESTONE 0: Optional field for V1/V2 tracking
  
  // Phase 2: Instagram Basic Display Integration
  providerType?: string; // 'INSTAGRAM_BUSINESS' | 'INSTAGRAM_BASIC' for Instagram accounts
  accountType?: string; // 'PERSONAL' | 'BUSINESS' | 'CREATOR' for Instagram accounts
  connectionMetadata?: ConnectionMetadata; // Type-safe metadata based on provider type

  // Phase 3: Connection Health Scoring
  healthScore?: number; // 0-100 health score
  healthGrade?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  healthLastUpdated?: Date;

  // Real Platform Integrations: Multi-workspace protection and capabilities
  connectionOwner?: mongoose.Types.ObjectId; // Workspace that first connected this account
  platformAccountId?: string; // Unique ID from platform (for duplicate detection)
  capabilities?: {
    publishPost: boolean;
    publishVideo: boolean;
    publishImage: boolean;
    publishCarousel: boolean;
    analytics: boolean;
    stories: boolean;
    reels: boolean;
    scheduling: boolean;
    maxVideoSize?: number;
    maxImageSize?: number;
    supportedFormats?: string[];
  };
  permissionStatus?: 'sufficient' | 'insufficient_permissions';
  missingPermissions?: string[];

  // Methods
  getDecryptedAccessToken(): string;
  getDecryptedRefreshToken(): string | undefined;
  isTokenExpired(): boolean;
  toSafeObject(): any;
}

const SocialAccountSchema = new Schema<ISocialAccount>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(SocialPlatform),
      required: true,
    },
    providerUserId: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
      select: false, // Never select by default
    },
    refreshToken: {
      type: String,
      select: false, // Never select by default
    },
    tokenExpiresAt: {
      type: Date,
    },
    encryptionKeyVersion: {
      type: Number,
      default: 1,
      index: true, // For migration queries
    },
    scopes: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.ACTIVE,
      index: true,
    },
    lastRefreshedAt: {
      type: Date,
    },
    lastError: {
      type: String,
    },
    lastErrorAt: {
      type: Date,
    },
    disconnectedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastSyncAt: {
      type: Date,
    },
    connectionVersion: {
      type: String,
      enum: ['v1', 'v2'],
      required: false, // MILESTONE 0: Must be optional for backward compatibility
      default: undefined, // MILESTONE 0: No default for existing accounts
    },
    // Phase 2: Instagram Basic Display Integration
    providerType: {
      type: String,
      required: false, // Optional for backward compatibility
      index: true, // For provider-specific queries
    },
    accountType: {
      type: String,
      required: false, // Optional
    },
    connectionMetadata: {
      type: Schema.Types.Mixed,
      required: false, // Optional
    },
    // Phase 3: Connection Health Scoring
    healthScore: {
      type: Number,
      min: 0,
      max: 100,
      required: false,
      index: true, // For querying unhealthy accounts
    },
    healthGrade: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'critical'],
      required: false,
    },
    healthLastUpdated: {
      type: Date,
      required: false,
    },
    // Real Platform Integrations: Multi-workspace protection and capabilities
    connectionOwner: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: false, // Optional for backward compatibility
      index: true, // For ownership queries
    },
    platformAccountId: {
      type: String,
      required: false, // Optional for backward compatibility
      index: true, // For duplicate detection
    },
    capabilities: {
      type: Schema.Types.Mixed,
      required: false,
    },
    permissionStatus: {
      type: String,
      enum: ['sufficient', 'insufficient_permissions'],
      required: false,
    },
    missingPermissions: {
      type: [String],
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
SocialAccountSchema.index({ workspaceId: 1, provider: 1 });
SocialAccountSchema.index({ workspaceId: 1, status: 1 });
SocialAccountSchema.index({ status: 1, tokenExpiresAt: 1 }); // For token refresh jobs
SocialAccountSchema.index({ tokenExpiresAt: 1, status: 1 }); // For auto-refresh worker

// Compound unique index: one account per provider per workspace per user
SocialAccountSchema.index(
  { workspaceId: 1, provider: 1, providerUserId: 1 },
  { unique: true }
);

// Real Platform Integrations: Unique compound index for duplicate detection
// Prevents same platform account from being connected to multiple workspaces
SocialAccountSchema.index(
  { provider: 1, platformAccountId: 1 },
  { 
    unique: true,
    sparse: true, // Allow null platformAccountId for backward compatibility
    partialFilterExpression: { platformAccountId: { $exists: true, $ne: null } }
  }
);

// Phase 2: Index for provider type queries
SocialAccountSchema.index({ _id: 1, providerType: 1 });

/**
 * Get decrypted access token
 */
SocialAccountSchema.methods.getDecryptedAccessToken = function (): string {
  return decrypt(this.accessToken);
};

/**
 * Get decrypted refresh token
 */
SocialAccountSchema.methods.getDecryptedRefreshToken = function (): string | undefined {
  if (!this.refreshToken) {
    return undefined;
  }
  return decrypt(this.refreshToken);
};

/**
 * Check if token is expired
 */
SocialAccountSchema.methods.isTokenExpired = function (): boolean {
  if (!this.tokenExpiresAt) {
    return false;
  }
  return new Date() >= this.tokenExpiresAt;
};

/**
 * Convert to safe object (without tokens)
 */
SocialAccountSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.accessToken;
  delete obj.refreshToken;
  return obj;
};

/**
 * Encrypt tokens before saving
 */
SocialAccountSchema.pre('save', function (next) {
  const { getCurrentKeyVersion } = require('../utils/encryption');
  
  // Type assertion for accessing properties
  const doc = this as any;
  
  // Only encrypt if tokens are modified and not already encrypted
  if (doc.isModified('accessToken') && !isEncrypted(doc.accessToken)) {
    doc.accessToken = encrypt(doc.accessToken);
    doc.encryptionKeyVersion = getCurrentKeyVersion();
  }
  
  if (doc.isModified('refreshToken') && doc.refreshToken && !isEncrypted(doc.refreshToken)) {
    doc.refreshToken = encrypt(doc.refreshToken);
    // Use same version for both tokens
    if (!doc.encryptionKeyVersion) {
      doc.encryptionKeyVersion = getCurrentKeyVersion();
    }
  }
  
  next();
});

/**
 * Remove tokens from JSON output by default
 */
SocialAccountSchema.set('toJSON', {
  transform: function (doc, ret) {
    const result = ret as any;
    delete result.accessToken;
    delete result.refreshToken;
    delete result.__v;
    return result;
  },
});

export const SocialAccount = mongoose.model<ISocialAccount>('SocialAccount', SocialAccountSchema);
