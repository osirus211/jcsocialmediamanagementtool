/**
 * Notification Model
 * 
 * Stores in-app notifications for users
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum NotificationType {
  // Post notifications
  POST_PUBLISHED = 'post_published',
  POST_FAILED = 'post_failed',
  POST_SCHEDULED = 'post_scheduled',
  
  // Approval notifications
  APPROVAL_REQUIRED = 'approval_required',
  POST_APPROVED = 'post_approved',
  POST_REJECTED = 'post_rejected',
  
  // Connection notifications
  CONNECTION_EXPIRED = 'connection_expired',
  CONNECTION_DEGRADED = 'connection_degraded',
  CONNECTION_RECOVERED = 'connection_recovered',
  
  // Subscription notifications
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_FAILED = 'subscription_failed',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  TRIAL_ENDING = 'trial_ending',
  PAYMENT_FAILED = 'payment_failed',
  
  // Limit notifications
  LIMIT_REACHED = 'limit_reached',
  LIMIT_WARNING = 'limit_warning',
  
  // Team notifications
  MEMBER_INVITED = 'member_invited',
  MEMBER_JOINED = 'member_joined',
  MEMBER_REMOVED = 'member_removed',
  
  // Media notifications
  MEDIA_PROCESSED = 'media_processed',
  MEDIA_FAILED = 'media_failed',
  
  // Analytics notifications
  ANALYTICS_READY = 'analytics_ready',
  
  // System notifications
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  
  // Comment notifications
  COMMENT_ADDED = 'comment_added',
  MENTION_IN_COMMENT = 'mention_in_comment',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  
  // Notification details
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  
  // Additional data
  data?: Record<string, any>;
  
  // Action
  actionUrl?: string;
  actionText?: string;
  
  // Status
  read: boolean;
  readAt?: Date;
  
  // Expiration
  expiresAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Notification details
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.MEDIUM,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    
    // Additional data
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    // Action
    actionUrl: {
      type: String,
    },
    actionText: {
      type: String,
      maxlength: 50,
    },
    
    // Status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    
    // Expiration
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ workspaceId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, priority: 1, read: 1 });

// TTL index for expired notifications
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark as read
NotificationSchema.methods.markAsRead = function (): Promise<INotification> {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
