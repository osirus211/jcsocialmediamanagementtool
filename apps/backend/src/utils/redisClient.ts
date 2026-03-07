/**
 * Redis Client Utility
 * 
 * Centralized Redis client for distributed state management
 * 
 * Features:
 * - Connection pooling
 * - Automatic reconnection
 * - Error handling
 * - Health checks
 * - Graceful shutdown
 */

import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  /**
   * Get or create Redis client instance
   */
  getClient(): Redis {
    if (!this.client) {
      this.client = this.createClient();
    }
    return this.client;
  }

  /**
   * Create Redis client with configuration
   */
  private createClient(): Redis {
    const options: RedisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis connection retry', { attempt: times, delay });
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    const client = new Redis(options);

    // Connection event handlers
    client.on('connect', () => {
      logger.info('Redis client connecting', {
        host: config.redis.host,
        port: config.redis.port,
      });
    });

    client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    client.on('error', (error: Error) => {
      logger.error('Redis client error', {
        error: error.message,
        stack: error.stack,
      });
    });

    client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });

    client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    return client;
  }

  /**
   * Check if Redis is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error });
      return false;
    }
  }

  /**
   * Gracefully disconnect Redis client
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis client disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting Redis client', { error });
        // Force disconnect if graceful quit fails
        this.client.disconnect();
      }
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();
