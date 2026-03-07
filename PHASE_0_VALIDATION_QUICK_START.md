# Phase 0 Validation - Quick Start
## 30-Second Setup → 2.5 Hour Execution → GO/NO-GO Decision

---

## QUICK START (Copy & Paste)

### Terminal 1 - Pre-Flight Checks

```bash
cd apps/backend

# 1. Check prerequisites
node --version          # Need v16+
redis-cli --version     # Need 6.2.0+
docker --version        # Need 20+
docker-compose --version # Need 2+

# 2. Verify Redis GETDEL support (CRITICAL)
redis-cli SET test:getdel "value" && redis-cli GETDEL test:getdel && redis-cli GET test:getdel
# Expected: "value" then "(nil)"

# 3. Make scripts executable
chmod +x scripts/redis-failure-simulation.sh scripts/run-phase0-validation.sh

# 4. Start multi-instance environment
docker-compose -f docker-compose.multi-instance.yml up -d
sleep 30

# 5. Verify all services healthy
docker-compose -f docker-compose.multi-instance.yml ps
# All should show "Up (healthy)"

# 6. Test load balancer distribution
for i in {1..20}; do curl -s http://localhost:5000/health | jq -r '.instance // "unknown"'; done | sort | uniq -c
# Should show roughly even distribution across 3 instances

# 7. Create results directory
mkdir -p validation-results
export TIMESTAMP=$(date +%Y%m%d_%H%M%S)
```

**CHECKPOINT**: All services healthy and load balancer distributing?
- ✅ YES → Continue to Test Execution
- ❌ NO → Check logs: `docker-compose logs --tail=50`

---

### Terminal 2 - Redis Monitoring (Keep Running)

```bash
watch -n 5 'redis-cli INFO stats | grep -E "instantaneous_ops_per_sec|used_cpu_sys|used_memory_human|connected_clients"'
```

**Watch for**:
- ops_per_sec: 50-200 during tests
- CPU: <80%
- Memory: <200MB
- Connections: 3-10

---

### Terminal 3 - Backend Logs (Keep Running)

```bash
cd apps/backend
docker-compose -f docker-compose.multi-instance.yml logs -f --tail=50 | grep -E "ERROR|WARN|OAuth"
```

**Watch for RED FLAGS**:
- ❌ "Redis unavailable" (>5 times)
- ❌ "ECONNREFUSED"
- ❌ "State consumed twice"
- ❌ "Race condition detected"

---

## TEST EXECUTION (Terminal 1)

### Test 1: Horizontal Scaling (30 min)

```bash
export BACKEND_URL=http://localhost:5000
export NUM_FLOWS=500
export CONCURRENCY=50

node scripts/validate-horizontal-scaling.js \
  2>&1 | tee validation-results/horizontal-scaling-$TIMESTAMP.log
```

**SUCCESS CRITERIA**:
- ✅ Success rate ≥99.9% (≥499/500)
- ✅ P99 latency <2000ms
- ✅ Instance routing 25-40% each
- ✅ Replay attack prevented
- ✅ IP binding working
- ✅ Exit code = 0

---

### Test 2: Concurrency Stress (20 min)

```bash
export CONCURRENT_CREATES=1000
export CONCURRENT_CONSUMES=1000
export REDIS_HOST=localhost
export REDIS_PORT=6379

node load-tests/concurrency-stress-test.js \
  2>&1 | tee validation-results/concurrency-stress-$TIMESTAMP.log
```

**SUCCESS CRITERIA**:
- ✅ Creates ≥99.9% success (≥999/1000)
- ✅ Consumes ≥99.9% success (≥999/1000)
- ✅ Redis CPU <80s
- ✅ Redis memory <200MB
- ✅ P99 latency <2000ms
- ✅ Exit code = 0

---

### Test 3: Redis Failure Simulation (15 min)

```bash
./scripts/redis-failure-simulation.sh \
  2>&1 | tee validation-results/redis-failure-$TIMESTAMP.log
```

**SUCCESS CRITERIA** (CRITICAL):
- ✅ Normal operation: 200
- ✅ **Fail-closed: 503** (CRITICAL - must NOT be 200)
- ✅ Recovery: 200
- ✅ Mid-flow restart: state lost

