/**
 * Webhook Delivery Model
 * 
 * Stores webhook delivery attempts and history for debugging and monitoring
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookDelivery extends Document {
  _id: mongoose.Types.ObjectId;
  webhookId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  event: string;
  payload: Record<string, any>;
  url: string;
  attempt: number;
  maxAttempts: number;
  status: 'pending' | 'success' | 'failed' | 'dead_letter';
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: Date;
  deliveryTimestamp?: number;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    webhookId: {
      type: Schema.Types.ObjectId,
      ref: 'Webhook',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    attempt: {
      type: Number,
      required: true,
      default: 1,
    },
    maxAttempts: {
      type: Number,
      required: true,
      default: 5,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'dead_letter'],
      required: true,
      default: 'pending',
      index: true,
    },
    statusCode: {
      type: Number,
    },
    responseBody: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    deliveredAt: {
      type: Date,
    },
    deliveryTimestamp: {
      type: Number,
    },
    nextRetryAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
WebhookDeliverySchema.index({ workspaceId: 1, webhookId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ status: 1, nextRetryAt: 1 }); // For retry processing
WebhookDeliverySchema.index({ workspaceId: 1, event: 1, createdAt: -1 }); // For event filtering

export const WebhookDelivery = mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);