# Health Endpoints Duplication Audit

**Date:** 2026-03-07  
**Auditor:** Kiro AI  
**Purpose:** Identify existing health endpoints before implementing Phase 3 Step 3

---

## Executive Summary

The system already has **COMPREHENSIVE** health check infrastructure in place. Health endpoints exist but need to be **EXTENDED** to include Redis, Workers, and Queues specific endpoints.

**Key Findings:**
- ✅ HealthCheckService: **COMPLETE** - Comprehensive health checks
- ✅ Health endpoints: **PARTIAL** - Basic endpoints exist, need Redis/Workers/Queues specific ones
- ✅ HealthController: **EXISTS** - But not used (app.ts uses HealthCheckService directly)
- ⚠️ Missing: `/health/redis`, `/health/workers`, `/health/queues` endpoints

**Recommendation:** **EXTEND** existing health infrastructure, DO NOT create duplicate services.

---

## STEP 1 — Existing Health Infrastructure

### HealthCheckService

**Location:** `src/services/HealthCheckService.ts`

**Status:** ✅ **COMPLETE** - Comprehensive health check service

**Features:**
- ✅ Redis health check (with circuit breaker status)
- ✅ MongoDB health check
- ✅ Worker health check (via QueueManager)
- ✅ Memory health check
- ✅ Overall status determination
- ✅ Response time tracking
- ✅ Timeout protection (2s per check)
- ✅ Graceful error handling

**Methods:**
```typescript
async getHealthStatus(): Promise<HealthStatus>
async isHealthy(): Promise<boolean>
private async checkRedis(): Promise<ComponentHealth>
private async checkMongoDB(): Promise<ComponentHealth>
private async checkWorkers(): Promise<ComponentHealth>
private async checkMemory(): Promise<ComponentHealth>
```

