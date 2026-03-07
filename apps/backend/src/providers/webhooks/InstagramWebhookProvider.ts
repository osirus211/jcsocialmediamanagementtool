/**
 * Instagram Webhook Provider
 * NOTE: Instagram webhooks use Facebook's infrastructure
 * Placeholder - full implementation in Phase 3
 */

import { FacebookWebhookProvider } from './FacebookWebhookProvider';

export class InstagramWebhookProvider extends FacebookWebhookProvider {
  readonly name = 'instagram';
}
