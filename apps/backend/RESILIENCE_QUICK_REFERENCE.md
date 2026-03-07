# Resilience System - Quick Reference

## 📁 File Structure

```
src/resilience/
├── types.ts                          # Type definitions
├── ResilienceConfig.ts               # Configuration
├── LatencyTracker.ts                 # Latency histogram tracking
├── BackpressureManager.ts            # Load monitoring
├── AdaptivePublishPacer.ts           # Dynamic concurrency
├── AdaptiveRefreshScheduler.ts       # Refresh throttling
├── AdmissionController.ts            # Request admission control
├── DegradedModeManager.ts            # Degraded mode management
├── ResilienceDashboardService.ts     # Metrics dashboard
└── index.ts                          # Unified exports
```

## 🎯 What Each Component Does

| Component | Purpose | Key Methods |
|-----------|---------|-------------|
| **LatencyTracker** | Tracks P50/P95/P99/Max latency | `recordPublishLatency()`, `recordRefreshLatency()`, `recordQueueLag()` |
| **BackpressureManager** | Monitors system load, emits state changes | `getCurrentState()`, `getLastMetrics()` |
| **AdaptivePublishPacer** | Adjusts worker concurrency dynamically | `getCurrentConcurrency()`, `shouldAdmitJob()` |
| **AdaptiveRefreshScheduler** | Throttles token refresh operations | `shouldAllowRefresh()`, `recordRefresh()` |
| **AdmissionController** | Controls new request admission | `checkAdmission()` |
| **DegradedModeManager** | Triggers degraded mode under stress | `isDegraded()`, `isRecovering()` |
| **ResilienceDashboardService** | Exposes metrics via API | `getStatus()`, `getMetrics()`, `exportMetrics()` |

## 🔄 Load States

```
LOW_LOAD (score < 30)
  ↓ System load increases
ELEVATED_LOAD (30 ≤ score < 50)
  ↓ System load increases
HIGH_LOAD (50 ≤ score < 70)
  ↓ System load increases
CRITICAL_LOAD (score ≥ 70)
```

**Load Score Formula**:
```
score = (queueDepth × 0.3) + (retryRate × 0.3) + (rateLimitHits × 0.2) + (refreshBacklog × 0.2)
```

## 🎚️ Concurrency Adjustments

| Load State | Publish Concurrency | Behavior |
|------------|---------------------|----------|
| LOW_LOAD | 5 (100%) | Normal operation |
| ELEVATED_LOAD | 4 (80%) | Slight reduction |
| HIGH_LOAD | 2 (40%) | Significant reduction |
| CRITICAL_LOAD | 0 (0%) | **PAUSED** |

## 🚦 Admission Control Rules

| Load State | Low Priority | Normal Priority | High Priority | Critical Priority |
|------------|--------------|-----------------|---------------|-------------------|
| LOW_LOAD | ✅ Accept | ✅ Accept | ✅ Accept | ✅ Accept |
| ELEVATED_LOAD | ⏸️ Delay 5s | ✅ Accept | ✅ Accept | ✅ Accept |
| HIGH_LOAD | ⏸️ Delay 10s | ⏸️ Delay 10s | ✅ Accept | ✅ Accept |
| CRITICAL_LOAD | ❌ Reject | ❌ Reject | ✅ Accept | ✅ Accept |

## 🔴 Degraded Mode Triggers

System enters degraded mode when **ANY** of these conditions are met:

1. **P99 Latency**: >5000ms sustained for 2 minutes
2. **Queue Lag**: >60s sustained for 2 minutes
3. **Retry Storm**: >100 retries/minute

### Degraded Mode Actions:
- ❌ Disable analytics recording
- ⏸️ Pause non-essential operations
- 🐌 Slow publish pacing
- 🛡️ Aggressive rate-limit backoff

### Recovery:
- ✅ Auto-exit after **5 minutes** of stable conditions

## 📊 Key Metrics

### Latency Metrics:
- `publish.p99` - 99th percentile publish latency
- `refresh.p99` - 99th percentile refresh latency
- `queueLag.p99` - 99th percentile queue lag
- `lockAcquisition.p99` - 99th percentile lock acquisition time

