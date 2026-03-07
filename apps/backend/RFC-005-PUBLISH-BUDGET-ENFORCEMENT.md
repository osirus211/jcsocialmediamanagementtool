# RFC-005: Multi-Tenant Publish Budget Enforcement & Unified Admission Control

**Status**: Draft  
**Author**: Principal Distributed Systems Architect  
**Created**: 2026-02-27  
**Last Updated**: 2026-02-27

---

## Executive Summary

This RFC defines the architecture for multi-tenant publish budget enforcement integrated with the existing resilience system. The design extends (not duplicates) existing components: `GlobalRateLimitManager`, `AdmissionController`, `DegradedModeManager`, and `BackpressureManager`.

**Key Design Principles**:
- Single Redis round-trip per admission check (Lua script)
- Atomic check-and-increment (no separate increment step)
- Sliding window semantics (not fixed window)
- Correlation ID deduplication for retries
- Fail-open if Redis unavailable
- Governance vs stability separation (budget rejections ≠ overload freeze)
- Security: tier derived from authenticated context (INVARIANT-9)

---

## Table of Contents

1. [Requirements Specification](#1-requirements-specification)
2. [Design Specification](#2-design-specification)
3. [Redis Data Model](#3-redis-data-model)
4. [Admission Decision Flow](#4-admission-decision-flow)
5. [Failure Scenarios](#5-failure-scenarios)
6. [Fairness Model](#6-fairness-model)
7. [Freeze Logic](#7-freeze-logic)
8. [Performance Analysis](#8-performance-analysis)
9. [Test Strategy](#9-test-strategy)
10. [Rollout Plan](#10-rollout-plan)

---

## 1. Requirements Specification

### 1.1 Functional Requirements

#### FR-1: Global Publish Budget
- **Requirement**: System MUST enforce a global publish budget of 1000 publishes per minute across all workspaces
- **Rationale**: Prevents platform-level rate limit exhaustion and protects downstream API providers
- **Scope**: Applies to all publish operations regardless of workspace or tier
- **Reset**: Sliding window (not fixed window) to prevent boundary aliasing

#### FR-2: Per-Workspace Publish Budget
- **Requirement**: System MUST enforce per-workspace publish budgets based on subscription tier:
  - **Free tier**: 10 publishes/minute
  - **Pro tier**: 50 publishes/minute
  - **Enterprise tier**: 200 publishes/minute
- **Rationale**: Fair resource allocation, prevents single tenant monopolization, revenue-aligned capacity
- **Scope**: Applies per workspace ID
- **Reset**: Sliding window synchronized with global budget

#### FR-3: Optional Per-Platform Publish Budget
- **Requirement**: System MAY enforce per-platform publish budgets (e.g., Twitter: 300/min, LinkedIn: 200/min)
- **Rationale**: Platform-specific rate limit protection
- **Scope**: Optional feature flag controlled
- **Reset**: Sliding window per platform

#### FR-4: Deterministic Admission Decision Ordering
- **Requirement**: Admission decisions MUST follow deterministic evaluation order:
  1. Degraded mode freeze check
  2. Backpressure state check (load-based)
  3. Global budget check
  4. Workspace budget check
  5. Platform budget check (if enabled)
  6. Priority bypass rules (critical priority only)
- **Rationale**: Predictable behavior, debuggability, correctness
- **Invariant**: Order MUST NOT change based on runtime conditions


#### FR-5: Freeze Activation Logic (CORRECTED)
- **Requirement**: System MUST trigger overload freeze when BOTH conditions are met:
  1. **High budget rejection rate**: >30% of requests rejected due to budget exhaustion in past 60 seconds
  2. **System stress**: `load_state >= HIGH_LOAD` (from BackpressureManager)
- **Rationale**: Budget rejections alone are governance enforcement, NOT system instability. Freeze only when budget exhaustion correlates with actual system stress.
- **Correction**: Previous design incorrectly triggered freeze on budget rejections alone. This violates governance/stability separation.
- **Invariant**: Budget governance MUST NOT trigger stability mechanisms unless system is actually stressed

#### FR-6: Retry-After Semantics (CORRECTED)
- **Requirement**: When budget exhausted, system MUST return `Retry-After` header using sliding window semantics:
  ```
  retry_after = (oldest_entry_timestamp + window_size) - current_timestamp
  ```
- **Example**: If oldest entry is at `12:00:05` and window is 60s, retry at `12:01:05`. If current time is `12:00:45`, `Retry-After = 20 seconds`.
- **Correction**: Previous design used minute-boundary logic (`next_minute_boundary - current_timestamp`), which is INCORRECT for sliding windows.
- **Invariant**: Retry-After MUST reflect actual window expiration, not arbitrary boundaries

#### FR-7: Budget Increment Timing (CORRECTED)
- **Requirement**: Budget increment MUST occur atomically within admission check (Lua script), NOT in PublishingWorker
- **Deduplication**: Use correlation ID to prevent double increment on retries
- **Correction**: Previous design incremented budget in PublishingWorker after admission, creating race conditions and double-counting on retries
- **Invariant**: Budget counters MUST reflect admission decisions, not publish outcomes


### 1.2 Non-Functional Requirements

#### NFR-1: Single Redis Round-Trip
- **Requirement**: Admission check MUST complete in single Redis operation (Lua script)
- **Rationale**: Minimize latency, avoid race conditions, atomic check-and-increment
- **Constraint**: No multi-key transactions, no separate increment step

#### NFR-2: No Double Increment Under Retry
- **Requirement**: Retried publish attempts MUST NOT increment budget counters multiple times
- **Mechanism**: Correlation ID deduplication within Lua script
- **Invariant**: `budget_consumed = unique_admission_decisions`, not `total_admission_checks`

#### NFR-3: Deterministic Behavior Under Concurrency
- **Requirement**: System MUST produce identical admission decisions for identical inputs regardless of concurrency level
- **Mechanism**: Lua script atomicity, deterministic evaluation order
- **Test**: 100 concurrent workers with identical requests must produce consistent results

#### NFR-4: No Starvation Across Tenants
- **Requirement**: No workspace can be permanently starved of capacity
- **Mechanism**: Per-workspace budgets are independent; global budget prevents monopolization
- **Invariant**: If workspace budget available AND global budget available, admission MUST succeed

#### NFR-5: No Additional Redis Clients
- **Requirement**: Reuse existing Redis client from `GlobalRateLimitManager`
- **Rationale**: Connection pool management, operational simplicity
- **Constraint**: Extend existing service, do not create new Redis connections

#### NFR-6: Backward Compatibility
- **Requirement**: Existing admission logic MUST continue to function if budget enforcement disabled
- **Mechanism**: Feature flags, graceful degradation
- **Invariant**: Load-based admission (BackpressureManager) operates independently of budget enforcement


### 1.3 System Invariants

#### INVARIANT-1: Budget Hierarchy
```
workspace_budget <= global_budget
```
A workspace cannot consume more than its allocated share of global capacity.

#### INVARIANT-2: Budget Accuracy
```
sum(workspace_consumed) <= global_consumed <= global_budget
```
Global consumption is the sum of all workspace consumption.

#### INVARIANT-3: Sliding Window Consistency
```
count(entries_in_window) = budget_consumed
```
Budget counters reflect actual entries in sliding window.

#### INVARIANT-4: Admission Idempotency
```
checkAdmission(correlationId, ...) = checkAdmission(correlationId, ...)
```
Repeated admission checks with same correlation ID produce identical results.

#### INVARIANT-5: Atomic Check-Increment
```
if (budget_available) then increment_budget; return admitted
else return rejected
```
Check and increment are atomic; no race conditions.

#### INVARIANT-6: Fail-Open Safety
```
if (redis_unavailable) then admit_request
```
Redis unavailability does not block publishes (fail-open).

#### INVARIANT-7: Governance-Stability Separation
```
budget_rejection ≠ overload_freeze
```
Budget rejections are governance enforcement, not stability signals. Freeze requires BOTH high rejection rate AND system stress.

#### INVARIANT-8: Retry-After Accuracy
```
retry_after = (oldest_entry_ts + window_size) - current_ts
```
Retry-After reflects sliding window expiration, not arbitrary boundaries.

#### INVARIANT-9: Tier Trust Boundary (SECURITY)
```
tier = derive_from_authenticated_context(workspace_id)
tier ≠ client_provided_tier
```
Subscription tier MUST be derived from authenticated workspace context, NEVER from client payload. Prevents privilege escalation attacks where free-tier users claim enterprise budgets.


---

## 2. Design Specification

### 2.1 Redis Strategy Selection

**Chosen Strategy**: Sliding Window with ZSET + Lua Script

**Justification**:
- **Atomic operations**: Lua script ensures check-and-increment atomicity
- **Sliding window**: Prevents boundary aliasing (fixed window problem)
- **Single round-trip**: All operations in one Lua script execution
- **Scalability**: ZSET operations are O(log N), efficient for 10k workspaces
- **Accurate Retry-After**: Oldest entry timestamp enables precise retry calculation
- **Deduplication**: Correlation ID as ZSET member prevents double increment

**Rejected Alternatives**:
1. **Fixed Window Counters**: Boundary aliasing problem (2x capacity at minute boundaries)
2. **Token Bucket**: Requires separate refill process, complex state management
3. **Separate Check + Increment**: Race conditions, not atomic

### 2.2 Lua Script Design

**Script Name**: `checkAndIncrementPublishBudget.lua`

**Inputs** (KEYS and ARGV):
```lua
KEYS[1] = global_budget_key        -- "publish:budget:global"
KEYS[2] = workspace_budget_key     -- "publish:budget:workspace:{workspaceId}"
KEYS[3] = platform_budget_key      -- "publish:budget:platform:{platform}" (optional)
KEYS[4] = correlation_key          -- "publish:correlation:{correlationId}"

ARGV[1] = current_timestamp_ms     -- Current time in milliseconds
ARGV[2] = window_size_ms           -- Window size (60000 for 1 minute)
ARGV[3] = global_budget_limit      -- 1000
ARGV[4] = workspace_budget_limit   -- 10/50/200 based on tier
ARGV[5] = platform_budget_limit    -- Optional, 0 if disabled
ARGV[6] = correlation_id           -- Unique request ID for deduplication
ARGV[7] = correlation_ttl_sec      -- TTL for correlation key (300 seconds)
```


**Script Logic**:
```lua
-- 1. Check correlation ID for deduplication
local correlation_exists = redis.call('EXISTS', KEYS[4])
if correlation_exists == 1 then
  -- Already processed, return cached result
  local cached_result = redis.call('GET', KEYS[4])
  return cjson.decode(cached_result)
end

-- 2. Remove expired entries from all windows
local cutoff_ts = tonumber(ARGV[1]) - tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', cutoff_ts)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', cutoff_ts)
if tonumber(ARGV[5]) > 0 then
  redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', cutoff_ts)
end

-- 3. Count current entries in each window
local global_count = redis.call('ZCARD', KEYS[1])
local workspace_count = redis.call('ZCARD', KEYS[2])
local platform_count = 0
if tonumber(ARGV[5]) > 0 then
  platform_count = redis.call('ZCARD', KEYS[3])
end

-- 4. Check budgets in order: global, workspace, platform
local result = {admitted = false, reason = '', retry_after = 0}

if global_count >= tonumber(ARGV[3]) then
  -- Global budget exhausted
  local oldest_global = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  if #oldest_global > 0 then
    local oldest_ts = tonumber(oldest_global[2])
    result.retry_after = math.ceil((oldest_ts + tonumber(ARGV[2]) - tonumber(ARGV[1])) / 1000)
  end
  result.reason = 'global_budget_exhausted'
  
elseif workspace_count >= tonumber(ARGV[4]) then
  -- Workspace budget exhausted
  local oldest_workspace = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  if #oldest_workspace > 0 then
    local oldest_ts = tonumber(oldest_workspace[2])
    result.retry_after = math.ceil((oldest_ts + tonumber(ARGV[2]) - tonumber(ARGV[1])) / 1000)
  end
  result.reason = 'workspace_budget_exhausted'
  
elseif tonumber(ARGV[5]) > 0 and platform_count >= tonumber(ARGV[5]) then
  -- Platform budget exhausted
  local oldest_platform = redis.call('ZRANGE', KEYS[3], 0, 0, 'WITHSCORES')
  if #oldest_platform > 0 then
    local oldest_ts = tonumber(oldest_platform[2])
    result.retry_after = math.ceil((oldest_ts + tonumber(ARGV[2]) - tonumber(ARGV[1])) / 1000)
  end
  result.reason = 'platform_budget_exhausted'
  
else
  -- Budget available, increment all counters
  local entry_id = ARGV[6] .. ':' .. ARGV[1]
  redis.call('ZADD', KEYS[1], ARGV[1], entry_id)
  redis.call('ZADD', KEYS[2], ARGV[1], entry_id)
  if tonumber(ARGV[5]) > 0 then
    redis.call('ZADD', KEYS[3], ARGV[1], entry_id)
  end
  
  result.admitted = true
  result.reason = 'admitted'
end

-- 5. Cache result with correlation ID
redis.call('SETEX', KEYS[4], ARGV[7], cjson.encode(result))

return result
```

**Key Properties**:
- **Atomic**: All operations in single Lua execution
- **Deduplication**: Correlation ID prevents double increment
- **Sliding window**: ZREMRANGEBYSCORE removes expired entries
- **Accurate Retry-After**: Uses oldest entry timestamp
- **Single round-trip**: One Redis call from application


### 2.3 Integration Points

#### 2.3.1 GlobalRateLimitManager Extension

**New Methods**:
```typescript
class GlobalRateLimitManager {
  // Existing methods preserved...
  
  /**
   * Check and increment publish budget atomically
   * 
   * @param workspaceId - Workspace identifier
   * @param platform - Platform (twitter, linkedin, etc.)
   * @param tier - Subscription tier (free, pro, enterprise)
   * @param correlationId - Unique request ID for deduplication
   * @returns Admission decision with retry_after if rejected
   */
  async checkPublishBudget(
    workspaceId: string,
    platform: string,
    tier: 'free' | 'pro' | 'enterprise',
    correlationId: string
  ): Promise<{
    admitted: boolean;
    reason: string;
    retryAfter?: number;
  }>;
  
  /**
   * Get current budget consumption
   */
  async getBudgetStats(): Promise<{
    global: { consumed: number; limit: number; remaining: number };
    workspace: { consumed: number; limit: number; remaining: number };
    platform?: { consumed: number; limit: number; remaining: number };
  }>;
}
```

**Configuration**:
```typescript
// ResilienceConfig.ts extension
static readonly PUBLISH_BUDGET = {
  enabled: process.env.PUBLISH_BUDGET_ENABLED !== 'false',
  globalLimit: parseInt(process.env.PUBLISH_BUDGET_GLOBAL_LIMIT || '1000', 10),
  windowSizeMs: parseInt(process.env.PUBLISH_BUDGET_WINDOW_MS || '60000', 10),
  
  // Per-tier limits
  freeTierLimit: parseInt(process.env.PUBLISH_BUDGET_FREE_TIER || '10', 10),
  proTierLimit: parseInt(process.env.PUBLISH_BUDGET_PRO_TIER || '50', 10),
  enterpriseTierLimit: parseInt(process.env.PUBLISH_BUDGET_ENTERPRISE_TIER || '200', 10),
  
  // Platform limits (optional)
  platformLimitsEnabled: process.env.PUBLISH_BUDGET_PLATFORM_ENABLED === 'true',
  platformLimits: {
    twitter: parseInt(process.env.PUBLISH_BUDGET_TWITTER || '300', 10),
    linkedin: parseInt(process.env.PUBLISH_BUDGET_LINKEDIN || '200', 10),
    facebook: parseInt(process.env.PUBLISH_BUDGET_FACEBOOK || '200', 10),
    instagram: parseInt(process.env.PUBLISH_BUDGET_INSTAGRAM || '200', 10),
  },
  
  // Correlation ID TTL (5 minutes)
  correlationTtlSec: parseInt(process.env.PUBLISH_BUDGET_CORRELATION_TTL || '300', 10),
};
```


#### 2.3.2 AdmissionController Extension

**New Method**:
```typescript
class AdmissionController {
  // Existing methods preserved...
  
  /**
   * Unified admission check with budget enforcement
   * 
   * Evaluation order:
   * 1. Degraded mode freeze
   * 2. Backpressure state (load-based)
   * 3. Publish budget (global, workspace, platform)
   * 4. Priority bypass rules
   */
  async checkAdmissionWithBudget(
    workspaceId: string,
    platform: string,
    tier: 'free' | 'pro' | 'enterprise',
    priority: 'low' | 'normal' | 'high' | 'critical',
    correlationId: string
  ): Promise<{
    admitted: boolean;
    rejected: boolean;
    delayed: boolean;
    retryAfter?: number;
    delayMs?: number;
    reason: string;
    rejectionType?: 'load' | 'budget' | 'freeze';
  }>;
}
```

**Implementation Logic**:
```typescript
async checkAdmissionWithBudget(...): Promise<...> {
  // 1. Check degraded mode freeze
  if (degradedModeManager.isDegraded()) {
    if (priority !== 'critical') {
      return {
        admitted: false,
        rejected: true,
        retryAfter: 60,
        reason: 'System in degraded mode',
        rejectionType: 'freeze',
      };
    }
  }
  
  // 2. Check backpressure state (existing load-based logic)
  const loadAdmission = this.checkAdmission(); // Existing method
  if (!loadAdmission.admitted) {
    return {
      ...loadAdmission,
      rejectionType: 'load',
    };
  }
  
  // 3. Check publish budget (if enabled)
  if (ResilienceConfig.PUBLISH_BUDGET.enabled) {
    const budgetCheck = await globalRateLimitManager.checkPublishBudget(
      workspaceId,
      platform,
      tier,
      correlationId
    );
    
    if (!budgetCheck.admitted) {
      // Track budget rejection for freeze detection
      this.trackBudgetRejection();
      
      return {
        admitted: false,
        rejected: true,
        retryAfter: budgetCheck.retryAfter,
        reason: budgetCheck.reason,
        rejectionType: 'budget',
      };
    }
  }
  
  // 4. Admitted
  return {
    admitted: true,
    rejected: false,
    delayed: false,
    reason: 'admitted',
  };
}
```


#### 2.3.3 DegradedModeManager Extension

**New Trigger**: Budget Overload Freeze

**Implementation**:
```typescript
class DegradedModeManager {
  // Existing triggers preserved...
  
  private budgetRejectionHistory: Array<{ timestamp: number; reason: string }> = [];
  
  /**
   * Track budget rejection for freeze detection
   */
  trackBudgetRejection(reason: string): void {
    const now = Date.now();
    this.budgetRejectionHistory.push({ timestamp: now, reason });
    
    // Trim to last 60 seconds
    const cutoff = now - 60000;
    this.budgetRejectionHistory = this.budgetRejectionHistory.filter(
      r => r.timestamp > cutoff
    );
  }
  
  /**
   * Check if budget overload freeze should activate
   * 
   * Conditions (BOTH required):
   * 1. High budget rejection rate: >30% of requests rejected in past 60s
   * 2. System stress: load_state >= HIGH_LOAD
   */
  private checkBudgetOverloadFreeze(): boolean {
    const totalRequests = admissionController.getMetrics().totalRequests;
    const budgetRejections = this.budgetRejectionHistory.length;
    
    if (totalRequests === 0) return false;
    
    const rejectionRate = budgetRejections / totalRequests;
    const loadState = backpressureManager.getCurrentState();
    
    // BOTH conditions required
    const highRejectionRate = rejectionRate > 0.3;
    const systemStressed = loadState === LoadState.HIGH_LOAD || loadState === LoadState.CRITICAL_LOAD;
    
    if (highRejectionRate && systemStressed) {
      logger.warn('Budget overload freeze triggered', {
        rejectionRate: (rejectionRate * 100).toFixed(1) + '%',
        budgetRejections,
        totalRequests,
        loadState,
      });
      return true;
    }
    
    return false;
  }
  
  // Integrate into existing checkDegradedMode() method
  private async checkDegradedMode(): Promise<void> {
    // ... existing triggers ...
    
    // 4. Check budget overload freeze
    if (this.checkBudgetOverloadFreeze()) {
      newTriggers.push('Budget overload with system stress');
    }
    
    // ... rest of state machine ...
  }
}
```

**Key Properties**:
- Budget rejections alone do NOT trigger freeze
- Freeze requires BOTH high rejection rate AND system stress
- Preserves governance/stability separation (INVARIANT-7)


---

## 3. Redis Data Model

### 3.1 Key Schema

#### Global Budget Key
```
Key:   publish:budget:global
Type:  ZSET
Score: timestamp_ms (when entry was added)
Member: {correlationId}:{timestamp_ms}
TTL:   None (cleaned by ZREMRANGEBYSCORE)
```

#### Workspace Budget Key
```
Key:   publish:budget:workspace:{workspaceId}
Type:  ZSET
Score: timestamp_ms
Member: {correlationId}:{timestamp_ms}
TTL:   None (cleaned by ZREMRANGEBYSCORE)
```

#### Platform Budget Key (Optional)
```
Key:   publish:budget:platform:{platform}
Type:  ZSET
Score: timestamp_ms
Member: {correlationId}:{timestamp_ms}
TTL:   None (cleaned by ZREMRANGEBYSCORE)
```

#### Correlation Deduplication Key
```
Key:   publish:correlation:{correlationId}
Type:  STRING (JSON-encoded result)
Value: {"admitted": true/false, "reason": "...", "retry_after": 0}
TTL:   300 seconds (5 minutes)
```

### 3.2 Memory Analysis

**Per Entry Size**:
- ZSET member: ~50 bytes (correlationId + timestamp)
- ZSET score: 8 bytes (double)
- ZSET overhead: ~16 bytes
- Total per entry: ~74 bytes

**Worst Case (1000 publishes/min)**:
- Global ZSET: 1000 entries × 74 bytes = 74 KB
- Workspace ZSETs: 10,000 workspaces × 200 entries × 74 bytes = 148 MB (unrealistic, assumes all enterprise tier)
- Realistic: 10,000 workspaces × 10 entries (avg) × 74 bytes = 7.4 MB
- Correlation keys: 1000 entries × 200 bytes = 200 KB
- **Total realistic**: ~8 MB

**Key Churn**:
- Entries expire after 60 seconds (sliding window)
- ZREMRANGEBYSCORE runs on every admission check
- Correlation keys auto-expire after 5 minutes

**Conclusion**: Memory footprint is negligible (<10 MB for 10k workspaces).


---

## 4. Admission Decision Flow

### 4.1 Deterministic Evaluation Order

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Degraded Mode Freeze Check                               │
│    if (degradedMode.isDegraded() && priority != 'critical') │
│       return REJECTED (freeze)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Backpressure State Check (Load-Based)                    │
│    loadState = backpressureManager.getCurrentState()        │
│    if (loadState == CRITICAL_LOAD)                          │
│       return REJECTED (load)                                 │
│    if (loadState == HIGH_LOAD)                              │
│       return DELAYED (load)                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Publish Budget Check (Lua Script - Single Round-Trip)    │
│    result = checkPublishBudget(workspace, platform, tier)   │
│                                                              │
│    3a. Check correlation ID (deduplication)                 │
│        if (correlation_exists) return cached_result         │
│                                                              │
│    3b. Remove expired entries (sliding window)              │
│        ZREMRANGEBYSCORE(global, -inf, cutoff)               │
│        ZREMRANGEBYSCORE(workspace, -inf, cutoff)            │
│        ZREMRANGEBYSCORE(platform, -inf, cutoff)             │
│                                                              │
│    3c. Count current entries                                │
│        global_count = ZCARD(global)                         │
│        workspace_count = ZCARD(workspace)                   │
│        platform_count = ZCARD(platform)                     │
│                                                              │
│    3d. Check budgets in order                               │
│        if (global_count >= global_limit)                    │
│           return REJECTED (global_budget_exhausted)         │
│        if (workspace_count >= workspace_limit)              │
│           return REJECTED (workspace_budget_exhausted)      │
│        if (platform_count >= platform_limit)                │
│           return REJECTED (platform_budget_exhausted)       │
│                                                              │
│    3e. Increment all counters atomically                    │
│        ZADD(global, timestamp, entry_id)                    │
│        ZADD(workspace, timestamp, entry_id)                 │
│        ZADD(platform, timestamp, entry_id)                  │
│                                                              │
│    3f. Cache result with correlation ID                     │
│        SETEX(correlation_key, 300, result)                  │
│                                                              │
│    if (!result.admitted)                                    │
│       return REJECTED (budget)                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Priority Bypass Rules                                     │
│    if (priority == 'critical')                              │
│       return ADMITTED (bypass)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. ADMITTED                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Rejection Response Format

**Budget Rejection**:
```json
{
  "admitted": false,
  "rejected": true,
  "reason": "workspace_budget_exhausted",
  "rejectionType": "budget",
  "retryAfter": 42,
  "message": "Workspace publish budget exhausted. Retry after 42 seconds."
}
```

**Load Rejection**:
```json
{
  "admitted": false,
  "rejected": true,
  "reason": "System under critical load",
  "rejectionType": "load",
  "retryAfter": 60,
  "message": "System under critical load. Retry after 60 seconds."
}
```

**Freeze Rejection**:
```json
{
  "admitted": false,
  "rejected": true,
  "reason": "System in degraded mode",
  "rejectionType": "freeze",
  "retryAfter": 60,
  "message": "System in degraded mode. Retry after 60 seconds."
}
```


---

## 5. Failure Scenarios

### 5.1 Redis Unavailable

**Scenario**: Redis connection fails or times out

**Behavior**: Fail-open (admit request)

**Rationale**:
- Budget enforcement is governance, not safety
- Temporary Redis outage should not block all publishes
- Platform rate limits provide fallback protection

**Implementation**:
```typescript
try {
  const budgetCheck = await globalRateLimitManager.checkPublishBudget(...);
  if (!budgetCheck.admitted) {
    return { rejected: true, ... };
  }
} catch (error) {
  logger.error('Budget check failed, failing open', { error });
  // Continue with admission (fail-open)
}
```

**Monitoring**: Alert on Redis errors, track fail-open rate

### 5.2 Worker Crash Before Increment

**Scenario**: Worker crashes after admission check but before publish starts

**Behavior**: Budget already incremented (atomic in Lua script)

**Impact**: Budget consumed but publish not attempted

**Mitigation**:
- Acceptable trade-off for atomicity
- Budget is governance, not exact accounting
- Correlation ID TTL (5 min) prevents indefinite reservation

**Invariant Preserved**: INVARIANT-5 (atomic check-increment)

### 5.3 Publish Retry

**Scenario**: Publish fails, worker retries with same correlation ID

**Behavior**: Lua script detects existing correlation ID, returns cached result

**Impact**: No double increment, budget consumed only once

**Implementation**:
```lua
local correlation_exists = redis.call('EXISTS', KEYS[4])
if correlation_exists == 1 then
  local cached_result = redis.call('GET', KEYS[4])
  return cjson.decode(cached_result)
end
```

**Invariant Preserved**: INVARIANT-2 (no double increment), INVARIANT-4 (idempotency)


### 5.4 Concurrent Publishes (100 Workers)

**Scenario**: 100 workers attempt publish simultaneously

**Behavior**: Lua script serializes execution, deterministic admission order

**Impact**: Some workers admitted, others rejected based on budget availability

**Guarantees**:
- Exactly N workers admitted where N = remaining budget
- No race conditions (Lua atomicity)
- Deterministic results (same inputs → same outputs)

**Performance**: Single Redis instance handles ~50k ops/sec, 100 concurrent workers = ~2ms latency

**Invariant Preserved**: INVARIANT-3 (deterministic behavior under concurrency)

### 5.5 Clock Skew

**Scenario**: Worker clocks drift, timestamps inconsistent

**Behavior**: Redis uses worker-provided timestamps for ZSET scores

**Impact**: Sliding window accuracy depends on worker clock accuracy

**Mitigation**:
- Use NTP on all workers
- Acceptable drift: ±1 second (1.6% error on 60s window)
- Monitor clock skew via metrics

**Invariant Preserved**: INVARIANT-3 (sliding window consistency) within clock accuracy bounds

### 5.6 Freeze Oscillation

**Scenario**: System oscillates between degraded and normal mode

**Behavior**: Existing oscillation detection in BackpressureManager applies

**Mitigation**:
- Minimum dwell time (30s in CRITICAL_LOAD)
- Oscillation freeze (30s after 5 transitions/60s)
- Budget overload freeze requires sustained high rejection rate (60s window)

**Invariant Preserved**: Stable control loop prevents rapid freeze oscillation

### 5.7 Chaos Test Exhaustion

**Scenario**: Chaos testing exhausts all budgets simultaneously

**Behavior**:
1. Global budget exhausted → all workspaces rejected
2. High rejection rate (>30%) detected
3. System load increases (queue depth, retries)
4. Load state transitions to HIGH_LOAD or CRITICAL_LOAD
5. Budget overload freeze activates (BOTH conditions met)
6. Critical priority publishes bypass freeze

**Recovery**:
- Sliding window expires after 60 seconds
- Budget capacity restored
- Freeze exits after stable 5 minutes

**Test Validation**: Chaos harness should verify this exact sequence


---

## 6. Fairness Model

### 6.1 Mathematical Definitions

#### Global Capacity Allocation
```
C_global = 1000 publishes/minute (fixed)
C_workspace(tier) = {10, 50, 200} publishes/minute (tier-dependent)
```

#### Fairness Constraint
```
∀ workspace_i: consumed_i ≤ C_workspace(tier_i)
∑ consumed_i ≤ C_global
```

**Interpretation**: Each workspace is bounded by its tier limit, and total consumption cannot exceed global capacity.

#### Workspace Isolation
```
consumed_i is independent of consumed_j for i ≠ j
```

**Interpretation**: One workspace exhausting its budget does not affect other workspaces (unless global budget exhausted).

### 6.2 Fairness Guarantees

#### Guarantee 1: No Monopolization
```
max(consumed_i) ≤ 200 publishes/minute (enterprise tier limit)
```
No single workspace can consume more than 20% of global capacity.

#### Guarantee 2: Proportional Allocation
```
If C_global not exhausted:
  workspace_i can consume up to C_workspace(tier_i)
```
Workspaces are not competing for capacity unless global budget exhausted.

#### Guarantee 3: No Starvation
```
If consumed_i < C_workspace(tier_i) AND ∑ consumed < C_global:
  admission(workspace_i) = ADMITTED
```
A workspace with available budget is never starved if global capacity exists.

#### Guarantee 4: Tier-Based Priority
```
C_workspace(enterprise) > C_workspace(pro) > C_workspace(free)
200 > 50 > 10
```
Higher tiers receive proportionally more capacity.


### 6.3 Unused Capacity Reclamation

**Question**: If workspace A has 50/min budget but only uses 10/min, can workspace B use the unused 40/min?

**Answer**: No (by design)

**Rationale**:
- Predictable behavior: Workspaces know their exact capacity
- No starvation: Workspace A can burst to 50/min anytime
- Simplicity: No complex reclamation logic

**Alternative Design** (not chosen):
- Proportional sharing: Unused capacity distributed proportionally
- Complexity: Requires dynamic budget adjustment
- Unpredictability: Workspace capacity varies based on others' usage

**Chosen Design**: Hard per-workspace limits with global cap

### 6.4 Global Budget Exhaustion Behavior

**Scenario**: ∑ consumed_i = C_global (1000/min)

**Behavior**: All workspaces rejected until sliding window expires

**Fairness Impact**:
- First-come-first-served within budget constraints
- No workspace prioritization (except tier limits)
- Critical priority bypasses budget (emergency escape hatch)

**Mitigation**:
- Global budget sized for expected load (1000/min >> typical usage)
- Monitoring alerts on global budget exhaustion
- Capacity planning based on workspace growth

### 6.5 Starvation Prevention

**Mechanism**: Independent per-workspace budgets

**Proof of No Starvation**:
```
Assume workspace_i is starved (never admitted)
→ consumed_i < C_workspace(tier_i) (workspace budget available)
→ ∑ consumed < C_global (global budget available, since workspace_i not consuming)
→ admission(workspace_i) = ADMITTED (by Lua script logic)
→ Contradiction

Therefore, no workspace can be starved if it has available budget and global capacity exists.
```

**Exception**: Global budget exhaustion (temporary, resolves after 60s)


---

## 7. Freeze Logic

### 7.1 Trigger Conditions (CORRECTED)

**Budget Overload Freeze activates when BOTH conditions are met**:

#### Condition 1: High Budget Rejection Rate
```
rejection_rate = budget_rejections_past_60s / total_requests_past_60s
threshold = 0.3 (30%)

if (rejection_rate > threshold) → Condition 1 satisfied
```

#### Condition 2: System Stress
```
load_state = backpressureManager.getCurrentState()

if (load_state == HIGH_LOAD || load_state == CRITICAL_LOAD) → Condition 2 satisfied
```

**Freeze Activation**:
```
if (Condition 1 AND Condition 2) → Enter DEGRADED mode
```

**Rationale**:
- Budget rejections alone are governance enforcement, NOT system instability
- Freeze only when budget exhaustion correlates with actual system stress
- Preserves governance/stability separation (INVARIANT-7)

**Example Scenarios**:

| Rejection Rate | Load State | Freeze? | Reason |
|----------------|------------|---------|--------|
| 50% | LOW_LOAD | No | High rejections but system healthy (governance only) |
| 50% | HIGH_LOAD | Yes | High rejections + system stressed (overload) |
| 10% | CRITICAL_LOAD | No | Low rejections despite high load (not budget-related) |
| 40% | ELEVATED_LOAD | No | High rejections but load not critical yet |


### 7.2 Minimum Freeze Duration

**Duration**: Inherited from existing DegradedModeManager

**State Machine**:
```
NORMAL → DEGRADED (freeze activated)
DEGRADED → RECOVERING (conditions cleared)
RECOVERING → NORMAL (stable for 5 minutes)
```

**Minimum Freeze Duration**: Effectively 5 minutes (recovery stable period)

**Rationale**:
- Prevents rapid freeze oscillation
- Allows system to stabilize
- Consistent with existing degraded mode behavior

### 7.3 Recovery Conditions

**Exit DEGRADED mode when**:
```
rejection_rate ≤ 0.3 (30%)
OR
load_state < HIGH_LOAD
```

**Enter RECOVERING mode**: Conditions cleared, start 5-minute stability timer

**Exit RECOVERING mode**: Stable for 5 minutes without re-triggering

**Rationale**:
- Either condition clearing is sufficient (not both required)
- Budget capacity restored OR system load reduced
- 5-minute stability prevents premature exit

### 7.4 Oscillation Prevention

**Mechanism**: Reuse existing BackpressureManager oscillation detection

**Oscillation Detection**:
- Track state transitions (NORMAL ↔ DEGRADED ↔ RECOVERING)
- If >5 transitions in 60 seconds → Oscillation detected
- Freeze state transitions for 30 seconds

**Integration**:
- DegradedModeManager state changes emit events
- BackpressureManager-style oscillation tracking applied
- Minimum dwell time in each state (10s NORMAL, 30s DEGRADED, 300s RECOVERING)

**Rationale**:
- Consistent with stable control loop design
- Prevents rapid freeze/unfreeze cycles
- Preserves system stability


### 7.5 Critical Priority Bypass Rules

**Rule**: Critical priority publishes bypass ALL admission controls

**Implementation**:
```typescript
if (priority === 'critical') {
  // Skip degraded mode freeze
  // Skip backpressure rejection
  // Skip budget enforcement
  return { admitted: true, reason: 'critical_priority_bypass' };
}
```

**Use Cases**:
- Emergency notifications
- System-critical publishes
- SLA-guaranteed publishes

**Safeguards**:
- Critical priority assigned by backend, not client
- Audit logging for all critical bypasses
- Rate limit on critical priority usage (separate mechanism)

**Rationale**:
- Emergency escape hatch for critical operations
- Prevents complete system lockout
- Maintains service availability for critical functions

**Monitoring**:
- Track critical bypass rate
- Alert on excessive critical priority usage
- Dashboard showing critical vs normal admission ratio

---

## 8. Performance Analysis

### 8.1 Redis Operations Per Publish

**Single Admission Check** (Lua script):
```
1. EXISTS (correlation key)                    → 1 op
2. ZREMRANGEBYSCORE (global)                   → 1 op
3. ZREMRANGEBYSCORE (workspace)                → 1 op
4. ZREMRANGEBYSCORE (platform, if enabled)     → 1 op
5. ZCARD (global)                              → 1 op
6. ZCARD (workspace)                           → 1 op
7. ZCARD (platform, if enabled)                → 1 op
8. ZRANGE (oldest entry, if rejected)          → 1 op
9. ZADD (global, if admitted)                  → 1 op
10. ZADD (workspace, if admitted)              → 1 op
11. ZADD (platform, if admitted)               → 1 op
12. SETEX (correlation key)                    → 1 op

Total: 12 operations (platform disabled: 9 operations)
```

**Lua Script Execution**: All operations in single Redis round-trip

**Latency**: ~1-2ms (single Redis call from application perspective)

### 8.2 Worst-Case Concurrency

**Scenario**: 100 workers, all attempting publish simultaneously

**Redis Throughput**: ~50,000 ops/sec (single instance)

**Admission Check Throughput**: 50,000 / 12 = ~4,166 checks/sec

**100 Workers**: 100 checks = ~24ms total (serialized by Redis)

**Per-Worker Latency**: ~2ms average (Redis scheduling)

**Conclusion**: Single Redis instance handles 100 concurrent workers with <5ms latency

### 8.3 Memory Usage

**Per Entry**: 74 bytes (ZSET member + score + overhead)

**Global Budget** (1000/min):
- 1000 entries × 74 bytes = 74 KB

**Workspace Budgets** (10,000 workspaces):
- Realistic average: 10 entries/workspace × 74 bytes = 740 bytes/workspace
- Total: 10,000 × 740 bytes = 7.4 MB

**Platform Budgets** (4 platforms):
- 300 entries/platform × 74 bytes = 22.2 KB/platform
- Total: 4 × 22.2 KB = 88.8 KB

**Correlation Keys** (1000 active):
- 1000 keys × 200 bytes = 200 KB

**Total Memory**: ~8 MB (negligible for Redis)


### 8.4 Key Churn Rate

**Entry Expiration**: 60 seconds (sliding window)

**Churn Rate**: 1000 entries/min = ~16.7 entries/sec

**ZREMRANGEBYSCORE**: Runs on every admission check, removes expired entries

**Impact**: Negligible (ZREMRANGEBYSCORE is O(log N + M) where M = removed entries)

**Correlation Key Expiration**: 300 seconds (5 minutes)

**Correlation Churn**: 1000 keys / 300 sec = ~3.3 keys/sec

**Impact**: Negligible (Redis handles millions of expirations/sec)

### 8.5 Expiration Load

**Redis Expiration Strategy**: Lazy + Active

**Lazy Expiration**: Key accessed → check TTL → delete if expired

**Active Expiration**: Background process samples keys, deletes expired

**Budget System Impact**:
- ZSET entries: No TTL (cleaned by ZREMRANGEBYSCORE)
- Correlation keys: TTL-based expiration

**Expiration Load**: ~3.3 correlation keys/sec (negligible)

### 8.6 Bottleneck Analysis

**Potential Bottlenecks**:
1. Redis single-threaded execution
2. Lua script complexity
3. Network latency

**Mitigation**:
1. Redis throughput: 50k ops/sec >> 1000 publishes/min
2. Lua script: Simple operations, no loops, O(log N) complexity
3. Network: Co-locate Redis with application servers

**Conclusion**: Redis will NOT become bottleneck at 1000 publishes/min scale

**Scaling Headroom**: System can handle 10x load (10,000 publishes/min) without Redis bottleneck

---

## 9. Test Strategy

### 9.1 Unit Tests

#### GlobalRateLimitManager Tests
```typescript
describe('GlobalRateLimitManager.checkPublishBudget', () => {
  test('admits request when budget available');
  test('rejects request when global budget exhausted');
  test('rejects request when workspace budget exhausted');
  test('rejects request when platform budget exhausted');
  test('returns correct retry_after on rejection');
  test('deduplicates requests with same correlation ID');
  test('fails open when Redis unavailable');
  test('respects tier limits (free: 10, pro: 50, enterprise: 200)');
  test('sliding window expires entries after 60 seconds');
  test('correlation key expires after 5 minutes');
});
```

#### AdmissionController Tests
```typescript
describe('AdmissionController.checkAdmissionWithBudget', () => {
  test('evaluates checks in correct order (freeze → load → budget)');
  test('rejects when degraded mode active (non-critical)');
  test('bypasses freeze for critical priority');
  test('rejects when load state is CRITICAL_LOAD');
  test('delays when load state is HIGH_LOAD');
  test('rejects when budget exhausted');
  test('admits when all checks pass');
  test('returns correct rejection type (load/budget/freeze)');
  test('tracks budget rejections for freeze detection');
});
```

#### DegradedModeManager Tests
```typescript
describe('DegradedModeManager.budgetOverloadFreeze', () => {
  test('does NOT freeze on high rejection rate alone');
  test('does NOT freeze on high load alone');
  test('freezes when BOTH high rejection rate AND high load');
  test('exits freeze when rejection rate drops below 30%');
  test('exits freeze when load state drops below HIGH_LOAD');
  test('prevents oscillation with minimum dwell time');
  test('tracks budget rejection history (60s window)');
});
```


### 9.2 Concurrency Tests

```typescript
describe('Budget Enforcement Concurrency', () => {
  test('100 concurrent workers: exactly N admitted where N = remaining budget', async () => {
    // Setup: Global budget = 1000, workspace budget = 50
    // Action: 100 workers attempt publish simultaneously
    // Assert: Exactly 50 admitted, 50 rejected
    // Assert: No race conditions, deterministic results
  });
  
  test('Concurrent retries with same correlation ID: no double increment', async () => {
    // Setup: Worker retries publish 10 times with same correlation ID
    // Action: All retries execute concurrently
    // Assert: Budget incremented only once
    // Assert: All retries return same cached result
  });
  
  test('Concurrent workspace publishes: independent budgets', async () => {
    // Setup: 10 workspaces, each with 50/min budget
    // Action: Each workspace attempts 60 publishes concurrently
    // Assert: Each workspace gets exactly 50 admitted, 10 rejected
    // Assert: No cross-workspace interference
  });
});
```

### 9.3 Chaos Exhaustion Tests

```typescript
describe('Chaos Budget Exhaustion', () => {
  test('Global budget exhaustion triggers freeze when load high', async () => {
    // Setup: Global budget = 1000
    // Action: Chaos harness sends 2000 publishes rapidly
    // Assert: First 1000 admitted, next 1000 rejected
    // Assert: Rejection rate >30% detected
    // Assert: Load state transitions to HIGH_LOAD (queue depth increases)
    // Assert: Budget overload freeze activates
    // Assert: Critical priority bypasses freeze
  });
  
  test('Budget exhaustion without load increase: no freeze', async () => {
    // Setup: Global budget = 1000, workers process instantly (no queue buildup)
    // Action: Send 2000 publishes at controlled rate
    // Assert: First 1000 admitted, next 1000 rejected
    // Assert: Rejection rate >30% but load state = LOW_LOAD
    // Assert: NO freeze activation (governance only)
  });
  
  test('Sliding window recovery after exhaustion', async () => {
    // Setup: Exhaust global budget (1000 publishes)
    // Action: Wait 60 seconds (sliding window expires)
    // Assert: Budget capacity restored
    // Assert: New publishes admitted
    // Assert: Freeze exits after 5-minute stability
  });
});
```


### 9.4 Fairness Validation Tests

```typescript
describe('Budget Fairness', () => {
  test('No workspace monopolization: max 200/min per workspace', async () => {
    // Setup: 1 enterprise workspace (200/min), global budget = 1000
    // Action: Enterprise workspace attempts 500 publishes
    // Assert: Exactly 200 admitted, 300 rejected
    // Assert: Workspace cannot exceed tier limit
  });
  
  test('No starvation: workspace with budget always admitted', async () => {
    // Setup: 10 workspaces, each with 50/min budget, global = 1000
    // Action: Each workspace attempts 50 publishes
    // Assert: All 500 publishes admitted (no starvation)
    // Assert: Global budget not exhausted (500 < 1000)
  });
  
  test('Tier-based allocation: enterprise > pro > free', async () => {
    // Setup: 1 free (10/min), 1 pro (50/min), 1 enterprise (200/min)
    // Action: Each attempts 100 publishes
    // Assert: Free gets 10, pro gets 50, enterprise gets 200
    // Assert: Tier limits enforced independently
  });
  
  test('Unused capacity not reclaimed', async () => {
    // Setup: Workspace A (50/min) uses only 10/min
    // Action: Workspace B (50/min) attempts 60 publishes
    // Assert: Workspace B gets exactly 50 (not 50 + 40 unused from A)
    // Assert: Hard per-workspace limits
  });
});
```

### 9.5 Freeze Activation Tests

```typescript
describe('Budget Overload Freeze', () => {
  test('Freeze requires BOTH high rejection rate AND high load', async () => {
    // Test Case 1: High rejections, low load → No freeze
    // Test Case 2: Low rejections, high load → No freeze
    // Test Case 3: High rejections, high load → Freeze
  });
  
  test('Freeze exits when rejection rate drops', async () => {
    // Setup: Freeze active (high rejections + high load)
    // Action: Budget capacity restored (sliding window expires)
    // Assert: Rejection rate drops below 30%
    // Assert: Freeze exits to RECOVERING
    // Assert: After 5 min stability, exits to NORMAL
  });
  
  test('Freeze exits when load drops', async () => {
    // Setup: Freeze active (high rejections + high load)
    // Action: Queue drains, load state drops to ELEVATED_LOAD
    // Assert: Freeze exits to RECOVERING (even if rejections still high)
    // Assert: After 5 min stability, exits to NORMAL
  });
});
```


### 9.6 Budget Reset Tests

```typescript
describe('Sliding Window Budget Reset', () => {
  test('Entries expire after 60 seconds', async () => {
    // Setup: Consume 1000/1000 global budget
    // Action: Wait 60 seconds
    // Assert: ZREMRANGEBYSCORE removes all entries
    // Assert: Budget fully restored (1000/1000 available)
  });
  
  test('Partial window expiration', async () => {
    // Setup: Consume 500 at T=0, 500 at T=30
    // Action: Check budget at T=60
    // Assert: First 500 expired, second 500 still counted
    // Assert: 500/1000 budget available
  });
  
  test('Retry-After accuracy with sliding window', async () => {
    // Setup: Budget exhausted, oldest entry at T=12:00:05
    // Action: Check admission at T=12:00:45
    // Assert: retry_after = (12:00:05 + 60s) - 12:00:45 = 20 seconds
    // Assert: NOT minute-boundary logic (would be 15 seconds)
  });
  
  test('Correlation key expiration', async () => {
    // Setup: Admission check creates correlation key with 5-min TTL
    // Action: Wait 5 minutes
    // Assert: Correlation key expired
    // Assert: Retry with same correlation ID creates new entry
  });
});
```

---

## 10. Rollout Plan

### 10.1 Phase 1: Global Budget Only (Week 1)

**Scope**: Implement global publish budget (1000/min) without workspace or platform limits

**Implementation**:
1. Create Lua script with global budget logic only
2. Extend `GlobalRateLimitManager.checkPublishBudget()` (global only)
3. Extend `AdmissionController.checkAdmissionWithBudget()` (global check only)
4. Add unit tests for global budget
5. Add concurrency tests (100 workers)

**Feature Flags**:
```env
PUBLISH_BUDGET_ENABLED=true
PUBLISH_BUDGET_GLOBAL_LIMIT=1000
PUBLISH_BUDGET_WORKSPACE_ENABLED=false
PUBLISH_BUDGET_PLATFORM_ENABLED=false
```

**Validation**:
- Global budget enforced correctly
- Retry-After calculation accurate
- Correlation ID deduplication works
- Fail-open on Redis errors
- No performance degradation

**Rollback**: Set `PUBLISH_BUDGET_ENABLED=false`

### 10.2 Phase 2: Add Workspace Budgets (Week 2)

**Scope**: Add per-workspace budgets (10/50/200 based on tier)

**Implementation**:
1. Extend Lua script with workspace budget logic
2. Add tier resolution logic (derive from authenticated context)
3. Update `checkPublishBudget()` to include workspace checks
4. Add fairness validation tests
5. Add tier-based allocation tests

**Feature Flags**:
```env
PUBLISH_BUDGET_ENABLED=true
PUBLISH_BUDGET_WORKSPACE_ENABLED=true
PUBLISH_BUDGET_FREE_TIER=10
PUBLISH_BUDGET_PRO_TIER=50
PUBLISH_BUDGET_ENTERPRISE_TIER=200
```

**Validation**:
- Workspace budgets enforced independently
- Tier limits respected
- No starvation
- No monopolization
- INVARIANT-9 validated (tier from auth context)

**Rollback**: Set `PUBLISH_BUDGET_WORKSPACE_ENABLED=false`


### 10.3 Phase 3: Add Platform Budgets (Week 3)

**Scope**: Add optional per-platform budgets (Twitter: 300/min, LinkedIn: 200/min, etc.)

**Implementation**:
1. Extend Lua script with platform budget logic
2. Update `checkPublishBudget()` to include platform checks
3. Add platform-specific tests
4. Add chaos tests for platform exhaustion

**Feature Flags**:
```env
PUBLISH_BUDGET_PLATFORM_ENABLED=true
PUBLISH_BUDGET_TWITTER=300
PUBLISH_BUDGET_LINKEDIN=200
PUBLISH_BUDGET_FACEBOOK=200
PUBLISH_BUDGET_INSTAGRAM=200
```

**Validation**:
- Platform budgets enforced correctly
- Platform limits independent of workspace limits
- Global budget still enforced
- No cross-platform interference

**Rollback**: Set `PUBLISH_BUDGET_PLATFORM_ENABLED=false`

### 10.4 Phase 4: Enable Freeze Logic (Week 4)

**Scope**: Enable budget overload freeze detection

**Implementation**:
1. Extend `DegradedModeManager` with budget rejection tracking
2. Implement `checkBudgetOverloadFreeze()` logic
3. Add freeze activation tests (BOTH conditions required)
4. Add freeze exit tests
5. Add oscillation prevention tests

**Feature Flags**:
```env
PUBLISH_BUDGET_FREEZE_ENABLED=true
PUBLISH_BUDGET_FREEZE_REJECTION_THRESHOLD=0.3
PUBLISH_BUDGET_FREEZE_WINDOW_MS=60000
```

**Validation**:
- Freeze activates only when BOTH conditions met
- Freeze does NOT activate on budget rejections alone
- Freeze does NOT activate on high load alone
- Freeze exits correctly (rejection rate OR load drops)
- Oscillation prevention works

**Rollback**: Set `PUBLISH_BUDGET_FREEZE_ENABLED=false`


### 10.5 Monitoring & Observability

**Metrics to Track**:
```typescript
// Budget consumption
publish_budget_global_consumed
publish_budget_global_limit
publish_budget_workspace_consumed{workspace_id, tier}
publish_budget_workspace_limit{workspace_id, tier}
publish_budget_platform_consumed{platform}
publish_budget_platform_limit{platform}

// Admission decisions
admission_total{result=admitted|rejected|delayed}
admission_rejection_type{type=load|budget|freeze}
admission_budget_rejection_rate

// Freeze detection
budget_overload_freeze_active{state=normal|degraded|recovering}
budget_rejection_rate_60s
budget_freeze_correlation_with_load

// Performance
budget_check_latency_ms
budget_check_redis_errors
budget_check_fail_open_count

// Fairness
workspace_starvation_events
workspace_monopolization_events
tier_allocation_distribution{tier}
```

**Dashboards**:
1. Budget Consumption Overview (global, workspace, platform)
2. Admission Decision Breakdown (admitted/rejected/delayed by type)
3. Freeze Activation Timeline (triggers, duration, recovery)
4. Fairness Metrics (tier distribution, starvation detection)
5. Performance Metrics (latency, Redis health, fail-open rate)

**Alerts**:
- Global budget >80% consumed (warning)
- Global budget exhausted (critical)
- Budget overload freeze activated (critical)
- Redis errors >1% (warning)
- Fail-open rate >5% (critical)
- Workspace starvation detected (warning)


### 10.6 Operational Runbook

#### Scenario 1: Global Budget Exhausted
**Symptoms**: All publishes rejected, `global_budget_exhausted` errors

**Investigation**:
1. Check global budget consumption: `publish_budget_global_consumed`
2. Identify top consuming workspaces
3. Check if legitimate traffic spike or abuse

**Resolution**:
- If legitimate: Increase `PUBLISH_BUDGET_GLOBAL_LIMIT`
- If abuse: Investigate workspace, consider rate limiting
- If temporary: Wait 60 seconds for sliding window to expire

#### Scenario 2: Budget Overload Freeze Activated
**Symptoms**: System in degraded mode, budget-related triggers

**Investigation**:
1. Check rejection rate: `budget_rejection_rate_60s`
2. Check load state: `backpressure_load_state`
3. Verify BOTH conditions met (>30% rejections AND high load)

**Resolution**:
- If budget exhaustion: Increase budgets or wait for window expiration
- If load spike: Investigate queue depth, worker capacity
- If false positive: Review freeze threshold configuration

#### Scenario 3: Redis Unavailable
**Symptoms**: Budget checks failing, fail-open mode active

**Investigation**:
1. Check Redis health: `redis_connection_status`
2. Check fail-open rate: `budget_check_fail_open_count`
3. Review Redis logs for errors

**Resolution**:
- Restore Redis connection
- Monitor for budget violations during fail-open period
- Consider temporary budget increase after recovery

#### Scenario 4: Workspace Starvation
**Symptoms**: Workspace with available budget not getting admitted

**Investigation**:
1. Check workspace budget: `publish_budget_workspace_consumed`
2. Check global budget: `publish_budget_global_consumed`
3. Review admission logs for rejection reasons

**Resolution**:
- If global exhausted: Increase global budget
- If bug: Review Lua script logic, check for race conditions
- If configuration: Verify tier limits correct


---

## 11. Implementation Checklist

### 11.1 Code Changes

- [ ] Create `checkAndIncrementPublishBudget.lua` script
- [ ] Extend `GlobalRateLimitManager` with `checkPublishBudget()` method
- [ ] Extend `AdmissionController` with `checkAdmissionWithBudget()` method
- [ ] Extend `DegradedModeManager` with budget rejection tracking
- [ ] Extend `ResilienceConfig` with `PUBLISH_BUDGET` configuration
- [ ] Extend `types.ts` with budget-related types
- [ ] Update `PublishingWorker` to use unified admission check
- [ ] Add tier resolution logic (derive from authenticated context)

### 11.2 Testing

- [ ] Unit tests: GlobalRateLimitManager (10 tests)
- [ ] Unit tests: AdmissionController (8 tests)
- [ ] Unit tests: DegradedModeManager (7 tests)
- [ ] Concurrency tests (3 tests)
- [ ] Chaos exhaustion tests (3 tests)
- [ ] Fairness validation tests (4 tests)
- [ ] Freeze activation tests (3 tests)
- [ ] Budget reset tests (4 tests)
- [ ] Integration tests with existing resilience system

### 11.3 Documentation

- [ ] Update `RESILIENCE_IMPLEMENTATION_STATUS.md`
- [ ] Create `PUBLISH_BUDGET_COMPLETE.md`
- [ ] Update `RESILIENCE_QUICK_REFERENCE.md`
- [ ] Create operational runbook
- [ ] Update API documentation with budget rejection responses
- [ ] Create architecture diff report

### 11.4 Monitoring

- [ ] Add budget consumption metrics
- [ ] Add admission decision metrics
- [ ] Add freeze detection metrics
- [ ] Add performance metrics
- [ ] Create Grafana dashboards
- [ ] Configure alerts
- [ ] Add logging for budget rejections

### 11.5 Deployment

- [ ] Phase 1: Global budget only (feature flag)
- [ ] Phase 2: Add workspace budgets (feature flag)
- [ ] Phase 3: Add platform budgets (feature flag)
- [ ] Phase 4: Enable freeze logic (feature flag)
- [ ] Validate each phase before proceeding
- [ ] Monitor metrics after each phase
- [ ] Document rollback procedures

---

## 12. Security Considerations

### 12.1 Tier Trust Boundary (INVARIANT-9)

**Threat**: Privilege escalation attack where free-tier user claims enterprise budget

**Mitigation**:
```typescript
// CORRECT: Derive tier from authenticated workspace context
const workspace = await getAuthenticatedWorkspace(workspaceId);
const tier = workspace.subscription.tier; // From database, not client

// INCORRECT: Accept tier from client payload
const tier = request.body.tier; // NEVER DO THIS
```

**Validation**:
- Tier MUST be derived from authenticated session
- Tier MUST be validated against database subscription record
- Client-provided tier MUST be ignored
- Audit log all tier resolutions

### 12.2 Correlation ID Security

**Threat**: Correlation ID prediction allows budget bypass

**Mitigation**:
- Use cryptographically secure random UUIDs
- Include timestamp and workspace ID in correlation ID
- Validate correlation ID format server-side

**Format**:
```typescript
const correlationId = `${workspaceId}:${uuidv4()}:${Date.now()}`;
```

### 12.3 Redis Injection Prevention

**Threat**: Malicious input in workspace ID or platform causes Redis command injection

**Mitigation**:
- Validate all inputs before passing to Lua script
- Use parameterized Lua script (KEYS and ARGV)
- Sanitize workspace IDs and platform names

**Validation**:
```typescript
const WORKSPACE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const PLATFORM_REGEX = /^(twitter|linkedin|facebook|instagram)$/;

if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
  throw new Error('Invalid workspace ID');
}
if (!PLATFORM_REGEX.test(platform)) {
  throw new Error('Invalid platform');
}
```

### 12.4 Denial of Service Prevention

**Threat**: Attacker exhausts budgets to deny service to legitimate users

**Mitigation**:
- Per-workspace budgets prevent single attacker from exhausting global capacity
- Budget overload freeze protects system under attack
- Critical priority bypass ensures emergency operations
- Rate limiting at API gateway (separate layer)

### 12.5 Audit Logging

**Requirements**:
- Log all budget rejections with workspace ID, tier, reason
- Log all freeze activations with triggers
- Log all critical priority bypasses
- Log all tier resolutions
- Retain logs for 90 days minimum

**Format**:
```json
{
  "event": "budget_rejection",
  "timestamp": "2026-02-27T12:00:00Z",
  "workspace_id": "ws_123",
  "tier": "free",
  "reason": "workspace_budget_exhausted",
  "retry_after": 42,
  "correlation_id": "ws_123:uuid:timestamp"
}
```

---

## 13. Open Questions & Future Work

### 13.1 Open Questions

**Q1**: Should critical priority bypass budget enforcement entirely, or only freeze?

**Current Design**: Bypasses all checks (freeze, load, budget)

**Alternative**: Bypass freeze only, still enforce budget

**Decision Needed**: Depends on business requirements for critical publishes

---

**Q2**: Should unused workspace capacity be reclaimable by other workspaces?

**Current Design**: No (hard per-workspace limits)

**Alternative**: Proportional sharing of unused capacity

**Trade-off**: Simplicity vs. efficiency

---

**Q3**: Should platform budgets be per-account or global per-platform?

**Current Design**: Global per-platform (e.g., all Twitter accounts share 300/min)

**Alternative**: Per-account per-platform (each Twitter account gets 300/min)

**Decision Needed**: Depends on platform rate limit structure

---

### 13.2 Future Enhancements

#### Enhancement 1: Dynamic Budget Adjustment
- Automatically adjust budgets based on historical usage
- Machine learning model predicts optimal budgets
- Gradual budget increases for well-behaved workspaces

#### Enhancement 2: Budget Borrowing
- Allow workspaces to temporarily borrow from global capacity
- Repay borrowed capacity over time
- Prevents hard rejections during legitimate bursts

#### Enhancement 3: Priority-Based Budget Allocation
- Higher priority publishes get preferential budget allocation
- Reserve portion of budget for high-priority requests
- Prevents low-priority requests from starving high-priority

#### Enhancement 4: Multi-Region Budget Coordination
- Coordinate budgets across multiple Redis instances
- Global budget enforced across all regions
- Eventual consistency acceptable for budget enforcement

#### Enhancement 5: Budget Analytics Dashboard
- Real-time budget consumption visualization
- Historical trends and forecasting
- Anomaly detection for unusual consumption patterns

---

## 14. Appendix

### 14.1 Complete Lua Script

```lua
-- checkAndIncrementPublishBudget.lua
-- Atomic publish budget check and increment with sliding window

local global_key = KEYS[1]
local workspace_key = KEYS[2]
local platform_key = KEYS[3]
local correlation_key = KEYS[4]

local current_ts = tonumber(ARGV[1])
local window_size = tonumber(ARGV[2])
local global_limit = tonumber(ARGV[3])
local workspace_limit = tonumber(ARGV[4])
local platform_limit = tonumber(ARGV[5])
local correlation_id = ARGV[6]
local correlation_ttl = tonumber(ARGV[7])

-- 1. Check correlation ID for deduplication
local correlation_exists = redis.call('EXISTS', correlation_key)
if correlation_exists == 1 then
  local cached_result = redis.call('GET', correlation_key)
  return cjson.decode(cached_result)
end

-- 2. Remove expired entries from all windows
local cutoff_ts = current_ts - window_size
redis.call('ZREMRANGEBYSCORE', global_key, '-inf', cutoff_ts)
redis.call('ZREMRANGEBYSCORE', workspace_key, '-inf', cutoff_ts)
if platform_limit > 0 then
  redis.call('ZREMRANGEBYSCORE', platform_key, '-inf', cutoff_ts)
end

-- 3. Count current entries in each window
local global_count = redis.call('ZCARD', global_key)
local workspace_count = redis.call('ZCARD', workspace_key)
local platform_count = 0
if platform_limit > 0 then
  platform_count = redis.call('ZCARD', platform_key)
end

-- 4. Check budgets in order: global, workspace, platform
local result = {admitted = false, reason = '', retry_after = 0}

if global_count >= global_limit then
  -- Global budget exhausted
  local oldest_global = redis.call('ZRANGE', global_key, 0, 0, 'WITHSCORES')
  if #oldest_global > 0 then
    local oldest_ts = tonumber(oldest_global[2])
    result.retry_after = math.ceil((oldest_ts + window_size - current_ts) / 1000)
  end
  result.reason = 'global_budget_exhausted'
  
elseif workspace_count >= workspace_limit then
  -- Workspace budget exhausted
  local oldest_workspace = redis.call('ZRANGE', workspace_key, 0, 0, 'WITHSCORES')
  if #oldest_workspace > 0 then
    local oldest_ts = tonumber(oldest_workspace[2])
    result.retry_after = math.ceil((oldest_ts + window_size - current_ts) / 1000)
  end
  result.reason = 'workspace_budget_exhausted'
  
elseif platform_limit > 0 and platform_count >= platform_limit then
  -- Platform budget exhausted
  local oldest_platform = redis.call('ZRANGE', platform_key, 0, 0, 'WITHSCORES')
  if #oldest_platform > 0 then
    local oldest_ts = tonumber(oldest_platform[2])
    result.retry_after = math.ceil((oldest_ts + window_size - current_ts) / 1000)
  end
  result.reason = 'platform_budget_exhausted'
  
else
  -- Budget available, increment all counters
  local entry_id = correlation_id .. ':' .. current_ts
  redis.call('ZADD', global_key, current_ts, entry_id)
  redis.call('ZADD', workspace_key, current_ts, entry_id)
  if platform_limit > 0 then
    redis.call('ZADD', platform_key, current_ts, entry_id)
  end
  
  result.admitted = true
  result.reason = 'admitted'
end

-- 5. Cache result with correlation ID
redis.call('SETEX', correlation_key, correlation_ttl, cjson.encode(result))

return result
```


### 14.2 Type Definitions

```typescript
// types.ts extensions

export interface PublishBudgetConfig {
  enabled: boolean;
  globalLimit: number;
  windowSizeMs: number;
  freeTierLimit: number;
  proTierLimit: number;
  enterpriseTierLimit: number;
  platformLimitsEnabled: boolean;
  platformLimits: {
    twitter: number;
    linkedin: number;
    facebook: number;
    instagram: number;
  };
  correlationTtlSec: number;
  freezeEnabled: boolean;
  freezeRejectionThreshold: number;
  freezeWindowMs: number;
}

export interface BudgetCheckResult {
  admitted: boolean;
  reason: string;
  retryAfter?: number;
}

export interface BudgetStats {
  global: {
    consumed: number;
    limit: number;
    remaining: number;
  };
  workspace: {
    consumed: number;
    limit: number;
    remaining: number;
  };
  platform?: {
    consumed: number;
    limit: number;
    remaining: number;
  };
}

export interface UnifiedAdmissionResult {
  admitted: boolean;
  rejected: boolean;
  delayed: boolean;
  retryAfter?: number;
  delayMs?: number;
  reason: string;
  rejectionType?: 'load' | 'budget' | 'freeze';
}

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface BudgetRejectionRecord {
  timestamp: number;
  reason: string;
  workspaceId: string;
  tier: SubscriptionTier;
}
```


### 14.3 Configuration Reference

```bash
# Budget Enforcement
PUBLISH_BUDGET_ENABLED=true
PUBLISH_BUDGET_GLOBAL_LIMIT=1000
PUBLISH_BUDGET_WINDOW_MS=60000

# Workspace Budgets
PUBLISH_BUDGET_WORKSPACE_ENABLED=true
PUBLISH_BUDGET_FREE_TIER=10
PUBLISH_BUDGET_PRO_TIER=50
PUBLISH_BUDGET_ENTERPRISE_TIER=200

# Platform Budgets (Optional)
PUBLISH_BUDGET_PLATFORM_ENABLED=false
PUBLISH_BUDGET_TWITTER=300
PUBLISH_BUDGET_LINKEDIN=200
PUBLISH_BUDGET_FACEBOOK=200
PUBLISH_BUDGET_INSTAGRAM=200

# Correlation Deduplication
PUBLISH_BUDGET_CORRELATION_TTL=300

# Freeze Logic
PUBLISH_BUDGET_FREEZE_ENABLED=true
PUBLISH_BUDGET_FREEZE_REJECTION_THRESHOLD=0.3
PUBLISH_BUDGET_FREEZE_WINDOW_MS=60000
```

### 14.4 References

- **Existing Resilience System**: `apps/backend/RESILIENCE_IMPLEMENTATION_STATUS.md`
- **Stable Control Loop**: `apps/backend/STABLE_CONTROL_LOOP_COMPLETE.md`
- **BackpressureManager**: `apps/backend/src/resilience/BackpressureManager.ts`
- **AdmissionController**: `apps/backend/src/resilience/AdmissionController.ts`
- **DegradedModeManager**: `apps/backend/src/resilience/DegradedModeManager.ts`
- **GlobalRateLimitManager**: `apps/backend/src/services/GlobalRateLimitManager.ts`
- **ResilienceConfig**: `apps/backend/src/resilience/ResilienceConfig.ts`

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-27 | Principal Architect | Initial RFC creation |
| 1.1 | 2026-02-27 | Principal Architect | Architectural corrections (FR-5, FR-6, FR-7, INVARIANT-9) |

---

**END OF RFC-005**

