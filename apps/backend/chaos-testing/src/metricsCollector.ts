import express from 'express';
import { MongoClient, Db } from 'mongodb';
import { logger, logMetric } from './utils/logger';
import { getRedisClient } from './utils/redisClient';
import { config } from './config';
import { duplicateDetector } from './duplicateDetector';
import { refreshStormValidator } from './refreshStormValidator';
import { rateLimitValidator } from './rateLimitValidator';

/**
 * Metrics Collector
 * 
 * Collects and exposes metrics from:
 * - MongoDB (posts, accounts, queue stats)
 * - Redis (counters, locks, rate limits)
 * - System (memory, CPU)
 * - Validators (duplicates, refresh storm, rate limits)
 */

export class MetricsCollector {
  private app: express.Application;
  private db: Db | null = null;
  private baselineMemory: number = 0;
  private metrics: any = {};
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.collectMetrics();
        res.json(metrics);
      } catch (error: any) {
        logger.error('Failed to collect metrics', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/metrics/summary', async (req, res) => {
      try {
        const summary = await this.getSummary();
        res.json(summary);
      } catch (error: any) {
        logger.error('Failed to get summary', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Start metrics collector
   */
  async start(): Promise<void> {
    // Connect to MongoDB
    const client = await MongoClient.connect(config.mongodbUri);
    this.db = client.db();
    logger.info('MetricsCollector connected to MongoDB');

    // Connect to Redis
    await getRedisClient();
    logger.info('MetricsCollector connected to Redis');

    // Record baseline memory
    this.baselineMemory = process.memoryUsage().heapUsed;

    // Start periodic collection
    this.intervalId = setInterval(() => {
      this.collectAndLogMetrics();
    }, config.metricsInterval);

    // Start Express server
    this.app.listen(config.metricsPort, () => {
      logger.info(`MetricsCollector listening on port ${config.metricsPort}`);
    });
  }

  /**
   * Stop metrics collector
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Collect all metrics
   */
  private async collectMetrics(): Promise<any> {
    const [
      publishMetrics,
      refreshMetrics,
      queueMetrics,
      systemMetrics,
      validatorMetrics,
    ] = await Promise.all([
      this.collectPublishMetrics(),
      this.collectRefreshMetrics(),
      this.collectQueueMetrics(),
      this.collectSystemMetrics(),
      this.collectValidatorMetrics(),
    ]);

    this.metrics = {
      timestamp: new Date().toISOString(),
      publish: publishMetrics,
      refresh: refreshMetrics,
      queue: queueMetrics,
      system: systemMetrics,
      validators: validatorMetrics,
    };

    return this.metrics;
  }

  /**
   * Collect publish metrics
   */
  private async collectPublishMetrics(): Promise<any> {
    if (!this.db) return {};

    const [total, successful, failed, publishing, scheduled] = await Promise.all([
      this.db.collection('posts').countDocuments(),
      this.db.collection('posts').countDocuments({ status: 'published' }),
      this.db.collection('posts').countDocuments({ status: 'failed' }),
      this.db.collection('posts').countDocuments({ status: 'publishing' }),
      this.db.collection('posts').countDocuments({ status: 'scheduled' }),
    ]);

    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      publishing,
      scheduled,
      successRate: successRate.toFixed(2),
    };
  }

  /**
   * Collect refresh metrics
   */
  private async collectRefreshMetrics(): Promise<any> {
    const redis = await getRedisClient();
    
    // Get refresh counters from Redis
    const keys = await redis.keys('chaos:refresh:*');
    const refreshAttempts = keys.length;

    return {
      attempts: refreshAttempts,
      ...refreshStormValidator.getStatistics(),
    };
  }

  /**
   * Collect queue metrics
   */
  private async collectQueueMetrics(): Promise<any> {
    const redis = await getRedisClient();

    // Get BullMQ queue stats
    const [waitingCount, activeCount, completedCount, failedCount, delayedCount] = await Promise.all([
      redis.lLen('bull:posting-queue:wait'),
      redis.lLen('bull:posting-queue:active'),
      redis.zCard('bull:posting-queue:completed'),
      redis.zCard('bull:posting-queue:failed'),
      redis.zCard('bull:posting-queue:delayed'),
    ]);

    const total = waitingCount + activeCount + completedCount + failedCount + delayedCount;

    // Calculate queue lag (time between job creation and processing)
    const queueLag = await this.calculateQueueLag();

    return {
      waiting: waitingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      total,
      lag: queueLag,
    };
  }

  /**
   * Calculate queue lag
   */
  private async calculateQueueLag(): Promise<any> {
    const redis = await getRedisClient();
    
    // Get oldest waiting job
    const waitingJobs = await redis.lRange('bull:posting-queue:wait', 0, 0);
    
    if (waitingJobs.length === 0) {
      return { avg: 0, max: 0 };
    }

    try {
      const job = JSON.parse(waitingJobs[0]);
      const lag = Date.now() - job.timestamp;
      
      return {
        avg: lag,
        max: lag,
      };
    } catch (error) {
      return { avg: 0, max: 0 };
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<any> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const memoryGrowth = this.baselineMemory > 0 
      ? memUsage.heapUsed / this.baselineMemory 
      : 1;

    return {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        baseline: Math.round(this.baselineMemory / 1024 / 1024), // MB
        growth: memoryGrowth.toFixed(2),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: Math.floor(process.uptime()),
    };
  }

  /**
   * Collect validator metrics
   */
  private async collectValidatorMetrics(): Promise<any> {
    return {
      duplicates: await duplicateDetector.getStatistics(),
      refreshStorm: refreshStormValidator.getStatistics(),
      rateLimit: await rateLimitValidator.getStatistics(),
    };
  }

  /**
   * Collect and log metrics
   */
  private async collectAndLogMetrics(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();

      // Log key metrics
      logMetric('publish_total', metrics.publish.total);
      logMetric('publish_successful', metrics.publish.successful);
      logMetric('publish_failed', metrics.publish.failed);
      logMetric('publish_success_rate', parseFloat(metrics.publish.successRate));
      
      logMetric('queue_waiting', metrics.queue.waiting);
      logMetric('queue_active', metrics.queue.active);
      logMetric('queue_lag_avg', metrics.queue.lag.avg);
      logMetric('queue_lag_max', metrics.queue.lag.max);
      
      logMetric('memory_heap_used', metrics.system.memory.heapUsed);
      logMetric('memory_growth', parseFloat(metrics.system.memory.growth));
      
      logMetric('duplicates_detected', metrics.validators.duplicates.duplicatesDetected);
      logMetric('refresh_peak_rate', metrics.validators.refreshStorm.peakRefreshRate);
      logMetric('rate_limit_hits', metrics.validators.rateLimit.rateLimitHits);

      // Console summary every 60 seconds
      if (Math.floor(Date.now() / 1000) % 60 === 0) {
        this.printConsoleSummary(metrics);
      }
    } catch (error: any) {
      logger.error('Failed to collect metrics', { error: error.message });
    }
  }

  /**
   * Print console summary
   */
  private printConsoleSummary(metrics: any): void {
    console.log('\n' + '='.repeat(80));
    console.log('CHAOS TEST METRICS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${metrics.timestamp}`);
    console.log('\nPUBLISH METRICS:');
    console.log(`  Total: ${metrics.publish.total}`);
    console.log(`  Successful: ${metrics.publish.successful}`);
    console.log(`  Failed: ${metrics.publish.failed}`);
    console.log(`  Success Rate: ${metrics.publish.successRate}%`);
    console.log('\nQUEUE METRICS:');
    console.log(`  Waiting: ${metrics.queue.waiting}`);
    console.log(`  Active: ${metrics.queue.active}`);
    console.log(`  Completed: ${metrics.queue.completed}`);
    console.log(`  Failed: ${metrics.queue.failed}`);
    console.log(`  Lag (avg): ${metrics.queue.lag.avg}ms`);
    console.log('\nSYSTEM METRICS:');
    console.log(`  Memory Used: ${metrics.system.memory.heapUsed}MB`);
    console.log(`  Memory Growth: ${metrics.system.memory.growth}x`);
    console.log(`  Uptime: ${metrics.system.uptime}s`);
    console.log('\nVALIDATOR METRICS:');
    console.log(`  Duplicates Detected: ${metrics.validators.duplicates.duplicatesDetected}`);
    console.log(`  Peak Refresh Rate: ${metrics.validators.refreshStorm.peakRefreshRate}/s`);
    console.log(`  Rate Limit Hits: ${metrics.validators.rateLimit.rateLimitHits}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Get summary
   */
  private async getSummary(): Promise<any> {
    const metrics = await this.collectMetrics();

    return {
      timestamp: metrics.timestamp,
      status: this.getOverallStatus(metrics),
      publish: {
        total: metrics.publish.total,
        successRate: metrics.publish.successRate,
      },
      queue: {
        total: metrics.queue.total,
        lagAvg: metrics.queue.lag.avg,
      },
      system: {
        memoryGrowth: metrics.system.memory.growth,
        uptime: metrics.system.uptime,
      },
      validators: {
        duplicates: metrics.validators.duplicates.duplicatesDetected,
        peakRefreshRate: metrics.validators.refreshStorm.peakRefreshRate,
        rateLimitHits: metrics.validators.rateLimit.rateLimitHits,
      },
    };
  }

  /**
   * Get overall status
   */
  private getOverallStatus(metrics: any): string {
    if (metrics.validators.duplicates.duplicatesDetected > 0) return 'FAILED';
    if (parseFloat(metrics.system.memory.growth) > config.maxMemoryGrowthMultiplier) return 'FAILED';
    if (metrics.queue.lag.max > config.maxQueueLagSeconds * 1000) return 'FAILED';
    if (metrics.validators.refreshStorm.peakRefreshRate > config.maxRefreshPerSecond) return 'FAILED';
    return 'PASSED';
  }
}

// Run if executed directly
if (require.main === module) {
  const collector = new MetricsCollector();
  collector.start().catch(error => {
    logger.error('Failed to start metrics collector', { error: error.message });
    process.exit(1);
  });
}
