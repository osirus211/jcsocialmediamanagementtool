import Docker from 'dockerode';
import { logger, logEvent } from './utils/logger';
import { config } from './config';
import { getRedisClient } from './utils/redisClient';

const docker = new Docker();

/**
 * Chaos Injection Modules
 */

export class ChaosInjector {
  private intervals: NodeJS.Timeout[] = [];
  private isRunning: boolean = false;

  /**
   * Start all chaos injection modules
   */
  async start(): Promise<void> {
    if (!config.chaosEnabled) {
      logger.info('Chaos injection disabled');
      return;
    }

    this.isRunning = true;
    logger.info('Starting chaos injection modules');

    // Start periodic chaos injections
    if (config.chaosKillWorkerInterval > 0) {
      this.intervals.push(
        setInterval(() => this.killWorkerRandomly(), config.chaosKillWorkerInterval)
      );
    }

    if (config.chaosRestartRedisInterval > 0) {
      this.intervals.push(
        setInterval(() => this.restartRedisContainer(), config.chaosRestartRedisInterval)
      );
    }

    logger.info('Chaos injection modules started');
  }

  /**
   * Stop all chaos injection
   */
  stop(): void {
    this.isRunning = false;
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    logger.info('Chaos injection modules stopped');
  }

  /**
   * Kill a random worker container
   */
  async killWorkerRandomly(): Promise<void> {
    try {
      const containers = await docker.listContainers({
        filters: {
          name: ['chaos-publishing-worker', 'chaos-refresh-worker'],
        },
      });

      if (containers.length === 0) {
        logger.warn('No worker containers found to kill');
        return;
      }

      const randomContainer = containers[Math.floor(Math.random() * containers.length)];
      const container = docker.getContainer(randomContainer.Id);

      logger.warn('CHAOS: Killing worker container', {
        containerId: randomContainer.Id.substring(0, 12),
        name: randomContainer.Names[0],
      });

      logEvent('chaos_kill_worker', {
        containerId: randomContainer.Id,
        name: randomContainer.Names[0],
      });

      await container.kill();

      // Container will restart automatically due to restart policy
    } catch (error: any) {
      logger.error('Failed to kill worker container', { error: error.message });
    }
  }

  /**
   * Restart Redis container
   */
  async restartRedisContainer(): Promise<void> {
    try {
      const containers = await docker.listContainers({
        filters: {
          name: ['chaos-redis'],
        },
      });

      if (containers.length === 0) {
        logger.warn('Redis container not found');
        return;
      }

      const container = docker.getContainer(containers[0].Id);

      logger.warn('CHAOS: Restarting Redis container');

      logEvent('chaos_restart_redis', {
        containerId: containers[0].Id,
      });

      await container.restart();

      // Wait for Redis to be ready
      await this.waitForRedis();
    } catch (error: any) {
      logger.error('Failed to restart Redis container', { error: error.message });
    }
  }

  /**
   * Wait for Redis to be ready
   */
  private async waitForRedis(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const client = await getRedisClient();
        await client.ping();
        logger.info('Redis is ready after restart');
        return;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Redis did not become ready after restart');
  }

  /**
   * Inject Redis delay (simulates slow Redis responses)
   */
  shouldInjectRedisDelay(): boolean {
    return config.chaosEnabled && Math.random() < config.chaosRedisDelayRate;
  }

  /**
   * Inject platform 429 error
   */
  shouldInjectPlatform429(): boolean {
    return config.chaosEnabled && Math.random() < config.chaosPlatform429Rate;
  }

  /**
   * Inject platform 500 error
   */
  shouldInjectPlatform500(): boolean {
    return config.chaosEnabled && Math.random() < config.chaosPlatform500Rate;
  }

  /**
   * Inject network timeout
   */
  shouldInjectNetworkTimeout(): boolean {
    return config.chaosEnabled && Math.random() < config.chaosNetworkTimeoutRate;
  }

  /**
   * Inject token corruption
   */
  shouldInjectTokenCorruption(): boolean {
    return config.chaosEnabled && Math.random() < config.chaosTokenCorruptionRate;
  }

  /**
   * Inject token revocation
   */
  shouldInjectTokenRevocation(): boolean {
    return config.chaosEnabled && Math.random() < config.chaosTokenRevocationRate;
  }

  /**
   * Inject worker crash
   */
  shouldInjectWorkerCrash(): boolean {
    return config.chaosEnabled && Math.random() < config.chaosWorkerCrashRate;
  }

  /**
   * Delay Redis response
   */
  async delayRedisResponse(delayMs: number = 1000): Promise<void> {
    if (this.shouldInjectRedisDelay()) {
      logger.debug('CHAOS: Injecting Redis delay', { delayMs });
      logEvent('chaos_redis_delay', { delayMs });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Inject platform error
   */
  injectPlatformError(): Error | null {
    if (this.shouldInjectPlatform429()) {
      logger.debug('CHAOS: Injecting 429 rate limit error');
      logEvent('chaos_platform_429');
      const error: any = new Error('Rate limit exceeded');
      error.statusCode = 429;
      error.retryable = true;
      return error;
    }

    if (this.shouldInjectPlatform500()) {
      logger.debug('CHAOS: Injecting 500 server error');
      logEvent('chaos_platform_500');
      const error: any = new Error('Internal server error');
      error.statusCode = 500;
      error.retryable = true;
      return error;
    }

    if (this.shouldInjectNetworkTimeout()) {
      logger.debug('CHAOS: Injecting network timeout');
      logEvent('chaos_network_timeout');
      const error: any = new Error('Network timeout');
      error.code = 'ETIMEDOUT';
      error.retryable = true;
      return error;
    }

    return null;
  }

  /**
   * Corrupt token
   */
  corruptToken(token: string): string {
    if (this.shouldInjectTokenCorruption()) {
      logger.debug('CHAOS: Corrupting token');
      logEvent('chaos_token_corruption');
      return token.substring(0, token.length - 10) + 'CORRUPTED';
    }
    return token;
  }

  /**
   * Force token revocation
   */
  forceTokenRevocation(): boolean {
    if (this.shouldInjectTokenRevocation()) {
      logger.debug('CHAOS: Forcing token revocation');
      logEvent('chaos_token_revocation');
      return true;
    }
    return false;
  }

  /**
   * Trigger worker crash
   */
  triggerWorkerCrash(): void {
    if (this.shouldInjectWorkerCrash()) {
      logger.warn('CHAOS: Triggering worker crash');
      logEvent('chaos_worker_crash');
      process.exit(1);
    }
  }
}

// Singleton instance
export const chaosInjector = new ChaosInjector();
