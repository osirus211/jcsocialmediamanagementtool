import { publishingWorkerWrapper } from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';

describe('Stress & Reliability Validation', () => {
  
  beforeEach(() => {
    publishingWorkerWrapper.resetMetrics();
    publishingWorkerWrapper.shutdown();
    const circuitBreakerManager = (publishingWorkerWrapper as any).circuitBreakerManager;
    if (circuitBreakerManager && circuitBreakerManager.resetAllCircuitBreakers) {
      circuitBreakerManager.resetAllCircuitBreakers();
    }
  });

  afterEach(() => {
    publishingWorkerWrapper.resetMetrics();
    const circuitBreakerManager = (publishingWorkerWrapper as any).circuitBreakerManager;
    if (circuitBreakerManager && circuitBreakerManager.resetAllCircuitBreakers) {
      circuitBreakerManager.resetAllCircuitBreakers();
    }
  });

  afterAll(() => {
    publishingWorkerWrapper.shutdown();
  });

  describe('1. High Concurrency', () => {
    
    it('should handle 50+ concurrent publish jobs', async () => {
      const mockPublish = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      const concurrentJobs = 50;
      const jobs = [];
      
      for (let i = 0; i < concurrentJobs; i++) {
        jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' }));
      }
      
      const startTime = Date.now();
      const results = await Promise.all(jobs);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(concurrentJobs);
      results.forEach(result => expect(result.platformPostId).toBe('post-123'));
      expect(mockPublish).toHaveBeenCalledTimes(concurrentJobs);
      
      console.log(`50 concurrent jobs: ${duration}ms (${(duration / concurrentJobs).toFixed(2)}ms avg)`);
    });

    it('should ensure no race conditions under high concurrency', async () => {
      const mockPublish = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      const concurrentJobs = 100;
      const jobs = [];
      
      for (let i = 0; i < concurrentJobs; i++) {
        jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' }));
      }
      
      const results = await Promise.all(jobs);
      expect(results).toHaveLength(concurrentJobs);
      results.forEach(result => expect(result.platformPostId).toBe('post-123'));
      expect(mockPublish).toHaveBeenCalledTimes(concurrentJobs);
    });
  });

  describe('2. Retry Storm Scenario', () => {
    
    it('should prevent retry amplification', async () => {
      const mockPublish = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      let totalAttempts = 0;
      const maxRetries = 3;
      
      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: 'test-post', platform: 'twitter' });
        } catch (error) {
          totalAttempts++;
        }
      }
      
      expect(totalAttempts).toBe(maxRetries);
      expect(mockPublish).toHaveBeenCalledTimes(maxRetries);
    });

    it('should open circuit breaker after repeated failures', async () => {
      const mockPublish = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      const failureThreshold = 3;
      
      for (let i = 0; i < failureThreshold; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' });
        } catch (error) {}
      }
      
      const circuitState = publishingWorkerWrapper.getCircuitState('socialPublishing');
      expect(circuitState).toBe('OPEN');
    });

    it('should prevent infinite retry loops', async () => {
      const mockPublish = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      let attemptCount = 0;
      const maxAttempts = 10;
      
      for (let i = 0; i < maxAttempts; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' });
        } catch (error: any) {
          attemptCount++;
          if (error.circuitBreakerOpen) break;
        }
      }
      
      expect(attemptCount).toBeLessThan(maxAttempts);
    });
  });

  describe('3. Circuit Breaker Under Load', () => {
    
    it('should prevent hammering when circuit is OPEN', async () => {
      const mockPublish = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      for (let i = 0; i < 5; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' });
        } catch (error) {}
      }
      
      const callCountBeforeOpen = mockPublish.mock.calls.length;
      const circuitState = publishingWorkerWrapper.getCircuitState('socialPublishing');
      expect(circuitState).toBe('OPEN');
      
      for (let i = 0; i < 10; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-open-${i}`, platform: 'twitter' });
        } catch (error: any) {
          expect(error.circuitBreakerOpen).toBe(true);
        }
      }
      
      expect(mockPublish.mock.calls.length).toBe(callCountBeforeOpen);
    });

    it('should verify correct state transitions', async () => {
      const stateTransitions: string[] = [];
      let state = publishingWorkerWrapper.getCircuitState('socialPublishing');
      stateTransitions.push(state);
      expect(state).toBe('CLOSED');
      
      const mockPublish = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      for (let i = 0; i < 5; i++) {
        try {
          await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' });
        } catch (error) {}
      }
      
      state = publishingWorkerWrapper.getCircuitState('socialPublishing');
      stateTransitions.push(state);
      expect(state).toBe('OPEN');
      expect(stateTransitions).toContain('CLOSED');
      expect(stateTransitions).toContain('OPEN');
    });
  });

  describe('4. Worker Crash Simulation', () => {
    
    it('should safely retry after crash', async () => {
      const mockPublish = jest.fn()
        .mockRejectedValueOnce(new Error('Worker crashed'))
        .mockResolvedValueOnce({ success: true, platformPostId: 'post-123' });
      
      let crashOccurred = false;
      let recoverySucceeded = false;
      
      try {
        await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: 'test-post', platform: 'twitter' });
      } catch (error) {
        crashOccurred = true;
      }
      
      try {
        const result = await publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: 'test-post', platform: 'twitter' });
        if (result && result.platformPostId) recoverySucceeded = true;
      } catch (error) {}
      
      expect(crashOccurred).toBe(true);
      expect(recoverySucceeded).toBe(true);
    });

    it('should ensure no stuck jobs after crash', async () => {
      const mockPublish = jest.fn()
        .mockRejectedValueOnce(new Error('Crash'))
        .mockResolvedValueOnce({ success: true, platformPostId: 'post-123' });
      
      const jobs = [];
      for (let i = 0; i < 5; i++) {
        jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' }).catch(() => ({ crashed: true })));
      }
      
      const results = await Promise.all(jobs);
      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  describe('5. Performance Validation', () => {
    
    it('should measure wrapper overhead', async () => {
      const mockPublish = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      const iterations = 100;
      const jobs = [];
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' }));
      }
      
      await Promise.all(jobs);
      const duration = Date.now() - startTime;
      const avgOverhead = duration / iterations;
      
      console.log(`Wrapper overhead: ${avgOverhead.toFixed(2)}ms per op (${iterations} ops in ${duration}ms)`);
      expect(avgOverhead).toBeLessThan(50);
    });

    it('should ensure acceptable throughput', async () => {
      const mockPublish = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      const operations = 200;
      const startTime = Date.now();
      const jobs = [];
      
      for (let i = 0; i < operations; i++) {
        jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' }));
      }
      
      await Promise.all(jobs);
      const duration = Date.now() - startTime;
      const throughput = (operations / duration) * 1000;
      
      console.log(`Throughput: ${throughput.toFixed(2)} ops/sec (${operations} ops in ${duration}ms)`);
      expect(throughput).toBeGreaterThan(10);
    });

    it('should ensure no memory leak', async () => {
      const mockPublish = jest.fn().mockResolvedValue({ success: true, platformPostId: 'post-123' });
      const operations = 1000;
      const batchSize = 100;
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let batch = 0; batch < operations / batchSize; batch++) {
        const jobs = [];
        for (let i = 0; i < batchSize; i++) {
          jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${batch * batchSize + i}`, platform: 'twitter' }));
        }
        await Promise.all(jobs);
        if (global.gc) global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB after ${operations} ops`);
      expect(memoryGrowthMB).toBeLessThan(50);
    });

    it('should ensure non-blocking operations', async () => {
      const mockPublish = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { success: true, platformPostId: 'post-123' };
      });
      
      const concurrentOps = 50;
      const startTime = Date.now();
      const jobs = [];
      
      for (let i = 0; i < concurrentOps; i++) {
        jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mockPublish, { postId: `test-post-${i}`, platform: 'twitter' }));
      }
      
      await Promise.all(jobs);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(200);
      console.log(`${concurrentOps} concurrent ops in ${duration}ms (non-blocking confirmed)`);
    });
  });
});

import { publishingWorkerWrapper } from '../../../../../.kiro/execution/reliability/PublishingWorkerWrapper';

describe('Stress Validation', () => {
  beforeEach(() => {
    publishingWorkerWrapper.resetMetrics();
    publishingWorkerWrapper.shutdown();
    const cb = (publishingWorkerWrapper as any).circuitBreakerManager;
    if (cb && cb.resetAllCircuitBreakers) cb.resetAllCircuitBreakers();
  });

  afterEach(() => {
    publishingWorkerWrapper.resetMetrics();
    const cb = (publishingWorkerWrapper as any).circuitBreakerManager;
    if (cb && cb.resetAllCircuitBreakers) cb.resetAllCircuitBreakers();
  });

  afterAll(() => publishingWorkerWrapper.shutdown());

  it('should handle 50 concurrent jobs', async () => {
    const mock = jest.fn().mockResolvedValue({ success: true, platformPostId: 'p123' });
    const jobs = [];
    for (let i = 0; i < 50; i++) {
      jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mock, { postId: `p${i}`, platform: 'twitter' }));
    }
    const results = await Promise.all(jobs);
    expect(results).toHaveLength(50);
    expect(mock).toHaveBeenCalledTimes(50);
  });

  it('should prevent retry amplification', async () => {
    const mock = jest.fn().mockRejectedValue(new Error('fail'));
    let attempts = 0;
    for (let i = 0; i < 3; i++) {
      try {
        await publishingWorkerWrapper.wrapPlatformPublish(mock, { postId: 'p1', platform: 'twitter' });
      } catch (e) {
        attempts++;
      }
    }
    expect(attempts).toBe(3);
  });

  it('should open circuit after failures', async () => {
    const mock = jest.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      try {
        await publishingWorkerWrapper.wrapPlatformPublish(mock, { postId: `p${i}`, platform: 'twitter' });
      } catch (e) {}
    }
    expect(publishingWorkerWrapper.getCircuitState('socialPublishing')).toBe('OPEN');
  });

  it('should measure throughput', async () => {
    const mock = jest.fn().mockResolvedValue({ success: true, platformPostId: 'p123' });
    const start = Date.now();
    const jobs = [];
    for (let i = 0; i < 200; i++) {
      jobs.push(publishingWorkerWrapper.wrapPlatformPublish(mock, { postId: `p${i}`, platform: 'twitter' }));
    }
    await Promise.all(jobs);
    const duration = Date.now() - start;
    const throughput = (200 / duration) * 1000;
    console.log(`Throughput: ${throughput.toFixed(2)} ops/sec`);
    expect(throughput).toBeGreaterThan(10);
  });
});