**CRITICAL**: If Redis unavailable returns 200 instead of 503, this is a CRITICAL SECURITY ISSUE (fail-open). STOP immediately.

---

## RESULT EVALUATION

### Quick Metrics Capture

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Success Rate | ___._% | ≥99.9% | ☐ ✅ ☐ ❌ |
| P99 Latency | ____ms | <2000ms | ☐ ✅ ☐ ❌ |
| Instance Routing | __% / __% / __% | 25-40% each | ☐ ✅ ☐ ❌ |
| Redis CPU | __s | <80s | ☐ ✅ ☐ ❌ |
| Redis Memory | ___MB | <200MB | ☐ ✅ ☐ ❌ |
| Replay Prevention | ☐ ✅ ☐ ❌ | 100% | ☐ ✅ ☐ ❌ |
| IP Binding | ☐ ✅ ☐ ❌ | 100% | ☐ ✅ ☐ ❌ |
| Fail-Closed | ☐ ✅ ☐ ❌ | ✅ | ☐ ✅ ☐ ❌ |

---

### Check for Red Flags

```bash
# Check for double-consumption
grep -i "consumed twice\|duplicate consumption" validation-results/*.log

# Check for race conditions
grep -i "race condition" validation-results/*.log

# Count Redis errors
grep -i "redis unavailable\|ECONNREFUSED" validation-results/*.log | wc -l
# ❌ FAIL if >10

# Check leftover states
redis-cli KEYS "oauth:state:*" | wc -l
# Expected: 0-5
# ❌ FAIL if >20
```

---

## GO/NO-GO DECISION

### ✅ GO Decision (All must be checked)

- [ ] Success rate ≥99.9%
- [ ] P99 latency <2000ms
- [ ] Cross-instance routing 25-40% each
- [ ] No double-consumption
- [ ] Redis errors = 0
- [ ] Replay prevention 100%
- [ ] IP binding 100%
- [ ] Fail-closed working (503 when Redis down)

**If ALL checked** → ✅ **PROCEED TO P0-3**

```bash
echo "✅ VALIDATION PASSED - PROCEEDING TO P0-3"
```

---

### ❌ NO-GO Decision (Any triggers NO-GO)

- [ ] Success rate <99.0%
- [ ] Double-consumption detected
- [ ] Redis errors >10
- [ ] Replay attacks succeed
- [ ] IP binding bypassed
- [ ] Fail-closed not working (200 when Redis down)
- [ ] P99 latency >3000ms

**If ANY checked** → ❌ **DO NOT PROCEED TO P0-3**

```bash
echo "❌ VALIDATION FAILED - INVESTIGATION REQUIRED"
cat validation-results/*.log | grep -E "ERROR|FAIL"
```

---

## CLEANUP

```bash
# Stop multi-instance environment
docker-compose -f docker-compose.multi-instance.yml down

# Archive logs
tar -czf validation-results-$TIMESTAMP.tar.gz validation-results/
```

---

## NEXT STEPS

### If GO:
1. Complete validation report (use template in PHASE_0_VALIDATION_EXECUTOR_GUIDE.md)
2. Update `.kiro/specs/channel-connect-production-audit/tasks.md`
3. Mark P0-1 and P0-2 as validated
4. Proceed to Phase 0 Task P0-3 (Idempotency Guard)

### If NO-GO:
1. Categorize issue (Race/Proxy/Redis/Performance/Code)
2. Apply corrective actions (see PHASE_0_VALIDATION_EXECUTOR_GUIDE.md Section 5)
3. Re-run validation
4. DO NOT proceed to P0-3

---

## REFERENCE DOCUMENTS

- **Detailed Guide**: `PHASE_0_VALIDATION_EXECUTOR_GUIDE.md` (complete step-by-step)
- **Checklist**: `PHASE_0_VALIDATION_EXECUTION_CHECKLIST.md` (print-friendly)
- **Complete Plan**: `PHASE_0_HORIZONTAL_SCALING_VALIDATION.md` (full context)

---

**Total Time**: ~2.5 hours  
**Decision Authority**: GO/NO-GO for Phase 0 Task P0-3  
**Risk Level**: CRITICAL (Authentication foundation)
