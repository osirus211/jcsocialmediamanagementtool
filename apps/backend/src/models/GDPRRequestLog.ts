import mongoose, { Schema, Document } from 'mongoose';

export enum GDPRRequestType {
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',
  DATA_ACCESS = 'data_access',
  DATA_RECTIFICATION = 'data_rectification',
  CONSENT_WITHDRAWAL = 'consent_withdrawal',
}

export enum GDPRRequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface IGDPRRequestLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  requestType: GDPRRequestType;
  status: GDPRRequestStatus;
  requestedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  requestData?: any; // Additional request-specific data
  responseData?: any; // Response or result data
  ipAddress?: string;
  userAgent?: string;
  processingNotes?: string;
  retentionUntil?: Date; // For deletion requests - when data will be permanently deleted
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  markInProgress(notes?: string): Promise<IGDPRRequestLog>;
  markCompleted(responseData?: any): Promise<IGDPRRequestLog>;
  markFailed(reason: string): Promise<IGDPRRequestLog>;
}

// Static methods interface
interface IGDPRRequestLogModel extends mongoose.Model<IGDPRRequestLog> {
  findPendingDeletions(): Promise<IGDPRRequestLog[]>;
  findUserRequests(userId: string): Promise<IGDPRRequestLog[]>;
}

const GDPRRequestLogSchema = new Schema<IGDPRRequestLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: Object.values(GDPRRequestType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(GDPRRequestStatus),
      required: true,
      default: GDPRRequestStatus.PENDING,
      index: true,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    requestData: {
      type: Schema.Types.Mixed,
      default: null,
    },
    responseData: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    processingNotes: {
      type: String,
      default: null,
    },
    retentionUntil: {
      type: Date,
      default: null,
      index: true, // For scheduled deletion queries
    },
  },
  {
    timestamps: true,
    collection: 'gdpr_request_logs',
  }
);

// Compound indexes for efficient queries
GDPRRequestLogSchema.index({ userId: 1, requestType: 1 });
GDPRRequestLogSchema.index({ status: 1, requestedAt: -1 });
GDPRRequestLogSchema.index({ retentionUntil: 1, status: 1 }); // For cleanup jobs

// Instance methods
GDPRRequestLogSchema.methods.markInProgress = function(notes?: string) {
  this.status = GDPRRequestStatus.IN_PROGRESS;
  if (notes) this.processingNotes = notes;
  return this.save();
};

GDPRRequestLogSchema.methods.markCompleted = function(responseData?: any) {
  this.status = GDPRRequestStatus.COMPLETED;
  this.completedAt = new Date();
  if (responseData) this.responseData = responseData;
  return this.save();
};

GDPRRequestLogSchema.methods.markFailed = function(reason: string) {
  this.status = GDPRRequestStatus.FAILED;
  this.failedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

// Static methods
GDPRRequestLogSchema.statics.findPendingDeletions = function() {
  return this.find({
    requestType: GDPRRequestType.DATA_DELETION,
    status: GDPRRequestStatus.COMPLETED,
    retentionUntil: { $lte: new Date() },
  });
};

GDPRRequestLogSchema.statics.findUserRequests = function(userId: string) {
  return this.find({ userId }).sort({ requestedAt: -1 });
};

export const GDPRRequestLog = mongoose.model<IGDPRRequestLog, IGDPRRequestLogModel>('GDPRRequestLog', GDPRRequestLogSchema);