**Health Status Structure:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  timestamp: string,
  uptime: number,
  version: string,
  components: {
    redis: ComponentHealth,
    mongodb: ComponentHealth,
    workers: ComponentHealth,
    memory: ComponentHealth,
  },
  details: {
    responseTime: number,
    nodeVersion: string,
    platform: string,
    arch: string,
  }
}
```

---

### HealthController

**Location:** `src/controllers/HealthController.ts`

**Status:** ⚠️ **EXISTS BUT NOT USED**

**Features:**
- ✅ Health check endpoint handler
- ✅ Database check
- ✅ Redis check (with circuit breaker)
- ✅ Queue check
- ✅ Worker heartbeat check
- ✅ Memory usage tracking
- ✅ Timeout protection

**Issue:** This controller exists but is NOT used in app.ts. The app.ts file uses HealthCheckService directly.

**Recommendation:** Either use this controller OR remove it to avoid confusion.

---

### Existing Health Endpoints

**Location:** `src/app.ts` (lines 106-195)

**Endpoints:**

1. **`GET /health`** - Simple health check
   - Returns: `{ status: 'ok' | 'unhealthy' }`
   - Status Code: 200 (healthy) or 503 (unhealthy)
   - Uses: `healthCheckService.isHealthy()`

2. **`GET /health/detailed`** - Detailed health status
   - Returns: Full HealthStatus object
   - Status Code: 200 (healthy/degraded) or 503 (unhealthy)
   - Uses: `healthCheckService.getHealthStatus()`
   - Includes: Redis, MongoDB, Workers, Memory status

3. **`GET /health/live`** - Kubernetes liveness probe
   - Returns: `{ status: 'alive', timestamp, uptime }`
   - Status Code: Always 200 (unless process crashes)
   - Purpose: Check if process is alive

4. **`GET /health/ready`** - Kubernetes readiness probe
   - Returns: `{ status: 'ready', components }`
   - Status Code: 200 (ready) or 503 (not ready)
   - Purpose: Check if system can serve traffic

5. **`GET /internal/publishing-health`** - Publishing system health
   - Returns: Publishing-specific health status
   - Uses: `publishingHealthService.getPublishingHealth()`

**Status:** ✅ **COMPLETE** - Basic health endpoints exist

---

## STEP 2 — Missing Health Endpoints

### Required by Phase 3

According to Phase 3 Step 3 requirements, we need:

1. **`GET /health/redis`** - Redis-specific health ❌ MISSING
2. **`GET /health/workers`** - Worker-specific health ❌ MISSING
3. **`GET /health/queues`** - Queue-specific health ❌ MISSING

### Current Coverage

**What exists:**
- ✅ `/health` - Overall health (includes Redis, Workers, Memory, MongoDB)
- ✅ `/health/detailed` - Detailed health (includes all components)
- ✅ `/health/live` - Liveness probe
- ✅ `/health/ready` - Readiness probe

**What's missing:**
- ❌ `/health/redis` - Redis-specific endpoint
- ❌ `/health/workers` - Worker-specific endpoint
- ❌ `/health/queues` - Queue-specific endpoint

---

## STEP 3 — Integration with WorkerManager and QueueMonitoringService

### Current Integration

**HealthCheckService.checkWorkers():**
```typescript
// Uses QueueManager.getWorkerHealth()
const workerHealth = queueManager.getWorkerHealth();
```

**Issue:** This uses QueueManager's worker health, NOT WorkerManager's health.

**Required Integration:**
- ✅ WorkerManager.getStatus() - Returns worker statuses
- ✅ WorkerManager.isHealthy() - Returns overall worker health
- ✅ WorkerManager.getRedisHealth() - Returns Redis health
- ✅ QueueMonitoringService.getStatus() - Returns monitoring status
- ✅ QueueMonitoringService.getAllQueueStats() - Returns queue statistics

---

## STEP 4 — Recommended Implementation

### Option 1: Extend HealthCheckService (RECOMMENDED)

**Approach:** Add new methods to HealthCheckService and create new endpoints in app.ts

**Advantages:**
- ✅ Reuses existing infrastructure
- ✅ Consistent with current architecture
- ✅ No duplicate services
- ✅ Minimal changes

**Implementation:**

1. **Add methods to HealthCheckService:**
   ```typescript
   async getRedisHealth(): Promise<RedisHealth>
   async getWorkersHealth(): Promise<WorkersHealth>
   async getQueuesHealth(): Promise<QueuesHealth>
   ```

2. **Add endpoints to app.ts:**
   ```typescript
   app.get('/health/redis', async (req, res) => { ... })
   app.get('/health/workers', async (req, res) => { ... })
   app.get('/health/queues', async (req, res) => { ... })
   ```

3. **Integrate with WorkerManager and QueueMonitoringService:**
   - Use `WorkerManager.getInstance().getStatus()`
   - Use `WorkerManager.getInstance().getRedisHealth()`
   - Use `queueMonitoringService.getAllQueueStats()`

---

### Option 2: Create Separate Health Routes File

**Approach:** Create `src/routes/health.ts` and move all health endpoints there

**Advantages:**
- ✅ Better organization
- ✅ Separates health endpoints from app.ts
- ✅ Easier to maintain

**Disadvantages:**
- ⚠️ Requires refactoring existing endpoints
- ⚠️ More changes to existing code

**Not Recommended:** Keep existing endpoints in app.ts for consistency.

---

## STEP 5 — Implementation Plan

### Phase 3 Step 3 Implementation

**DO NOT CREATE:**
- ❌ New HealthCheckService
- ❌ New health check infrastructure
- ❌ Duplicate health endpoints

**DO EXTEND:**

1. **Add methods to HealthCheckService** (OPTIONAL - can be inline in app.ts)
   - `getRedisHealth()` - Returns Redis health with circuit breaker status
   - `getWorkersHealth()` - Returns WorkerManager status
   - `getQueuesHealth()` - Returns QueueMonitoringService status

2. **Add endpoints to app.ts** (REQUIRED)
   - `GET /health/redis` - Redis-specific health
   - `GET /health/workers` - Worker-specific health
   - `GET /health/queues` - Queue-specific health

3. **Integrate with Phase 3 services** (REQUIRED)
   - Use `WorkerManager.getInstance()`
   - Use `queueMonitoringService`
   - Use existing `isRedisHealthy()`, `getCircuitBreakerStatus()`, `getRecoveryService()`

---

## STEP 6 — Endpoint Specifications

### GET /health/redis

**Purpose:** Redis connection health with circuit breaker and recovery status

**Response:**
```typescript
{
  status: 'healthy' | 'unhealthy',
  timestamp: string,
  redis: {
    connected: boolean,
    circuitBreaker: {
      state: 'closed' | 'open' | 'half-open',
      errorRate: number,
      errors: number,
      successes: number,
      lastError: string | null,
      openedAt: string | null,
    }
  },
  recovery: {
    enabled: boolean,
    servicesRegistered: number,
    lastDisconnect: string | null,
    lastReconnect: string | null,
    metrics: {
      disconnect_events: number,
      reconnect_events: number,
      recovery_attempts: number,
      recovery_success: number,
      recovery_failed: number,
    }
  } | null
}
```

**Status Codes:**
- 200: Redis healthy
- 503: Redis unhealthy

---

### GET /health/workers

**Purpose:** Worker health status from WorkerManager

**Response:**
```typescript
{
  status: 'healthy' | 'unhealthy',
  timestamp: string,
  workers: Array<{
    name: string,
    isEnabled: boolean,
    isRunning: boolean,
    restartCount: number,
    lastStartedAt: Date | null,
    lastStoppedAt: Date | null,
    lastError: string | null,
  }>,
  redis: {
    isHealthy: boolean,
    circuitBreaker: any,
    recoveryService: any,
  },
  summary: {
    total: number,
    enabled: number,
    running: number,
    healthy: boolean,
  }
}
```

**Status Codes:**
- 200: Workers healthy
- 503: Workers unhealthy

---

### GET /health/queues

**Purpose:** Queue health status from QueueMonitoringService

**Response:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  timestamp: string,
  monitoring: {
    isMonitoring: boolean,
    queues: string[],
    historySize: number,
  },
  queues: Array<{
    name: string,
    waiting: number,
    active: number,
    failed: number,
    delayed: number,
    completed: number,
    failureRate: number,
    health: 'healthy' | 'degraded' | 'unhealthy',
    timestamp: Date,
    lagP50?: number,
    lagP95?: number,
    lagP99?: number,
  }>,
  summary: {
    total: number,
    healthy: number,
    degraded: number,
    unhealthy: number,
  }
}
```

