# Task 5: Multi-Tenant Publish Budget & Unified Admission Control - RFC Complete

**Status**: RFC Specification Complete ✅  
**Date**: 2026-02-27  
**Document**: `RFC-005-PUBLISH-BUDGET-ENFORCEMENT.md`

---

## Summary

RFC-005 specification document has been created, defining the complete architecture for multi-tenant publish budget enforcement integrated with the existing resilience system.

## RFC Sections Completed

1. ✅ Requirements Specification (FR-1 through FR-7, NFR-1 through NFR-6, 9 System Invariants)
2. ✅ Design Specification (Redis strategy, Lua script, integration points)
3. ✅ Redis Data Model (key schema, memory analysis)
4. ✅ Admission Decision Flow (deterministic 7-step evaluation)
5. ✅ Failure Scenarios (7 scenarios analyzed)
6. ✅ Fairness Model (mathematical definitions, 4 guarantees)
7. ✅ Freeze Logic (corrected trigger conditions, recovery, oscillation prevention)
8. ✅ Performance Analysis (Redis ops, concurrency, memory, bottleneck analysis)
9. ✅ Test Strategy (6 test categories, 42+ test cases)
10. ✅ Rollout Plan (4-phase deployment with feature flags)
11. ✅ Implementation Checklist (code, testing, docs, monitoring, deployment)
12. ✅ Security Considerations (5 security aspects)
13. ✅ Open Questions & Future Work
14. ✅ Appendix (complete Lua script, type definitions, configuration)

## Key Architectural Corrections Applied

### FR-5: Freeze Logic (CORRECTED)
- **Before**: Budget rejections alone trigger freeze
- **After**: Freeze requires BOTH high rejection rate (>30%) AND system stress (load_state ≥ HIGH_LOAD)
- **Rationale**: Governance vs stability separation

### FR-6: Retry-After Semantics (CORRECTED)
- **Before**: Minute-boundary logic
- **After**: Sliding window semantics: `retry_after = (oldest_entry_ts + window_size) - current_ts`
- **Rationale**: Accurate retry calculation for sliding windows

### FR-7: Budget Increment Timing (CORRECTED)
- **Before**: Separate increment in PublishingWorker
- **After**: Atomic check-and-increment within Lua script
- **Rationale**: Prevents race conditions and double-counting on retries

### INVARIANT-9: Tier Trust Boundary (SECURITY)
- **Requirement**: Tier MUST be derived from authenticated context, NEVER from client payload
- **Rationale**: Prevents privilege escalation attacks

## Design Highlights

### Single Redis Round-Trip
- All budget checks in one Lua script execution
- 12 Redis operations (9 without platform budgets)
- ~1-2ms latency per admission check

### Sliding Window with ZSET
- Prevents boundary aliasing (fixed window problem)
- Accurate Retry-After calculation
- Automatic expiration via ZREMRANGEBYSCORE

### Correlation ID Deduplication
- Prevents double increment on retries
- 5-minute TTL for correlation keys
- Idempotent admission checks

### Fail-Open Safety
- Redis unavailable → admit request
- Budget enforcement is governance, not safety
- Platform rate limits provide fallback

### Deterministic Evaluation Order
1. Degraded mode freeze check
2. Backpressure state check (load-based)
3. Publish budget check (global → workspace → platform)
4. Priority bypass rules (critical only)

## Integration Points

### GlobalRateLimitManager Extension
- New method: `checkPublishBudget(workspaceId, platform, tier, correlationId)`
- Lua script execution
- Budget stats retrieval

### AdmissionController Extension
- New method: `checkAdmissionWithBudget(...)`
- Unified admission pipeline
- Budget rejection tracking

### DegradedModeManager Extension
- Budget rejection history tracking
- Budget overload freeze detection (BOTH conditions required)
- Integration with existing degraded mode state machine

### ResilienceConfig Extension
- `PUBLISH_BUDGET` configuration section
- Feature flags for phased rollout
- Tier limits, platform limits, freeze thresholds

## Rollout Strategy

### Phase 1: Global Budget Only (Week 1)
- Feature flag: `PUBLISH_BUDGET_ENABLED=true`
- Global limit: 1000/min
- Validation: Global enforcement, retry-after, deduplication

### Phase 2: Add Workspace Budgets (Week 2)
- Feature flag: `PUBLISH_BUDGET_WORKSPACE_ENABLED=true`
- Tier limits: 10/50/200
- Validation: Fairness, no starvation, tier enforcement

### Phase 3: Add Platform Budgets (Week 3)
- Feature flag: `PUBLISH_BUDGET_PLATFORM_ENABLED=true`
- Platform limits: Twitter 300, LinkedIn 200, etc.
- Validation: Platform independence, global enforcement

### Phase 4: Enable Freeze Logic (Week 4)
- Feature flag: `PUBLISH_BUDGET_FREEZE_ENABLED=true`
- Freeze threshold: 30% rejection rate + high load
- Validation: BOTH conditions required, correct exit behavior

## Performance Characteristics

- **Memory**: ~8 MB for 10k workspaces
- **Throughput**: 4,166 checks/sec (single Redis instance)
- **Latency**: <5ms for 100 concurrent workers
- **Scalability**: 10x headroom (10,000 publishes/min)

## Next Steps

1. **Implementation**: Follow RFC-005 specification
2. **Testing**: Implement 42+ test cases from test strategy
3. **Monitoring**: Deploy metrics, dashboards, alerts
4. **Phased Rollout**: Execute 4-phase deployment plan
5. **Documentation**: Update resilience docs with budget system

## Files Created

- `apps/backend/RFC-005-PUBLISH-BUDGET-ENFORCEMENT.md` (complete specification)
- `apps/backend/TASK_5_RFC_COMPLETE.md` (this file)

---

**RFC Status**: Ready for Implementation Review
