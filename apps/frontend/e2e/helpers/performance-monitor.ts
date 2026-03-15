import { Page } from '@playwright/test';

/**
 * Performance Monitoring Utilities
 * 
 * Provides comprehensive performance monitoring and metrics collection
 * for authentication system performance validation.
 */

export interface PerformanceMetrics {
  requestId: string;
  timestamp: number;
  responseTime: number;
  statusCode: number;
  success: boolean;
  error?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface PerformanceSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  medianResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  throughput: number; // requests per second
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  errors: string[];
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  /**
   * Start performance monitoring session
   */
  start(): void {
    this.startTime = Date.now();
    this.metrics = [];
    console.log('🔍 Performance monitoring started');
  }

  /**
   * Stop performance monitoring session
   */
  stop(): void {
    this.endTime = Date.now();
    console.log('🔍 Performance monitoring stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
  }

  /**
   * Execute a monitored login request
   */
  async monitoredLoginRequest(
    page: Page, 
    email: string, 
    password: string, 
    requestId: string
  ): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    
    try {
      const response = await page.request.post('http://localhost:5000/api/v1/auth/login', {
        data: { email, password },
        headers: { 'Content-Type': 'application/json' }
      });
      
      const responseTime = Date.now() - startTime;
      
      const metric: PerformanceMetrics = {
        requestId,
        timestamp: Date.now(),
        responseTime,
        statusCode: response.status(),
        success: response.ok()
      };
      
      if (!response.ok()) {
        const errorText = await response.text().catch(() => 'Unknown error');
        metric.error = `Status ${response.status()}: ${errorText}`;
      }
      
      this.recordMetric(metric);
      return metric;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const metric: PerformanceMetrics = {
        requestId,
        timestamp: Date.now(),
        responseTime,
        statusCode: 0,
        success: false,
        error: error.message
      };
      
      this.recordMetric(metric);
      return metric;
    }
  }

  /**
   * Generate performance summary from collected metrics
   */
  generateSummary(): PerformanceSummary {
    if (this.metrics.length === 0) {
      throw new Error('No metrics collected');
    }

    const responseTimes = this.metrics.map(m => m.responseTime);
    const successfulRequests = this.metrics.filter(m => m.success).length;
    const failedRequests = this.metrics.length - successfulRequests;
    const errors = this.metrics.filter(m => m.error).map(m => m.error!);
    
    const totalTime = this.endTime - this.startTime;
    const throughput = totalTime > 0 ? (this.metrics.length / totalTime) * 1000 : 0;
    
    return {
      totalRequests: this.metrics.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: this.calculateAverage(responseTimes),
      medianResponseTime: this.calculatePercentile(responseTimes, 50),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      successRate: (successfulRequests / this.metrics.length) * 100,
      throughput,
      p50: this.calculatePercentile(responseTimes, 50),
      p90: this.calculatePercentile(responseTimes, 90),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99),
      errors
    };
  }

  /**
   * Generate detailed performance report
   */
  generateReport(): string {
    const summary = this.generateSummary();
    const duration = this.endTime - this.startTime;
    
    return `
# Performance Validation Report

## Test Execution Summary
- **Duration**: ${duration}ms
- **Total Requests**: ${summary.totalRequests}
- **Throughput**: ${summary.throughput.toFixed(2)} requests/second

## Success Metrics
- **Successful Requests**: ${summary.successfulRequests}
- **Failed Requests**: ${summary.failedRequests}
- **Success Rate**: ${summary.successRate.toFixed(2)}%

## Response Time Analysis
- **Average**: ${summary.averageResponseTime.toFixed(2)}ms
- **Median (P50)**: ${summary.medianResponseTime.toFixed(2)}ms
- **Minimum**: ${summary.minResponseTime}ms
- **Maximum**: ${summary.maxResponseTime}ms

## Percentile Analysis
- **P50 (Median)**: ${summary.p50.toFixed(2)}ms
- **P90**: ${summary.p90.toFixed(2)}ms
- **P95**: ${summary.p95.toFixed(2)}ms
- **P99**: ${summary.p99.toFixed(2)}ms

## Performance Targets Validation
- **Average Response Time < 100ms**: ${summary.averageResponseTime < 100 ? '✅ PASS' : '❌ FAIL'} (${summary.averageResponseTime.toFixed(2)}ms)
- **Success Rate > 95%**: ${summary.successRate > 95 ? '✅ PASS' : '❌ FAIL'} (${summary.successRate.toFixed(2)}%)
- **P95 Response Time < 200ms**: ${summary.p95 < 200 ? '✅ PASS' : '❌ FAIL'} (${summary.p95.toFixed(2)}ms)
- **P99 Response Time < 500ms**: ${summary.p99 < 500 ? '✅ PASS' : '❌ FAIL'} (${summary.p99.toFixed(2)}ms)

${summary.errors.length > 0 ? `
## Errors Encountered
${summary.errors.slice(0, 10).map((error, index) => `${index + 1}. ${error}`).join('\n')}
${summary.errors.length > 10 ? `\n... and ${summary.errors.length - 10} more errors` : ''}
` : '## No Errors Encountered ✅'}

## Recommendations
${this.generateRecommendations(summary)}
`;
  }

  /**
   * Generate performance recommendations based on metrics
   */
  private generateRecommendations(summary: PerformanceSummary): string {
    const recommendations: string[] = [];
    
    if (summary.averageResponseTime > 100) {
      recommendations.push('- Consider optimizing authentication logic to reduce average response time');
    }
    
    if (summary.successRate < 95) {
      recommendations.push('- Investigate failed requests to improve system reliability');
    }
    
    if (summary.p95 > 200) {
      recommendations.push('- Address response time outliers affecting 95th percentile performance');
    }
    
    if (summary.maxResponseTime > 1000) {
      recommendations.push('- Investigate and optimize slow requests exceeding 1 second');
    }
    
    if (summary.throughput < 50) {
      recommendations.push('- Consider scaling authentication infrastructure to improve throughput');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- Performance meets all targets. System is performing optimally.');
    }
    
    return recommendations.join('\n');
  }

  /**
   * Export metrics to JSON for further analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      summary: this.generateSummary(),
      rawMetrics: this.metrics,
      testDuration: this.endTime - this.startTime,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Calculate percentile from array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Get current metrics count
   */
  getMetricsCount(): number {
    return this.metrics.length;
  }

  /**
   * Clear all collected metrics
   */
  clear(): void {
    this.metrics = [];
    this.startTime = 0;
    this.endTime = 0;
  }
}

