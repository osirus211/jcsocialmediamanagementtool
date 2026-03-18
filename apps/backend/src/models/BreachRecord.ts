import mongoose, { Schema, Document } from 'mongoose';

export interface IBreachRecord extends Document {
  description: string;
  affectedUserCount: number;
  dataTypes: string[];
  discoveredAt: Date;
  reportedAt: Date;
  reportedBy: string;
  status: 'reported' | 'investigating' | 'resolved';
  notificationDeadline: Date;
  authorityNotifiedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BreachRecordSchema = new Schema<IBreachRecord>({
  description: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  affectedUserCount: {
    type: Number,
    required: true,
    min: 0,
  },
  dataTypes: [{
    type: String,
    required: true,
    enum: [
      'personal_data',
      'financial_data', 
      'authentication_data',
      'communication_data',
      'behavioral_data',
      'technical_data',
      'other'
    ],
  }],
  discoveredAt: {
    type: Date,
    required: true,
  },
  reportedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  reportedBy: {
    type: String,
    required: true,
    maxlength: 100,
  },
  status: {
    type: String,
    required: true,
    enum: ['reported', 'investigating', 'resolved'],
    default: 'reported',
  },
  notificationDeadline: {
    type: Date,
    required: true,
  },
  authorityNotifiedAt: {
    type: Date,
  },
  resolutionNotes: {
    type: String,
    maxlength: 2000,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
BreachRecordSchema.index({ reportedAt: -1 });
BreachRecordSchema.index({ status: 1 });
BreachRecordSchema.index({ notificationDeadline: 1 });

export const BreachRecord = mongoose.model<IBreachRecord>('BreachRecord', BreachRecordSchema);