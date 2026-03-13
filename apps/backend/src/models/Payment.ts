import mongoose, { Document, Schema } from 'mongoose';

/**
 * Payment Model
 * 
 * Stores payment information for billing history and GDPR exports
 */

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  stripePaymentIntentId: string;
  invoiceId?: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  paymentMethod: string;
  description?: string;
  failureReason?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    status: {
      type: String,
      enum: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled'],
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    failureReason: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ workspaceId: 1, paidAt: -1 });
PaymentSchema.index({ stripePaymentIntentId: 1 });
PaymentSchema.index({ invoiceId: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);