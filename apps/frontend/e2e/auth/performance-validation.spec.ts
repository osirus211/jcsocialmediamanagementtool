import { test, expect, devices } from '@playwright/test';
import { AuthHelpers } from '../helpers/auth-helpers';

/**
 * Performance Validation Test Suite - Task 3.3
 * 
 * STEP 3 — Performance Validation (100 concurrent requests)
 * 
 * This test suite validates the authentication system performance under load
 * as specified in task 3.3 of the email-password-login-security-fix spec.
 * 
 * Requirements:
 * - Implement 100 concurrent login request performance test
 * - Measure and validate response times (< 100ms average target)
 * - Validate success rates (> 95% target)
 * - Test authentication system under realistic load
 * - Implement performance monitoring and metrics collection
 * - Create performance benchmarking reports
 * 
 * **Validates: Requirements 2.1, 2.9, 3.7**
 * 
 * Bug_Condition: Performance degradation under load
 * Expected_Behavior: System handles concurrent requests efficiently
 * Preservation: Existing performance characteristics for legitimate users
 */

// Use WebKit as specified in requirements
test.use({ ...devices['Desktop Safari'] });

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  responseTimes: number[];
  errors: string[];
}

interface LoginResult {
  success: boolean;
  responseTime: number;
  statusCode: number;
  error?: string;
  timestamp: number;
}

