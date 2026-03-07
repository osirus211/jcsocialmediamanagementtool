/**
 * Business Location Model
 * 
 * Stores Google Business Profile locations associated with connected accounts
 * 
 * Features:
 * - Multi-location support per account
 * - Address and contact information
 * - Location verification status
 * - Workspace-scoped access
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IBusinessLocation extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  socialAccountId: mongoose.Types.ObjectId;
  locationId: string; // GBP location resource name (e.g., accounts/{accountId}/locations/{locationId})
  accountId: string; // GBP account ID
  name: string;
  address: {
    addressLines: string[];
    locality: string; // City
    administrativeArea: string; // State
    postalCode: string;
    regionCode: string; // Country code
  };
  primaryPhone?: string;
  websiteUrl?: string;
  locationState: 'VERIFIED' | 'UNVERIFIED' | 'SUSPENDED';
  isActive: boolean;
  metadata: {
    placeId?: string;
    storeCode?: string;
    categories?: string[];
  };
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessLocationSchema = new Schema<IBusinessLocation>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    socialAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SocialAccount',
      required: true,
      index: true,
    },
    locationId: {
      type: String,
      required: true,
    },
    accountId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    address: {
      addressLines: {
        type: [String],
        default: [],
      },
      locality: {
        type: String,
        default: '',
      },
      administrativeArea: {
        type: String,
        default: '',
      },
      postalCode: {
        type: String,
        default: '',
      },
      regionCode: {
        type: String,
        default: '',
      },
    },
    primaryPhone: {
      type: String,
    },
    websiteUrl: {
      type: String,
    },
    locationState: {
      type: String,
      enum: ['VERIFIED', 'UNVERIFIED', 'SUSPENDED'],
      default: 'UNVERIFIED',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
BusinessLocationSchema.index({ workspaceId: 1, socialAccountId: 1 });
BusinessLocationSchema.index({ socialAccountId: 1, locationId: 1 }, { unique: true });
BusinessLocationSchema.index({ workspaceId: 1, isActive: 1 });

export const BusinessLocation = mongoose.model<IBusinessLocation>(
  'BusinessLocation',
  BusinessLocationSchema
);
