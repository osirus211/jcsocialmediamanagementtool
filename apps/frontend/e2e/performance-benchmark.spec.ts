import { test, expect, devices } from '@playwright/test';
import { PerformanceMonitor, runConcurrentPerformanceTest, validatePerformanceTargets } from './helpers/performance-monitor';
import fs from 'fs';
import path from 'path';

/**
 * Performance Benchmarking Suite
 * 
 * Comprehensive performance testing and benchmarking for the authentication system.
 * This suite generates detailed performance reports and validates system performance
 * under various load conditions.
 */

// Use WebKit as specified in requirements
test.use({ ...devices['Desktop Safari'] });

test.describe('Authentication System Performance Benchmarking', () => {
  test('comprehensive performance benchmark - 100 concurrent requests', async ({ browser }) => {
    const monitor = new PerformanceMonitor();
    monitor.start();

    console.log('🎯 COMPREHENSIVE PERFORMANCE BENCHMARK');
    console.log('=====================================');
    console.log('Target: 100 concurrent login requests');
    console.log('Expected: < 100ms average, > 95% success rate');
    console.log('');

    // Execute 100 concurrent requests
    const results = await runConcurrentPerformanceTest(
      async (index) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
          return await monitor.monitoredLoginRequest(
            page,
            `perf-test-${index}@example.com`,
            'TestPassword123!',
            `req-${index}`
          );
        } finally {
          await context.close();
        }
      },
      100,
      'Authentication Performance Benchmark'
    );

    monitor.stop();
    
    // Generate comprehensive report
    const summary = monitor.generateSummary();
    const report = monitor.generateReport();
    
    // Save report to file
    const reportPath = path.join(__dirname, 'reports', 'performance-benchmark-report.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);
    
    // Save raw metrics
    const metricsPath = path.join(__dirname, 'reports', 'performance-metrics.json');
    fs.writeFileSync(metricsPath, monitor.exportMetrics());
    
    console.log('📊 Performance Benchmark Results:');
    console.log(`   Total Requests: ${summary.totalRequests}`);
    console.log(`   Success Rate: ${summary.successRate.toFixed(2)}%`);
    console.log(`   Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`   P95 Response Time: ${summary.p95.toFixed(2)}ms`);
    console.log(`   Throughput: ${summary.throughput.toFixed(2)} req/s`);
    console.log('');
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`📊 Metrics saved to: ${metricsPath}`);

    // Validate performance targets
    const validation = validatePerformanceTargets(summary, {
      averageResponseTime: 100,
      successRate: 95,
      p95ResponseTime: 200,
      p99ResponseTime: 500
    });

    if (!validation.passed) {
      console.log('❌ Performance validation failed:');
      validation.failures.forEach(failure => console.log(`   - ${failure}`));
    } else {
      console.log('✅ All performance targets met!');
    }

    // Assert performance requirements
    expect(summary.averageResponseTime).toBeLessThan(100);
    expect(summary.successRate).toBeGreaterThan(95);
    expect(summary.p95).toBeLessThan(200);
  });
});