import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';
import { config } from './config';
import { duplicateDetector } from './duplicateDetector';
import { refreshStormValidator } from './refreshStormValidator';
import { rateLimitValidator } from './rateLimitValidator';
import { MongoClient, Db } from 'mongodb';

/**
 * Report Generator
 * 
 * Generates comprehensive test report with:
 * - Test configuration
 * - Execution summary
 * - Metrics and statistics
 * - Validation results
 * - Pass/Fail determination
 */

export class ReportGenerator {
  private db: Db | null = null;

  async generate(testData: any): Promise<void> {
    logger.info('Generating test report');

    // Connect to MongoDB
    const client = await MongoClient.connect(config.mongodbUri);
    this.db = client.db();

    // Collect all data
    const report = {
      metadata: this.generateMetadata(testData),
      configuration: this.generateConfiguration(),
      execution: await this.generateExecutionSummary(testData),
      metrics: await this.generateMetrics(),
      validation: await this.generateValidation(),
      conclusion: await this.generateConclusion(),
    };

    // Write report files
    await this.writeReports(report);

    logger.info('Test report generated', {
      reportsDir: config.reportsDir,
    });
  }

  /**
   * Generate metadata
   */
  private generateMetadata(testData: any): any {
    return {
      testName: 'Chaos Load Simulation',
      timestamp: new Date().toISOString(),
      duration: {
        start: new Date(testData.startTime).toISOString(),
        end: new Date(testData.endTime).toISOString(),
        durationMs: testData.endTime - testData.startTime,
        durationMinutes: ((testData.endTime - testData.startTime) / 60000).toFixed(2),
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }

  /**
   * Generate configuration
   */
  private generateConfiguration(): any {
    return {
      load: {
        accounts: config.accounts,
        posts: config.posts,
        publishRate: config.publishRate,
        refreshExpiryBurst: config.refreshExpiryBurst,
        failureRate: config.failureRate,
        durationMinutes: config.durationMinutes,
      },
      chaos: {
        enabled: config.chaosEnabled,
        killWorkerInterval: config.chaosKillWorkerInterval,
        redisDelayRate: config.chaosRedisDelayRate,
        restartRedisInterval: config.chaosRestartRedisInterval,
        workerCrashRate: config.chaosWorkerCrashRate,
        platform429Rate: config.chaosPlatform429Rate,
        platform500Rate: config.chaosPlatform500Rate,
        networkTimeoutRate: config.chaosNetworkTimeoutRate,
        tokenCorruptionRate: config.chaosTokenCorruptionRate,
        tokenRevocationRate: config.chaosTokenRevocationRate,
      },
      thresholds: {
        maxRefreshPerSecond: config.maxRefreshPerSecond,
        maxQueueLagSeconds: config.maxQueueLagSeconds,
        maxMemoryGrowthMultiplier: config.maxMemoryGrowthMultiplier,
        maxRetryStormThreshold: config.maxRetryStormThreshold,
      },
    };
  }

  /**
   * Generate execution summary
   */
  private async generateExecutionSummary(testData: any): Promise<any> {
    if (!this.db) throw new Error('Database not connected');

    const [total, published, failed, cancelled] = await Promise.all([
      this.db.collection('posts').countDocuments(),
      this.db.collection('posts').countDocuments({ status: 'published' }),
      this.db.collection('posts').countDocuments({ status: 'failed' }),
      this.db.collection('posts').countDocuments({ status: 'cancelled' }),
    ]);

    const successRate = total > 0 ? (published / total) * 100 : 0;

    return {
      workspaces: testData.workspaces,
      accounts: testData.accounts,
      posts: {
        total: testData.posts,
        published,
        failed,
        cancelled,
        successRate: successRate.toFixed(2) + '%',
      },
    };
  }

  /**
   * Generate metrics
   */
  private async generateMetrics(): Promise<any> {
    const duplicateStats = await duplicateDetector.getStatistics();
    const refreshStats = refreshStormValidator.getStatistics();
    const rateLimitStats = await rateLimitValidator.getStatistics();

    return {
      duplicates: duplicateStats,
      refreshStorm: refreshStats,
      rateLimit: rateLimitStats,
      memory: this.getMemoryMetrics(),
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): any {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
    };
  }

  /**
   * Generate validation
   */
  private async generateValidation(): Promise<any> {
    const duplicateStats = await duplicateDetector.getStatistics();
    const refreshStats = refreshStormValidator.getStatistics();
    const rateLimitStats = await rateLimitValidator.getStatistics();

    const checks = [
      {
        name: 'No Duplicate Publishes',
        passed: duplicateStats.duplicatesDetected === 0,
        value: duplicateStats.duplicatesDetected,
        threshold: 0,
      },
      {
        name: 'No Refresh Storm',
        passed: refreshStats.peakRefreshRate <= config.maxRefreshPerSecond,
        value: refreshStats.peakRefreshRate,
        threshold: config.maxRefreshPerSecond,
      },
      {
        name: 'No Concurrent Refresh Violations',
        passed: refreshStats.concurrentRefreshViolations === 0,
        value: refreshStats.concurrentRefreshViolations,
        threshold: 0,
      },
      {
        name: 'No Retry Storm',
        passed: refreshStats.retryStormEvents === 0,
        value: refreshStats.retryStormEvents,
        threshold: 0,
      },
      {
        name: 'No Job Explosion',
        passed: !rateLimitStats.jobExplosionDetected,
        value: rateLimitStats.jobExplosionDetected ? 'Yes' : 'No',
        threshold: 'No',
      },
    ];

    const allPassed = checks.every(check => check.passed);

    return {
      checks,
      allPassed,
    };
  }

  /**
   * Generate conclusion
   */
  private async generateConclusion(): Promise<any> {
    const validation = await this.generateValidation();

    return {
      result: validation.allPassed ? 'PASSED' : 'FAILED',
      summary: validation.allPassed
        ? 'All validation checks passed. System is reliable under chaos conditions.'
        : 'Some validation checks failed. System has reliability issues.',
      failedChecks: validation.checks.filter((c: any) => !c.passed),
    };
  }

  /**
   * Write reports
   */
  private async writeReports(report: any): Promise<void> {
    // Ensure reports directory exists
    if (!fs.existsSync(config.reportsDir)) {
      fs.mkdirSync(config.reportsDir, { recursive: true });
    }

    // Write JSON report
    const jsonPath = path.join(config.reportsDir, 'chaos-test-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    logger.info('JSON report written', { path: jsonPath });

    // Write Markdown report
    const mdPath = path.join(config.reportsDir, 'chaos-test-report.md');
    const markdown = this.generateMarkdown(report);
    fs.writeFileSync(mdPath, markdown);
    logger.info('Markdown report written', { path: mdPath });

    // Write summary
    const summaryPath = path.join(config.reportsDir, 'SUMMARY.txt');
    const summary = this.generateSummary(report);
    fs.writeFileSync(summaryPath, summary);
    logger.info('Summary written', { path: summaryPath });
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(report: any): string {
    return `# Chaos Load Simulation Report

## Test Metadata

- **Test Name**: ${report.metadata.testName}
- **Timestamp**: ${report.metadata.timestamp}
- **Duration**: ${report.metadata.duration.durationMinutes} minutes
- **Result**: **${report.conclusion.result}**

## Configuration

### Load Configuration
- Accounts: ${report.configuration.load.accounts}
- Posts: ${report.configuration.load.posts}
- Publish Rate: ${report.configuration.load.publishRate}/sec
- Refresh Expiry Burst: ${report.configuration.load.refreshExpiryBurst}
- Failure Rate: ${(report.configuration.load.failureRate * 100).toFixed(0)}%
- Duration: ${report.configuration.load.durationMinutes} minutes

### Chaos Configuration
- Enabled: ${report.configuration.chaos.enabled}
- Kill Worker Interval: ${report.configuration.chaos.killWorkerInterval}ms
- Redis Delay Rate: ${(report.configuration.chaos.redisDelayRate * 100).toFixed(0)}%
- Platform 429 Rate: ${(report.configuration.chaos.platform429Rate * 100).toFixed(0)}%
- Platform 500 Rate: ${(report.configuration.chaos.platform500Rate * 100).toFixed(0)}%

## Execution Summary

- Workspaces Created: ${report.execution.workspaces}
- Accounts Created: ${report.execution.accounts}
- Posts Scheduled: ${report.execution.posts.total}
- Posts Published: ${report.execution.posts.published}
- Posts Failed: ${report.execution.posts.failed}
- Success Rate: ${report.execution.posts.successRate}

## Metrics

### Duplicate Detection
- Duplicates Detected: ${report.metrics.duplicates.duplicatesDetected}
- Total Tracked Posts: ${report.metrics.duplicates.totalTrackedPosts}
- Total Publish Attempts: ${report.metrics.duplicates.totalPublishAttempts}
- Avg Attempts Per Post: ${report.metrics.duplicates.avgAttemptsPerPost}

### Refresh Storm
- Peak Refresh Rate: ${report.metrics.refreshStorm.peakRefreshRate}/sec
- Average Refresh Rate: ${report.metrics.refreshStorm.averageRefreshRate}/sec
- Concurrent Refresh Violations: ${report.metrics.refreshStorm.concurrentRefreshViolations}
- Retry Storm Events: ${report.metrics.refreshStorm.retryStormEvents}

### Rate Limit
- Rate Limit Hits: ${report.metrics.rateLimit.rateLimitHits}
- Circuit Breaker Opens: ${report.metrics.rateLimit.circuitBreakerOpens}
- Recovery Events: ${report.metrics.rateLimit.recoveryEvents}
- Job Explosion Detected: ${report.metrics.rateLimit.jobExplosionDetected}

### Memory
- Heap Used: ${report.metrics.memory.heapUsed}
- Heap Total: ${report.metrics.memory.heapTotal}
- RSS: ${report.metrics.memory.rss}

## Validation Results

${report.validation.checks.map((check: any) => 
  `- [${check.passed ? 'x' : ' '}] **${check.name}**: ${check.value} (threshold: ${check.threshold})`
).join('\n')}

## Conclusion

**Result**: ${report.conclusion.result}

${report.conclusion.summary}

${report.conclusion.failedChecks.length > 0 ? `
### Failed Checks
${report.conclusion.failedChecks.map((check: any) => 
  `- ${check.name}: ${check.value} (threshold: ${check.threshold})`
).join('\n')}
` : ''}

---
Generated: ${report.metadata.timestamp}
`;
  }

  /**
   * Generate summary
   */
  private generateSummary(report: any): string {
    return `
${'='.repeat(80)}
CHAOS LOAD SIMULATION SUMMARY
${'='.repeat(80)}

RESULT: ${report.conclusion.result}

Duration: ${report.metadata.duration.durationMinutes} minutes
Posts: ${report.execution.posts.published}/${report.execution.posts.total} published (${report.execution.posts.successRate})

VALIDATION CHECKS:
${report.validation.checks.map((check: any) => 
  `  [${check.passed ? 'PASS' : 'FAIL'}] ${check.name}: ${check.value}`
).join('\n')}

KEY METRICS:
  - Duplicates Detected: ${report.metrics.duplicates.duplicatesDetected}
  - Peak Refresh Rate: ${report.metrics.refreshStorm.peakRefreshRate}/sec
  - Rate Limit Hits: ${report.metrics.rateLimit.rateLimitHits}
  - Memory Used: ${report.metrics.memory.heapUsed}

${report.conclusion.summary}

${'='.repeat(80)}
`;
  }
}
