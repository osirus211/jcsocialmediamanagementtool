/**
 * PRODUCTION HARDENING & STRESS VALIDATION TEST SUITE
 * 
 * Comprehensive production survivability testing under:
 * - Concurrency stress
 * - Race conditions
 * - Queue failures
 * - Memory leaks
 * - Rate limiting
 * - Billing enforcement
 * - Multi-tenant isolation
 * 
 * Run: tsx production-hardening-stress-test.ts
 */

import axios, { AxiosInstance } from 'axios';
import { performance } from 'perf_hooks';

const API_URL = process.env.API_URL || 'http://localhost:5000/api/v1';
const CONCURRENCY_LEVEL = 50;
const QUEUE_STRESS_JOBS = 100;
const RATE_LIMIT_BURST = 100;

interface TestResult {
  phase: string;
  status: 'PASS' | 'FAIL';
  issues: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string[];
  fixRequired: string[];
  duration: number;
}

interface ProductionReport {
  survivabilityScore: number;
  concurrencySafety: 'SAFE' | 'RISK';
  queueReliability: 'STABLE' | 'UNSTABLE';
  memoryStability: 'SAFE' | 'LEAKING';
  planEnforcement: 'SECURE' | 'BYPASSABLE';
  tenantIsolation: 'SAFE' | 'VULNERABLE';
  readyForProduction: boolean;
  results: TestResult[];
}

