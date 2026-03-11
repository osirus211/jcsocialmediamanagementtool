/**
 * Webhook Retry Scheduler
 * 
 * Polls for pending webhook retries and processes them
 * Runs every 60 seconds to check for retries that are ready
 */

import { logger } from '../utils/logger';
import { WebhookDeliveryQueue } from '../queue/WebhookDeliveryQueue';

export class WebhookRetryScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly POLL_INTERVAL = 60000; // 60 seconds

  start(): void {
    if (this.isRunning) {
      logger.warn('Webhook retry scheduler already running');
      return;
    }

    this.isRunning = true;

    logger.info('Webhook retry scheduler started', {
      pollInterval: this.POLL_INTERVAL,
    });

    // Immediate execution
    this.poll();

    // Interval execution
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.POLL_INTERVAL);
  }

  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Webhook retry scheduler stopped');
  }

  private async poll(): Promise<void> {
    try {
      logger.debug('Webhook retry scheduler polling for pending retries');

      const queue = WebhookDeliveryQueue.getInstance();
      await queue.processPendingRetries();

      logger.debug('Webhook retry scheduler poll completed');
    } catch (error: any) {
      logger.error('Webhook retry scheduler poll error', {
        error: error.message,
      });
    }
  }

  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}

export const webhookRetryScheduler = new WebhookRetryScheduler();