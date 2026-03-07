import mongoose, { Schema, Document } from 'mongoose';

/**
 * Webhook Event Model
 * 
 * Stores processed Stripe webhook events to ensure idempotency
 * Prevents duplicate processing of the same event
 */

export interface IWebhookEvent extends Document {
  _id: mongoose.Types.ObjectId;
  stripeEventId: string;
  eventType: string;
  processedAt: Date;
  metadata: {
    workspaceId?: string;
    subscriptionId?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    processedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for cleanup queries (delete old events after 30 days)
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const WebhookEvent = mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
