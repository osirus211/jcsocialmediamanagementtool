# Phase 1: Distributed Token Lifecycle Automation
## Part 6: Implementation Skeleton

---

## CODE STRUCTURE

```
apps/backend/src/
├── services/
│   ├── TokenRefreshService.ts          (Core refresh logic)
│   ├── CircuitBreakerService.ts        (Circuit breaker per provider)
│   └── TokenRefreshMetrics.ts          (Prometheus metrics)
├── workers/
│   ├── TokenRefreshScheduler.ts        (Cron scheduler)
│   └── TokenRefreshWorker.ts           (BullMQ worker)
├── queue/
│   └── TokenRefreshQueue.ts            (Queue configuration)
└── utils/
    └── tokenRefreshLock.ts             (Distributed lock helper)
```

---

## 1. TOKEN REFRESH QUEUE

**File**: `apps/backend/src/queue/TokenRefreshQueue.ts`

```typescript
import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient } from '../config/redis';

export interface TokenRefreshJobData {
  connectionId: string;
  provider: string;
  expiresAt: Date;
  attempt: number;
}

const queueOptions: QueueOptions = {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: false, // Keep failed jobs for debugging
  },
};

export const tokenRefreshQueue = new Queue<TokenRefreshJobData>(
  'token-refresh',
  queueOptions
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await tokenRefreshQueue.close();
});
```

---

## 2. CIRCUIT BREAKER SERVICE

**File**: `apps/backend/src/services/CircuitBreakerService.ts`

```typescript
import { getRedisClientSafe } from '../config/redis';
import { logger } from '../utils/logger';

interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
  nextAttemptAt: number | null;
}

export class CircuitBreakerService {
  private static instance: CircuitBreakerService;
  
  private readonly FAILURE_THRESHOLD = 5;
  private readonly SUCCESS_THRESHOLD = 3;
  private readonly COOLDOWN_MS = 60000; // 60 seconds

  static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  async checkCircuit(provider: string): Promise<'allow' | 'block'> {
    const redis = getRedisClientSafe();
    if (!redis) {
      throw new Error('Redis unavailable - cannot check circuit breaker');
    }

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    if (!circuitData) {
      return 'allow'; // No circuit state = allow
    }

    const state: CircuitState = JSON.parse(circuitData);

    if (state.state === 'open') {
      // Check if cooldown period passed
      if (Date.now() < state.nextAttemptAt!) {
        logger.warn('Circuit breaker open, blocking request', {
          provider,
          nextAttemptAt: new Date(state.nextAttemptAt!),
        });
        return 'block';
      }

      // Transition to half-open
      state.state = 'half-open';
      state.successCount = 0;
      await redis.set(circuitKey, JSON.stringify(state));
      
      logger.info('Circuit breaker transitioning to half-open', { provider });
      return 'allow';
    }

    return 'allow'; // closed or half-open
  }

  async recordSuccess(provider: string): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) return;

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    const state: CircuitState = circuitData
      ? JSON.parse(circuitData)
      : {
          state: 'closed',
          failureCount: 0,
          successCount: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          openedAt: null,
          nextAttemptAt: null,
        };

    state.successCount++;
    state.failureCount = 0;
    state.lastSuccessTime = Date.now();

    // If in half-open and enough successes, close circuit
    if (state.state === 'half-open' && state.successCount >= this.SUCCESS_THRESHOLD) {
      state.state = 'closed';
      state.successCount = 0;
      state.openedAt = null;
      state.nextAttemptAt = null;
      
      logger.info('Circuit breaker closed', { provider });
    }

    await redis.set(circuitKey, JSON.stringify(state));
  }

  async recordFailure(provider: string): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) return;

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    const state: CircuitState = circuitData
      ? JSON.parse(circuitData)
      : {
          state: 'closed',
          failureCount: 0,
          successCount: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          openedAt: null,
          nextAttemptAt: null,
        };

    state.failureCount++;
    state.successCount = 0;
    state.lastFailureTime = Date.now();

    // Open circuit after threshold failures
    if (state.failureCount >= this.FAILURE_THRESHOLD) {
      state.state = 'open';
      state.openedAt = Date.now();
      state.nextAttemptAt = Date.now() + this.COOLDOWN_MS;
      
      logger.error('Circuit breaker opened', {
        provider,
        failureCount: state.failureCount,
        nextAttemptAt: new Date(state.nextAttemptAt),
      });
    }

    await redis.set(circuitKey, JSON.stringify(state));
  }

  async getState(provider: string): Promise<CircuitState | null> {
    const redis = getRedisClientSafe();
    if (!redis) return null;

    const circuitKey = `oauth:circuit:${provider}`;
    const circuitData = await redis.get(circuitKey);

    return circuitData ? JSON.parse(circuitData) : null;
  }
}

export const circuitBreakerService = CircuitBreakerService.getInstance();
```

---

## 3. DISTRIBUTED LOCK HELPER

**File**: `apps/backend/src/utils/tokenRefreshLock.ts`

```typescript
import { getRedisClientSafe } from '../config/redis';
import { logger } from '../utils/logger';

const LOCK_TTL = 120; // 120 seconds

export async function acquireRefreshLock(
  connectionId: string,
  workerId: string
): Promise<boolean> {
  const redis = getRedisClientSafe();
  
  if (!redis) {
    throw new Error('Redis unavailable - cannot acquire lock');
  }

  const lockKey = `oauth:refresh:lock:${connectionId}`;
  const lockValue = `${workerId}:${Date.now()}`;

  const result = await redis.set(lockKey, lockValue, 'EX', LOCK_TTL, 'NX');

  if (result === 'OK') {
    logger.debug('Lock acquired', { connectionId, workerId });
    return true;
  }

  logger.debug('Lock held by another worker', { connectionId, workerId });
  return false;
}

export async function releaseRefreshLock(connectionId: string): Promise<void> {
  const redis = getRedisClientSafe();
  if (!redis) return;

  const lockKey = `oauth:refresh:lock:${connectionId}`;
  await redis.del(lockKey);
  
  logger.debug('Lock released', { connectionId });
}

export async function checkMinimumInterval(connectionId: string): Promise<boolean> {
  const redis = getRedisClientSafe();
  if (!redis) return true; // Allow if Redis unavailable

  const lastRefreshKey = `oauth:refresh:last:${connectionId}`;
  const lastRefresh = await redis.get(lastRefreshKey);

  if (lastRefresh) {
    const timeSinceRefresh = Date.now() - parseInt(lastRefresh);
    const MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes

    if (timeSinceRefresh < MIN_INTERVAL) {
      logger.info('Refresh too soon, skipping', {
        connectionId,
        timeSinceRefresh,
      });
      return false;
    }
  }

  return true;
}

export async function setLastRefreshTime(connectionId: string): Promise<void> {
  const redis = getRedisClientSafe();
  if (!redis) return;

  const lastRefreshKey = `oauth:refresh:last:${connectionId}`;
  await redis.set(lastRefreshKey, Date.now().toString(), 'EX', 2592000); // 30 days
}
```

---