### Backpressure Metrics:
- `queueDepth` - Waiting + delayed jobs
- `systemLoadScore` - Weighted load score (0-100)
- `retryRate` - Retries per minute
- `rateLimitHits` - Active rate limits

### Admission Metrics:
- `rejectionRate` - % of requests rejected
- `totalRequests` - Total admission checks
- `acceptedRequests` - Accepted requests
- `rejectedRequests` - Rejected requests

## 🔌 Integration Points

### 1. PublishingWorker
```typescript
// Track latency
const duration = Date.now() - startTime;
latencyTracker.recordPublishLatency(duration);

// Get current concurrency
const concurrency = adaptivePublishPacer.getCurrentConcurrency();

// Check degraded mode
if (degradedModeManager.isDegraded()) {
  // Skip non-essential operations
}
```

### 2. RefreshWorker
```typescript
// Check if refresh allowed
const admission = adaptiveRefreshScheduler.shouldAllowRefresh(platform, expiresAt);
if (!admission.allowed) {
  // Delay or skip refresh
}

// Record refresh
adaptiveRefreshScheduler.recordRefresh(platform);

// Track latency
latencyTracker.recordRefreshLatency(duration);
```

### 3. QueueManager
```typescript
// Track queue lag
worker.on('active', (job) => {
  const lag = Date.now() - job.timestamp;
  latencyTracker.recordQueueLag(lag);
});
```

### 4. API Endpoints
```typescript
// Admission control middleware
router.post('/api/posts', admissionControlMiddleware, async (req, res) => {
  // ... schedule post ...
});
```

## 🌐 API Endpoints

| Endpoint | Description | Format |
|----------|-------------|--------|
| `GET /api/resilience/status` | Human-readable status | JSON |
| `GET /api/resilience/metrics` | Full metrics | JSON |
| `GET /api/resilience/summary` | Compact summary | JSON |
| `GET /api/resilience/export` | Prometheus format | Text |

## 🔧 Configuration

### Key Environment Variables:

```bash
# Load Thresholds
LOAD_THRESHOLD_CRITICAL=90        # Enter CRITICAL_LOAD at score 90

# Concurrency
PUBLISH_CONCURRENCY_NORMAL=5      # Normal concurrency
PUBLISH_CONCURRENCY_CRITICAL=0    # Pause at critical load

# Degraded Mode
DEGRADED_P99_LATENCY_THRESHOLD_MS=5000    # Trigger at 5s P99
DEGRADED_RECOVERY_STABLE_SEC=300          # Recover after 5min stable
```

See `RESILIENCE_IMPLEMENTATION_STATUS.md` for full configuration reference.

## 🚀 Quick Start

### 1. Start Resilience System
```typescript
import { startResilienceSystem } from './resilience';

// After DB/Redis connection
startResilienceSystem();
```

### 2. Check Status
```bash
curl http://localhost:3000/api/resilience/status
```

### 3. Monitor Metrics
```bash
# Prometheus format
curl http://localhost:3000/api/resilience/export
```

## 🧪 Testing

### Unit Tests:
```bash
npm test src/resilience/BackpressureManager.test.ts
npm test src/resilience/AdaptivePublishPacer.test.ts
npm test src/resilience/DegradedModeManager.test.ts
```

### Integration Tests:
```bash
npm test src/__tests__/integration/resilience.test.ts
```

### Chaos Tests:
```bash
cd chaos-testing
npm run chaos-test
```

## 📈 Monitoring Alerts

### Recommended Alerts:

1. **High Load State**
   - Condition: `loadState == "HIGH_LOAD"` for >5 minutes
   - Action: Investigate queue depth, retry rate

2. **Critical Load State**
   - Condition: `loadState == "CRITICAL_LOAD"`
   - Action: **IMMEDIATE** - System paused, investigate immediately

3. **Degraded Mode Activated**
   - Condition: `degradedMode == "DEGRADED"`
   - Action: **URGENT** - System under extreme stress

4. **High P99 Latency**
   - Condition: `publish.p99 > 3000ms` for >5 minutes
   - Action: Investigate slow operations

