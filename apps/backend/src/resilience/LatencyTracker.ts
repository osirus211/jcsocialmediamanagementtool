import { logger } from '../utils/logger';
import { LatencyHistogram, LatencyMetrics } from './types';

/**
 * Latency Tracker
 * 
 * Tracks latency histograms with sliding window for:
 * - Publish latency (time to publish a post)
 * - Refresh latency (time to refresh a token)
 * - Queue lag (time between job scheduled and started)
 * - Lock acquisition time
 * 
 * Provides P50, P95, P99, Max metrics
 * 
 * Features:
 * - Sliding 5-minute window
 * - Efficient percentile calculation
 * - Thread-safe operations
 * - Automatic cleanup of old data
 */

interface LatencySample {
  value: number;
  timestamp: number;
}

export class LatencyTracker {
  private static instance: LatencyTracker;
  
  // Sliding window: 5 minutes
  private readonly WINDOW_SIZE_MS = 5 * 60 * 1000;
  
  // Latency samples by operation type
  private publishSamples: LatencySample[] = [];
  private refreshSamples: LatencySample[] = [];
  private queueLagSamples: LatencySample[] = [];
  private lockAcquisitionSamples: LatencySample[] = [];
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start cleanup task (every 30 seconds)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSamples();
    }, 30000);
    
    logger.info('LatencyTracker initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LatencyTracker {
    if (!LatencyTracker.instance) {
      LatencyTracker.instance = new LatencyTracker();
    }
    return LatencyTracker.instance;
  }

  /**
   * Record publish latency
   */
  recordPublishLatency(latencyMs: number): void {
    this.publishSamples.push({
      value: latencyMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Record refresh latency
   */
  recordRefreshLatency(latencyMs: number): void {
    this.refreshSamples.push({
      value: latencyMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Record queue lag
   */
  recordQueueLag(lagMs: number): void {
    this.queueLagSamples.push({
      value: lagMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Record lock acquisition time
   */
  recordLockAcquisition(timeMs: number): void {
    this.lockAcquisitionSamples.push({
      value: timeMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all latency metrics
   */
  getMetrics(): LatencyMetrics {
    // Cleanup before calculating
    this.cleanupOldSamples();
    
    return {
      publish: this.calculateHistogram(this.publishSamples),
      refresh: this.calculateHistogram(this.refreshSamples),
      queueLag: this.calculateHistogram(this.queueLagSamples),
      lockAcquisition: this.calculateHistogram(this.lockAcquisitionSamples),
    };
  }

  /**
   * Calculate histogram from samples
   */
  private calculateHistogram(samples: LatencySample[]): LatencyHistogram {
    if (samples.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        max: 0,
        count: 0,
        sum: 0,
        avg: 0,
      };
    }

    // Extract values and sort
    const values = samples.map(s => s.value).sort((a, b) => a - b);
    
    const count = values.length;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / count;
    
    return {
      p50: this.percentile(values, 0.50),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
      max: values[values.length - 1],
      count,
      sum,
      avg,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Cleanup samples older than window size
   */
  private cleanupOldSamples(): void {
    const now = Date.now();
    const cutoff = now - this.WINDOW_SIZE_MS;
    
    const beforeCount = 
      this.publishSamples.length +
      this.refreshSamples.length +
      this.queueLagSamples.length +
      this.lockAcquisitionSamples.length;
    
    this.publishSamples = this.publishSamples.filter(s => s.timestamp >= cutoff);
    this.refreshSamples = this.refreshSamples.filter(s => s.timestamp >= cutoff);
    this.queueLagSamples = this.queueLagSamples.filter(s => s.timestamp >= cutoff);
    this.lockAcquisitionSamples = this.lockAcquisitionSamples.filter(s => s.timestamp >= cutoff);
    
    const afterCount = 
      this.publishSamples.length +
      this.refreshSamples.length +
      this.queueLagSamples.length +
      this.lockAcquisitionSamples.length;
    
    const removed = beforeCount - afterCount;
    
    if (removed > 0) {
      logger.debug('Cleaned up old latency samples', {
        removed,
        remaining: afterCount,
        windowSizeMs: this.WINDOW_SIZE_MS,
      });
    }
  }

  /**
   * Reset all samples (for testing)
   */
  reset(): void {
    this.publishSamples = [];
    this.refreshSamples = [];
    this.queueLagSamples = [];
    this.lockAcquisitionSamples = [];
    
    logger.info('LatencyTracker reset');
  }

  /**
   * Shutdown tracker
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    logger.info('LatencyTracker shutdown');
  }
}

// Export singleton instance
export const latencyTracker = LatencyTracker.getInstance();
