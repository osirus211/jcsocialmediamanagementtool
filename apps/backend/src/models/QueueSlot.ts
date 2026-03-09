/**
 * QueueSlot Model
 * 
 * Defines fixed posting times per day for queue-based scheduling
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IQueueSlot extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  platform: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  time: string; // HH:MM format (24-hour)
  timezone: string; // IANA timezone (e.g., "America/New_York")
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QueueSlotSchema = new Schema<IQueueSlot>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'threads', 'google-business'],
      index: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
      index: true,
    },
    time: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      default: 'UTC',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one slot per workspace+platform+day+time
QueueSlotSchema.index(
  { workspaceId: 1, platform: 1, dayOfWeek: 1, time: 1 },
  { unique: true }
);

// Index for finding active slots
QueueSlotSchema.index({ workspaceId: 1, platform: 1, isActive: 1 });

/**
 * Instance Methods
 */
QueueSlotSchema.methods = {
  /**
   * Convert to safe object for API responses
   */
  toJSON(): any {
    const obj = this.toObject();
    return {
      id: obj._id.toString(),
      workspaceId: obj.workspaceId.toString(),
      platform: obj.platform,
      dayOfWeek: obj.dayOfWeek,
      time: obj.time,
      timezone: obj.timezone,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  },
};

export const QueueSlot = mongoose.model<IQueueSlot>('QueueSlot', QueueSlotSchema);