test.describe('Performance Validation - 100 Concurrent Login Requests', () => {
  test('should handle 100 concurrent login requests efficiently', async ({ browser }) => {
    console.log('🚀 Starting Performance Validation Test - 100 Concurrent Login Requests');
    console.log('📊 Target Metrics:');
    console.log('   - Average Response Time: < 100ms');
    console.log('   - Success Rate: > 95%');
    console.log('   - Concurrent Requests: 100');
    console.log('');

    const startTime = Date.now();
    const results: LoginResult[] = [];
    
    // Create 100 concurrent login requests
    const loginPromises = Array.from({ length: 100 }, async (_, index) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        const requestStartTime = Date.now();
        
        // Navigate to login page
        await page.goto('/login');
        
        // Perform login request via API (more accurate for performance testing)
        const response = await page.request.post('http://localhost:5000/api/v1/auth/login', {
          data: {
            email: `test-user-${index}@example.com`,
            password: 'TestPassword123!'
          },
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const responseTime = Date.now() - requestStartTime;
        
        const result: LoginResult = {
          success: response.ok(),
          responseTime,
          statusCode: response.status(),
          timestamp: Date.now()
        };
        
        if (!response.ok()) {
          const errorText = await response.text().catch(() => 'Unknown error');
          result.error = `Status ${response.status()}: ${errorText}`;
        }
        
        return result;
        
      } catch (error) {
        const responseTime = Date.now() - requestStartTime;
        return {
          success: false,
          responseTime,
          statusCode: 0,
          error: error.message,
          timestamp: Date.now()
        } as LoginResult;
        
      } finally {
        await context.close();
      }
    });
    
    // Execute all requests concurrently
    console.log('⏳ Executing 100 concurrent login requests...');
    const concurrentResults = await Promise.all(loginPromises);
    results.push(...concurrentResults);
    
    const totalTime = Date.now() - startTime;
    
    // Calculate performance metrics
    const metrics = calculatePerformanceMetrics(results);
    
    // Generate performance report
    generatePerformanceReport(metrics, totalTime);
    
    // Validate performance requirements
    console.log('🔍 Validating Performance Requirements:');
    
    // Requirement 1: Average response time < 100ms
    console.log(`   Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms (Target: < 100ms)`);
    expect(metrics.averageResponseTime).toBeLessThan(100);
    
    // Requirement 2: Success rate > 95%
    console.log(`   Success Rate: ${metrics.successRate.toFixed(2)}% (Target: > 95%)`);
    expect(metrics.successRate).toBeGreaterThan(95);
    
    // Requirement 3: All requests completed within reasonable time (5 seconds max)
    console.log(`   Total Execution Time: ${totalTime}ms (Target: < 5000ms)`);
    expect(totalTime).toBeLessThan(5000);
    
    // Additional performance validations
    console.log(`   Min Response Time: ${metrics.minResponseTime}ms`);
    console.log(`   Max Response Time: ${metrics.maxResponseTime}ms`);
    console.log(`   Successful Requests: ${metrics.successfulRequests}/${metrics.totalRequests}`);
    
    // Validate no excessive response time outliers (95th percentile < 200ms)
    const p95ResponseTime = calculatePercentile(metrics.responseTimes, 95);
    console.log(`   95th Percentile Response Time: ${p95ResponseTime.toFixed(2)}ms (Target: < 200ms)`);
    expect(p95ResponseTime).toBeLessThan(200);
    
    // Log any errors for debugging
    if (metrics.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      metrics.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      if (metrics.errors.length > 5) {
        console.log(`   ... and ${metrics.errors.length - 5} more errors`);
      }
    }
    
    console.log('✅ Performance Validation Test Completed Successfully');
  });

  test('should maintain performance under mixed load scenarios', async ({ browser }) => {
    console.log('🔄 Testing Mixed Load Scenarios');
    
    // Test with different user types and request patterns
    const scenarios = [
      { name: 'Valid Users', count: 70, useValidCredentials: true },
      { name: 'Invalid Users', count: 20, useValidCredentials: false },
      { name: 'Rate Limited Users', count: 10, useValidCredentials: true, rapidFire: true }
    ];
    
    const allResults: LoginResult[] = [];
    
    for (const scenario of scenarios) {
      console.log(`   Running ${scenario.name} scenario (${scenario.count} requests)...`);
      
      const scenarioPromises = Array.from({ length: scenario.count }, async (_, index) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
          const requestStartTime = Date.now();
          
          // Determine credentials based on scenario
          const email = scenario.useValidCredentials 
            ? `valid-user-${index}@example.com`
            : `invalid-user-${index}@example.com`;
          const password = scenario.useValidCredentials 
            ? 'TestPassword123!'
            : 'WrongPassword123!';
          
          // Add delay for rapid fire scenario to simulate rate limiting
          if (scenario.rapidFire && index > 0) {
            await page.waitForTimeout(50); // Small delay between requests
          }
          
          const response = await page.request.post('http://localhost:5000/api/v1/auth/login', {
            data: { email, password },
            headers: { 'Content-Type': 'application/json' }
          });
          
          const responseTime = Date.now() - requestStartTime;
          
          return {
            success: response.ok(),
            responseTime,
            statusCode: response.status(),
            timestamp: Date.now(),
            error: response.ok() ? undefined : `${scenario.name}: Status ${response.status()}`
          } as LoginResult;
          
        } catch (error) {
          return {
            success: false,
            responseTime: Date.now() - requestStartTime,
            statusCode: 0,
            error: `${scenario.name}: ${error.message}`,
            timestamp: Date.now()
          } as LoginResult;
        } finally {
          await context.close();
        }
      });
      
      const scenarioResults = await Promise.all(scenarioPromises);
      allResults.push(...scenarioResults);
    }
    
    // Analyze mixed load performance
    const metrics = calculatePerformanceMetrics(allResults);
    
    console.log('📊 Mixed Load Performance Results:');
    console.log(`   Total Requests: ${metrics.totalRequests}`);
    console.log(`   Success Rate: ${metrics.successRate.toFixed(2)}%`);
    console.log(`   Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    
    // Validate that system handles mixed load appropriately
    expect(metrics.totalRequests).toBe(100);
    expect(metrics.averageResponseTime).toBeLessThan(150); // Slightly higher threshold for mixed load
    
    console.log('✅ Mixed Load Scenario Test Completed');
  });

  test('should validate authentication system resilience under sustained load', async ({ browser }) => {
    console.log('🔥 Testing Sustained Load Resilience');
    
    // Run 3 waves of 50 concurrent requests with short intervals
    const waves = 3;
    const requestsPerWave = 50;
    const waveInterval = 1000; // 1 second between waves
    
    const allResults: LoginResult[] = [];
    
    for (let wave = 0; wave < waves; wave++) {
      console.log(`   Wave ${wave + 1}/${waves}: ${requestsPerWave} concurrent requests...`);
      
      const wavePromises = Array.from({ length: requestsPerWave }, async (_, index) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
          const requestStartTime = Date.now();
          
          const response = await page.request.post('http://localhost:5000/api/v1/auth/login', {
            data: {
              email: `wave-${wave}-user-${index}@example.com`,
              password: 'TestPassword123!'
            },
            headers: { 'Content-Type': 'application/json' }
          });
          
          const responseTime = Date.now() - requestStartTime;
          
          return {
            success: response.ok(),
            responseTime,
            statusCode: response.status(),
            timestamp: Date.now(),
            error: response.ok() ? undefined : `Wave ${wave + 1}: Status ${response.status()}`
          } as LoginResult;
          
        } catch (error) {
          return {
            success: false,
            responseTime: Date.now() - requestStartTime,
            statusCode: 0,
            error: `Wave ${wave + 1}: ${error.message}`,
            timestamp: Date.now()
          } as LoginResult;
        } finally {
          await context.close();
        }
      });
      
      const waveResults = await Promise.all(wavePromises);
      allResults.push(...waveResults);
      
      // Wait between waves (except for the last wave)
      if (wave < waves - 1) {
        await new Promise(resolve => setTimeout(resolve, waveInterval));
      }
    }
    
    // Analyze sustained load performance
    const metrics = calculatePerformanceMetrics(allResults);
    
    console.log('📊 Sustained Load Performance Results:');
    console.log(`   Total Requests: ${metrics.totalRequests}`);
    console.log(`   Success Rate: ${metrics.successRate.toFixed(2)}%`);
    console.log(`   Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    
    // Validate sustained load performance
    expect(metrics.totalRequests).toBe(waves * requestsPerWave);
    expect(metrics.successRate).toBeGreaterThan(90); // Slightly lower threshold for sustained load
    expect(metrics.averageResponseTime).toBeLessThan(200); // Higher threshold for sustained load
    
    console.log('✅ Sustained Load Resilience Test Completed');
  });
});

