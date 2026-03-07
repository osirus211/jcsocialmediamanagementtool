/**
 * Webhook Provider Interface
 * 
 * All webhook providers must implement this interface to ensure
 * consistent behavior across different platforms.
 */

import { IncomingHttpHeaders } from 'http';
import { Request, Response } from 'express';
import { WebhookEvent, NormalizedWebhookEvent } from '../../types/webhook.types';
import { WebhookVerificationCache } from '../../services/WebhookVerificationCache';

export interface IWebhookProvider {
  /**
   * Provider name (e.g., 'facebook', 'linkedin', 'twitter')
   */
  readonly name: string;

  /**
   * Verify webhook signature
   * 
   * @param headers - Request headers containing signature
   * @param rawBody - Raw request body (Buffer)
   * @param cache - Optional verification cache
   * @returns true if signature is valid, false otherwise
   * @throws WebhookSignatureError if signature is invalid
   */
  verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer,
    cache?: WebhookVerificationCache
  ): Promise<boolean>;

  /**
   * Extract event from webhook payload
   * 
   * @param payload - Parsed webhook payload
   * @returns Extracted event with id, type, and data
   * @throws WebhookPayloadError if payload is invalid
   */
  extractEvent(payload: any): Promise<WebhookEvent>;

  /**
   * Normalize event to standard format
   * 
   * Converts platform-specific event format to our internal format
   * 
   * @param event - Raw webhook event
   * @returns Normalized event
   */
  normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent>;

  /**
   * Extract resource ID from event (for ordering protection)
   * 
   * @param event - Raw webhook event
   * @returns Resource ID (user ID, account ID, etc.)
   */
  extractResourceId?(event: WebhookEvent): string | undefined;

  /**
   * Handle platform-specific challenges (e.g., Twitter CRC)
   * 
   * @param req - Express request
   * @param res - Express response
   * @returns true if challenge was handled, false otherwise
   */
  handleChallenge?(req: Request, res: Response): Promise<boolean>;
}