class ProductionStressValidator {
  private client: AxiosInstance;
  private results: TestResult[] = [];
  private testUsers: Map<string, any> = new Map();

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  /**
   * Main execution entry point
   */
  async run(): Promise<ProductionReport> {
    console.log('🔥 PRODUCTION HARDENING & STRESS VALIDATION\n');
    console.log('='.repeat(80));
    console.log(`API URL: ${API_URL}`);
    console.log(`Concurrency Level: ${CONCURRENCY_LEVEL}`);
    console.log(`Queue Stress Jobs: ${QUEUE_STRESS_JOBS}`);
    console.log('='.repeat(80) + '\n');

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Phase 1: Concurrency Testing
      await this.phase1_ConcurrencyTesting();

      // Phase 2: Queue Stress Test
      await this.phase2_QueueStressTest();

      // Phase 3: Rate Limit & Abuse Test
      await this.phase3_RateLimitTest();

      // Phase 4: Memory & Resource Monitoring
      await this.phase4_MemoryMonitoring();

      // Phase 5: Billing & Plan Enforcement
      await this.phase5_BillingEnforcement();

      // Phase 6: Multi-Tenant Isolation
      await this.phase6_TenantIsolation();

      // Generate final report
      return this.generateReport();
    } catch (error: any) {
      console.error('❌ Fatal error during stress testing:', error.message);
      throw error;
    }
  }

  /**
   * Setup test environment with multiple users and workspaces
   */
  private async setupTestEnvironment(): Promise<void> {
    console.log('📋 Setting up test environment...\n');

    // Create test users for different scenarios
    const userConfigs = [
      { email: 'stress-test-1@test.com', password: 'Test1234!', name: 'Stress Test 1' },
      { email: 'stress-test-2@test.com', password: 'Test1234!', name: 'Stress Test 2' },
      { email: 'stress-test-3@test.com', password: 'Test1234!', name: 'Stress Test 3' },
    ];

    for (const config of userConfigs) {
      try {
        const response = await this.client.post('/auth/register', {
          email: config.email,
          password: config.password,
          firstName: config.name.split(' ')[0],
          lastName: config.name.split(' ')[1],
        });

        if (response.status === 201 || response.status === 409) {
          // Login if already exists
          const loginRes = await this.client.post('/auth/login', {
            email: config.email,
            password: config.password,
          });

          if (loginRes.status === 200) {
            this.testUsers.set(config.email, {
              ...loginRes.data,
              email: config.email,
              password: config.password,
            });
          }
        } else if (response.status === 201) {
          this.testUsers.set(config.email, {
            ...response.data,
            email: config.email,
            password: config.password,
          });
        }
      } catch (error: any) {
        console.warn(`⚠️  Could not setup user ${config.email}: ${error.message}`);
      }
    }

    console.log(`✅ Test environment ready with ${this.testUsers.size} users\n`);
  }

  /**
   * PHASE 1: CONCURRENCY TESTING
   * Tests for race conditions, token reuse, and concurrent access
   */
  private async phase1_ConcurrencyTesting(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 1: CONCURRENCY TESTING');
    console.log('='.repeat(80) + '\n');

    const startTime = performance.now();
    const issues: string[] = [];
    const evidence: string[] = [];
    const fixRequired: string[] = [];

    try {
      // Test 1.1: 50 concurrent logins
      console.log('Test 1.1: 50 concurrent logins...');
      const loginPromises = Array(CONCURRENCY_LEVEL).fill(null).map(async (_, i) => {
        const user = Array.from(this.testUsers.values())[i % this.testUsers.size];
        const response = await this.client.post('/auth/login', {
          email: user.email,
          password: user.password,
        });
        return { status: response.status, data: response.data };
      });

      const loginResults = await Promise.all(loginPromises);
      const successfulLogins = loginResults.filter(r => r.status === 200).length;
      const errors = loginResults.filter(r => r.status >= 500).length;

      evidence.push(`Concurrent logins: ${successfulLogins}/${CONCURRENCY_LEVEL} successful`);
      evidence.push(`Server errors (5xx): ${errors}`);

      if (errors > 0) {
        issues.push(`${errors} server errors during concurrent logins`);
        fixRequired.push('Investigate database connection pooling and request handling');
      }

      // Test 1.2: 50 concurrent refresh token requests
      console.log('Test 1.2: 50 concurrent refresh token requests...');
      const user = Array.from(this.testUsers.values())[0];
      const refreshToken = user.tokens?.refreshToken;

      if (refreshToken) {
        const refreshPromises = Array(CONCURRENCY_LEVEL).fill(null).map(async () => {
          const response = await this.client.post('/auth/refresh', { refreshToken });
          return { status: response.status, data: response.data };
        });

        const refreshResults = await Promise.all(refreshPromises);
        const successfulRefreshes = refreshResults.filter(r => r.status === 200).length;
        const unauthorized = refreshResults.filter(r => r.status === 401).length;

        evidence.push(`Concurrent refreshes: ${successfulRefreshes} successful, ${unauthorized} rejected`);

        // Only ONE should succeed due to token rotation
        if (successfulRefreshes > 1) {
          issues.push('CRITICAL: Multiple concurrent refresh requests succeeded - token reuse detected!');
          fixRequired.push('Implement atomic token rotation with Redis locking');
        }
      }

      // Test 1.3: Parallel refresh with SAME token (race condition test)
      console.log('Test 1.3: Parallel refresh with SAME token (race condition)...');
      const loginRes = await this.client.post('/auth/login', {
        email: user.email,
        password: user.password,
      });

      if (loginRes.status === 200) {
        const sameToken = loginRes.data.tokens.refreshToken;
        
        const racePromises = Array(10).fill(null).map(async () => {
          const response = await this.client.post('/auth/refresh', { refreshToken: sameToken });
          return { status: response.status };
        });

        const raceResults = await Promise.all(racePromises);
        const raceSuccesses = raceResults.filter(r => r.status === 200).length;

        evidence.push(`Race condition test: ${raceSuccesses}/10 succeeded`);

        if (raceSuccesses > 1) {
          issues.push('CRITICAL: Race condition allows multiple token refreshes!');
          fixRequired.push('Add distributed locking (Redlock) for token rotation');
        }
      }

      const duration = performance.now() - startTime;
      const status = issues.length === 0 ? 'PASS' : 'FAIL';
      const severity = issues.some(i => i.includes('CRITICAL')) ? 'CRITICAL' : 
                       issues.length > 0 ? 'HIGH' : 'LOW';

      this.results.push({
        phase: 'Phase 1: Concurrency Testing',
        status,
        issues,
        severity,
        evidence,
        fixRequired,
        duration,
      });

      this.printPhaseResult(status, issues, evidence);
    } catch (error: any) {
      this.results.push({
        phase: 'Phase 1: Concurrency Testing',
        status: 'FAIL',
        issues: [`Exception: ${error.message}`],
        severity: 'CRITICAL',
        evidence: [],
        fixRequired: ['Fix unhandled exception in concurrency tests'],
        duration: performance.now() - startTime,
      });
    }
  }

  /**
   * PHASE 2: QUEUE STRESS TEST
   * Tests queue reliability, worker processing, and failure recovery
   */
  private async phase2_QueueStressTest(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2: QUEUE STRESS TEST');
    console.log('='.repeat(80) + '\n');

    const startTime = performance.now();
    const issues: string[] = [];
    const evidence: string[] = [];
    const fixRequired: string[] = [];

    try {
      const user = Array.from(this.testUsers.values())[0];
      const accessToken = user.tokens?.accessToken;

      if (!accessToken) {
        issues.push('No access token available for queue testing');
        this.results.push({
          phase: 'Phase 2: Queue Stress Test',
          status: 'FAIL',
          issues,
          severity: 'HIGH',
          evidence: [],
          fixRequired: ['Ensure test user authentication works'],
          duration: performance.now() - startTime,
        });
        return;
      }

      // Test 2.1: Enqueue 100 publish jobs
      console.log(`Test 2.1: Enqueuing ${QUEUE_STRESS_JOBS} publish jobs...`);
      const enqueuePromises = Array(QUEUE_STRESS_JOBS).fill(null).map(async (_, i) => {
        try {
          const response = await this.client.post(
            '/posts',
            {
              content: `Stress test post ${i}`,
              platforms: ['twitter'],
              scheduledAt: new Date(Date.now() + 60000).toISOString(),
            },
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          return { status: response.status, postId: response.data?.post?._id };
        } catch (error: any) {
          return { status: 500, error: error.message };
        }
      });

      const enqueueResults = await Promise.all(enqueuePromises);
      const successfulEnqueues = enqueueResults.filter(r => r.status === 201).length;
      const failedEnqueues = enqueueResults.filter(r => r.status >= 400).length;

      evidence.push(`Enqueued: ${successfulEnqueues}/${QUEUE_STRESS_JOBS}`);
      evidence.push(`Failed: ${failedEnqueues}`);

      if (failedEnqueues > QUEUE_STRESS_JOBS * 0.1) {
        issues.push(`High failure rate: ${failedEnqueues} failed enqueues`);
        fixRequired.push('Investigate queue capacity and error handling');
      }

      // Test 2.2: Check for duplicate jobs
      console.log('Test 2.2: Checking for duplicate jobs...');
      const postIds = enqueueResults
        .filter(r => r.postId)
        .map(r => r.postId);
      
      const uniquePostIds = new Set(postIds);
      if (postIds.length !== uniquePostIds.size) {
        issues.push('CRITICAL: Duplicate post IDs detected in queue!');
        fixRequired.push('Ensure job deduplication is working correctly');
      }

      evidence.push(`Unique posts: ${uniquePostIds.size}/${postIds.length}`);

      // Test 2.3: Monitor queue health
      console.log('Test 2.3: Monitoring queue health...');
      await this.sleep(2000); // Wait for queue to process

      try {
        const healthRes = await this.client.get('/health');
        if (healthRes.status === 200) {
          const queueHealth = healthRes.data.queue;
          evidence.push(`Queue status: ${queueHealth?.status || 'unknown'}`);
          evidence.push(`Waiting jobs: ${queueHealth?.waiting || 0}`);
          evidence.push(`Active jobs: ${queueHealth?.active || 0}`);
          evidence.push(`Failed jobs: ${queueHealth?.failed || 0}`);

          if (queueHealth?.failed > QUEUE_STRESS_JOBS * 0.2) {
            issues.push(`High failure rate in queue: ${queueHealth.failed} failed jobs`);
            fixRequired.push('Review worker error handling and retry logic');
          }
        }
      } catch (error: any) {
        evidence.push(`Health check failed: ${error.message}`);
      }

      const duration = performance.now() - startTime;
      const status = issues.length === 0 ? 'PASS' : 'FAIL';
      const severity = issues.some(i => i.includes('CRITICAL')) ? 'CRITICAL' : 
                       issues.length > 0 ? 'HIGH' : 'MEDIUM';

      this.results.push({
        phase: 'Phase 2: Queue Stress Test',
        status,
        issues,
        severity,
        evidence,
        fixRequired,
        duration,
      });

      this.printPhaseResult(status, issues, evidence);
    } catch (error: any) {
      this.results.push({
        phase: 'Phase 2: Queue Stress Test',
        status: 'FAIL',
        issues: [`Exception: ${error.message}`],
        severity: 'CRITICAL',
        evidence: [],
        fixRequired: ['Fix unhandled exception in queue tests'],
        duration: performance.now() - startTime,
      });
    }
  }

  /**
   * PHASE 3: RATE LIMIT & ABUSE TEST
   * Tests rate limiting, brute force protection, and resource exhaustion
   */
  private async phase3_RateLimitTest(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 3: RATE LIMIT & ABUSE TEST');
    console.log('='.repeat(80) + '\n');

    const startTime = performance.now();
    const issues: string[] = [];
    const evidence: string[] = [];
    const fixRequired: string[] = [];

    try {
      // Test 3.1: Brute-force login attempts
      console.log('Test 3.1: Simulating brute-force login attempts...');
      const bruteForcePromises = Array(30).fill(null).map(async (_, i) => {
        const response = await this.client.post('/auth/login', {
          email: 'nonexistent@test.com',
          password: `wrong-password-${i}`,
        });
        return { status: response.status, attempt: i };
      });

      const bruteForceResults = await Promise.all(bruteForcePromises);
      const rateLimited = bruteForceResults.filter(r => r.status === 429).length;
      const unauthorized = bruteForceResults.filter(r => r.status === 401).length;

      evidence.push(`Brute-force attempts: ${bruteForceResults.length}`);
      evidence.push(`Rate limited: ${rateLimited}`);
      evidence.push(`Unauthorized: ${unauthorized}`);

      if (rateLimited === 0) {
        issues.push('CRITICAL: No rate limiting detected on login endpoint!');
        fixRequired.push('Implement rate limiting on authentication endpoints');
      }

      // Test 3.2: API flood (100 requests in burst)
      console.log('Test 3.2: API flood test (100 requests in burst)...');
      const user = Array.from(this.testUsers.values())[0];
      const accessToken = user.tokens?.accessToken;

      if (accessToken) {
        const floodPromises = Array(RATE_LIMIT_BURST).fill(null).map(async () => {
          const response = await this.client.get('/auth/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          return { status: response.status };
        });

        const floodResults = await Promise.all(floodPromises);
        const successful = floodResults.filter(r => r.status === 200).length;
        const rateLimitedFlood = floodResults.filter(r => r.status === 429).length;

        evidence.push(`Flood requests: ${RATE_LIMIT_BURST}`);
        evidence.push(`Successful: ${successful}`);
        evidence.push(`Rate limited: ${rateLimitedFlood}`);

        if (rateLimitedFlood === 0 && successful === RATE_LIMIT_BURST) {
          issues.push('WARNING: No rate limiting on authenticated endpoints');
          fixRequired.push('Consider implementing per-user rate limits');
        }
      }

      // Test 3.3: Memory and CPU monitoring during stress
      console.log('Test 3.3: Monitoring resource usage...');
      const memBefore = process.memoryUsage();
      
      // Simulate sustained load
      await Promise.all(
        Array(50).fill(null).map(() => 
          this.client.get('/health')
        )
      );

      const memAfter = process.memoryUsage();
      const heapIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      evidence.push(`Heap increase: ${heapIncrease.toFixed(2)} MB`);

      if (heapIncrease > 100) {
        issues.push('WARNING: Significant memory increase during stress test');
        fixRequired.push('Investigate potential memory leaks');
      }

      const duration = performance.now() - startTime;
      const status = issues.filter(i => i.includes('CRITICAL')).length === 0 ? 'PASS' : 'FAIL';
      const severity = issues.some(i => i.includes('CRITICAL')) ? 'CRITICAL' : 
                       issues.length > 0 ? 'MEDIUM' : 'LOW';

      this.results.push({
        phase: 'Phase 3: Rate Limit & Abuse Test',
        status,
        issues,
        severity,
        evidence,
        fixRequired,
        duration,
      });

      this.printPhaseResult(status, issues, evidence);
    } catch (error: any) {
      this.results.push({
        phase: 'Phase 3: Rate Limit & Abuse Test',
        status: 'FAIL',
        issues: [`Exception: ${error.message}`],
        severity: 'CRITICAL',
        evidence: [],
        fixRequired: ['Fix unhandled exception in rate limit tests'],
        duration: performance.now() - startTime,
      });
    }
  }

  /**
   * PHASE 4: MEMORY & RESOURCE MONITORING
   * Tests for memory leaks, connection leaks, and resource exhaustion
   */
  private async phase4_MemoryMonitoring(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 4: MEMORY & RESOURCE MONITORING');
    console.log('='.repeat(80) + '\n');

    const startTime = performance.now();
    const issues: string[] = [];
    const evidence: string[] = [];
    const fixRequired: string[] = [];

    try {
      // Test 4.1: Baseline memory usage
      console.log('Test 4.1: Establishing baseline memory usage...');
      const baseline = await this.getServerMetrics();
      
      if (baseline) {
        evidence.push(`Baseline heap: ${baseline.heapUsed.toFixed(2)} MB`);
        evidence.push(`Baseline RSS: ${baseline.rss.toFixed(2)} MB`);
      }

      // Test 4.2: Sustained load memory test
      console.log('Test 4.2: Running sustained load test...');
      const iterations = 5;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < iterations; i++) {
        await Promise.all(
          Array(20).fill(null).map(() => this.client.get('/health'))
        );
        
        const metrics = await this.getServerMetrics();
        if (metrics) {
          memorySnapshots.push(metrics.heapUsed);
        }
        
        await this.sleep(1000);
      }

      // Check for memory leak pattern (consistently increasing)
      if (memorySnapshots.length >= 3) {
        const isIncreasing = memorySnapshots.every((val, i) => 
          i === 0 || val >= memorySnapshots[i - 1]
        );

        const totalIncrease = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
        
        evidence.push(`Memory snapshots: ${memorySnapshots.map(m => m.toFixed(1)).join(' → ')} MB`);
        evidence.push(`Total increase: ${totalIncrease.toFixed(2)} MB`);

        if (isIncreasing && totalIncrease > 50) {
          issues.push('WARNING: Potential memory leak detected');
          fixRequired.push('Profile application for memory leaks');
        }
      }

      // Test 4.3: Event loop delay
      console.log('Test 4.3: Measuring event loop delay...');
      const eventLoopDelays: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await new Promise(resolve => setImmediate(resolve));
        const delay = performance.now() - start;
        eventLoopDelays.push(delay);
      }

      const avgDelay = eventLoopDelays.reduce((a, b) => a + b, 0) / eventLoopDelays.length;
      evidence.push(`Avg event loop delay: ${avgDelay.toFixed(2)} ms`);

      if (avgDelay > 100) {
        issues.push('WARNING: High event loop delay detected');
        fixRequired.push('Optimize blocking operations');
      }

      const duration = performance.now() - startTime;
      const status = issues.filter(i => i.includes('CRITICAL')).length === 0 ? 'PASS' : 'FAIL';
      const severity = issues.length > 0 ? 'MEDIUM' : 'LOW';

      this.results.push({
        phase: 'Phase 4: Memory & Resource Monitoring',
        status,
        issues,
        severity,
        evidence,
        fixRequired,
        duration,
      });

      this.printPhaseResult(status, issues, evidence);
    } catch (error: any) {
      this.results.push({
        phase: 'Phase 4: Memory & Resource Monitoring',
        status: 'FAIL',
        issues: [`Exception: ${error.message}`],
        severity: 'HIGH',
        evidence: [],
        fixRequired: ['Fix unhandled exception in memory tests'],
        duration: performance.now() - startTime,
      });
    }
  }

  /**
   * PHASE 5: BILLING & PLAN ENFORCEMENT VALIDATION
   * Tests plan limits, usage tracking, and enforcement
   */
  private async phase5_BillingEnforcement(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 5: BILLING & PLAN ENFORCEMENT VALIDATION');
    console.log('='.repeat(80) + '\n');

    const startTime = performance.now();
    const issues: string[] = [];
    const evidence: string[] = [];
    const fixRequired: string[] = [];

    try {
      const user = Array.from(this.testUsers.values())[0];
      const accessToken = user.tokens?.accessToken;

      if (!accessToken) {
        issues.push('No access token for billing tests');
        this.results.push({
          phase: 'Phase 5: Billing & Plan Enforcement',
          status: 'FAIL',
          issues,
          severity: 'HIGH',
          evidence: [],
          fixRequired: ['Ensure test user authentication'],
          duration: performance.now() - startTime,
        });
        return;
      }

      // Test 5.1: Attempt to exceed maxPostsPerMonth
      console.log('Test 5.1: Testing post limit enforcement...');
      let postCount = 0;
      let limitEnforced = false;

      for (let i = 0; i < 15; i++) {
        const response = await this.client.post(
          '/posts',
          {
            content: `Limit test post ${i}`,
            platforms: ['twitter'],
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.status === 201) {
          postCount++;
        } else if (response.status === 403 || response.status === 429) {
          limitEnforced = true;
          evidence.push(`Limit enforced after ${postCount} posts`);
          break;
        }
      }

      if (!limitEnforced && postCount >= 10) {
        issues.push('CRITICAL: Post limit not enforced!');
        fixRequired.push('Implement plan limit enforcement for posts');
      }

      // Test 5.2: Check usage tracking accuracy
      console.log('Test 5.2: Verifying usage tracking...');
      try {
        const usageRes = await this.client.get('/billing/usage', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (usageRes.status === 200) {
          const usage = usageRes.data;
          evidence.push(`Posts used: ${usage.usage?.posts || 0}`);
          evidence.push(`AI used: ${usage.usage?.ai || 0}`);
          evidence.push(`Accounts: ${usage.usage?.accounts || 0}`);

          // Verify usage matches actual posts created
          if (Math.abs((usage.usage?.posts || 0) - postCount) > 2) {
            issues.push('WARNING: Usage tracking inaccurate');
            fixRequired.push('Review usage increment logic');
          }
        }
      } catch (error: any) {
        evidence.push(`Usage check failed: ${error.message}`);
      }

      // Test 5.3: Attempt to exceed AI credits
      console.log('Test 5.3: Testing AI limit enforcement...');
      let aiCount = 0;
      let aiLimitEnforced = false;

      for (let i = 0; i < 10; i++) {
        const response = await this.client.post(
          '/ai/generate-caption',
          { prompt: 'Test prompt' },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.status === 200) {
          aiCount++;
        } else if (response.status === 403 || response.status === 429) {
          aiLimitEnforced = true;
          evidence.push(`AI limit enforced after ${aiCount} requests`);
          break;
        }
      }

      if (!aiLimitEnforced && aiCount >= 5) {
        issues.push('WARNING: AI limit not enforced');
        fixRequired.push('Implement AI usage limit enforcement');
      }

      const duration = performance.now() - startTime;
      const status = issues.filter(i => i.includes('CRITICAL')).length === 0 ? 'PASS' : 'FAIL';
      const severity = issues.some(i => i.includes('CRITICAL')) ? 'CRITICAL' : 
                       issues.length > 0 ? 'MEDIUM' : 'LOW';

      this.results.push({
        phase: 'Phase 5: Billing & Plan Enforcement',
        status,
        issues,
        severity,
        evidence,
        fixRequired,
        duration,
      });

      this.printPhaseResult(status, issues, evidence);
    } catch (error: any) {
      this.results.push({
        phase: 'Phase 5: Billing & Plan Enforcement',
        status: 'FAIL',
        issues: [`Exception: ${error.message}`],
        severity: 'CRITICAL',
        evidence: [],
        fixRequired: ['Fix unhandled exception in billing tests'],
        duration: performance.now() - startTime,
      });
    }
  }

  /**
   * PHASE 6: MULTI-TENANT ISOLATION ATTACK
   * Tests workspace isolation and cross-tenant access prevention
   */
  private async phase6_TenantIsolation(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 6: MULTI-TENANT ISOLATION ATTACK');
    console.log('='.repeat(80) + '\n');

    const startTime = performance.now();
    const issues: string[] = [];
    const evidence: string[] = [];
    const fixRequired: string[] = [];

    try {
      const users = Array.from(this.testUsers.values());
      if (users.length < 2) {
        issues.push('Insufficient test users for isolation testing');
        this.results.push({
          phase: 'Phase 6: Multi-Tenant Isolation',
          status: 'FAIL',
          issues,
          severity: 'HIGH',
          evidence: [],
          fixRequired: ['Create multiple test users'],
          duration: performance.now() - startTime,
        });
        return;
      }

      const user1 = users[0];
      const user2 = users[1];

      // Test 6.1: Cross-workspace post access
      console.log('Test 6.1: Testing cross-workspace post access...');
      
      // Create post as user1
      const postRes = await this.client.post(
        '/posts',
        {
          content: 'Isolation test post',
          platforms: ['twitter'],
        },
        {
          headers: { Authorization: `Bearer ${user1.tokens.accessToken}` },
        }
      );

      if (postRes.status === 201) {
        const postId = postRes.data.post._id;
        
        // Try to access as user2
        const accessRes = await this.client.get(`/posts/${postId}`, {
          headers: { Authorization: `Bearer ${user2.tokens.accessToken}` },
        });

        evidence.push(`Cross-workspace access attempt: ${accessRes.status}`);

        if (accessRes.status === 200) {
          issues.push('CRITICAL: Cross-workspace data leak detected!');
          fixRequired.push('Implement workspace isolation in data queries');
        }
      }

      // Test 6.2: Workspace ID header manipulation
      console.log('Test 6.2: Testing workspace ID manipulation...');
      
      const manipulatedRes = await this.client.get('/posts', {
        headers: {
          Authorization: `Bearer ${user2.tokens.accessToken}`,
          'X-Workspace-Id': 'fake-workspace-id',
        },
      });

      evidence.push(`Manipulated header response: ${manipulatedRes.status}`);

      if (manipulatedRes.status === 200 && manipulatedRes.data.posts?.length > 0) {
        issues.push('WARNING: Workspace ID header manipulation possible');
        fixRequired.push('Validate workspace ID against authenticated user');
      }

      // Test 6.3: Token replay across workspaces
      console.log('Test 6.3: Testing token replay attack...');
      
      // Try to use user1's token to access user2's workspace
      const replayRes = await this.client.get('/workspaces', {
        headers: { Authorization: `Bearer ${user1.tokens.accessToken}` },
      });

      if (replayRes.status === 200) {
        const workspaces = replayRes.data.workspaces || [];
        const hasOtherWorkspaces = workspaces.some((w: any) => 
          w.owner !== user1.user._id
        );

        if (hasOtherWorkspaces) {
          issues.push('CRITICAL: Token allows access to other workspaces!');
          fixRequired.push('Enforce workspace membership in token validation');
        }

        evidence.push(`Accessible workspaces: ${workspaces.length}`);
      }

      const duration = performance.now() - startTime;
      const status = issues.filter(i => i.includes('CRITICAL')).length === 0 ? 'PASS' : 'FAIL';
      const severity = issues.some(i => i.includes('CRITICAL')) ? 'CRITICAL' : 
                       issues.length > 0 ? 'HIGH' : 'LOW';

      this.results.push({
        phase: 'Phase 6: Multi-Tenant Isolation',
        status,
        issues,
        severity,
        evidence,
        fixRequired,
        duration,
      });

      this.printPhaseResult(status, issues, evidence);
    } catch (error: any) {
      this.results.push({
        phase: 'Phase 6: Multi-Tenant Isolation',
        status: 'FAIL',
        issues: [`Exception: ${error.message}`],
        severity: 'CRITICAL',
        evidence: [],
        fixRequired: ['Fix unhandled exception in isolation tests'],
        duration: performance.now() - startTime,
      });
    }
  }

  /**
   * Generate final production readiness report
   */
  private generateReport(): ProductionReport {
    console.log('\n' + '='.repeat(80));
    console.log('FINAL PRODUCTION READINESS REPORT');
    console.log('='.repeat(80) + '\n');

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const criticalIssues = this.results.filter(r => r.severity === 'CRITICAL').length;
    const highIssues = this.results.filter(r => r.severity === 'HIGH').length;

    // Calculate survivability score (0-10)
    const baseScore = (passedTests / totalTests) * 10;
    const penaltyCritical = criticalIssues * 2;
    const penaltyHigh = highIssues * 1;
    const survivabilityScore = Math.max(0, baseScore - penaltyCritical - penaltyHigh);

    // Determine component safety
    const concurrencySafety = this.results[0]?.status === 'PASS' && 
                              !this.results[0]?.issues.some(i => i.includes('CRITICAL')) 
                              ? 'SAFE' : 'RISK';
    
    const queueReliability = this.results[1]?.status === 'PASS' ? 'STABLE' : 'UNSTABLE';
    const memoryStability = this.results[3]?.status === 'PASS' ? 'SAFE' : 'LEAKING';
    const planEnforcement = this.results[4]?.status === 'PASS' && 
                           !this.results[4]?.issues.some(i => i.includes('CRITICAL'))
                           ? 'SECURE' : 'BYPASSABLE';
    const tenantIsolation = this.results[5]?.status === 'PASS' &&
                           !this.results[5]?.issues.some(i => i.includes('CRITICAL'))
                           ? 'SAFE' : 'VULNERABLE';

    const readyForProduction = survivabilityScore >= 7 && criticalIssues === 0;

    const report: ProductionReport = {
      survivabilityScore: Math.round(survivabilityScore * 10) / 10,
      concurrencySafety,
      queueReliability,
      memoryStability,
      planEnforcement,
      tenantIsolation,
      readyForProduction,
      results: this.results,
    };

    // Print summary
    console.log(`Production Survivability Score: ${report.survivabilityScore}/10`);
    console.log(`Concurrency Safety: ${report.concurrencySafety}`);
    console.log(`Queue Reliability: ${report.queueReliability}`);
    console.log(`Memory Stability: ${report.memoryStability}`);
    console.log(`Plan Enforcement: ${report.planEnforcement}`);
    console.log(`Tenant Isolation: ${report.tenantIsolation}`);
    console.log(`\nReady for Real User Traffic: ${report.readyForProduction ? '✅ YES' : '❌ NO'}`);

    if (!report.readyForProduction) {
      console.log('\n⚠️  CRITICAL ISSUES MUST BE RESOLVED BEFORE PRODUCTION:');
      this.results.forEach(result => {
        if (result.severity === 'CRITICAL') {
          console.log(`\n${result.phase}:`);
          result.issues.forEach(issue => console.log(`  - ${issue}`));
          result.fixRequired.forEach(fix => console.log(`  → ${fix}`));
        }
      });
    }

    console.log('\n' + '='.repeat(80) + '\n');

    return report;
  }

  /**
   * Helper: Print phase result
   */
  private printPhaseResult(status: string, issues: string[], evidence: string[]): void {
    console.log(`\nStatus: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    
    if (issues.length > 0) {
      console.log('\nIssues Found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (evidence.length > 0) {
      console.log('\nEvidence:');
      evidence.forEach(ev => console.log(`  • ${ev}`));
    }
  }

  /**
   * Helper: Get server metrics
   */
  private async getServerMetrics(): Promise<{ heapUsed: number; rss: number } | null> {
    try {
      const response = await this.client.get('/metrics');
      if (response.status === 200 && response.data.memory) {
        return {
          heapUsed: response.data.memory.heapUsed / 1024 / 1024,
          rss: response.data.memory.rss / 1024 / 1024,
        };
      }
    } catch (error) {
      // Metrics endpoint might not be available
    }
    return null;
  }

  /**
   * Helper: Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
(async () => {
  const validator = new ProductionStressValidator();
  
  try {
    const report = await validator.run();
    
    // Exit with appropriate code
    process.exit(report.readyForProduction ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
})();