/**
 * Calculate comprehensive performance metrics from test results
 */
function calculatePerformanceMetrics(results: LoginResult[]): PerformanceMetrics {
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = results.length - successfulRequests;
  const responseTimes = results.map(r => r.responseTime);
  const errors = results.filter(r => r.error).map(r => r.error!);
  
  const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  const successRate = (successfulRequests / results.length) * 100;
  
  return {
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    minResponseTime,
    maxResponseTime,
    successRate,
    responseTimes,
    errors
  };
}

/**
 * Calculate percentile from array of numbers
 */
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * Generate detailed performance report
 */
function generatePerformanceReport(metrics: PerformanceMetrics, totalTime: number): void {
  console.log('');
  console.log('📊 PERFORMANCE VALIDATION REPORT');
  console.log('═'.repeat(50));
  console.log(`Total Execution Time: ${totalTime}ms`);
  console.log(`Total Requests: ${metrics.totalRequests}`);
  console.log(`Successful Requests: ${metrics.successfulRequests}`);
  console.log(`Failed Requests: ${metrics.failedRequests}`);
  console.log(`Success Rate: ${metrics.successRate.toFixed(2)}%`);
  console.log('');
  console.log('Response Time Statistics:');
  console.log(`  Average: ${metrics.averageResponseTime.toFixed(2)}ms`);
  console.log(`  Minimum: ${metrics.minResponseTime}ms`);
  console.log(`  Maximum: ${metrics.maxResponseTime}ms`);
  console.log(`  50th Percentile: ${calculatePercentile(metrics.responseTimes, 50).toFixed(2)}ms`);
  console.log(`  90th Percentile: ${calculatePercentile(metrics.responseTimes, 90).toFixed(2)}ms`);
  console.log(`  95th Percentile: ${calculatePercentile(metrics.responseTimes, 95).toFixed(2)}ms`);
  console.log(`  99th Percentile: ${calculatePercentile(metrics.responseTimes, 99).toFixed(2)}ms`);
  console.log('');
  console.log('Performance Targets:');
  console.log(`  ✓ Average Response Time < 100ms: ${metrics.averageResponseTime < 100 ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Success Rate > 95%: ${metrics.successRate > 95 ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Total Time < 5000ms: ${totalTime < 5000 ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ 95th Percentile < 200ms: ${calculatePercentile(metrics.responseTimes, 95) < 200 ? 'PASS' : 'FAIL'}`);
  console.log('═'.repeat(50));
  console.log('');
}