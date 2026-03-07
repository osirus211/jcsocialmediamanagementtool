/**
 * Notification Metrics Configuration
 * 
 * Prometheus metrics for notification system
 */

import { Counter, Histogram, Gauge, register } from 'prom-client';

// Notification metrics
export const notificationsSentCounter = new Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['event_type', 'channel'],
  registers: [register],
});

export const notificationsFailedCounter = new Counter({
  name: 'notifications_failed_total',
  help: 'Total number of failed notifications',
  labelNames: ['event_type', 'channel', 'error_type'],
  registers: [register],
});

export const notificationLatencyHistogram = new Histogram({
  name: 'notification_latency_seconds',
  help: 'Notification processing latency',
  labelNames: ['event_type', 'channel'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const unreadNotificationsGauge = new Gauge({
  name: 'unread_notifications_total',
  help: 'Total number of unread notifications',
  labelNames: ['user_id'],
  registers: [register],
});

// Email metrics
export const emailsSentCounter = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['event_type'],
  registers: [register],
});

export const emailsFailedCounter = new Counter({
  name: 'emails_failed_total',
  help: 'Total number of failed emails',
  labelNames: ['event_type', 'error_type'],
  registers: [register],
});

export const emailLatencyHistogram = new Histogram({
  name: 'email_latency_seconds',
  help: 'Email sending latency',
  labelNames: ['event_type'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Webhook metrics
export const webhooksSentCounter = new Counter({
  name: 'webhooks_sent_total',
  help: 'Total number of webhooks sent',
  labelNames: ['event_type', 'workspace_id'],
  registers: [register],
});

export const webhooksFailedCounter = new Counter({
  name: 'webhooks_failed_total',
  help: 'Total number of failed webhooks',
  labelNames: ['event_type', 'workspace_id', 'error_type'],
  registers: [register],
});

export const webhookLatencyHistogram = new Histogram({
  name: 'webhook_latency_seconds',
  help: 'Webhook sending latency',
  labelNames: ['event_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Event bus metrics
export const eventsEmittedCounter = new Counter({
  name: 'events_emitted_total',
  help: 'Total number of events emitted',
  labelNames: ['event_type'],
  registers: [register],
});

export const eventListenersGauge = new Gauge({
  name: 'event_listeners_total',
  help: 'Total number of event listeners',
  labelNames: ['event_type'],
  registers: [register],
});

// Queue metrics
export const notificationQueueSizeGauge = new Gauge({
  name: 'notification_queue_size',
  help: 'Number of jobs in notification queue',
  labelNames: ['status'],
  registers: [register],
});

export const notificationQueueProcessingDuration = new Histogram({
  name: 'notification_queue_processing_duration_seconds',
  help: 'Duration of notification queue job processing',
  labelNames: ['event_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

/**
 * Helper functions to record metrics
 */

export function recordNotificationSent(eventType: string, channel: string = 'in-app'): void {
  notificationsSentCounter.inc({ event_type: eventType, channel });
}

export function recordNotificationFailed(
  eventType: string,
  channel: string = 'in-app',
  errorType: string = 'unknown'
): void {
  notificationsFailedCounter.inc({ event_type: eventType, channel, error_type: errorType });
}

export function recordNotificationLatency(
  eventType: string,
  durationSeconds: number,
  channel: string = 'in-app'
): void {
  notificationLatencyHistogram.observe({ event_type: eventType, channel }, durationSeconds);
}

export function updateUnreadNotifications(userId: string, count: number): void {
  unreadNotificationsGauge.set({ user_id: userId }, count);
}

export function recordEmailSent(eventType: string): void {
  emailsSentCounter.inc({ event_type: eventType });
}

export function recordEmailFailed(eventType: string, errorType: string = 'unknown'): void {
  emailsFailedCounter.inc({ event_type: eventType, error_type: errorType });
}

export function recordEmailLatency(eventType: string, durationSeconds: number): void {
  emailLatencyHistogram.observe({ event_type: eventType }, durationSeconds);
}

export function recordWebhookSent(eventType: string, workspaceId: string): void {
  webhooksSentCounter.inc({ event_type: eventType, workspace_id: workspaceId });
}

export function recordWebhookFailed(
  eventType: string,
  workspaceId: string,
  errorType: string = 'unknown'
): void {
  webhooksFailedCounter.inc({ event_type: eventType, workspace_id: workspaceId, error_type: errorType });
}

export function recordWebhookLatency(eventType: string, durationSeconds: number): void {
  webhookLatencyHistogram.observe({ event_type: eventType }, durationSeconds);
}

export function recordEventEmitted(eventType: string): void {
  eventsEmittedCounter.inc({ event_type: eventType });
}

export function updateEventListeners(eventType: string, count: number): void {
  eventListenersGauge.set({ event_type: eventType }, count);
}

export function updateNotificationQueueSize(status: string, size: number): void {
  notificationQueueSizeGauge.set({ status }, size);
}

export function recordNotificationQueueProcessing(eventType: string, durationSeconds: number): void {
  notificationQueueProcessingDuration.observe({ event_type: eventType }, durationSeconds);
}
