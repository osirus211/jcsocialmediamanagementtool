/**
 * Publisher Registry
 * 
 * Central registry for all platform publishers
 */

import { IPublisher } from './IPublisher';
import { logger } from '../../utils/logger';

export class PublisherNotFoundError extends Error {
  constructor(platform: string) {
    super(`Publisher not found for platform: ${platform}`);
    this.name = 'PublisherNotFoundError';
  }
}

export class PublisherRegistry {
  private publishers: Map<string, IPublisher> = new Map();

  /**
   * Register a publisher
   */
  register(platform: string, publisher: IPublisher): void {
    this.publishers.set(platform.toLowerCase(), publisher);
    logger.info('Publisher registered', { platform });
  }

  /**
   * Get publisher for platform
   */
  getPublisher(platform: string): IPublisher {
    const publisher = this.publishers.get(platform.toLowerCase());

    if (!publisher) {
      throw new PublisherNotFoundError(platform);
    }

    return publisher;
  }

  /**
   * Check if publisher exists
   */
  hasPublisher(platform: string): boolean {
    return this.publishers.has(platform.toLowerCase());
  }

  /**
   * Get all registered platforms
   */
  listPlatforms(): string[] {
    return Array.from(this.publishers.keys());
  }

  /**
   * Unregister a publisher
   */
  unregister(platform: string): void {
    this.publishers.delete(platform.toLowerCase());
    logger.info('Publisher unregistered', { platform });
  }
}
