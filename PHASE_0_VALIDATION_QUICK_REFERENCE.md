# Phase 0 Validation - Quick Reference

## One-Command Test Suite

```bash
# Complete validation in one command
./apps/backend/scripts/run-phase0-validation.sh
```

## Individual Tests

### 1. Horizontal Scaling (30 min)
```bash
BACKEND_URL=http://localhost:5000 \
NUM_FLOWS=500 \
CONCURRENCY=50 \
node apps/backend/scripts/validate-horizontal-scaling.js
```

**Success**: ≥99.9% success rate, ≥30% cross-instance routing

### 2. Concurrency Stress (20 min)
```bash
BACKEND_URL=http://localhost:5000 \
CONCURRENT_CREATES=1000 \
CONCURRENT_CONSUMES=1000 \
node apps/backend/load-tests/concurrency-stress-test.js
```

**Success**: ≥99.9% success, P99 <2000ms, Redis CPU <80%

### 3. Redis Failure (15 min)
```bash
./apps/backend/scripts/redis-failure-simulation.sh
```

**Success**: 503 errors when Redis down, automatic recovery

### 4. Security Tests (20 min)
```bash
# Replay attack
STATE=$(curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test" | jq -r '.state')
curl "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE"
curl "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE"
# Second attempt should fail

# IP binding
curl -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "X-Forwarded-For: 1.1.1.1" | jq -r '.state' | \
  xargs -I {} curl "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state={}" \
  -H "X-Forwarded-For: 2.2.2.2"
# Should fail with IP mismatch
```

**Success**: All replay attempts blocked, IP mismatches blocked

## Go/No-Go Decision

### ✅ GO Criteria (ALL must pass)
- [ ] Success rate ≥99.9%
- [ ] State creation 100%
- [ ] No double-consumption
- [ ] Cross-instance ≥30%
- [ ] P99 latency <2000ms
- [ ] No Redis errors
- [ ] Replay prevention 100%
- [ ] IP binding 100%
- [ ] State entropy 100%

### ❌ NO-GO Triggers (ANY fails)
- Success rate <99%
- Double-consumption detected
- Redis connection errors
- Replay attacks succeed
- Duplicate states found

## Quick Checks

### Redis Health
```bash
redis-cli ping
redis-cli INFO stats | grep total_commands_processed
redis-cli KEYS "oauth:state:*" | wc -l
```

### Backend Health
```bash
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
```

### Load Balancer
```bash
# Should distribute across instances
for i in {1..10}; do
  curl -s http://localhost:5000/health | jq -r '.instance'
done | sort | uniq -c
```

## Common Issues

### Issue: Success rate <99%
**Check**: Backend logs for errors
**Fix**: Review error messages, check Redis connection

### Issue: High latency (P99 >2000ms)
**Check**: Redis CPU, network latency
**Fix**: Optimize Redis, check network

### Issue: Uneven routing
**Check**: Nginx config, backend health
**Fix**: Verify round-robin, check pod resources

### Issue: Redis connection errors
**Check**: Redis logs, connection pool
**Fix**: Increase maxclients, check network policies

## Next Steps

**After GO decision**:
1. Document results in `PHASE_0_VALIDATION_RESULTS.md`
2. Proceed to Phase 0 Task P0-3 (Idempotency Guard)
3. Schedule Phase 0 checkpoint review

**After NO-GO decision**:
1. Document failures in `PHASE_0_VALIDATION_FAILURES.md`
2. Create investigation tasks
3. Fix issues
4. Re-run validation
