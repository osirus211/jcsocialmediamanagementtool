/**
 * Event Service
 * 
 * Central event bus for emitting and handling system events
 */

import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export enum SystemEvent {
  // Post events
  POST_PUBLISHED = 'post_published',
  POST_FAILED = 'post_failed',
  POST_SCHEDULED = 'post_scheduled',
  
  // Approval events
  APPROVAL_REQUIRED = 'approval_required',
  POST_APPROVED = 'post_approved',
  POST_REJECTED = 'post_rejected',
  
  // Connection events
  CONNECTION_EXPIRED = 'connection_expired',
  CONNECTION_DEGRADED = 'connection_degraded',
  CONNECTION_RECOVERED = 'connection_recovered',
  CONNECTION_DISCONNECTED = 'connection_disconnected',
  
  // Subscription events
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_FAILED = 'subscription_failed',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  TRIAL_ENDING = 'trial_ending',
  PAYMENT_FAILED = 'payment_failed',
  
  // Limit events
  LIMIT_REACHED = 'limit_reached',
  LIMIT_WARNING = 'limit_warning', // 80% of limit
  
  // Team events
  MEMBER_INVITED = 'member_invited',
  MEMBER_JOINED = 'member_joined',
  MEMBER_REMOVED = 'member_removed',
  
  // Media events
  MEDIA_PROCESSED = 'media_processed',
  MEDIA_FAILED = 'media_failed',
  
  // Analytics events
  ANALYTICS_READY = 'analytics_ready',
  
  // Comment events
  COMMENT_ADDED = 'comment_added',
  MENTION_IN_COMMENT = 'mention_in_comment',
}

export interface EventPayload {
  workspaceId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  data: Record<string, any>;
  timestamp: Date;
}

class EventService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Increase max listeners for multiple handlers
  }

  /**
   * Emit a system event
   */
  emit(event: SystemEvent, payload: EventPayload): boolean {
    logger.debug(`Event emitted: ${event}`, {
      workspaceId: payload.workspaceId.toString(),
      userId: payload.userId?.toString(),
    });

    return super.emit(event, payload);
  }

  /**
   * Subscribe to an event
   */
  on(event: SystemEvent, listener: (payload: EventPayload) => void): this {
    return super.on(event, listener);
  }

  /**
   * Subscribe to an event once
   */
  once(event: SystemEvent, listener: (payload: EventPayload) => void): this {
    return super.once(event, listener);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: SystemEvent, listener: (payload: EventPayload) => void): this {
    return super.off(event, listener);
  }

  /**
   * Emit post published event
   */
  emitPostPublished(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    postId: string;
    platform: string;
    platformPostId: string;
  }): void {
    this.emit(SystemEvent.POST_PUBLISHED, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        postId: params.postId,
        platform: params.platform,
        platformPostId: params.platformPostId,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit post failed event
   */
  emitPostFailed(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    postId: string;
    platform: string;
    error: string;
  }): void {
    this.emit(SystemEvent.POST_FAILED, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        postId: params.postId,
        platform: params.platform,
        error: params.error,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit approval required event
   */
  emitApprovalRequired(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    postId: string;
    content: string;
  }): void {
    this.emit(SystemEvent.APPROVAL_REQUIRED, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        postId: params.postId,
        content: params.content,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit connection expired event
   */
  emitConnectionExpired(params: {
    workspaceId: mongoose.Types.ObjectId;
    accountId: string;
    platform: string;
  }): void {
    this.emit(SystemEvent.CONNECTION_EXPIRED, {
      workspaceId: params.workspaceId,
      data: {
        accountId: params.accountId,
        platform: params.platform,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit subscription failed event
   */
  emitSubscriptionFailed(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    reason: string;
    amount: number;
  }): void {
    this.emit(SystemEvent.SUBSCRIPTION_FAILED, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        reason: params.reason,
        amount: params.amount,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit limit reached event
   */
  emitLimitReached(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId;
    limitType: string;
    current: number;
    limit: number;
  }): void {
    this.emit(SystemEvent.LIMIT_REACHED, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        limitType: params.limitType,
        current: params.current,
        limit: params.limit,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit limit warning event (80% of limit)
   */
  emitLimitWarning(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId;
    limitType: string;
    current: number;
    limit: number;
    percentage: number;
  }): void {
    this.emit(SystemEvent.LIMIT_WARNING, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        limitType: params.limitType,
        current: params.current,
        limit: params.limit,
        percentage: params.percentage,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit payment failed event
   */
  emitPaymentFailed(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    amount: number;
    reason: string;
  }): void {
    this.emit(SystemEvent.PAYMENT_FAILED, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        amount: params.amount,
        reason: params.reason,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit trial ending event
   */
  emitTrialEnding(params: {
    workspaceId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    daysRemaining: number;
  }): void {
    this.emit(SystemEvent.TRIAL_ENDING, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      data: {
        daysRemaining: params.daysRemaining,
      },
      timestamp: new Date(),
    });
  }
}

// Singleton instance
export const eventService = new EventService();
