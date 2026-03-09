/**
 * API Key Usage Aggregation Worker
 * 
 * Runs daily to aggregate API key usage statistics
 * 
 * Features:
 * - Aggregates request counts per API key per day
 * - Calculates error rates per API key
 * - Prepares analytics for dashboards
 * - Stores usage data for 90-day retention
 * - Runs daily at midnight
 * 
 * Security:
 * - Never logs raw API keys
 * - Only logs keyId and metadata
 */

import { logger } from '../utils/logger';
import { ApiKey } from '../models/ApiKey';
import { publicApiMetricsTracker } from '../middleware/publicApiMetrics';
import mongoose from 'mongoose';
import { captureException } from '../monitoring/sentry';

export interface IWorker {
  start(): void;
  stop(): Promise<void>;
  getStatus(): { isRunning: boolean; metrics?: any };
}

/**
 * API Key Usage Statistics Model
 */
export interface IApiKeyUsageStats extends mongoose.Document {
  apiKeyId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  date: Date;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  endpointUsage: Map<string, number>;
  createdAt: Date;
}

const ApiKeyUsageStatsSchema = new mongoose.Schema<IApiKeyUsageStats>({
  apiKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey',
    required: true,
    index: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  requestCount: {
    type: Number,
    required: true,
    default: 0,
  },
  errorCount: {
    type: Number,
    required: true,
    default: 0,
  },
  errorRate: {
    type: Number,
    required: true,
    default: 0,
  },
  avgLatencyMs: {
    type: Number,
    required: true,
    default: 0,
  },
  endpointUsage: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient queries
ApiKeyUsageStatsSchema.index({ apiKeyId: 1, date: -1 });
ApiKeyUsageStatsSchema.index({ workspaceId: 1, date: -1 });

// TTL index for 90-day retention
ApiKeyUsageStatsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ApiKeyUsageStats = mongoose.model<IApiKeyUsageStats>(
  'ApiKeyUsageStats',
  ApiKeyUsageStatsSchema
);

export class ApiKeyUsageAggregationWorker implements IWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Metrics
  private metrics = {
    aggregation_runs_total: 0,
    stats_created_total: 0,
    aggregation_errors_total: 0,
    last_run_timestamp: 0,
    last_run_duration_ms: 0,
  };

  constructor() {
    logger.info('ApiKeyUsageAggregationWorker initialized');
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('API key usage aggregation worker already running');
      return;
    }

    this.isRunning = true;

    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Run at midnight
    setTimeout(() => {
      this.runAggregation().catch(error => {
        logger.error('Initial API key usage aggregation failed', {
          error: error.message,
        });
      });

      // Schedule daily runs
      this.intervalId = setInterval(() => {
        this.runAggregation().catch(error => {
          logger.error('Scheduled API key usage aggregation failed', {
            error: error.message,
          });
        });
      }, this.INTERVAL_MS);
    }, msUntilMidnight);

    logger.info('API key usage aggregation worker started', {
      intervalMs: this.INTERVAL_MS,
      intervalHours: this.INTERVAL_MS / (60 * 60 * 1000),
      nextRunAt: tomorrow.toISOString(),
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('API key usage aggregation worker not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    logger.info('API key usage aggregation worker stopped');
  }

  /**
   * Run aggregation process
   */
  private async runAggregation(): Promise<void> {
    const startTime = Date.now();
    this.metrics.aggregation_runs_total++;
    this.metrics.last_run_timestamp = startTime;

    logger.info('Starting API key usage aggregation');

    try {
      // Get metrics from tracker
      const metrics = publicApiMetricsTracker.getMetrics();

      // Get yesterday's date (aggregate previous day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Aggregate usage per API key
      const apiKeyIds = Array.from(metrics.requests_by_api_key.keys());

      for (const apiKeyId of apiKeyIds) {
        try {
          await this.aggregateKeyUsage(apiKeyId, yesterday, metrics);
        } catch (error: any) {
          logger.error('Failed to aggregate usage for API key', {
            apiKeyId,
            error: error.message,
          });
        }
      }

      const duration = Date.now() - startTime;
      this.metrics.last_run_duration_ms = duration;

      logger.info('API key usage aggregation completed', {
        duration,
        statsCreated: this.metrics.stats_created_total,
        keysProcessed: apiKeyIds.length,
      });
    } catch (error: any) {
      this.metrics.aggregation_errors_total++;

      logger.error('API key usage aggregation failed', {
        error: error.message,
        stack: error.stack,
      });

      captureException(error, {
        level: 'error',
        tags: {
          worker: 'api-key-usage-aggregation',
        },
      });
    }
  }

  /**
   * Aggregate usage for a specific API key
   */
  private async aggregateKeyUsage(
    apiKeyId: string,
    date: Date,
    metrics: any
  ): Promise<void> {
    // Get API key details
    const apiKey = await ApiKey.findById(apiKeyId).select('workspaceId name');

    if (!apiKey) {
      logger.warn('API key not found for aggregation', { apiKeyId });
      return;
    }

    // Calculate statistics
    const requestCount = metrics.requests_by_api_key.get(apiKeyId) || 0;
    const errorCount = metrics.errors_by_api_key.get(apiKeyId) || 0;
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

    // Get average latency for this key (simplified - would need per-key tracking)
    const avgLatencyMs = metrics.public_api_latency_avg_ms || 0;

    // Get endpoint usage (simplified - would need per-key per-endpoint tracking)
    const endpointUsage = new Map<string, number>();
    for (const [endpoint, count] of metrics.requests_by_endpoint.entries()) {
      endpointUsage.set(endpoint, count);
    }

    // Create or update usage stats
    await ApiKeyUsageStats.findOneAndUpdate(
      {
        apiKeyId: new mongoose.Types.ObjectId(apiKeyId),
        date,
      },
      {
        workspaceId: apiKey.workspaceId,
        requestCount,
        errorCount,
        errorRate,
        avgLatencyMs,
        endpointUsage,
      },
      {
        upsert: true,
        new: true,
      }
    );

    this.metrics.stats_created_total++;

    logger.debug('API key usage stats aggregated', {
      apiKeyId,
      keyName: apiKey.name,
      date: date.toISOString(),
      requestCount,
      errorCount,
      errorRate: errorRate.toFixed(4),
    });
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean; metrics: any } {
    return {
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
    };
  }
}

// Singleton instance
export const apiKeyUsageAggregationWorker = new ApiKeyUsageAggregationWorker();
