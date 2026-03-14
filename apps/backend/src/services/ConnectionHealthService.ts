/**
 * Connection Health Service
 * 
 * Computes health score for each social account based on:
 * - Token refresh success rate (40% weight)
 * - Webhook activity (30% weight)
 * - Error frequency (20% weight)
 * - Last successful interaction (10% weight)
 * 
 * Health Score: 0-100
 * - 90-100: Excellent
 * - 70-89: Good
 * - 50-69: Fair
 * - 30-49: Poor
 * - 0-29: Critical
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { updateConnectionHealthScore } from '../config/metrics';
import {
  recordHealthCheck,
  recordStatusChange,
  updateApiFailureRate,
  updatePublishErrorRate,
} from '../config/connectionHealthMetrics';

interface HealthMetrics {
  tokenRefreshSuccessRate: number; // 0-100
  webhookActivityScore: number; // 0-100
  errorFrequencyScore: number; // 0-100
  lastInteractionScore: number; // 0-100
  responseTimeScore: number; // 0-100
}

interface HealthScoreResult {
  score: number; // 0-100
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  metrics: HealthMetrics;
  timestamp: Date;
}

export class ConnectionHealthService {
  private readonly keyPrefix = 'health';
  private readonly metricsWindow = 7 * 24 * 60 * 60; // 7 days in seconds

  // Weights for health score calculation
  private readonly weights = {
    tokenRefresh: 0.3, // 30%
    webhookActivity: 0.25, // 25%
    errorFrequency: 0.2, // 20%
    lastInteraction: 0.1, // 10%
    responseTime: 0.15, // 15%
  };

  constructor(private redis: Redis) {}

  /**
   * Calculate health score for a social account
   * 
   * @param provider - Provider name
   * @param accountId - Social account ID
   * @returns Health score result
   */
  async calculateHealthScore(
    provider: string,
    accountId: string
  ): Promise<HealthScoreResult> {
    try {
      // Get metrics
      const tokenRefreshSuccessRate = await this.getTokenRefreshSuccessRate(provider, accountId);
      const webhookActivityScore = await this.getWebhookActivityScore(provider, accountId);
      const errorFrequencyScore = await this.getErrorFrequencyScore(provider, accountId);
      const lastInteractionScore = await this.getLastInteractionScore(provider, accountId);
      const responseTimeScore = await this.getResponseTimeScore(provider, accountId);

      const metrics: HealthMetrics = {
        tokenRefreshSuccessRate,
        webhookActivityScore,
        errorFrequencyScore,
        lastInteractionScore,
        responseTimeScore,
      };

      // Calculate weighted score
      const score = Math.round(
        tokenRefreshSuccessRate * this.weights.tokenRefresh +
          webhookActivityScore * this.weights.webhookActivity +
          errorFrequencyScore * this.weights.errorFrequency +
          lastInteractionScore * this.weights.lastInteraction +
          responseTimeScore * this.weights.responseTime
      );

      // Determine grade
      const grade = this.getHealthGrade(score);

      const result: HealthScoreResult = {
        score,
        grade,
        metrics,
        timestamp: new Date(),
      };

      // Store health score
      await this.storeHealthScore(provider, accountId, result);

      // Update Prometheus metric
      updateConnectionHealthScore(provider, accountId, score);

      // Record health check
      recordHealthCheck(provider, grade);

      logger.debug('Health score calculated', {
        provider,
        accountId,
        score,
        grade,
        metrics,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to calculate health score', {
        provider,
        accountId,
        error: error.message,
      });

      // Return default poor health score on error
      return {
        score: 30,
        grade: 'poor',
        metrics: {
          tokenRefreshSuccessRate: 0,
          webhookActivityScore: 0,
          errorFrequencyScore: 0,
          lastInteractionScore: 0,
          responseTimeScore: 0,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get token refresh success rate (0-100)
   */
  private async getTokenRefreshSuccessRate(
    provider: string,
    accountId: string
  ): Promise<number> {
    const successKey = this.getMetricKey(provider, accountId, 'token_refresh_success');
    const failureKey = this.getMetricKey(provider, accountId, 'token_refresh_failure');

    const successCount = parseInt((await this.redis.get(successKey)) || '0');
    const failureCount = parseInt((await this.redis.get(failureKey)) || '0');

    const totalAttempts = successCount + failureCount;
    if (totalAttempts === 0) return 100; // No data = assume healthy

    return Math.round((successCount / totalAttempts) * 100);
  }

  /**
   * Get webhook activity score (0-100)
   * 
   * Based on number of webhooks received in last 7 days
   */
  private async getWebhookActivityScore(provider: string, accountId: string): Promise<number> {
    const key = this.getMetricKey(provider, accountId, 'webhook_count');
    const webhookCount = parseInt((await this.redis.get(key)) || '0');

    // Score based on webhook frequency
    // 0 webhooks = 0 score
    // 1-10 webhooks = 50 score
    // 11-50 webhooks = 75 score
    // 51+ webhooks = 100 score
    if (webhookCount === 0) return 0;
    if (webhookCount <= 10) return 50;
    if (webhookCount <= 50) return 75;
    return 100;
  }

  /**
   * Get error frequency score (0-100)
   * 
   * Lower errors = higher score
   */
  private async getErrorFrequencyScore(provider: string, accountId: string): Promise<number> {
    const errorKey = this.getMetricKey(provider, accountId, 'error_count');
    const totalKey = this.getMetricKey(provider, accountId, 'total_operations');

    const errorCount = parseInt((await this.redis.get(errorKey)) || '0');
    const totalOperations = parseInt((await this.redis.get(totalKey)) || '0');

    if (totalOperations === 0) return 100; // No data = assume healthy

    const errorRate = (errorCount / totalOperations) * 100;

    // Convert error rate to score (inverse relationship)
    // 0% errors = 100 score
    // 5% errors = 75 score
    // 10% errors = 50 score
    // 20%+ errors = 0 score
    if (errorRate === 0) return 100;
    if (errorRate <= 5) return 75;
    if (errorRate <= 10) return 50;
    if (errorRate <= 20) return 25;
    return 0;
  }

  /**
   * Get last interaction score (0-100)
   * 
   * Based on time since last successful interaction
   */
  private async getLastInteractionScore(provider: string, accountId: string): Promise<number> {
    const key = this.getMetricKey(provider, accountId, 'last_interaction');
    const lastInteractionStr = await this.redis.get(key);

    if (!lastInteractionStr) return 0; // No interaction = 0 score

    const lastInteraction = parseInt(lastInteractionStr);
    const now = Date.now();
    const hoursSinceInteraction = (now - lastInteraction) / (1000 * 60 * 60);

    // Score based on recency
    // < 1 hour = 100 score
    // < 24 hours = 75 score
    // < 7 days = 50 score
    // < 30 days = 25 score
    // 30+ days = 0 score
    if (hoursSinceInteraction < 1) return 100;
    if (hoursSinceInteraction < 24) return 75;
    if (hoursSinceInteraction < 168) return 50; // 7 days
    if (hoursSinceInteraction < 720) return 25; // 30 days
    return 0;
  }

  /**
   * Get health grade from score
   */
  private getHealthGrade(
    score: number
  ): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }

  /**
   * Store health score in Redis
   */
  private async storeHealthScore(
    provider: string,
    accountId: string,
    result: HealthScoreResult
  ): Promise<void> {
    const key = this.getMetricKey(provider, accountId, 'health_score');
    await this.redis.setex(key, this.metricsWindow, JSON.stringify(result));
  }

  /**
   * Get stored health score
   */
  async getHealthScore(provider: string, accountId: string): Promise<HealthScoreResult | null> {
    const key = this.getMetricKey(provider, accountId, 'health_score');
    const data = await this.redis.get(key);

    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Update metrics after token refresh
   */
  async recordTokenRefresh(
    provider: string,
    accountId: string,
    success: boolean
  ): Promise<void> {
    const key = success
      ? this.getMetricKey(provider, accountId, 'token_refresh_success')
      : this.getMetricKey(provider, accountId, 'token_refresh_failure');

    await this.redis.incr(key);
    await this.redis.expire(key, this.metricsWindow);

    // Update last interaction if successful
    if (success) {
      await this.recordInteraction(provider, accountId);
    }

    // Recalculate health score
    await this.calculateHealthScore(provider, accountId);
  }

  /**
   * Update metrics after webhook event
   */
  async recordWebhookEvent(provider: string, accountId: string): Promise<void> {
    const key = this.getMetricKey(provider, accountId, 'webhook_count');
    await this.redis.incr(key);
    await this.redis.expire(key, this.metricsWindow);

    // Update last interaction
    await this.recordInteraction(provider, accountId);

    // Recalculate health score
    await this.calculateHealthScore(provider, accountId);
  }

  /**
   * Update metrics after error
   */
  async recordError(provider: string, accountId: string): Promise<void> {
    const errorKey = this.getMetricKey(provider, accountId, 'error_count');
    const totalKey = this.getMetricKey(provider, accountId, 'total_operations');

    await this.redis.incr(errorKey);
    await this.redis.incr(totalKey);
    await this.redis.expire(errorKey, this.metricsWindow);
    await this.redis.expire(totalKey, this.metricsWindow);

    // Recalculate health score
    await this.calculateHealthScore(provider, accountId);
  }

  /**
   * Record successful interaction
   */
  async recordInteraction(provider: string, accountId: string): Promise<void> {
    const key = this.getMetricKey(provider, accountId, 'last_interaction');
    await this.redis.setex(key, this.metricsWindow, Date.now().toString());

    // Increment total operations
    const totalKey = this.getMetricKey(provider, accountId, 'total_operations');
    await this.redis.incr(totalKey);
    await this.redis.expire(totalKey, this.metricsWindow);
  }

  /**
   * Get Redis key for metric
   */
  private getMetricKey(provider: string, accountId: string, metric: string): string {
    return `${this.keyPrefix}:${provider}:${accountId}:${metric}`;
  }

  /**
   * Record API response time for health scoring
   */
  async recordApiResponseTime(
    provider: string,
    accountId: string,
    responseTimeMs: number
  ): Promise<void> {
    const key = this.getMetricKey(provider, accountId, 'response_times');
    
    // Store response time in a sorted set with timestamp as score
    await this.redis.zadd(key, Date.now(), responseTimeMs);
    await this.redis.expire(key, this.metricsWindow);

    // Keep only last 100 response times to prevent memory bloat
    await this.redis.zremrangebyrank(key, 0, -101);

    // Recalculate health score
    await this.calculateHealthScore(provider, accountId);
  }

  /**
   * Get average response time score (0-100)
   * 
   * Based on average API response time in last 7 days
   */
  private async getResponseTimeScore(provider: string, accountId: string): Promise<number> {
    const key = this.getMetricKey(provider, accountId, 'response_times');
    
    // Get all response times from last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const responseTimes = await this.redis.zrangebyscore(key, sevenDaysAgo, '+inf');

    if (responseTimes.length === 0) return 100; // No data = assume healthy

    // Calculate average response time
    const avgResponseTime = responseTimes
      .map(time => parseFloat(time))
      .reduce((sum, time) => sum + time, 0) / responseTimes.length;

    // Score based on response time
    // < 200ms = 100 score
    // < 500ms = 80 score
    // < 1000ms = 60 score
    // < 2000ms = 40 score
    // 2000ms+ = 20 score
    if (avgResponseTime < 200) return 100;
    if (avgResponseTime < 500) return 80;
    if (avgResponseTime < 1000) return 60;
    if (avgResponseTime < 2000) return 40;
    return 20;
  }

  /**
   * Clear metrics for account (for testing)
   */
  async clearMetrics(provider: string, accountId: string): Promise<void> {
    const pattern = `${this.keyPrefix}:${provider}:${accountId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
