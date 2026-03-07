/**
 * Event Listener Service
 * 
 * Subscribes to system events and routes them to notification queue
 */

import { eventService, SystemEvent, EventPayload } from './EventService';
import { notificationQueue } from '../queue/NotificationQueue';
import { logger } from '../utils/logger';
import { recordEventEmitted } from '../config/notificationMetrics';

export class EventListenerService {
  /**
   * Initialize event listeners
   */
  initialize(): void {
    logger.info('Initializing event listeners');

    // Subscribe to all system events
    Object.values(SystemEvent).forEach((event) => {
      eventService.on(event, (payload: EventPayload) => {
        this.handleEvent(event, payload);
      });
    });

    logger.info('Event listeners initialized');
  }

  /**
   * Handle system event
   */
  private async handleEvent(event: SystemEvent, payload: EventPayload): Promise<void> {
    try {
      logger.debug(`Handling event: ${event}`, {
        workspaceId: payload.workspaceId.toString(),
        userId: payload.userId?.toString(),
      });

      // Record metric
      recordEventEmitted(event);

      // Add to notification queue
      await notificationQueue.addNotification({
        eventType: event,
        workspaceId: payload.workspaceId.toString(),
        userId: payload.userId?.toString(),
        payload: payload.data,
        timestamp: payload.timestamp,
      });
    } catch (error: any) {
      logger.error(`Failed to handle event: ${event}`, {
        error: error.message,
        workspaceId: payload.workspaceId.toString(),
      });
    }
  }

  /**
   * Shutdown event listeners
   */
  shutdown(): void {
    logger.info('Shutting down event listeners');
    eventService.removeAllListeners();
  }
}

export const eventListenerService = new EventListenerService();
