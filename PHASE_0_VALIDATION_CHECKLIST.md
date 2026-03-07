# Phase 0 Validation Execution Checklist

## Pre-Validation Setup

### Environment Preparation
- [ ] Redis is running and accessible
- [ ] 2-3 backend instances are deployed
- [ ] Load balancer is configured (no sticky sessions)
- [ ] Test credentials are configured
- [ ] Monitoring/logging is enabled
- [ ] Team is available for observation

### Configuration Verification
- [ ] `docker-compose.multi-instance.yml` exists
- [ ] `nginx-multi-instance.conf` is configured
- [ ] Test scripts have execute permissions
- [ ] Node.js dependencies installed (`npm install`)
- [ ] Redis client tools installed (`redis-cli`)

### Health Checks
```bash
# Redis
- [ ] redis-cli ping → PONG

# Backend instances
- [ ] curl http://localhost:5001/health → 200 OK
- [ ] curl http://localhost:5002/health → 200 OK
- [ ] curl http://localhost:5003/health → 200 OK

# Load balancer
- [ ] curl http://localhost:5000/health → 200 OK
```

---

## Test Execution

### Test 1: Horizontal Scaling (30 min)
```bash
BACKEND_URL=http://localhost:5000 \
NUM_FLOWS=500 \
CONCURRENCY=50 \
node apps/backend/scripts/validate-horizontal-scaling.js
```

**Checkpoints**:
- [ ] Script starts without errors
- [ ] Progress updates appear every 50 flows
- [ ] No Redis connection errors in logs
- [ ] Final success rate displayed
- [ ] Instance routing statistics shown

**Success Criteria**:
- [ ] Success rate ≥99.9%
- [ ] Cross-instance routing ≥30%
- [ ] P99 latency <2000ms
- [ ] No Redis errors

**If Failed**: Document error messages, check logs, investigate before proceeding

---

### Test 2: Concurrency Stress (20 min)
```bash
BACKEND_URL=http://localhost:5000 \
CONCURRENT_CREATES=1000 \
CONCURRENT_CONSUMES=1000 \
node apps/backend/load-tests/concurrency-stress-test.js
```

**Checkpoints**:
- [ ] 1000 states created concurrently
- [ ] Redis metrics collected
- [ ] 1000 states consumed concurrently
- [ ] Final statistics displayed

**Success Criteria**:
- [ ] Create success ≥99.9%
- [ ] Consume success ≥99.9%
- [ ] Redis CPU <80%
- [ ] Redis memory <200MB
- [ ] P99 latency <2000ms

**If Failed**: Check Redis resources, review backend logs, investigate performance

---

### Test 3: Redis Failure Simulation (15 min)
```bash
./apps/backend/scripts/redis-failure-simulation.sh
```

**Checkpoints**:
- [ ] Normal operation verified (200 OK)
- [ ] Redis stopped successfully
- [ ] Fail-closed behavior verified (503 error)
- [ ] Redis restarted successfully
- [ ] Recovery verified (200 OK)
- [ ] Mid-flow restart tested

**Success Criteria**:
- [ ] 503 errors when Redis unavailable
- [ ] Automatic recovery after Redis restart
- [ ] No fallback to in-memory storage
- [ ] State lost after Redis restart (expected)

**If Failed**: Check Redis container, verify fail-closed logic, review error handling

---

### Test 4: Security Validation (20 min)

#### 4.1 Replay Attack Prevention
```bash
# Create state
STATE=$(curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test" | jq -r '.state')

# First consumption
FIRST=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE")

# Second consumption (replay)
SECOND=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE")
```

**Checkpoints**:
- [ ] State created successfully
- [ ] First consumption: 302 (success)
- [ ] Second consumption: 400 (blocked)
- [ ] Audit log contains replay attempt

**Success Criteria**:
- [ ] First attempt succeeds
- [ ] Second attempt fails
- [ ] State deleted after first consumption

---

#### 4.2 IP Binding Validation
```bash
# Create state from IP 1
STATE=$(curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test" \
  -H "X-Forwarded-For: 192.168.1.100" | jq -r '.state')

# Consume from IP 2
RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE" \
  -H "X-Forwarded-For: 192.168.1.200")
```

**Checkpoints**:
- [ ] State created with IP 1
- [ ] Consumption from IP 2 blocked
- [ ] Error message indicates IP mismatch

**Success Criteria**:
- [ ] Different IP rejected (400 error)
- [ ] Audit log contains IP mismatch event

---

#### 4.3 State Entropy Check
```bash
# Create 100 states
for i in {1..100}; do
  curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
    -H "Authorization: Bearer test-token" \
    -H "X-Workspace-ID: test" \
    -H "X-User-ID: test-$i" | jq -r '.state'
done | sort | uniq -d
```

**Checkpoints**:
- [ ] 100 states created
- [ ] No duplicates found (empty output)
- [ ] All states are 43 characters long

**Success Criteria**:
- [ ] Zero duplicate states
- [ ] All states match format `[A-Za-z0-9_-]{43}`

---

## Results Analysis

### Metrics Collection
- [ ] All test logs saved to `validation-results/`
- [ ] Success rates calculated
- [ ] Latency percentiles recorded
- [ ] Instance routing statistics captured
- [ ] Redis metrics documented

### Log Review
- [ ] Backend logs reviewed for errors
- [ ] Redis logs reviewed for issues
- [ ] Nginx logs reviewed for routing
- [ ] No unexpected errors found

### Performance Analysis
- [ ] P50, P95, P99 latencies calculated
- [ ] Redis CPU/memory usage recorded
- [ ] Instance load distribution verified
- [ ] No performance degradation detected

---

## Go/No-Go Decision

### Critical Criteria (ALL must pass)
- [ ] Success rate ≥99.9%
- [ ] State creation 100%
- [ ] No double-consumption
- [ ] Cross-instance ≥30%
- [ ] P99 latency <2000ms
- [ ] No Redis errors
- [ ] Replay prevention 100%
- [ ] IP binding 100%
- [ ] State entropy 100%

### Decision
- [ ] **GO**: All criteria met → Proceed to P0-3
- [ ] **NO-GO**: Criteria failed → Investigate and re-test

---

## Post-Validation Actions

### If GO Decision
- [ ] Document results in `PHASE_0_VALIDATION_RESULTS.md`
- [ ] Update task status: P0-1 and P0-2 validated
- [ ] Notify team of validation success
- [ ] Schedule Phase 0 checkpoint review
- [ ] Proceed to Phase 0 Task P0-3 (Idempotency Guard)

### If NO-GO Decision
- [ ] Document failures in `PHASE_0_VALIDATION_FAILURES.md`
- [ ] Create investigation tasks for each failure
- [ ] Assign owners for issue resolution
- [ ] Set target date for re-validation
- [ ] Do NOT proceed to P0-3

---

## Sign-Off

**Validation Executed By**: ___________________________  
**Date**: ___________________________  
**Decision**: ☐ GO  ☐ NO-GO  
**Approved By**: ___________________________  
**Date**: ___________________________  

---

## Notes

Use this space to document any observations, issues, or deviations from the plan:

```
[Your notes here]
```
