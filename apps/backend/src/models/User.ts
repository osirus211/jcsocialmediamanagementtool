import mongoose, { Schema, Document, Model, QueryWithHelpers } from 'mongoose';
import bcrypt from 'bcrypt';
import { z } from 'zod';

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Email validation schema
export const emailSchema = z.string().email('Invalid email address').toLowerCase();

// User roles enum
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

// OAuth providers enum
export enum OAuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

// User interface with query helpers
interface IUserQueryHelpers {
  notDeleted(): QueryWithHelpers<any, Document<IUser>, IUserQueryHelpers>;
}

// User interface
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  role: UserRole;
  isEmailVerified: boolean;
  provider: OAuthProvider;
  oauthId?: string;
  refreshTokens: string[];
  lastLoginAt?: Date;
  softDeletedAt?: Date;
  
  // Two-factor authentication
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes: string[];
  twoFactorVerifiedAt?: Date;
  
  // Magic link / passwordless authentication
  magicLinkToken?: string;
  magicLinkExpiresAt?: Date;
  
  // Notification preferences
  notificationPreferences: {
    email: {
      postPublished: boolean;
      postFailed: boolean;
      weeklyReport: boolean;
      accountIssues: boolean;
    };
    push: {
      postPublished: boolean;
      postFailed: boolean;
      accountIssues: boolean;
    };
  };
  
  // Onboarding state
  onboardingCompleted: boolean;
  onboardingStep: number;
  
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  getFullName(): string;
  addRefreshToken(token: string): Promise<void>;
  removeRefreshToken(token: string): Promise<void>;
  revokeAllTokens(): Promise<void>;
}

// User schema
const UserSchema = new Schema<IUser, Model<IUser, IUserQueryHelpers>, {}, IUserQueryHelpers>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value: string) => emailSchema.safeParse(value).success,
        message: 'Invalid email address',
      },
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === OAuthProvider.LOCAL;
      },
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: null,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    language: {
      type: String,
      default: 'en',
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.MEMBER,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: Object.values(OAuthProvider),
      default: OAuthProvider.LOCAL,
    },
    oauthId: {
      type: String,
      sparse: true, // Allow multiple null values
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false, // Never return refresh tokens by default
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    softDeletedAt: {
      type: Date,
      default: null,
    },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },
    twoFactorBackupCodes: { type: [String], default: [], select: false },
    twoFactorVerifiedAt: { type: Date, default: null },
    magicLinkToken: { type: String, default: null, select: false },
    magicLinkExpiresAt: { type: Date, default: null, select: false },
    notificationPreferences: {
      type: {
        email: {
          postPublished: { type: Boolean, default: true },
          postFailed: { type: Boolean, default: true },
          weeklyReport: { type: Boolean, default: true },
          accountIssues: { type: Boolean, default: true },
        },
        push: {
          postPublished: { type: Boolean, default: false },
          postFailed: { type: Boolean, default: true },
          accountIssues: { type: Boolean, default: true },
        },
      },
      default: () => ({
        email: {
          postPublished: true,
          postFailed: true,
          weeklyReport: true,
          accountIssues: true,
        },
        push: {
          postPublished: false,
          postFailed: true,
          accountIssues: true,
        },
      }),
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    onboardingStep: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        // Remove sensitive fields from JSON output
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        // Remove sensitive fields from object output
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance and uniqueness
UserSchema.index({ email: 1 });
UserSchema.index({ provider: 1, oauthId: 1 });
UserSchema.index({ softDeletedAt: 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save hook: Hash password before saving
UserSchema.pre('save', async function (next) {
  // Only hash password if it's modified and provider is local
  if (!this.isModified('password') || this.provider !== OAuthProvider.LOCAL) {
    return next();
  }

  try {
    // Validate password strength
    const validation = passwordSchema.safeParse(this.password);
    if (!validation.success) {
      throw new Error(validation.error.errors[0].message);
    }

    // Hash password with bcrypt (salt rounds: 12)
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method: Compare password (timing-attack safe)
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    // Use bcrypt.compare for timing-attack safe comparison
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Instance method: Get full name
UserSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`.trim();
};

// Instance method: Add refresh token
UserSchema.methods.addRefreshToken = async function (token: string): Promise<void> {
  // Limit to 5 active refresh tokens per user
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift(); // Remove oldest token
  }
  this.refreshTokens.push(token);
  await this.save();
};

// Instance method: Remove specific refresh token
UserSchema.methods.removeRefreshToken = async function (token: string): Promise<void> {
  this.refreshTokens = this.refreshTokens.filter((t: string) => t !== token);
  await this.save();
};

// Instance method: Revoke all refresh tokens (logout from all devices)
UserSchema.methods.revokeAllTokens = async function (): Promise<void> {
  this.refreshTokens = [];
  await this.save();
};

// Static method: Find by email (excluding soft-deleted)
UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase(), softDeletedAt: null });
};

// Static method: Find by OAuth provider
UserSchema.statics.findByOAuth = function (provider: OAuthProvider, oauthId: string) {
  return this.findOne({ provider, oauthId, softDeletedAt: null });
};

// Query helper: Exclude soft-deleted users
UserSchema.query.notDeleted = function () {
  return this.where({ softDeletedAt: null });
};

// Create and export model
export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
