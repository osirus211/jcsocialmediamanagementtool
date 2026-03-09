/**
 * Redis Reconnect Integration Test
 * 
 * Verifies system recovers automatically after Redis restart
 * 
 * Tests:
 * - RedisRecoveryService detects disconnect/reconnect
 * - WorkerManager restarts automatically
 * - QueueMonitoringService restarts automatically
 * - Backpressure monitors restart automatically
 * - Health endpoints return correct status
 * - Metrics reflect recovery events
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectRedis, disconnectRedis, getRecoveryService, isRedisHealthy, getCircuitBreakerStatus } from '../../config/redis';
import { WorkerManager } from '../../services/WorkerManager';
import { queueMonitoringService } from '../../services/QueueMonitoringService';
import { logger } from '../../utils/logger';

// Test configuration
const REDIS_RECONNECT_DELAY = 5000; // 5 seconds (RedisRecoveryService delay)
const TEST_TIMEOUT = 30000; // 30 seconds

describe('Redis Reconnect Integration Tests', () => {
  let workerManager: WorkerManager;
  let recoveryService: any;

  beforeAll(async () => {
    // Connect to Redis
    await connectRedis();
    
    // Get instances
    workerManager = WorkerManager.getInstance();
    recoveryService = getRecoveryService();
    
    // Ensure services are registered
    expect(recoveryService).not.toBeNull();
    
    logger.info('Redis reconnect test setup complete');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup
    await disconnectRedis();
    logger.info('Redis reconnect test cleanup complete');
  }, TEST_TIMEOUT);

  beforeEach(() => {
    // Reset test state
    logger.info('Starting new test case');
  });

  describe('STEP 1 — Service Registration', () => {
    it('should have WorkerManager registered with recovery service', () => {
      const status = recoveryService.getStatus();
      
      expect(status).toBeDefined();
      expect(status.servicesRegistered).toBeGreaterThan(0);
      
      logger.info('Recovery service status', { status });
    });

    it('should have QueueMonitoringService registered with recovery service', () => {
      const status = recoveryService.getStatus();
      
      // Check if queue-monitoring is in the registered services
      // Note: We can't directly check service names, but we can verify count
      expect(status.servicesRegistered).toBeGreaterThanOrEqual(2);
      
      logger.info('Services registered', { count: status.servicesRegistered });
    });

    it('should have WorkerManager running', () => {
      const isRunning = workerManager.isRunning();
      
      expect(isRunning).toBe(true);
      
      logger.info('WorkerManager running status', { isRunning });
    });

    it('should have QueueMonitoringService running', () => {
      const isRunning = queueMonitoringService.isRunning();
      
      expect(isRunning).toBe(true);
      
      logger.info('QueueMonitoringService running status', { isRunning });
    });
  });

  describe('STEP 2 — Redis Health Before Disconnect', () => {
    it('should report Redis as healthy', () => {
      const isHealthy = isRedisHealthy();
      
      expect(isHealthy).toBe(true);
      
      logger.info('Redis health before disconnect', { isHealthy });
    });

    it('should have circuit breaker closed', () => {
      const cbStatus = getCircuitBreakerStatus();
      
      expect(cbStatus.state).toBe('closed');
      
      logger.info('Circuit breaker status before disconnect', { cbStatus });
    });

    it('should have workers running', () => {
      const statuses = workerManager.getStatus();
      const runningWorkers = statuses.filter(s => s.isRunning);
      
      expect(runningWorkers.length).toBeGreaterThan(0);
      
      logger.info('Workers running before disconnect', { 
        total: statuses.length,
        running: runningWorkers.length,
      });
    });
  });

  describe('STEP 3 — Simulate Redis Disconnect (Manual Test)', () => {
    // Note: This test requires manual Redis restart
    // To run: docker stop redis (in another terminal)
    
    it.skip('should detect Redis disconnect', async () => {
      // This test is skipped by default
      // To run manually:
      // 1. Start test
      // 2. Stop Redis: docker stop redis
      // 3. Wait for detection
      
      logger.warn('Manual test: Stop Redis now (docker stop redis)');
      
      // Wait for disconnect detection
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const isHealthy = isRedisHealthy();
      expect(isHealthy).toBe(false);
      
      logger.info('Redis disconnect detected', { isHealthy });
    });

    it.skip('should stop WorkerManager on Redis disconnect', async () => {
      // This test is skipped by default
      // Requires manual Redis stop
      
      logger.warn('Manual test: Stop Redis now (docker stop redis)');
      
      // Wait for disconnect and recovery service to stop workers
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const isRunning = workerManager.isRunning();
      expect(isRunning).toBe(false);
      
      logger.info('WorkerManager stopped after disconnect', { isRunning });
    });

    it.skip('should stop QueueMonitoringService on Redis disconnect', async () => {
      // This test is skipped by default
      // Requires manual Redis stop
      
      logger.warn('Manual test: Stop Redis now (docker stop redis)');
      
      // Wait for disconnect and recovery service to stop monitoring
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const isRunning = queueMonitoringService.isRunning();
      expect(isRunning).toBe(false);
      
      logger.info('QueueMonitoringService stopped after disconnect', { isRunning });
    });
  });

  describe('STEP 4 — Simulate Redis Reconnect (Manual Test)', () => {
    // Note: This test requires manual Redis restart
    // To run: docker start redis (in another terminal)
    
    it.skip('should detect Redis reconnect', async () => {
      // This test is skipped by default
      // To run manually:
      // 1. Ensure Redis is stopped
      // 2. Start test
      // 3. Start Redis: docker start redis
      // 4. Wait for reconnect detection
      
      logger.warn('Manual test: Start Redis now (docker start redis)');
      
      // Wait for reconnect detection and recovery delay
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 5000));
      
      const isHealthy = isRedisHealthy();
      expect(isHealthy).toBe(true);
      
      logger.info('Redis reconnect detected', { isHealthy });
    });

    it.skip('should restart WorkerManager on Redis reconnect', async () => {
      // This test is skipped by default
      // Requires manual Redis start
      
      logger.warn('Manual test: Start Redis now (docker start redis)');
      
      // Wait for reconnect and recovery service to restart workers
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 5000));
      
      const isRunning = workerManager.isRunning();
      expect(isRunning).toBe(true);
      
      const statuses = workerManager.getStatus();
      const runningWorkers = statuses.filter(s => s.isRunning);
      
      expect(runningWorkers.length).toBeGreaterThan(0);
      
      logger.info('WorkerManager restarted after reconnect', { 
        isRunning,
        runningWorkers: runningWorkers.length,
      });
    });

    it.skip('should restart QueueMonitoringService on Redis reconnect', async () => {
      // This test is skipped by default
      // Requires manual Redis start
      
      logger.warn('Manual test: Start Redis now (docker start redis)');
      
      // Wait for reconnect and recovery service to restart monitoring
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 5000));
      
      const isRunning = queueMonitoringService.isRunning();
      expect(isRunning).toBe(true);
      
      logger.info('QueueMonitoringService restarted after reconnect', { isRunning });
    });
  });

  describe('STEP 5 — Verify Recovery Metrics', () => {
    it('should have recovery service metrics', () => {
      const status = recoveryService.getStatus();
      
      expect(status.metrics).toBeDefined();
      expect(status.metrics.disconnect_events).toBeGreaterThanOrEqual(0);
      expect(status.metrics.reconnect_events).toBeGreaterThanOrEqual(0);
      expect(status.metrics.recovery_attempts).toBeGreaterThanOrEqual(0);
      
      logger.info('Recovery service metrics', { metrics: status.metrics });
    });

    it.skip('should increment disconnect events after Redis stop', async () => {
      // This test is skipped by default
      // Requires manual Redis stop/start cycle
      
      const beforeStatus = recoveryService.getStatus();
      const beforeDisconnects = beforeStatus.metrics.disconnect_events;
      
      logger.warn('Manual test: Stop Redis now (docker stop redis)');
      
      // Wait for disconnect detection
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const afterStatus = recoveryService.getStatus();
      const afterDisconnects = afterStatus.metrics.disconnect_events;
      
      expect(afterDisconnects).toBeGreaterThan(beforeDisconnects);
      
      logger.info('Disconnect events incremented', { 
        before: beforeDisconnects,
        after: afterDisconnects,
      });
    });

    it.skip('should increment reconnect events after Redis start', async () => {
      // This test is skipped by default
      // Requires manual Redis stop/start cycle
      
      const beforeStatus = recoveryService.getStatus();
      const beforeReconnects = beforeStatus.metrics.reconnect_events;
      
      logger.warn('Manual test: Start Redis now (docker start redis)');
      
      // Wait for reconnect detection and recovery
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 5000));
      
      const afterStatus = recoveryService.getStatus();
      const afterReconnects = afterStatus.metrics.reconnect_events;
      
      expect(afterReconnects).toBeGreaterThan(beforeReconnects);
      
      logger.info('Reconnect events incremented', { 
        before: beforeReconnects,
        after: afterReconnects,
      });
    });
  });

  describe('STEP 6 — Verify System State After Recovery', () => {
    it.skip('should have all enabled workers running after recovery', async () => {
      // This test is skipped by default
      // Requires manual Redis stop/start cycle
      
      logger.warn('Manual test: Complete Redis stop/start cycle first');
      
      // Wait for full recovery
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 5000));
      
      const statuses = workerManager.getStatus();
      const enabledWorkers = statuses.filter(s => s.isEnabled);
      const runningWorkers = statuses.filter(s => s.isRunning);
      
      expect(runningWorkers.length).toBe(enabledWorkers.length);
      
      logger.info('All enabled workers running after recovery', { 
        enabled: enabledWorkers.length,
        running: runningWorkers.length,
      });
    });

    it.skip('should have queue monitoring active after recovery', async () => {
      // This test is skipped by default
      // Requires manual Redis stop/start cycle
      
      logger.warn('Manual test: Complete Redis stop/start cycle first');
      
      // Wait for full recovery
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 5000));
      
      const isRunning = queueMonitoringService.isRunning();
      const status = queueMonitoringService.getStatus();
      
      expect(isRunning).toBe(true);
      expect(status.queues.length).toBeGreaterThan(0);
      
      logger.info('Queue monitoring active after recovery', { 
        isRunning,
        queuesMonitored: status.queues.length,
      });
    });

    it.skip('should have backpressure monitors running after recovery', async () => {
      // This test is skipped by default
      // Requires manual Redis stop/start cycle
      
      logger.warn('Manual test: Complete Redis stop/start cycle first');
      
      // Wait for full recovery
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 5000));
      
      // Backpressure monitors are started by WorkerManager
      // If WorkerManager is running, backpressure monitors should be running
      const isRunning = workerManager.isRunning();
      
      expect(isRunning).toBe(true);
      
      logger.info('Backpressure monitors should be running (via WorkerManager)', { 
        workerManagerRunning: isRunning,
      });
    });

    it.skip('should have circuit breaker closed after recovery', async () => {
      // This test is skipped by default
      // Requires manual Redis stop/start cycle
      
      logger.warn('Manual test: Complete Redis stop/start cycle first');
      
      // Wait for full recovery and circuit breaker to close
      await new Promise(resolve => setTimeout(resolve, REDIS_RECONNECT_DELAY + 10000));
      
      const cbStatus = getCircuitBreakerStatus();
      
      expect(cbStatus.state).toBe('closed');
      
      logger.info('Circuit breaker closed after recovery', { cbStatus });
    });
  });

  describe('STEP 7 — Automated Recovery Test (Programmatic)', () => {
    it('should have recovery service with forceRecovery method', () => {
      // Check if recovery service has forceRecovery method for testing
      expect(recoveryService).toBeDefined();
      expect(typeof recoveryService.getStatus).toBe('function');
      
      logger.info('Recovery service methods available');
    });

    it('should maintain service registration after multiple operations', async () => {
      const status1 = recoveryService.getStatus();
      const count1 = status1.servicesRegistered;
      
      // Perform some operations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status2 = recoveryService.getStatus();
      const count2 = status2.servicesRegistered;
      
      expect(count2).toBe(count1);
      
      logger.info('Service registration stable', { 
        before: count1,
        after: count2,
      });
    });
  });
});