**Status Codes:**
- 200: Queues healthy
- 503: Queues unhealthy or degraded

---

## STEP 7 — Lightweight Implementation

### Performance Requirements

✅ **DO:**
- Use cached service state (WorkerManager.getStatus(), queueMonitoringService.getStatus())
- Use existing health check functions (isRedisHealthy(), getCircuitBreakerStatus())
- Return immediately without blocking operations
- Use existing singleton instances

❌ **DO NOT:**
- Perform direct Redis queries in endpoints
- Query MongoDB in endpoints
- Perform expensive calculations
- Block on I/O operations
- Create new service instances

### Response Time Targets

- `/health/redis`: < 10ms (cached state)
- `/health/workers`: < 10ms (cached state)
- `/health/queues`: < 50ms (may need to query queue stats)

---

## STEP 8 — Files to Modify

### Required Changes

1. **`src/app.ts`** (MODIFY)
   - Add `GET /health/redis` endpoint
   - Add `GET /health/workers` endpoint
   - Add `GET /health/queues` endpoint
   - Location: After existing health endpoints (line ~195)

### Optional Changes

2. **`src/services/HealthCheckService.ts`** (OPTIONAL)
   - Add `getRedisHealth()` method
   - Add `getWorkersHealth()` method
   - Add `getQueuesHealth()` method
   - Note: Can be implemented inline in app.ts instead

### Files NOT to Modify

- ❌ `src/controllers/HealthController.ts` - Not used, can be removed later
- ❌ `src/server.ts` - No changes needed
- ❌ `src/config/redis.ts` - Already has health functions

---

## STEP 9 — Unused HealthController

### Issue

The file `src/controllers/HealthController.ts` exists but is NOT used anywhere in the codebase.

**Evidence:**
- app.ts uses `healthCheckService` directly
- No imports of `HealthController` found
- No routes use `healthController`

### Recommendation

**Option 1:** Remove `HealthController.ts` to avoid confusion  
**Option 2:** Keep it for future use (not recommended)  
**Option 3:** Refactor app.ts to use HealthController (not recommended - too much refactoring)

**Decision:** Keep it for now, remove in future cleanup.

---

## Conclusion

The system has **COMPREHENSIVE** health check infrastructure. Phase 3 Step 3 should:

1. **EXTEND** existing health endpoints in app.ts
2. **INTEGRATE** with WorkerManager and QueueMonitoringService
3. **REUSE** existing health check functions
4. **DO NOT** create duplicate services or controllers

**Estimated Effort:** 20% of original scope (most infrastructure exists)

**Status:** ✅ AUDIT COMPLETE

**Next Step:** Implement Phase 3 Step 3 by adding 3 new endpoints to app.ts

---

## Sign-Off

**Audited By:** Kiro AI  
**Date:** 2026-03-07  
**Status:** ✅ AUDIT COMPLETE  
**Recommendation:** EXTEND existing infrastructure, DO NOT create duplicates  
**Next:** Implement Phase 3 Step 3 (add /health/redis, /health/workers, /health/queues)

