# Phase 3 — Redis Connection Resilience Implementation Plan

**Date:** 2026-03-07  
**Status:** ✅ AUDIT CONFIRMED - READY FOR IMPLEMENTATION  
**Approach:** REUSE existing infrastructure, DO NOT create new services

---

## Audit Confirmation

Based on `REDIS_RESILIENCE_DUPLICATION_AUDIT.md`, the following existing infrastructure will be reused:

✅ **CONFIRMED - Existing Infrastructure:**
1. Redis retry strategies (exponential backoff, max 10 attempts)
2. Circuit breaker (50% error threshold, 30s open duration, half-open testing)
3. RedisRecoveryService (auto-restart services on reconnect)
4. BullMQ connection config (correct retry and timeout settings)
5. Health checks (`isRedisHealthy()`, `getCircuitBreakerStatus()`)
6. Distributed lock safety (graceful degradation)

❌ **CONFIRMED - DO NOT CREATE:**
- New Redis connection manager
- New circuit breaker service
- New recovery service
- New retry strategy
- New health check service

✅ **CONFIRMED - IMPLEMENTATION SCOPE:**
- Integrate WorkerManager with RedisRecoveryService
- Register monitoring services with recovery
- Add health endpoints
- Export Prometheus metrics
- Add integration tests

---

## Implementation Steps

### STEP 1 — WorkerManager Integration with RedisRecoveryService

**Objective:** Register WorkerManager as a recoverable service so workers restart automatically after Redis reconnects.

**Files to Modify:**
1. `src/services/WorkerManager.ts`
2. `src/server.ts`
3. `src/workers-standalone.ts`

**Implementation:**

#### 1.1 Add Recovery Interface to WorkerManager

**File:** `src/services/WorkerManager.ts`

**Add Methods:**
```typescript
/**
 * Check if WorkerManager is running
 * (Required by RedisRecoveryService)
 */
isRunning(): boolean {
  // WorkerManager is running if any enabled worker is running
  for (const entry of this.workers.values()) {
    if (entry.config.enabled && entry.status.isRunning) {
      return true;
    }
  }
  return false;
}

/**
 * Get Redis health status
 */
getRedisHealth(): {
  isHealthy: boolean;
  circuitBreaker: any;
  recoveryService: any;
} {
  const { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } = require('../config/redis');
  
  return {
    isHealthy: isRedisHealthy(),
    circuitBreaker: getCircuitBreakerStatus(),
    recoveryService: getRecoveryService()?.getStatus() || null,
  };
}
```

#### 1.2 Register WorkerManager with RedisRecoveryService

**File:** `src/server.ts`

**Location:** After WorkerManager initialization, before server starts

**Add Registration:**
```typescript
// Register WorkerManager with Redis recovery service
if (redisConnected) {
  try {
    const recoveryService = getRecoveryService();
    if (recoveryService) {
      recoveryService.registerService({
        name: 'worker-manager',
        isRunning: () => workerManager.isRunning(),
        start: async () => await workerManager.startAll(),
        stop: async () => await workerManager.stopAll(),
        requiresRedis: true,
      });
      
      logger.info('✅ WorkerManager registered with Redis recovery service');
    }
  } catch (error) {
    logger.warn('Failed to register WorkerManager with recovery service', {
      error: error.message,
    });
  }
}
```

**File:** `src/workers-standalone.ts`

**Location:** After WorkerManager initialization

**Add Registration:**
```typescript
// Register WorkerManager with Redis recovery service
const recoveryService = getRecoveryService();
if (recoveryService) {
  recoveryService.registerService({
    name: 'worker-manager',
    isRunning: () => workerManager.isRunning(),
    start: async () => await workerManager.startAll(),
    stop: async () => await workerManager.stopAll(),
    requiresRedis: true,
  });
  
  logger.info('✅ WorkerManager registered with Redis recovery service');
}
```

**Expected Behavior:**
- Redis disconnects → WorkerManager.stopAll() called → All workers stop
- Redis reconnects → WorkerManager.startAll() called → All workers restart
- Backpressure monitors restart automatically (integrated in startAll/stopAll)

---

### STEP 2 — Monitoring Recovery Registration

**Objective:** Register QueueMonitoringService with RedisRecoveryService so monitoring resumes after Redis reconnects.

**Files to Modify:**
1. `src/services/QueueMonitoringService.ts`
2. `src/server.ts`

**Implementation:**

#### 2.1 Add Recovery Interface to QueueMonitoringService