5. **High Queue Lag**
   - Condition: `queueLag.p99 > 30s` for >5 minutes
   - Action: Scale workers or reduce load

6. **High Rejection Rate**
   - Condition: `rejectionRate > 10%` for >5 minutes
   - Action: System overloaded, scale up

## 🔍 Troubleshooting

### System in CRITICAL_LOAD?
1. Check `systemLoadScore` - what's contributing?
2. Check `queueDepth` - too many jobs queued?
3. Check `retryRate` - retry storm?
4. Check `rateLimitHits` - platform rate limits?

### Degraded Mode Won't Exit?
1. Check triggers - are conditions still present?
2. Check `recoveryProgress` - how long stable?
3. Requires 5 minutes of stable conditions by default

### High Latency?
1. Check `publish.p99` - slow platform API?
2. Check `lockAcquisition.p99` - lock contention?
3. Check `queueLag.p99` - worker capacity?

## 📚 Related Documentation

- `RESILIENCE_IMPLEMENTATION_STATUS.md` - Full implementation status
- `chaos-testing/README.md` - Chaos testing guide
- `docs/provider-architecture.md` - Provider system
- `docs/security-oauth-foundation-layer.md` - Security foundation

---

**Status**: Core implementation complete, integration pending
**Last Updated**: Context Transfer Session


---

## 🆕 Stable Control Loop (v1.1.0)

### Overview
Production-grade stable control loop with EMA smoothing, hysteresis, dwell time, cooldown, oscillation detection, and gradual ramping.

### Key Features

#### 1. EMA Load Smoothing
- **Formula**: `smoothed = alpha × raw + (1 - alpha) × previousSmoothed`
- **Default Alpha**: 0.2 (20% new value, 80% history)
- **Effect**: Dampens load spikes, prevents reactive state changes
- **Config**: `CONTROL_LOOP_EMA_ALPHA`

#### 2. Hysteresis Bands
- **LOW ↔ ELEVATED**: Enter at 45, exit at 35 (10-point band)
- **ELEVATED ↔ HIGH**: Enter at 65, exit at 55 (10-point band)
- **HIGH ↔ CRITICAL**: Enter at 85, exit at 75 (10-point band)
- **Effect**: Prevents oscillation around thresholds
- **Config**: `LOAD_THRESHOLD_*_ENTER` and `LOAD_THRESHOLD_*_EXIT`

#### 3. Minimum Dwell Time
- **LOW**: 10 seconds
- **ELEVATED**: 15 seconds
- **HIGH**: 20 seconds
- **CRITICAL**: 30 seconds
- **Effect**: Forces minimum time in each state
- **Config**: `CONTROL_LOOP_DWELL_TIME_*_MS`

#### 4. Global Transition Cooldown
- **Duration**: 10 seconds
- **Applies To**: All state transitions
- **Effect**: Enforces minimum time between any transitions
- **Config**: `CONTROL_LOOP_TRANSITION_COOLDOWN_MS`

#### 5. Oscillation Detection
- **Detection**: ≥5 transitions in 60-second window
- **Freeze Duration**: 30 seconds
- **Auto-Recovery**: Yes
- **Effect**: Prevents pathological oscillation
- **Config**: `CONTROL_LOOP_OSCILLATION_*`

#### 6. Gradual Concurrency Ramping
- **Ramp Interval**: 5 seconds
- **Ramp Step Size**: 1 worker
- **Example**: 5 → 4 → 3 → 2 (takes 15 seconds)
- **Effect**: Smooth worker scaling, no instant jumps
- **Config**: `CONTROL_LOOP_RAMP_INTERVAL_MS`, `CONTROL_LOOP_RAMP_STEP_SIZE`

### Enhanced Metrics

#### BackpressureManager
```typescript
{
  rawLoadScore: number,              // Instantaneous load
  smoothedLoadScore: number,         // EMA-smoothed load
  stateDurationMs: number,           // Time in current state
  transitionsPastMinute: number,     // Transition count
  oscillationDetected: boolean,      // Freeze active
}
```

