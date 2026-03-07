/**
 * Threads Webhook Provider
 * NOTE: Threads webhooks use Facebook's infrastructure
 * Placeholder - full implementation in Phase 3
 */

import { FacebookWebhookProvider } from './FacebookWebhookProvider';

export class ThreadsWebhookProvider extends FacebookWebhookProvider {
  readonly name = 'threads';
}