/**
 * Utility function to create concurrent performance tests
 */
export async function runConcurrentPerformanceTest(
  testFunction: (index: number) => Promise<PerformanceMetrics>,
  concurrency: number,
  testName: string = 'Concurrent Performance Test'
): Promise<PerformanceMetrics[]> {
  console.log(`🚀 Starting ${testName} with ${concurrency} concurrent requests`);
  
  const startTime = Date.now();
  
  const promises = Array.from({ length: concurrency }, (_, index) => testFunction(index));
  const results = await Promise.all(promises);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`✅ ${testName} completed in ${duration}ms`);
  
  return results;
}

/**
 * Utility function to validate performance against targets
 */
export function validatePerformanceTargets(
  summary: PerformanceSummary,
  targets: {
    averageResponseTime?: number;
    successRate?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
    minThroughput?: number;
  }
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  
  if (targets.averageResponseTime && summary.averageResponseTime > targets.averageResponseTime) {
    failures.push(`Average response time ${summary.averageResponseTime.toFixed(2)}ms exceeds target ${targets.averageResponseTime}ms`);
  }
  
  if (targets.successRate && summary.successRate < targets.successRate) {
    failures.push(`Success rate ${summary.successRate.toFixed(2)}% below target ${targets.successRate}%`);
  }
  
  if (targets.p95ResponseTime && summary.p95 > targets.p95ResponseTime) {
    failures.push(`P95 response time ${summary.p95.toFixed(2)}ms exceeds target ${targets.p95ResponseTime}ms`);
  }
  
  if (targets.p99ResponseTime && summary.p99 > targets.p99ResponseTime) {
    failures.push(`P99 response time ${summary.p99.toFixed(2)}ms exceeds target ${targets.p99ResponseTime}ms`);
  }
  
  if (targets.minThroughput && summary.throughput < targets.minThroughput) {
    failures.push(`Throughput ${summary.throughput.toFixed(2)} req/s below target ${targets.minThroughput} req/s`);
  }
  
  return {
    passed: failures.length === 0,
    failures
  };
}