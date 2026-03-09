/**
 * Metrics Collection Utilities
 * 
 * Provides functions to capture and analyze metrics during load tests
 * and validation tests.
 */

/**
 * Latency Metrics
 */
export interface LatencyMetrics {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
  samples: number[];
}

/**
 * Queue Lag Metrics
 */
export interface QueueLagMetrics {
  avg: number;
  max: number;
  min: number;
  samples: { timestamp: Date; lag: number }[];
}

/**
 * Metrics Sample
 */
export interface MetricsSample {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Track latency from an array of samples
 */
export function trackLatency(samples: number[]): LatencyMetrics {
  if (samples.length === 0) {
    return {
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
      min: 0,
      samples: [],
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, val) => acc + val, 0);

  return {
    avg: sum / samples.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    min: sorted[0],
    samples,
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Track queue lag from samples
 */
export function trackQueueLag(samples: { timestamp: Date; lag: number }[]): QueueLagMetrics {
  if (samples.length === 0) {
    return {
      avg: 0,
      max: 0,
      min: 0,
      samples: [],
    };
  }

  const lags = samples.map(s => s.lag);
  const sum = lags.reduce((acc, val) => acc + val, 0);

  return {
    avg: sum / lags.length,
    max: Math.max(...lags),
    min: Math.min(...lags),
    samples,
  };
}

/**
 * Capture metrics over a duration with sampling interval
 */
export async function captureMetrics(
  duration: number,
  interval: number,
  sampler: () => Promise<number> | number
): Promise<MetricsSample[]> {
  const samples: MetricsSample[] = [];
  const startTime = Date.now();
  const endTime = startTime + duration;

  while (Date.now() < endTime) {
    const timestamp = new Date();
    const value = await Promise.resolve(sampler());

    samples.push({ timestamp, value });

    // Wait for next interval
    const nextSampleTime = Date.now() + interval;
    const waitTime = Math.max(0, nextSampleTime - Date.now());
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  return samples;
}

/**
 * Calculate throughput (items per second)
 */
export function calculateThroughput(itemCount: number, durationMs: number): number {
  if (durationMs === 0) return 0;
  return (itemCount / durationMs) * 1000;
}

/**
 * Calculate error rate (percentage)
 */
export function calculateErrorRate(errorCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return (errorCount / totalCount) * 100;
}

/**
 * Format latency for display (ms)
 */
export function formatLatency(latencyMs: number): string {
  if (latencyMs < 1000) {
    return `${latencyMs.toFixed(2)}ms`;
  }
  return `${(latencyMs / 1000).toFixed(2)}s`;
}

/**
 * Format throughput for display (items/sec)
 */
export function formatThroughput(throughput: number): string {
  return `${throughput.toFixed(2)} items/sec`;
}

/**
 * Format error rate for display (percentage)
 */
export function formatErrorRate(errorRate: number): string {
  return `${errorRate.toFixed(2)}%`;
}

/**
 * Aggregate multiple latency metrics
 */
export function aggregateLatencyMetrics(metrics: LatencyMetrics[]): LatencyMetrics {
  if (metrics.length === 0) {
    return {
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
      min: 0,
      samples: [],
    };
  }

  const allSamples = metrics.flatMap(m => m.samples);
  return trackLatency(allSamples);
}

/**
 * Aggregate multiple queue lag metrics
 */
export function aggregateQueueLagMetrics(metrics: QueueLagMetrics[]): QueueLagMetrics {
  if (metrics.length === 0) {
    return {
      avg: 0,
      max: 0,
      min: 0,
      samples: [],
    };
  }

  const allSamples = metrics.flatMap(m => m.samples);
  return trackQueueLag(allSamples);
}

/**
 * Performance Summary
 */
export interface PerformanceSummary {
  duration: number;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  throughput: number;
  errorRate: number;
  latency: LatencyMetrics;
  queueLag?: QueueLagMetrics;
}

/**
 * Create performance summary
 */
export function createPerformanceSummary(
  duration: number,
  totalItems: number,
  successfulItems: number,
  failedItems: number,
  latencySamples: number[],
  queueLagSamples?: { timestamp: Date; lag: number }[]
): PerformanceSummary {
  return {
    duration,
    totalItems,
    successfulItems,
    failedItems,
    throughput: calculateThroughput(successfulItems, duration),
    errorRate: calculateErrorRate(failedItems, totalItems),
    latency: trackLatency(latencySamples),
    queueLag: queueLagSamples ? trackQueueLag(queueLagSamples) : undefined,
  };
}

/**
 * Print performance summary to console
 */
export function printPerformanceSummary(summary: PerformanceSummary): void {
  console.log('\n=== Performance Summary ===');
  console.log(`Duration: ${formatLatency(summary.duration)}`);
  console.log(`Total Items: ${summary.totalItems}`);
  console.log(`Successful: ${summary.successfulItems}`);
  console.log(`Failed: ${summary.failedItems}`);
  console.log(`Throughput: ${formatThroughput(summary.throughput)}`);
  console.log(`Error Rate: ${formatErrorRate(summary.errorRate)}`);
  console.log('\nLatency:');
  console.log(`  Avg: ${formatLatency(summary.latency.avg)}`);
  console.log(`  P50: ${formatLatency(summary.latency.p50)}`);
  console.log(`  P95: ${formatLatency(summary.latency.p95)}`);
  console.log(`  P99: ${formatLatency(summary.latency.p99)}`);
  console.log(`  Max: ${formatLatency(summary.latency.max)}`);
  console.log(`  Min: ${formatLatency(summary.latency.min)}`);

  if (summary.queueLag) {
    console.log('\nQueue Lag:');
    console.log(`  Avg: ${formatLatency(summary.queueLag.avg)}`);
    console.log(`  Max: ${formatLatency(summary.queueLag.max)}`);
    console.log(`  Min: ${formatLatency(summary.queueLag.min)}`);
  }

  console.log('===========================\n');
}

/**
 * Save performance summary to JSON file
 */
export async function savePerformanceSummary(
  summary: PerformanceSummary,
  filePath: string
): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');

  // Ensure directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Save summary
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2));
}

/**
 * Load performance summary from JSON file
 */
export async function loadPerformanceSummary(filePath: string): Promise<PerformanceSummary> {
  const fs = require('fs').promises;
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Compare two performance summaries
 */
export interface PerformanceComparison {
  throughputChange: number; // percentage
  errorRateChange: number; // percentage
  latencyChange: {
    avg: number;
    p95: number;
    p99: number;
  };
}

/**
 * Compare performance summaries
 */
export function comparePerformance(
  baseline: PerformanceSummary,
  current: PerformanceSummary
): PerformanceComparison {
  return {
    throughputChange: ((current.throughput - baseline.throughput) / baseline.throughput) * 100,
    errorRateChange: current.errorRate - baseline.errorRate,
    latencyChange: {
      avg: ((current.latency.avg - baseline.latency.avg) / baseline.latency.avg) * 100,
      p95: ((current.latency.p95 - baseline.latency.p95) / baseline.latency.p95) * 100,
      p99: ((current.latency.p99 - baseline.latency.p99) / baseline.latency.p99) * 100,
    },
  };
}
