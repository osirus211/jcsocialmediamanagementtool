/**
 * Webhook Provider Registry
 * 
 * Centralized registry for managing webhook providers
 */

import { IWebhookProvider } from './IWebhookProvider';
import { WebhookProviderNotFoundError } from '../../types/webhook.types';
import { logger } from '../../utils/logger';

export interface IWebhookProviderRegistry {
  register(name: string, provider: IWebhookProvider): void;
  getProvider(name: string): IWebhookProvider;
  hasProvider(name: string): boolean;
  listProviders(): string[];
}

export class WebhookProviderRegistry implements IWebhookProviderRegistry {
  private providers: Map<string, IWebhookProvider> = new Map();

  constructor() {
    // Providers will be registered manually after instantiation
    // to avoid circular dependencies
  }

  /**
   * Register a webhook provider
   */
  register(name: string, provider: IWebhookProvider): void {
    if (this.providers.has(name)) {
      throw new Error(`Provider ${name} already registered`);
    }
    this.providers.set(name, provider);
    logger.info('Webhook provider registered', { provider: name });
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): IWebhookProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new WebhookProviderNotFoundError(name);
    }
    return provider;
  }

  /**
   * Check if provider exists
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * List all registered providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
