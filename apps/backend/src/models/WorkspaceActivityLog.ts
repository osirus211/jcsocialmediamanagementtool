/**
 * Workspace Activity Log Model
 * 
 * Tracks all actions performed in a workspace for audit trail
 */

import mongoose, { Schema, Document } from 'mongoose';

export enum ActivityAction {
  // Post actions
  POST_CREATED = 'post_created',
  POST_UPDATED = 'post_updated',
  POST_DELETED = 'post_deleted',
  POST_SUBMITTED_FOR_APPROVAL = 'post_submitted_for_approval',
  POST_APPROVED = 'post_approved',
  POST_REJECTED = 'post_rejected',
  POST_PUBLISHED = 'post_published',
  POST_FAILED = 'post_failed',
  
  // Member actions
  MEMBER_INVITED = 'member_invited',
  MEMBER_JOINED = 'member_joined',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  
  // Social account actions
  ACCOUNT_CONNECTED = 'account_connected',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
  ACCOUNT_RECONNECTED = 'account_reconnected',
  
  // Workspace actions
  WORKSPACE_CREATED = 'workspace_created',
  WORKSPACE_UPDATED = 'workspace_updated',
  WORKSPACE_DELETED = 'workspace_deleted',
  WORKSPACE_PLAN_CHANGED = 'workspace_plan_changed',
  
  // Media actions
  MEDIA_UPLOADED = 'media_uploaded',
  MEDIA_DELETED = 'media_deleted',
  
  // Template actions
  TEMPLATE_CREATED = 'template_created',
  TEMPLATE_DELETED = 'template_deleted',
  
  // Caption actions
  CAPTION_SAVED = 'caption_saved',
  
  // Draft actions
  DRAFT_CREATED = 'draft_created',
  DRAFT_PUBLISHED = 'draft_published',
  
  // Security actions
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_CHANGED = 'password_changed',
  TWO_FACTOR_ENABLED = 'two_factor_enabled',
  TWO_FACTOR_DISABLED = 'two_factor_disabled',
  
  // Billing actions
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  CHECKOUT_STARTED = 'checkout_started',
  PORTAL_ACCESSED = 'portal_accessed',
  TRIAL_STARTED = 'trial_started',
  TRIAL_EXPIRED = 'trial_expired',
  PLAN_UPGRADED = 'plan_upgraded',
  PLAN_DOWNGRADED = 'plan_downgraded',
  
  // API actions
  API_KEY_CREATED = 'api_key_created',
  API_KEY_DELETED = 'api_key_deleted',
  API_KEY_ROTATED = 'api_key_rotated',
  API_KEY_REVOKED = 'api_key_revoked',
  PUBLIC_API_ACCESSED = 'public_api_accessed',
  ZAPIER_CONNECTED = 'zapier_connected',
  ZAPIER_DISCONNECTED = 'zapier_disconnected',
  MAKE_CONNECTED = 'make_connected',
  MAKE_DISCONNECTED = 'make_disconnected',
  INTEGRATION_WEBHOOK_REGISTERED = 'integration_webhook_registered',
  WEBHOOK_CREATED = 'webhook_created',
  WEBHOOK_DELETED = 'webhook_deleted',
  WEBHOOK_DELIVERY_FAILED = 'webhook_delivery_failed',
  
  // Queue actions
  QUEUE_PAUSED = 'queue_paused',
  QUEUE_RESUMED = 'queue_resumed',
  POST_SCHEDULED = 'post_scheduled',
  POST_UNSCHEDULED = 'post_unscheduled',
  BULK_POSTS_SCHEDULED = 'bulk_posts_scheduled',
  
  // Evergreen actions
  EVERGREEN_RULE_CREATED = 'evergreen_rule_created',
  EVERGREEN_RULE_DELETED = 'evergreen_rule_deleted',
  
  // Blackout date actions
  BLACKOUT_DATE_CREATED = 'blackout_date_created',
  BLACKOUT_DATE_DELETED = 'blackout_date_deleted',
  
  // RSS feed actions
  RSS_FEED_CREATED = 'rss_feed_created',
  RSS_FEED_DELETED = 'rss_feed_deleted',
  
  // Inbox actions
  INBOX_ACCESSED = 'inbox_accessed',
  MENTION_READ = 'mention_read',
  LISTENING_RULE_CREATED = 'listening_rule_created',
  LISTENING_RULE_DELETED = 'listening_rule_deleted',
  COMMENT_CREATED = 'comment_created',
  COMMENT_DELETED = 'comment_deleted',
  COMMENT_RESOLVED = 'comment_resolved',
  REPLY_SENT = 'reply_sent',
  MENTION_REPLIED = 'mention_replied',
  
  // Analytics actions
  ANALYTICS_EXPORTED = 'analytics_exported',
  REPORT_CREATED = 'report_created',
  REPORT_DELETED = 'report_deleted',
  REPORT_SENT = 'report_sent',
  COMPETITOR_ADDED = 'competitor_added',
  COMPETITOR_REMOVED = 'competitor_removed',
  GOOGLE_ANALYTICS_CONNECTED = 'google_analytics_connected',
  GOOGLE_ANALYTICS_DISCONNECTED = 'google_analytics_disconnected',
  
  // Notification actions
  NOTIFICATION_SENT = 'notification_sent',
  NOTIFICATION_READ = 'notification_read',
  EMAIL_SENT = 'email_sent',
  EMAIL_BOUNCED = 'email_bounced',
  PUSH_NOTIFICATION_SENT = 'push_notification_sent',
  
  // AI actions
  AI_CAPTION_GENERATED = 'ai_caption_generated',
  AI_IMAGE_GENERATED = 'ai_image_generated',
  AI_CONTENT_REPURPOSED = 'ai_content_repurposed',
  AI_TRANSLATION_GENERATED = 'ai_translation_generated',
  AI_HASHTAGS_SUGGESTED = 'ai_hashtags_suggested',
  AI_TONE_REWRITTEN = 'ai_tone_rewritten',
  AI_MODERATION_FLAGGED = 'ai_moderation_flagged',
}

export interface IWorkspaceActivityLog extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  action: ActivityAction;
  
  // Resource details
  resourceType?: string;
  resourceId?: mongoose.Types.ObjectId;
  
  // Action details
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  
  // IP and user agent for security
  ipAddress?: string;
  userAgent?: string;
  
  createdAt: Date;
}

const WorkspaceActivityLogSchema = new Schema<IWorkspaceActivityLog>(
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
      required: false,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(ActivityAction),
      required: true,
      index: true,
    },
    
    // Resource details
    resourceType: {
      type: String,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
    },
    
    // Action details
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    // Security
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes
WorkspaceActivityLogSchema.index({ workspaceId: 1, createdAt: -1 });
WorkspaceActivityLogSchema.index({ workspaceId: 1, action: 1, createdAt: -1 });
WorkspaceActivityLogSchema.index({ userId: 1, createdAt: -1 });
WorkspaceActivityLogSchema.index({ resourceType: 1, resourceId: 1 });

// TTL index - automatically delete logs older than 90 days
WorkspaceActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const WorkspaceActivityLog = mongoose.model<IWorkspaceActivityLog>(
  'WorkspaceActivityLog',
  WorkspaceActivityLogSchema
);
