/**
 * Webhook Types
 * 
 * Core type definitions for the webhook system
 */

import { IncomingHttpHeaders } from 'http';
import { Request, Response } from 'express';

/**
 * Raw webhook event extracted from platform payload
 */
export interface WebhookEvent {
  id: string;                    // Platform event ID
  type: string;                  // Platform event type
  timestamp: Date;               // Event timestamp
  data: any;                     // Platform-specific data
}

/**
 * Normalized webhook event (internal format)
 */
export interface NormalizedWebhookEvent {
  eventId: string;               // Unique event ID
  provider: string;              // Provider name
  eventType: WebhookEventType;   // Normalized event type
  timestamp: Date;               // Event timestamp
  accountId?: string;            // Social account ID (if applicable)
  userId?: string;               // User ID (if applicable)
  workspaceId?: string;          // Workspace ID (if applicable)
  data: {
    raw: any;                    // Original platform data
    normalized: any;             // Normalized data
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    receivedAt: Date;
    correlationId: string;
  };
}

/**
 * Normalized event types (internal)
 */
export enum WebhookEventType {
  TOKEN_REVOKED = 'token_revoked',
  TOKEN_EXPIRED = 'token_expired',
  PERMISSION_CHANGED = 'permission_changed',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
  ACCOUNT_DELETED = 'account_deleted',
  ACCOUNT_SUSPENDED = 'account_suspended',
  PROFILE_UPDATED = 'profile_updated',
  MEDIA_PUBLISHED = 'media_published',
  MEDIA_DELETED = 'media_deleted',
  COMMENT_RECEIVED = 'comment_received',
  MESSAGE_RECEIVED = 'message_received',
  UNKNOWN = 'unknown',
}

/**
 * Webhook ingest job (Stage 1)
 */
export interface WebhookIngestJob {
  eventId: string;
  provider: string;
  rawEvent: WebhookEvent;
  normalizedEvent: NormalizedWebhookEvent;
  metadata: {
    receivedAt: Date;
    correlationId: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Webhook processing job (Stage 2)
 */
export interface WebhookProcessingJob {
  eventId: string;
  provider: string;
  normalizedEvent: NormalizedWebhookEvent;
}

/**
 * Webhook signature error
 */
export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/**
 * Webhook payload error
 */
export class WebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookPayloadError';
  }
}

/**
 * Webhook provider not found error
 */
export class WebhookProviderNotFoundError extends Error {
  constructor(provider: string) {
    super(`Webhook provider not found: ${provider}`);
    this.name = 'WebhookProviderNotFoundError';
  }
}