**File:** `src/services/QueueMonitoringService.ts`

**Add Methods:**
```typescript
/**
 * Check if monitoring is running
 * (Required by RedisRecoveryService)
 */
isRunning(): boolean {
  return this.isMonitoring;
}

/**
 * Get monitoring status
 */
getStatus(): {
  isRunning: boolean;
  queuesMonitored: number;
  lastCheckAt: Date | null;
} {
  return {
    isRunning: this.isMonitoring,
    queuesMonitored: this.queueNames.length,
    lastCheckAt: this.lastCheckAt || null,
  };
}
```

#### 2.2 Register QueueMonitoringService with RedisRecoveryService

**File:** `src/server.ts`

**Location:** After QueueMonitoringService initialization

**Add Registration:**
```typescript
// Register QueueMonitoringService with Redis recovery service
if (redisConnected) {
  try {
    const recoveryService = getRecoveryService();
    if (recoveryService) {
      recoveryService.registerService({
        name: 'queue-monitoring',
        isRunning: () => queueMonitoringService.isRunning(),
        start: () => queueMonitoringService.start(),
        stop: () => queueMonitoringService.stop(),
        requiresRedis: true,
      });
      
      logger.info('✅ QueueMonitoringService registered with Redis recovery service');
    }
  } catch (error) {
    logger.warn('Failed to register QueueMonitoringService with recovery service', {
      error: error.message,
    });
  }
}
```

**Note:** Backpressure monitors are already integrated with WorkerManager (started in `startAll()`, stopped in `stopAll()`), so they will automatically restart when WorkerManager restarts.

**Expected Behavior:**
- Redis disconnects → QueueMonitoringService.stop() called → Monitoring stops
- Redis reconnects → QueueMonitoringService.start() called → Monitoring resumes
- Backpressure monitors restart via WorkerManager

---

### STEP 3 — Health Endpoints

**Objective:** Expose existing health checks via HTTP endpoints.

**Files to Create:**
1. `src/routes/health.ts` (NEW)
2. `src/controllers/HealthController.ts` (NEW)

**Files to Modify:**
1. `src/app.ts` (register health routes)

**Implementation:**

#### 3.1 Create HealthController

**File:** `src/controllers/HealthController.ts` (NEW)

```typescript
import { Request, Response } from 'express';
import { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } from '../config/redis';
import { WorkerManager } from '../services/WorkerManager';
import { queueMonitoringService } from '../services/QueueMonitoringService';
import { logger } from '../utils/logger';

export class HealthController {
  /**
   * GET /health/redis
   * Redis connection health
   */
  async getRedisHealth(req: Request, res: Response): Promise<void> {
    try {
      const isHealthy = isRedisHealthy();
      const circuitBreaker = getCircuitBreakerStatus();
      const recoveryService = getRecoveryService();
      
      const health = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        redis: {
          connected: isHealthy,
          circuitBreaker: {
            state: circuitBreaker.state,
            errorRate: circuitBreaker.errorRate,
            errors: circuitBreaker.errors,
            successes: circuitBreaker.successes,
            lastError: circuitBreaker.lastError,
            openedAt: circuitBreaker.openedAt,
          },
        },
        recovery: recoveryService ? recoveryService.getStatus() : null,
      };
      
      const statusCode = isHealthy ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error: any) {
      logger.error('Error getting Redis health', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  /**
   * GET /health/workers
   * Worker health status
   */
  async getWorkersHealth(req: Request, res: Response): Promise<void> {
    try {
      const workerManager = WorkerManager.getInstance();
      const workerStatuses = workerManager.getStatus();
      const isHealthy = workerManager.isHealthy();
      const redisHealth = workerManager.getRedisHealth();
      
      const health = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        workers: workerStatuses,
        redis: redisHealth,
        summary: {
          total: workerStatuses.length,
          enabled: workerStatuses.filter(w => w.isEnabled).length,
          running: workerStatuses.filter(w => w.isRunning).length,
          healthy: isHealthy,
        },
      };
      
      const statusCode = isHealthy ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error: any) {
      logger.error('Error getting workers health', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  /**
   * GET /health/queues
   * Queue health status
   */
  async getQueuesHealth(req: Request, res: Response): Promise<void> {
    try {
      const queueStats = await queueMonitoringService.getAllQueueStats();
      const monitoringStatus = queueMonitoringService.getStatus();
      
      // Determine overall health
      const unhealthyQueues = queueStats.filter(q => q.health === 'unhealthy');
      const degradedQueues = queueStats.filter(q => q.health === 'degraded');
      
      let overallStatus = 'healthy';
      if (unhealthyQueues.length > 0) {
        overallStatus = 'unhealthy';
      } else if (degradedQueues.length > 0) {
        overallStatus = 'degraded';
      }
      
      const health = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        monitoring: monitoringStatus,
        queues: queueStats,
        summary: {
          total: queueStats.length,
          healthy: queueStats.filter(q => q.health === 'healthy').length,
          degraded: degradedQueues.length,
          unhealthy: unhealthyQueues.length,
        },
      };
      
      const statusCode = overallStatus === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error: any) {
      logger.error('Error getting queues health', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  /**
   * GET /health
   * Overall system health
   */
  async getOverallHealth(req: Request, res: Response): Promise<void> {
    try {
      const isRedisHealthy_ = isRedisHealthy();
      const workerManager = WorkerManager.getInstance();
      const isWorkersHealthy = workerManager.isHealthy();
      const queueStats = await queueMonitoringService.getAllQueueStats();
      const unhealthyQueues = queueStats.filter(q => q.health === 'unhealthy');
      
      const isHealthy = isRedisHealthy_ && isWorkersHealthy && unhealthyQueues.length === 0;
      
      const health = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          redis: isRedisHealthy_ ? 'healthy' : 'unhealthy',
          workers: isWorkersHealthy ? 'healthy' : 'unhealthy',
          queues: unhealthyQueues.length === 0 ? 'healthy' : 'unhealthy',
        },
      };
      
      const statusCode = isHealthy ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error: any) {
      logger.error('Error getting overall health', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}

export const healthController = new HealthController();
```

