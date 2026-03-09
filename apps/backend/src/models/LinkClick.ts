/**
 * LinkClick Model
 * 
 * Click tracking for shortened links
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ILinkClick extends Document {
  _id: mongoose.Types.ObjectId;
  shortCode: string;
  clickedAt: Date;
  ip: string; // Hashed for privacy
  userAgent?: string;
  referrer?: string;
  country?: string;
}

const LinkClickSchema = new Schema<ILinkClick>(
  {
    shortCode: {
      type: String,
      required: true,
      index: true,
    },
    clickedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
    },
    referrer: {
      type: String,
    },
    country: {
      type: String,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for analytics queries
LinkClickSchema.index({ shortCode: 1, clickedAt: -1 });

export const LinkClick = mongoose.model<ILinkClick>('LinkClick', LinkClickSchema);
