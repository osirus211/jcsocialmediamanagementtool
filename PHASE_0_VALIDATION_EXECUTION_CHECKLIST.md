# Phase 0 Validation - Execution Checklist
## Quick Reference for Production Readiness Audit

**Print this page and check off items as you complete them**

---

## ☑️ PRE-VALIDATION (15 minutes)

### Environment Check
- [ ] Node.js v16+ installed: `node --version`
- [ ] Redis CLI 6.2.0+ installed: `redis-cli --version`
- [ ] Docker 20+ installed: `docker --version`
- [ ] Docker Compose 2+ installed: `docker-compose --version`
- [ ] jq installed: `jq --version`

### Redis Configuration
- [ ] Redis version ≥6.2.0: `redis-cli INFO server | grep redis_version`
- [ ] GETDEL command works: `redis-cli SET test val; redis-cli GETDEL test`
- [ ] maxclients ≥1000: `redis-cli CONFIG GET maxclients`

### Backend Configuration
- [ ] REDIS_HOST configured in .env
- [ ] REDIS_PORT configured in .env
- [ ] NODE_ENV=production in .env
- [ ] Trust proxy enabled: `grep "trust proxy" apps/backend/src/app.ts`
- [ ] OAuthController imports correct service

### Monitoring Setup
- [ ] Terminal 1 ready for test execution
- [ ] Terminal 2 ready for Redis monitoring
- [ ] Terminal 3 ready for backend logs
- [ ] Results directory created: `mkdir -p validation-results`

---

## ☑️ ENVIRONMENT STARTUP (10 minutes)

### Start Multi-Instance
- [ ] Navigate to backend: `cd apps/backend`
- [ ] Start containers: `docker-compose -f docker-compose.multi-instance.yml up -d`
- [ ] Wait 30 seconds: `sleep 30`
- [ ] All containers running: `docker-compose ps`

### Health Checks
- [ ] Redis: `redis-cli ping` → PONG
- [ ] Backend 1: `curl http://localhost:5001/health` → 200
- [ ] Backend 2: `curl http://localhost:5002/health` → 200
- [ ] Backend 3: `curl http://localhost:5003/health` → 200
- [ ] Load Balancer: `curl http://localhost:5000/health` → 200

### Load Balancer Verification
- [ ] Test routing distribution (20 requests)
- [ ] Each instance gets 25-40% of requests
- [ ] No sticky sessions (requests route to different instances)

---

## ☑️ TEST EXECUTION (90 minutes)

### Test 1: Horizontal Scaling (30 min)
- [ ] Set environment variables
- [ ] Run: `node apps/backend/scripts/validate-horizontal-scaling.js`
- [ ] Monitor progress (updates every 50 flows)
- [ ] No Redis errors in output
- [ ] Success rate ≥99.9% (≥499/500)
- [ ] Cross-instance routing 25-40% each
- [ ] P99 latency <2000ms
- [ ] Replay attack prevented ✅
- [ ] IP binding working ✅
- [ ] Exit code = 0

### Test 2: Concurrency Stress (20 min)
- [ ] Set environment variables
- [ ] Run: `node apps/backend/load-tests/concurrency-stress-test.js`
- [ ] 1000 creates ≥99.9% success
- [ ] 1000 consumes ≥99.9% success
- [ ] Redis CPU <80s
- [ ] Redis memory <200MB
- [ ] Redis connections <50
- [ ] P99 latency <2000ms
- [ ] Exit code = 0

### Test 3: Redis Failure (15 min)
- [ ] Run: `./apps/backend/scripts/redis-failure-simulation.sh`
- [ ] Normal operation: 200 OK
- [ ] Redis unavailable: 503 (fail-closed) ✅ CRITICAL
- [ ] Automatic recovery: 200 OK
- [ ] Mid-flow restart: state not found (expected)
- [ ] No fallback to in-memory

### Test 4: Security (20 min)
- [ ] Replay attack test: First succeeds, second fails
- [ ] IP binding test: Different IP rejected
- [ ] State entropy test: 0 duplicates in 100 states

---

## ☑️ LIVE MONITORING

### Redis Metrics (Terminal 2)
- [ ] `watch -n 5 'redis-cli INFO stats | grep -E "instantaneous_ops_per_sec|used_cpu_sys|used_memory_human"'`
- [ ] ops_per_sec: 50-200 during tests
- [ ] CPU: <80%
- [ ] Memory: <200MB

### Backend Logs (Terminal 3)
- [ ] `docker-compose logs -f | grep -E "ERROR|OAuth"`
- [ ] No "Redis unavailable" errors
- [ ] No "ECONNREFUSED" errors
- [ ] No "ETIMEDOUT" errors