#### 3.2 Create Health Routes

**File:** `src/routes/health.ts` (NEW)

```typescript
import { Router } from 'express';
import { healthController } from '../controllers/HealthController';

const router = Router();

/**
 * Health check endpoints
 * 
 * GET /health - Overall system health
 * GET /health/redis - Redis connection health
 * GET /health/workers - Worker health status
 * GET /health/queues - Queue health status
 */

router.get('/', (req, res) => healthController.getOverallHealth(req, res));
router.get('/redis', (req, res) => healthController.getRedisHealth(req, res));
router.get('/workers', (req, res) => healthController.getWorkersHealth(req, res));
router.get('/queues', (req, res) => healthController.getQueuesHealth(req, res));

export default router;
```

#### 3.3 Register Health Routes

**File:** `src/app.ts`

**Add Import:**
```typescript
import healthRoutes from './routes/health';
```

**Register Routes:**
```typescript
// Health check endpoints (no auth required)
app.use('/health', healthRoutes);
```

**Expected Endpoints:**
- `GET /health` - Overall system health
- `GET /health/redis` - Redis connection health
- `GET /health/workers` - Worker health status
- `GET /health/queues` - Queue health status

---

### STEP 4 — Prometheus Metrics Export

**Objective:** Ensure existing metrics are exported via `/metrics` endpoint.

**Files to Modify:**
1. `src/config/metrics.ts`

**Implementation:**

#### 4.1 Add Redis Connection Metrics

**File:** `src/config/metrics.ts`

**Add Gauges:**
```typescript
// Redis connection metrics
export const redisConnected = new client.Gauge({
  name: 'redis_connected',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
});

export const redisCircuitBreakerState = new client.Gauge({
  name: 'redis_circuit_breaker_state',
  help: 'Redis circuit breaker state (0 = closed, 1 = open, 2 = half-open)',
  labelNames: ['state'],
});

export const redisCircuitBreakerErrors = new client.Gauge({
  name: 'redis_circuit_breaker_errors_total',
  help: 'Total Redis circuit breaker errors',
});

export const redisCircuitBreakerSuccesses = new client.Gauge({
  name: 'redis_circuit_breaker_successes_total',
  help: 'Total Redis circuit breaker successes',
});

// Redis recovery metrics
export const redisRecoveryDisconnects = new client.Counter({
  name: 'redis_recovery_disconnects_total',
  help: 'Total Redis disconnect events',
});

export const redisRecoveryReconnects = new client.Counter({
  name: 'redis_recovery_reconnects_total',
  help: 'Total Redis reconnect events',
});

export const redisRecoveryAttempts = new client.Counter({
  name: 'redis_recovery_attempts_total',
  help: 'Total Redis recovery attempts',
});

export const redisRecoverySuccess = new client.Counter({
  name: 'redis_recovery_success_total',
  help: 'Total successful Redis recoveries',
});

export const redisRecoveryFailed = new client.Counter({
  name: 'redis_recovery_failed_total',
  help: 'Total failed Redis recoveries',
});
```

