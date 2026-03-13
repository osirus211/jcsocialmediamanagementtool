import mongoose, { Document, Schema } from 'mongoose';

/**
 * Invoice Model
 * 
 * Stores invoice information for billing history and GDPR exports
 */

export interface IInvoice extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  description?: string;
  invoiceDate: Date;
  dueDate?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
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
    stripeInvoiceId: {
      type: String,
      required: true,
      unique: true,
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
      enum: ['draft', 'open', 'paid', 'uncollectible', 'void'],
      required: true,
      index: true,
    },
    description: {
      type: String,
    },
    invoiceDate: {
      type: Date,
      required: true,
      index: true,
    },
    dueDate: {
      type: Date,
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
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ workspaceId: 1, invoiceDate: -1 });
InvoiceSchema.index({ stripeInvoiceId: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);