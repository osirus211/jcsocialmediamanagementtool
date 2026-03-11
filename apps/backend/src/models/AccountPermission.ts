import { Schema, model, Document, Types } from 'mongoose';

export interface IAccountPermission extends Document {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  socialAccountId: Types.ObjectId;
  canPost: boolean;
  canViewAnalytics: boolean;
  canManage: boolean;
  grantedBy: Types.ObjectId;
  grantedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccountPermissionSchema = new Schema<IAccountPermission>(
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
    socialAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SocialAccount',
      required: true,
      index: true,
    },
    canPost: {
      type: Boolean,
      default: true,
    },
    canViewAnalytics: {
      type: Boolean,
      default: true,
    },
    canManage: {
      type: Boolean,
      default: false,
    },
    grantedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index
AccountPermissionSchema.index(
  { workspaceId: 1, userId: 1, socialAccountId: 1 },
  { unique: true }
);

// Additional compound indexes for lookups
AccountPermissionSchema.index({ workspaceId: 1, userId: 1 }); // For member permission lookups
AccountPermissionSchema.index({ workspaceId: 1, socialAccountId: 1 }); // For account permission lookups
);

export const AccountPermission = model<IAccountPermission>('AccountPermission', AccountPermissionSchema);