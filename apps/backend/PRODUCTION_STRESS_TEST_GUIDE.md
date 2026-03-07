# Production Hardening & Stress Validation Guide

## Overview

This comprehensive stress testing suite validates production readiness by simulating real-world scenarios including:

- **Concurrency stress** - Race conditions, token reuse, parallel requests
- **Queue reliability** - Job processing, failure recovery, deduplication
- **Rate limiting** - Brute force protection, API abuse prevention
- **Memory stability** - Leak detection, resource monitoring
- **Billing enforcement** - Plan limits, usage tracking accuracy
- **Multi-tenant isolation** - Cross-workspace access prevention

## Prerequisites

1. **Backend server running** on `http://localhost:5000` (or set `API_URL` env var)
2. **MongoDB** and **Redis** running and accessible
3. **Worker processes** running for queue tests
4. **Node.js** 18+ and **TypeScript** installed

## Quick Start

```bash
# Navigate to backend directory
cd apps/backend

# Install dependencies (if not already done)
npm install

# Ensure server is running
npm run dev

# In another terminal, run the stress tests
tsx production-hardening-stress-test.ts
```

## Test Phases

### Phase 1: Concurrency Testing

**What it tests:**
- 50 concurrent login requests
- 50 concurrent refresh token requests
- Parallel refresh with same token (race condition)

**Pass criteria:**
- No 500 errors during concurrent operations
- Only ONE refresh succeeds when using same token
- No unhandled promise rejections

**Critical issues:**
- ❌ Multiple concurrent refreshes succeed → Token reuse vulnerability
- ❌ Race condition allows double refresh → Implement Redlock

### Phase 2: Queue Stress Test

**What it tests:**
- Enqueue 100 publish jobs
- Job deduplication
- Worker processing reliability
- Failure recovery

**Pass criteria:**
- >90% successful enqueues
- No duplicate job IDs
- <20% failure rate in queue

**Critical issues:**
- ❌ Duplicate post IDs → Job deduplication broken
- ❌ High failure rate → Review worker error handling

### Phase 3: Rate Limit & Abuse Test

**What it tests:**
- Brute-force login attempts (30 requests)
- API flood (100 requests in burst)
- Resource usage during stress

**Pass criteria:**
- Rate limiting triggers on auth endpoints
- Memory increase <100 MB during stress
- No CPU runaway

**Critical issues:**
- ❌ No rate limiting on login → Implement rate limiter
- ❌ Significant memory increase → Memory leak investigation

### Phase 4: Memory & Resource Monitoring

**What it tests:**
- Baseline memory usage
- Memory growth under sustained load
- Event loop delay
- Connection leak detection

**Pass criteria:**
- No consistent memory growth pattern
- Event loop delay <100ms
- Stable resource usage

**Warning signs:**
- ⚠️ Memory consistently increasing → Potential leak
- ⚠️ High event loop delay → Blocking operations

### Phase 5: Billing & Plan Enforcement

**What it tests:**
- Post limit enforcement (maxPostsPerMonth)
- AI credit limit enforcement
- Usage tracking accuracy
- Plan upgrade/downgrade

**Pass criteria:**
- Limits enforced correctly (403/429 responses)
- Usage tracking matches actual usage
- No silent bypasses

**Critical issues:**
- ❌ Limits not enforced → Implement plan enforcement
- ❌ Usage tracking inaccurate → Fix increment logic

### Phase 6: Multi-Tenant Isolation

**What it tests:**
- Cross-workspace post access
- Workspace ID header manipulation
- Token replay across workspaces

**Pass criteria:**
- All cross-workspace access blocked
- No data leaks between tenants
- Token validation enforces workspace membership

**Critical issues:**
- ❌ Cross-workspace data leak → Implement workspace isolation
- ❌ Token replay succeeds → Enforce workspace in token

## Interpreting Results

### Survivability Score (0-10)

- **9-10**: Excellent - Production ready
- **7-8**: Good - Minor issues to address
- **5-6**: Fair - Significant improvements needed
- **0-4**: Poor - Critical issues must be fixed

### Component Status

```
Concurrency Safety: SAFE | RISK
Queue Reliability: STABLE | UNSTABLE
Memory Stability: SAFE | LEAKING
Plan Enforcement: SECURE | BYPASSABLE
Tenant Isolation: SAFE | VULNERABLE
```

### Ready for Production?

✅ **YES** - Score ≥7 and no CRITICAL issues
❌ **NO** - Score <7 or CRITICAL issues present

## Example Output

```
🔥 PRODUCTION HARDENING & STRESS VALIDATION

================================================================================
API URL: http://localhost:5000/api/v1
Concurrency Level: 50
Queue Stress Jobs: 100
================================================================================

📋 Setting up test environment...
✅ Test environment ready with 3 users

================================================================================
PHASE 1: CONCURRENCY TESTING
================================================================================

Test 1.1: 50 concurrent logins...
Test 1.2: 50 concurrent refresh token requests...
Test 1.3: Parallel refresh with SAME token (race condition)...

Status: ✅ PASS

Evidence:
  • Concurrent logins: 50/50 successful
  • Server errors (5xx): 0
  • Concurrent refreshes: 1 successful, 49 rejected
  • Race condition test: 1/10 succeeded

================================================================================
FINAL PRODUCTION READINESS REPORT
================================================================================

Production Survivability Score: 8.5/10
Concurrency Safety: SAFE
Queue Reliability: STABLE
Memory Stability: SAFE
Plan Enforcement: SECURE
Tenant Isolation: SAFE

Ready for Real User Traffic: ✅ YES
```

## Troubleshooting

### Server not responding

```bash
# Check if server is running
curl http://localhost:5000/api/v1/health

# Check logs
tail -f apps/backend/logs/application-*.log
```

### Redis connection errors

```bash
# Check Redis is running
redis-cli ping

# Check connection in .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### MongoDB connection errors

```bash
# Check MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Check connection in .env
MONGODB_URI=mongodb://localhost:27017/social-media-scheduler
```

### Worker not processing jobs

```bash
# Start worker manually
npm run worker

# Check worker logs
tail -f apps/backend/logs/worker-*.log
```

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/stress-test.yml
name: Production Stress Test

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  stress-test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd apps/backend
          npm install
      
      - name: Start server
        run: |
          cd apps/backend
          npm run dev &
          sleep 10
      
      - name: Run stress tests
        run: |
          cd apps/backend
          tsx production-hardening-stress-test.ts
```

## Best Practices

1. **Run before every production deployment**
2. **Monitor trends** - Track survivability score over time
3. **Fix CRITICAL issues immediately** - Don't deploy with critical failures
4. **Address warnings proactively** - They become critical under real load
5. **Test with production-like data** - Use realistic volumes
6. **Run during off-peak hours** - Minimize impact on development

## Next Steps

After passing all tests:

1. ✅ Deploy to staging environment
2. ✅ Run stress tests against staging
3. ✅ Monitor metrics for 24 hours
4. ✅ Perform load testing with realistic traffic
5. ✅ Deploy to production with monitoring

## Support

For issues or questions:
- Check logs in `apps/backend/logs/`
- Review test output for specific failures
- Consult phase-specific documentation above