#### AdaptivePublishPacer
```typescript
{
  currentConcurrency: number,        // Actual concurrency
  targetConcurrency: number,         // Target concurrency
  concurrencyRampCount: number,      // Total ramp events
}
```

### Configuration Reference

```bash
# EMA Smoothing
CONTROL_LOOP_EMA_ALPHA=0.2

# Hysteresis Thresholds
LOAD_THRESHOLD_LOW_TO_ELEVATED_ENTER=45
LOAD_THRESHOLD_ELEVATED_TO_LOW_EXIT=35
LOAD_THRESHOLD_ELEVATED_TO_HIGH_ENTER=65
LOAD_THRESHOLD_HIGH_TO_ELEVATED_EXIT=55
LOAD_THRESHOLD_HIGH_TO_CRITICAL_ENTER=85
LOAD_THRESHOLD_CRITICAL_TO_HIGH_EXIT=75

# Dwell Times (milliseconds)
CONTROL_LOOP_DWELL_TIME_LOW_MS=10000
CONTROL_LOOP_DWELL_TIME_ELEVATED_MS=15000
CONTROL_LOOP_DWELL_TIME_HIGH_MS=20000
CONTROL_LOOP_DWELL_TIME_CRITICAL_MS=30000

# Transition Cooldown
CONTROL_LOOP_TRANSITION_COOLDOWN_MS=10000

# Oscillation Detection
CONTROL_LOOP_OSCILLATION_WINDOW_MS=60000
CONTROL_LOOP_OSCILLATION_THRESHOLD=5
CONTROL_LOOP_OSCILLATION_FREEZE_MS=30000

# Concurrency Ramping
CONTROL_LOOP_RAMP_INTERVAL_MS=5000
CONTROL_LOOP_RAMP_STEP_SIZE=1
```

### Usage Examples

#### Get Stability Metrics
```typescript
import { backpressureManager, adaptivePublishPacer } from './resilience';

// Get load scores
const rawScore = backpressureManager.getRawLoadScore();
const smoothedScore = backpressureManager.getSmoothedLoadScore();

// Get oscillation metrics
const oscillation = backpressureManager.getOscillationMetrics();
console.log('Oscillation frozen:', oscillation.oscillationFrozen);
console.log('Transitions past minute:', oscillation.transitionsPastMinute);

// Get concurrency status
const currentConcurrency = adaptivePublishPacer.getCurrentConcurrency();
const targetConcurrency = adaptivePublishPacer.getTargetConcurrency();
console.log(`Ramping: ${currentConcurrency} → ${targetConcurrency}`);

// Get transition history
const history = backpressureManager.getTransitionHistory();
console.log('Last 10 transitions:', history.slice(-10));
```

#### Monitor State Duration
```typescript
const durationMs = backpressureManager.getStateDurationMs();
console.log(`In ${backpressureManager.getCurrentState()} for ${durationMs}ms`);
```

### Troubleshooting

#### Frequent Oscillation Freezes
- **Symptom**: `oscillationDetectedCount` increasing
- **Cause**: Load fluctuating around threshold
- **Solution**: Widen hysteresis bands or increase dwell time

#### Slow State Transitions
- **Symptom**: State changes take too long
- **Cause**: Dwell time + cooldown too high
- **Solution**: Reduce dwell times or cooldown duration

#### Concurrency Not Changing
- **Symptom**: `currentConcurrency` stuck
- **Cause**: Ramp interval too long or oscillation freeze active
- **Solution**: Check oscillation status, reduce ramp interval

#### Load Score Jumpy
- **Symptom**: `rawLoadScore` volatile
- **Cause**: EMA alpha too high
- **Solution**: Reduce alpha (e.g., 0.1 for more smoothing)

### Performance Impact
- **Memory**: ~10KB (transition history)
- **CPU**: Negligible (O(1) per check)
- **Latency**: No blocking operations
- **Backward Compatible**: Yes

### Documentation
- **Full Details**: `STABLE_CONTROL_LOOP_COMPLETE.md`
- **Tests**: `src/resilience/__tests__/BackpressureManager.stable.test.ts`
- **Integration Tests**: `src/resilience/__tests__/StableControlLoop.integration.test.ts`

---