### Race Condition Watch
- [ ] No "State consumed twice" messages
- [ ] No "duplicate consumption" messages
- [ ] No "Race condition detected" messages

---

## ☑️ RESULTS EVALUATION

### PASS Criteria (All Required)
- [ ] Success rate ≥99.9%
- [ ] State creation 100%
- [ ] No double-consumption
- [ ] Cross-instance routing 25-40% each
- [ ] P99 latency <2000ms
- [ ] Redis errors = 0
- [ ] Replay prevention 100%
- [ ] IP binding 100%
- [ ] State entropy 100% (0 duplicates)
- [ ] Fail-closed working (503 when Redis down)

### FAIL Triggers (Any = NO-GO)
- [ ] Success rate <99.0%
- [ ] Double-consumption detected
- [ ] Redis errors >10
- [ ] Replay attacks succeed
- [ ] IP binding bypassed
- [ ] Fail-closed not working (200 when Redis down)
- [ ] P99 latency >3000ms

---

## ☑️ DECISION

### ✅ GO Decision
- [ ] All PASS criteria met
- [ ] No FAIL triggers
- [ ] No critical errors
- [ ] Team consensus

**Actions**:
- [ ] Complete validation report
- [ ] Mark P0-1 and P0-2 as validated
- [ ] Proceed to Phase 0 Task P0-3 (Idempotency Guard)
- [ ] Schedule Phase 0 checkpoint review

### ❌ NO-GO Decision
- [ ] One or more FAIL triggers
- [ ] Critical issues detected
- [ ] Security tests failed

**Actions**:
- [ ] Document all failures
- [ ] Categorize issues (Race/Proxy/Redis/Performance/Code)
- [ ] Create corrective action plan
- [ ] Assign owners
- [ ] Schedule re-validation
- [ ] DO NOT proceed to P0-3

### ⚠️ CONDITIONAL GO
- [ ] Only WARNING-level issues
- [ ] No FAIL triggers
- [ ] Team accepts risk

**Actions**:
- [ ] Document all warnings
- [ ] Create monitoring plan
- [ ] Proceed to P0-3 with caution
- [ ] Monitor production closely

---

## ☑️ POST-VALIDATION

### Documentation
- [ ] Validation report completed
- [ ] Metrics documented
- [ ] Anomalies documented
- [ ] Logs saved to validation-results/
- [ ] Team notified

### Cleanup
- [ ] Stop multi-instance environment: `docker-compose down`
- [ ] Archive logs
- [ ] Update task status in tasks.md

---

## 📊 QUICK METRICS CAPTURE

**Fill in during validation**:

| Metric | Value | Status |
|--------|-------|--------|
| Success Rate | ___._% | ☐ ✅ ☐ ❌ ☐ ⚠️ |
| P99 Latency | ____ms | ☐ ✅ ☐ ❌ ☐ ⚠️ |
| Cross-Instance | __% / __% / __% | ☐ ✅ ☐ ❌ ☐ ⚠️ |
| Redis CPU | __% | ☐ ✅ ☐ ❌ ☐ ⚠️ |
| Redis Memory | ___MB | ☐ ✅ ☐ ❌ ☐ ⚠️ |
| Replay Prevention | ☐ ✅ ☐ ❌ | ☐ ✅ ☐ ❌ |
| IP Binding | ☐ ✅ ☐ ❌ | ☐ ✅ ☐ ❌ |
| Fail-Closed | ☐ ✅ ☐ ❌ | ☐ ✅ ☐ ❌ |

**Final Decision**: ☐ GO  ☐ NO-GO  ☐ CONDITIONAL GO

---

## 🚨 EMERGENCY CONTACTS

**If critical issues arise**:
- Escalate to: ___________________________
- Slack channel: ___________________________
- On-call engineer: ___________________________

---

## ✍️ SIGN-OFF

**Validation Executed By**: ___________________________  
**Date**: ___________ Time: ___________  
**Duration**: ___________ hours  
**Decision**: ☐ GO  ☐ NO-GO  ☐ CONDITIONAL GO  
**Approved By**: ___________________________  
**Date**: ___________  

---

**Notes**:
```
[Use this space for any observations or issues]






```

---

**Reference Documents**:
- Full Guide: `PHASE_0_VALIDATION_EXECUTION_GUIDE.md`
- Complete Plan: `PHASE_0_HORIZONTAL_SCALING_VALIDATION.md`
- Quick Reference: `PHASE_0_VALIDATION_QUICK_REFERENCE.md`