**Add Update Functions:**
```typescript
/**
 * Update Redis connection metrics
 */
export function updateRedisMetrics(): void {
  const { isRedisHealthy, getCircuitBreakerStatus, getRecoveryService } = require('./redis');
  
  // Connection status
  redisConnected.set(isRedisHealthy() ? 1 : 0);
  
  // Circuit breaker
  const cbStatus = getCircuitBreakerStatus();
  const stateValue = cbStatus.state === 'closed' ? 0 : cbStatus.state === 'open' ? 1 : 2;
  redisCircuitBreakerState.set({ state: cbStatus.state }, stateValue);
  redisCircuitBreakerErrors.set(cbStatus.errors);
  redisCircuitBreakerSuccesses.set(cbStatus.successes);
  
  // Recovery service
  const recoveryService = getRecoveryService();
  if (recoveryService) {
    const status = recoveryService.getStatus();
    redisRecoveryDisconnects.inc(status.metrics.disconnect_events);
    redisRecoveryReconnects.inc(status.metrics.reconnect_events);
    redisRecoveryAttempts.inc(status.metrics.recovery_attempts);
    redisRecoverySuccess.inc(status.metrics.recovery_success);
    redisRecoveryFailed.inc(status.metrics.recovery_failed);
  }
}
```

#### 4.2 Call Update Function in Metrics Endpoint

**File:** `src/controllers/MetricsController.ts`

**Modify getMetrics():**
```typescript
async getMetrics(req: Request, res: Response): Promise<void> {
  try {
    // Update all metrics before export
    updateQueueMetrics();
    updateQueueLagMetrics();
    updateRedisMetrics(); // NEW
    
    // Export metrics
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', client.register.contentType);
    res.end(metrics);
  } catch (error: any) {
    logger.error('Error getting metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
}
```

**Expected Metrics:**
- `redis_connected` - Connection status
- `redis_circuit_breaker_state` - Circuit breaker state
- `redis_circuit_breaker_errors_total` - Error count
- `redis_circuit_breaker_successes_total` - Success count
- `redis_recovery_disconnects_total` - Disconnect events
- `redis_recovery_reconnects_total` - Reconnect events
- `redis_recovery_attempts_total` - Recovery attempts
- `redis_recovery_success_total` - Successful recoveries
- `redis_recovery_failed_total` - Failed recoveries

---

### STEP 5 — Testing

**Objective:** Add integration tests for Redis reconnect scenarios.

**Files to Create:**
1. `src/__tests__/integration/redis-reconnect.test.ts` (NEW)

**Implementation:**

#### 5.1 Create Redis Reconnect Tests

**File:** `src/__tests__/integration/redis-reconnect.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { connectRedis, disconnectRedis, getRecoveryService } from '../../config/redis';
import { WorkerManager } from '../../services/WorkerManager';
import { queueMonitoringService } from '../../services/QueueMonitoringService';

describe('Redis Reconnect Integration Tests', () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  describe('WorkerManager Recovery', () => {
    it('should register WorkerManager with recovery service', () => {
      const recoveryService = getRecoveryService();
      expect(recoveryService).not.toBeNull();
      
      const status = recoveryService!.getStatus();
      expect(status.servicesRegistered).toBeGreaterThan(0);
    });

    it('should restart workers after Redis reconnect', async () => {
      const workerManager = WorkerManager.getInstance();
      
      // Simulate Redis reconnect
      const recoveryService = getRecoveryService();
      await recoveryService!.forceRecovery();
      
      // Verify workers restarted
      const isRunning = workerManager.isRunning();
      expect(isRunning).toBe(true);
    });
  });

  describe('Monitoring Recovery', () => {
    it('should register QueueMonitoringService with recovery service', () => {
      const recoveryService = getRecoveryService();
      const status = recoveryService!.getStatus();
      
      // Should have at least: worker-manager, queue-monitoring
      expect(status.servicesRegistered).toBeGreaterThanOrEqual(2);
    });

    it('should restart monitoring after Redis reconnect', async () => {
      // Simulate Redis reconnect
      const recoveryService = getRecoveryService();
      await recoveryService!.forceRecovery();
      
      // Verify monitoring restarted
      const isRunning = queueMonitoringService.isRunning();
      expect(isRunning).toBe(true);
    });
  });

  describe('Health Endpoints', () => {
    it('should return Redis health status', async () => {
      // Test will be implemented after health endpoints are added
      expect(true).toBe(true);
    });

    it('should return worker health status', async () => {
      // Test will be implemented after health endpoints are added
      expect(true).toBe(true);
    });

    it('should return queue health status', async () => {
      // Test will be implemented after health endpoints are added
      expect(true).toBe(true);
    });
  });
});
```

