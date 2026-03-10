import mongoose, { Schema, Document, Model } from 'mongoose';

export enum ReportFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
}

export enum ReportType {
  OVERVIEW = 'overview',
  POSTS = 'posts',
  HASHTAGS = 'hashtags',
  FOLLOWERS = 'followers',
  FULL = 'full',
}

export interface IScheduledReport extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  frequency: ReportFrequency;
  format: ReportFormat;
  reportType: ReportType;
  recipients: string[];
  platforms: string[];
  dateRange: number;
  lastSentAt?: Date;
  nextSendAt: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledReportSchema = new Schema<IScheduledReport>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  frequency: {
    type: String,
    enum: Object.values(ReportFrequency),
    required: true,
  },
  format: {
    type: String,
    enum: Object.values(ReportFormat),
    required: true,
  },
  reportType: {
    type: String,
    enum: Object.values(ReportType),
    required: true,
  },
  recipients: [{
    type: String,
    required: true,
    trim: true,
  }],
  platforms: [{
    type: String,
    trim: true,
  }],
  dateRange: {
    type: Number,
    default: 30,
    min: 1,
    max: 365,
  },
  lastSentAt: {
    type: Date,
  },
  nextSendAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound index for scheduler queries
ScheduledReportSchema.index({ nextSendAt: 1, isActive: 1 });

// Pre-save hook to calculate nextSendAt
ScheduledReportSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('frequency') || this.isModified('lastSentAt')) {
    this.nextSendAt = calculateNextSendAt(this.frequency, this.lastSentAt);
  }
  next();
});

function calculateNextSendAt(frequency: ReportFrequency, lastSentAt?: Date): Date {
  const now = new Date();
  const baseDate = lastSentAt || now;
  
  switch (frequency) {
    case ReportFrequency.DAILY:
      return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
    case ReportFrequency.WEEKLY:
      return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    case ReportFrequency.MONTHLY:
      const nextMonth = new Date(baseDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    default:
      return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  }
}

export const ScheduledReport: Model<IScheduledReport> = mongoose.model<IScheduledReport>(
  'ScheduledReport',
  ScheduledReportSchema
);