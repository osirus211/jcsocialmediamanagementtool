import mongoose, { Document, Schema } from 'mongoose';

export interface IBlackoutDate extends Document {
  workspaceId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  reason: string;
  recurring: boolean;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number; // Every N days/weeks/months
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday) for weekly
    dayOfMonth?: number; // 1-31 for monthly
    customDates?: Date[]; // For custom patterns
    endRecurrence?: Date; // When to stop recurring
  };
  action: 'hold' | 'reschedule' | 'cancel';
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BlackoutDateSchema = new Schema<IBlackoutDate>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  endDate: {
    type: Date,
    required: true,
    index: true,
  },
  reason: {
    type: String,
    required: true,
    maxlength: 200,
  },
  recurring: {
    type: Boolean,
    default: false,
  },
  recurringPattern: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
    },
    interval: {
      type: Number,
      min: 1,
      max: 365,
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6,
    }],
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    customDates: [Date],
    endRecurrence: Date,
  },
  action: {
    type: String,
    enum: ['hold', 'reschedule', 'cancel'],
    default: 'hold',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
BlackoutDateSchema.index({ workspaceId: 1, startDate: 1, endDate: 1 });
BlackoutDateSchema.index({ workspaceId: 1, isActive: 1, startDate: 1 });

// Validation: endDate must be after startDate
BlackoutDateSchema.pre('validate', function(next) {
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  } else {
    next();
  }
});

// Validation: recurring pattern must be provided if recurring is true
BlackoutDateSchema.pre('validate', function(next) {
  if (this.recurring && !this.recurringPattern?.type) {
    next(new Error('Recurring pattern type is required when recurring is true'));
  } else {
    next();
  }
});

export const BlackoutDate = mongoose.model<IBlackoutDate>('BlackoutDate', BlackoutDateSchema);