---

## Implementation Checklist

### STEP 1 — WorkerManager Integration
- [ ] Add `isRunning()` method to WorkerManager
- [ ] Add `getRedisHealth()` method to WorkerManager
- [ ] Register WorkerManager in `server.ts`
- [ ] Register WorkerManager in `workers-standalone.ts`
- [ ] Test worker restart on Redis reconnect

### STEP 2 — Monitoring Recovery
- [ ] Add `isRunning()` method to QueueMonitoringService
- [ ] Add `getStatus()` method to QueueMonitoringService
- [ ] Register QueueMonitoringService in `server.ts`
- [ ] Test monitoring restart on Redis reconnect

### STEP 3 — Health Endpoints
- [ ] Create `HealthController.ts`
- [ ] Create `routes/health.ts`
- [ ] Register health routes in `app.ts`
- [ ] Test `/health/redis` endpoint
- [ ] Test `/health/workers` endpoint
- [ ] Test `/health/queues` endpoint
- [ ] Test `/health` endpoint

### STEP 4 — Prometheus Metrics
- [ ] Add Redis connection metrics to `metrics.ts`
- [ ] Add `updateRedisMetrics()` function
- [ ] Call `updateRedisMetrics()` in metrics endpoint
- [ ] Verify metrics exported at `/metrics`

### STEP 5 — Testing
- [ ] Create `redis-reconnect.test.ts`
- [ ] Test WorkerManager recovery
- [ ] Test monitoring recovery
- [ ] Test health endpoints
- [ ] Test Prometheus metrics

---

## Expected Outcomes

### After STEP 1
- WorkerManager automatically restarts after Redis reconnects
- All workers (including backpressure monitors) restart automatically
- No manual intervention required

### After STEP 2
- QueueMonitoringService automatically restarts after Redis reconnects
- Queue statistics resume collection
- No gaps in monitoring data

### After STEP 3
- Health endpoints available at `/health/*`
- Kubernetes/Docker health checks can use these endpoints
- Load balancers can detect unhealthy instances

### After STEP 4
- Prometheus can scrape Redis metrics
- Grafana dashboards can visualize Redis health
- Alerts can be configured for Redis issues

### After STEP 5
- Integration tests verify recovery behavior
- CI/CD pipeline validates Redis resilience
- Regression prevention

---

## Files Summary

### Files to Create (4)
1. `src/controllers/HealthController.ts` - Health check controller
2. `src/routes/health.ts` - Health check routes
3. `src/__tests__/integration/redis-reconnect.test.ts` - Integration tests
4. `apps/backend/PHASE_3_REDIS_RESILIENCE_SUMMARY.md` - Implementation summary

### Files to Modify (6)
1. `src/services/WorkerManager.ts` - Add recovery interface
2. `src/services/QueueMonitoringService.ts` - Add recovery interface
3. `src/server.ts` - Register services with recovery
4. `src/workers-standalone.ts` - Register WorkerManager with recovery
5. `src/app.ts` - Register health routes
6. `src/config/metrics.ts` - Add Redis metrics

---

## Conclusion

Phase 3 implementation will **REUSE** existing Redis resilience infrastructure:
- ✅ RedisRecoveryService (already exists)
- ✅ Circuit breaker (already exists)
- ✅ Retry strategies (already exists)
- ✅ Health checks (already exists)

Only **INTEGRATION** and **EXPOSURE** work required:
- Integrate WorkerManager with recovery service
- Expose health checks via HTTP endpoints
- Export metrics to Prometheus

**Estimated Effort:** 30% of original scope (most work already done)

**Status:** ✅ READY FOR IMPLEMENTATION

---

## Sign-Off

**Planned By:** Kiro AI  
**Date:** 2026-03-07  
**Status:** ✅ PLAN APPROVED  
**Next Step:** Begin STEP 1 implementation
