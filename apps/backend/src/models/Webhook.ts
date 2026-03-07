/**
 * Webhook Model
 * 
 * Stores webhook endpoints for workspace events
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhook extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  lastTriggeredAt?: Date;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSchema = new Schema<IWebhook>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    secret: {
      type: String,
      required: true,
    },
    events: {
      type: [String],
      required: true,
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastTriggeredAt: {
      type: Date,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
WebhookSchema.index({ workspaceId: 1, enabled: 1 });

export const Webhook = mongoose.model<IWebhook>('Webhook', WebhookSchema);
