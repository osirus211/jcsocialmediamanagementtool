/**
 * Metrics Collector
 * 
 * Collects and aggregates load test metrics
 */

export interface TestMetrics {
  testName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  
  // Counts
  totalPosts?: number;
  totalAccounts?: number;
  totalJobs?: number;
  successfulJobs?: number;
  failedJobs?: number;
  
  // Performance
  avgPublishTime?: number;
  minPublishTime?: number;
  maxPublishTime?: number;
  p50PublishTime?: number;
  p95PublishTime?: number;
  p99PublishTime?: number;
  
  // Throughput
  jobsPerSecond?: number;
  postsPerSecond?: number;
  
  // Queue
  maxQueueBacklog?: number;
  avgQueueBacklog?: number;
  queueLatency?: number;
  
  // Errors
  errorRate?: number;
  errors?: Array<{ message: string; count: number }>;
  
  // Resources
  avgCpuUsage?: number;
  avgMemoryUsage?: number;
  maxMemoryUsage?: number;
  
  // Custom metrics
  custom?: Record<string, any>;
}

export class MetricsCollector {
  private metrics: TestMetrics;
  private publishTimes: number[] = [];
  private queueBacklogs: number[] = [];
  private errorCounts: Map<string, number> = new Map();
  private intervalMetrics: Array<{
    timestamp: Date;
    jobsPerSecond: number;
    backlog: number;
    avgTime: number;
  }> = [];

  constructor(testName: string) {
    this.metrics = {
      testName,
      startTime: new Date(),
      totalPosts: 0,
      totalAccounts: 0,
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
    };
  }

  /**
   * Record publish time
   */
  recordPublishTime(timeMs: number): void {
    this.publishTimes.push(timeMs);
  }

  /**
   * Record queue backlog
   */
  recordQueueBacklog(size: number): void {
    this.queueBacklogs.push(size);
  }

  /**
   * Record error
   */
  recordError(error: string): void {
    const count = this.errorCounts.get(error) || 0;
    this.errorCounts.set(error, count + 1);
  }

  /**
   * Record interval metrics
   */
  recordInterval(jobsPerSecond: number, backlog: number, avgTime: number): void {
    this.intervalMetrics.push({
      timestamp: new Date(),
      jobsPerSecond,
      backlog,
      avgTime,
    });
  }

  /**
   * Increment counter
   */
  increment(field: keyof TestMetrics, amount: number = 1): void {
    if (typeof this.metrics[field] === 'number') {
      (this.metrics[field] as number) += amount;
    }
  }

  /**
   * Set value
   */
  set(field: keyof TestMetrics, value: any): void {
    (this.metrics as any)[field] = value;
  }

  /**
   * Set custom metric
   */
  setCustom(key: string, value: any): void {
    if (!this.metrics.custom) {
      this.metrics.custom = {};
    }
    this.metrics.custom[key] = value;
  }

  /**
   * Finalize metrics (calculate aggregates)
   */
  finalize(): TestMetrics {
    this.metrics.endTime = new Date();
    this.metrics.duration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();

    // Calculate publish time statistics
    if (this.publishTimes.length > 0) {
      const sorted = [...this.publishTimes].sort((a, b) => a - b);
      this.metrics.avgPublishTime = this.average(this.publishTimes);
      this.metrics.minPublishTime = sorted[0];
      this.metrics.maxPublishTime = sorted[sorted.length - 1];
      this.metrics.p50PublishTime = this.percentile(sorted, 50);
      this.metrics.p95PublishTime = this.percentile(sorted, 95);
      this.metrics.p99PublishTime = this.percentile(sorted, 99);
    }

    // Calculate queue statistics
    if (this.queueBacklogs.length > 0) {
      this.metrics.maxQueueBacklog = Math.max(...this.queueBacklogs);
      this.metrics.avgQueueBacklog = this.average(this.queueBacklogs);
    }

    // Calculate throughput
    if (this.metrics.duration && this.metrics.duration > 0) {
      const durationSeconds = this.metrics.duration / 1000;
      if (this.metrics.totalJobs) {
        this.metrics.jobsPerSecond = this.metrics.totalJobs / durationSeconds;
      }
      if (this.metrics.totalPosts) {
        this.metrics.postsPerSecond = this.metrics.totalPosts / durationSeconds;
      }
    }

    // Calculate error rate
    if (this.metrics.totalJobs && this.metrics.totalJobs > 0) {
      this.metrics.errorRate = ((this.metrics.failedJobs || 0) / this.metrics.totalJobs) * 100;
    }

    // Convert error map to array
    if (this.errorCounts.size > 0) {
      this.metrics.errors = Array.from(this.errorCounts.entries()).map(([message, count]) => ({
        message,
        count,
      }));
    }

    return this.metrics;
  }

  /**
   * Get current metrics (without finalizing)
   */
  getMetrics(): TestMetrics {
    return { ...this.metrics };
  }

  /**
   * Get interval metrics
   */
  getIntervalMetrics() {
    return this.intervalMetrics;
  }

  /**
   * Calculate average
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedNumbers: number[], p: number): number {
    if (sortedNumbers.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedNumbers.length) - 1;
    return sortedNumbers[Math.max(0, index)];
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const m = this.metrics;
    
    console.log('\n' + '='.repeat(60));
    console.log(`Test: ${m.testName}`);
    console.log('='.repeat(60));
    
    if (m.duration) {
      console.log(`Duration: ${(m.duration / 1000).toFixed(2)}s`);
    }
    
    if (m.totalPosts) {
      console.log(`\nPosts: ${m.totalPosts}`);
    }
    if (m.totalAccounts) {
      console.log(`Accounts: ${m.totalAccounts}`);
    }
    if (m.totalJobs) {
      console.log(`Jobs: ${m.totalJobs} (${m.successfulJobs} success, ${m.failedJobs} failed)`);
    }
    
    if (m.avgPublishTime) {
      console.log(`\nPublish Time:`);
      console.log(`  Avg: ${m.avgPublishTime.toFixed(0)}ms`);
      console.log(`  Min: ${m.minPublishTime}ms`);
      console.log(`  Max: ${m.maxPublishTime}ms`);
      console.log(`  P50: ${m.p50PublishTime}ms`);
      console.log(`  P95: ${m.p95PublishTime}ms`);
      console.log(`  P99: ${m.p99PublishTime}ms`);
    }
    
    if (m.jobsPerSecond) {
      console.log(`\nThroughput:`);
      console.log(`  Jobs/sec: ${m.jobsPerSecond.toFixed(2)}`);
      if (m.postsPerSecond) {
        console.log(`  Posts/sec: ${m.postsPerSecond.toFixed(2)}`);
      }
    }
    
    if (m.maxQueueBacklog !== undefined) {
      console.log(`\nQueue:`);
      console.log(`  Max backlog: ${m.maxQueueBacklog}`);
      console.log(`  Avg backlog: ${m.avgQueueBacklog?.toFixed(0)}`);
    }
    
    if (m.errorRate !== undefined) {
      console.log(`\nErrors:`);
      console.log(`  Error rate: ${m.errorRate.toFixed(2)}%`);
      if (m.errors && m.errors.length > 0) {
        m.errors.forEach(e => {
          console.log(`  - ${e.message}: ${e.count}`);
        });
      }
    }
    
    if (m.custom) {
      console.log(`\nCustom Metrics:`);
      Object.entries(m.custom).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    console.log('='.repeat(60) + '\n');
  }
}
