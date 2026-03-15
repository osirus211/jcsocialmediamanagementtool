/**
 * Notification Queue
 * 
 * BullMQ queue for processing notifications
 */

import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { SystemEvent } from '../services/EventService';
import mongoose from 'mongoose';

export interface NotificationJob {
  eventType: SystemEvent;
  workspaceId: string;
  userId?: string;
  payload: Record<string, any>;
  timestamp: Date;
}

export class NotificationQueue {
  private queue: Queue<NotificationJob> | null = null;

  constructor() {
    // Don't initialize queue in constructor - do it lazily
  }

  /**
   * Get queue instance (lazy initialization)
   */
  private getQueue(): Queue<NotificationJob> {
    if (!this.queue) {
      this.queue = new Queue<NotificationJob>('notification-queue', {
        connection: getRedisClient() as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });
    }
    return this.queue;
  }

  /**
   * Add notification job to queue
   */
  async addNotification(job: NotificationJob): Promise<void> {
    const queue = this.getQueue();
    await queue.add('process-notification', job, {
      priority: this.getPriority(job.eventType),
    });
  }

  /**
   * Get priority based on event type
   */
  private getPriority(eventType: SystemEvent): number {
    // Lower number = higher priority
    const priorities: Partial<Record<SystemEvent, number>> = {
      [SystemEvent.POST_FAILED]: 1,
      [SystemEvent.PAYMENT_FAILED]: 1,
      [SystemEvent.CONNECTION_EXPIRED]: 1,
      [SystemEvent.SUBSCRIPTION_FAILED]: 1,
      [SystemEvent.LIMIT_REACHED]: 2,
      [SystemEvent.APPROVAL_REQUIRED]: 2,
      [SystemEvent.TRIAL_ENDING]: 3,
      [SystemEvent.POST_PUBLISHED]: 5,
      [SystemEvent.POST_APPROVED]: 5,
    };

    return priorities[eventType] || 10;
  }

  /**
   * Get queue instance
   */
  getQueueInstance(): Queue<NotificationJob> {
    return this.getQueue();
  }

  /**
   * Close queue
   */
  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }
}

export const notificationQueue = new NotificationQueue();
