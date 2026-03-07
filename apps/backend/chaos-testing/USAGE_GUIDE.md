# Chaos Testing Usage Guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration Guide](#configuration-guide)
3. [Test Scenarios](#test-scenarios)
4. [Monitoring](#monitoring)
5. [Interpreting Results](#interpreting-results)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Quick Start

### Minimum Viable Test

Run a quick 10-minute test with minimal load:

```bash
cd apps/backend/chaos-testing
ACCOUNTS=100 POSTS=500 DURATION_MINUTES=10 ./scripts/run-chaos-test.sh
```

### Standard Test

Run the default 30-minute test with moderate load:

```bash
./scripts/run-chaos-test.sh
```

### Cleanup

After test completes:

```bash
./scripts/cleanup.sh
```

## Configuration Guide

### Load Parameters

#### ACCOUNTS
Number of social media accounts to create.

```bash
ACCOUNTS=1000  # Default
ACCOUNTS=100   # Light load
ACCOUNTS=5000  # Heavy load
```

**Recommendation**: Start with 100-500 for initial tests.

#### POSTS
Number of posts to schedule.

```bash
POSTS=5000   # Default
POSTS=500    # Light load
POSTS=25000  # Heavy load
```

**Recommendation**: 5-10x the number of accounts.

#### PUBLISH_RATE
Posts published per second.

```bash
PUBLISH_RATE=5   # Default
PUBLISH_RATE=1   # Slow
PUBLISH_RATE=20  # Fast
```

**Recommendation**: Start with 5, increase gradually.

#### REFRESH_EXPIRY_BURST
Number of tokens to expire simultaneously.

```bash
REFRESH_EXPIRY_BURST=500   # Default
REFRESH_EXPIRY_BURST=0     # No burst
REFRESH_EXPIRY_BURST=1000  # Large burst
```

**Recommendation**: 50% of accounts for stress test.

#### DURATION_MINUTES
How long to run the test.

```bash
DURATION_MINUTES=30  # Default
DURATION_MINUTES=10  # Quick test
DURATION_MINUTES=60  # Extended test
```

**Recommendation**: 30 minutes for thorough test.

### Chaos Parameters

#### CHAOS_ENABLED
Enable or disable all chaos injection.

```bash
CHAOS_ENABLED=true   # Default
CHAOS_ENABLED=false  # Baseline test
```

**Recommendation**: Run baseline first, then with chaos.

#### CHAOS_KILL_WORKER_INTERVAL
How often to kill a random worker (milliseconds).

```bash
CHAOS_KILL_WORKER_INTERVAL=300000  # Default (5 minutes)
CHAOS_KILL_WORKER_INTERVAL=0       # Disable
CHAOS_KILL_WORKER_INTERVAL=60000   # Every minute
```

**Recommendation**: 5-10 minutes for realistic test.

#### CHAOS_PLATFORM_429_RATE
Probability of injecting rate limit error (0.0-1.0).

```bash
CHAOS_PLATFORM_429_RATE=0.1   # Default (10%)
CHAOS_PLATFORM_429_RATE=0     # Disable
CHAOS_PLATFORM_429_RATE=0.5   # Aggressive (50%)
```

**Recommendation**: 10-20% for realistic test.

#### CHAOS_PLATFORM_500_RATE
Probability of injecting server error (0.0-1.0).

```bash
CHAOS_PLATFORM_500_RATE=0.05  # Default (5%)
CHAOS_PLATFORM_500_RATE=0     # Disable
CHAOS_PLATFORM_500_RATE=0.2   # Aggressive (20%)
```

**Recommendation**: 5-10% for realistic test.

### Validation Thresholds

#### MAX_REFRESH_PER_SECOND
Maximum allowed refresh rate.

```bash
MAX_REFRESH_PER_SECOND=50   # Default
MAX_REFRESH_PER_SECOND=100  # Relaxed
MAX_REFRESH_PER_SECOND=20   # Strict
```

**Recommendation**: Based on platform API limits.

#### MAX_QUEUE_LAG_SECONDS
Maximum allowed queue lag.

```bash
MAX_QUEUE_LAG_SECONDS=60   # Default
MAX_QUEUE_LAG_SECONDS=120  # Relaxed
MAX_QUEUE_LAG_SECONDS=30   # Strict
```

**Recommendation**: 60 seconds for production.

#### MAX_MEMORY_GROWTH_MULTIPLIER
Maximum allowed memory growth.

```bash
MAX_MEMORY_GROWTH_MULTIPLIER=2.0  # Default (2x)
MAX_MEMORY_GROWTH_MULTIPLIER=3.0  # Relaxed (3x)
MAX_MEMORY_GROWTH_MULTIPLIER=1.5  # Strict (1.5x)
```

**Recommendation**: 2x for production.

### Worker Scaling

#### PUBLISHING_WORKER_REPLICAS
Number of publishing worker containers.

```bash
PUBLISHING_WORKER_REPLICAS=3  # Default
PUBLISHING_WORKER_REPLICAS=1  # Minimal
PUBLISHING_WORKER_REPLICAS=5  # High throughput
```

**Recommendation**: 3-5 for production-like test.

#### REFRESH_WORKER_REPLICAS
Number of refresh worker containers.

```bash
REFRESH_WORKER_REPLICAS=2  # Default
REFRESH_WORKER_REPLICAS=1  # Minimal
REFRESH_WORKER_REPLICAS=3  # High throughput
```

**Recommendation**: 2-3 for production-like test.

## Test Scenarios

### Scenario 1: Baseline Performance

Test without chaos to establish baseline:

```bash
CHAOS_ENABLED=false \
ACCOUNTS=500 \
POSTS=2500 \
DURATION_MINUTES=15 \
./scripts/run-chaos-test.sh
```

**Expected**: 99%+ success rate, low latency.

### Scenario 2: Moderate Load + Chaos

Realistic production conditions:

```bash
ACCOUNTS=1000 \
POSTS=5000 \
DURATION_MINUTES=30 \
CHAOS_PLATFORM_429_RATE=0.1 \
CHAOS_PLATFORM_500_RATE=0.05 \
./scripts/run-chaos-test.sh
```

**Expected**: 95%+ success rate, handles failures gracefully.

### Scenario 3: Extreme Load

Stress test with high load:

```bash
ACCOUNTS=5000 \
POSTS=25000 \
PUBLISH_RATE=20 \
DURATION_MINUTES=60 \
PUBLISHING_WORKER_REPLICAS=5 \
./scripts/run-chaos-test.sh
```

**Expected**: 90%+ success rate, system remains stable.

### Scenario 4: Refresh Storm

Focus on token refresh:

```bash
ACCOUNTS=2000 \
POSTS=0 \
REFRESH_EXPIRY_BURST=1000 \
DURATION_MINUTES=20 \
./scripts/run-chaos-test.sh
```

**Expected**: No refresh storm, no concurrent refresh violations.

### Scenario 5: Rate Limit Meltdown

Test circuit breaker:

```bash
ACCOUNTS=500 \
POSTS=2000 \
CHAOS_PLATFORM_429_RATE=0.5 \
DURATION_MINUTES=15 \
./scripts/run-chaos-test.sh
```

**Expected**: Circuit breaker opens, system recovers.

### Scenario 6: Worker Chaos

Test worker resilience:

```bash
ACCOUNTS=1000 \
POSTS=5000 \
CHAOS_KILL_WORKER_INTERVAL=60000 \
CHAOS_WORKER_CRASH_RATE=0.05 \
DURATION_MINUTES=30 \
./scripts/run-chaos-test.sh
```

**Expected**: Workers recover, no data loss.

### Scenario 7: Infrastructure Chaos

Test infrastructure resilience:

```bash
ACCOUNTS=1000 \
POSTS=5000 \
CHAOS_RESTART_REDIS_INTERVAL=300000 \
CHAOS_REDIS_DELAY_RATE=0.1 \
DURATION_MINUTES=30 \
./scripts/run-chaos-test.sh
```

**Expected**: System recovers from Redis restarts.

## Monitoring

### Real-Time Metrics

While test is running, access metrics:

```bash
# Full metrics
curl http://localhost:9090/metrics | jq

# Summary
curl http://localhost:9090/metrics/summary | jq

# Health check
curl http://localhost:9090/health
```

### Container Logs

View logs from specific containers:

```bash
# Load simulator
docker-compose -f docker-compose.chaos.yml logs -f load-simulator

# Publishing workers
docker-compose -f docker-compose.chaos.yml logs -f publishing-worker

# Refresh workers
docker-compose -f docker-compose.chaos.yml logs -f refresh-worker

# API
docker-compose -f docker-compose.chaos.yml logs -f api

# Metrics exporter
docker-compose -f docker-compose.chaos.yml logs -f metrics-exporter
```

### Console Output

The test prints a summary every 60 seconds:

```
================================================================================
CHAOS TEST METRICS SUMMARY
================================================================================
Timestamp: 2024-01-15T10:30:00.000Z

PUBLISH METRICS:
  Total: 5000
  Successful: 4850
  Failed: 150
  Success Rate: 97.00%
...
```

## Interpreting Results

### Success Criteria

Test **PASSES** if:
- ✅ Zero duplicate publishes
- ✅ Peak refresh rate ≤ threshold
- ✅ Zero concurrent refresh violations
- ✅ Zero retry storm events
- ✅ No job explosion
- ✅ Memory growth ≤ 2x
- ✅ Queue lag ≤ 60 seconds

### Report Files

After test completes, check `./reports/`:

1. **SUMMARY.txt**: Quick pass/fail result
2. **chaos-test-report.md**: Full formatted report
3. **chaos-test-report.json**: Machine-readable report
4. **chaos-test.log**: Detailed logs

### Key Metrics

#### Publish Success Rate

```
Success Rate: 97.00%
```

- **99%+**: Excellent
- **95-99%**: Good
- **90-95%**: Acceptable with chaos
- **<90%**: Investigate failures

#### Queue Lag

```
Lag (avg): 2500ms
```

- **<5s**: Excellent
- **5-30s**: Good
- **30-60s**: Acceptable
- **>60s**: Problem

#### Memory Growth

```
Memory Growth: 1.5x
```

- **<1.5x**: Excellent
- **1.5-2.0x**: Good
- **2.0-3.0x**: Acceptable
- **>3.0x**: Memory leak

#### Peak Refresh Rate

```
Peak Refresh Rate: 45/s
```

- **<30/s**: Excellent
- **30-50/s**: Good
- **50-100/s**: Acceptable
- **>100/s**: Refresh storm

### Failure Analysis

If test fails, check:

1. **Which validation failed?**
   - Look at "Failed Checks" in report
   
2. **When did it fail?**
   - Check timestamps in logs
   
3. **What was happening?**
   - Review metrics at failure time
   
4. **Was it chaos-induced?**
   - Check chaos event logs

## Troubleshooting

### Common Issues

#### Issue: Containers fail to start

**Symptoms**: Docker errors, containers exit immediately

**Solutions**:
```bash
# Check Docker resources
docker system df

# Increase Docker memory to 8GB
# Check logs
docker-compose -f docker-compose.chaos.yml logs

# Rebuild images
docker-compose -f docker-compose.chaos.yml build --no-cache
```

#### Issue: Out of memory

**Symptoms**: System slow, containers killed

**Solutions**:
```bash
# Reduce load
ACCOUNTS=500 POSTS=2000 ./scripts/run-chaos-test.sh

# Reduce worker replicas
PUBLISHING_WORKER_REPLICAS=2 ./scripts/run-chaos-test.sh

# Reduce concurrency
PUBLISHING_WORKER_CONCURRENCY=3 ./scripts/run-chaos-test.sh
```

#### Issue: Test takes too long

**Symptoms**: Test doesn't complete in expected time

**Solutions**:
```bash
# Reduce duration
DURATION_MINUTES=15 ./scripts/run-chaos-test.sh

# Increase publish rate
PUBLISH_RATE=10 ./scripts/run-chaos-test.sh

# Reduce posts
POSTS=2000 ./scripts/run-chaos-test.sh
```

#### Issue: High failure rate

**Symptoms**: Success rate < 90%

**Solutions**:
```bash
# Reduce chaos rates
CHAOS_PLATFORM_429_RATE=0.05 \
CHAOS_PLATFORM_500_RATE=0.02 \
./scripts/run-chaos-test.sh

# Increase worker replicas
PUBLISHING_WORKER_REPLICAS=5 ./scripts/run-chaos-test.sh

# Check logs for errors
docker-compose -f docker-compose.chaos.yml logs | grep ERROR
```

#### Issue: Duplicate publishes detected

**Symptoms**: Validation fails on duplicate check

**Solutions**:
1. Check PublishingWorker idempotency logic
2. Review distributed lock implementation
3. Check database transaction isolation
4. Review PublishHash generation
5. Check for race conditions in status updates

#### Issue: Refresh storm detected

**Symptoms**: Peak refresh rate exceeds threshold

**Solutions**:
1. Check RefreshQueue rate limiting
2. Review token expiry logic
3. Check for refresh retry loops
4. Reduce REFRESH_EXPIRY_BURST
5. Increase MAX_REFRESH_PER_SECOND threshold

## Best Practices

### Before Running Tests

1. **Start with baseline**: Run without chaos first
2. **Start small**: Use low load initially
3. **Increase gradually**: Ramp up load over multiple runs
4. **Check resources**: Ensure adequate CPU/memory/disk
5. **Review configuration**: Validate all parameters

### During Tests

1. **Monitor actively**: Watch metrics in real-time
2. **Check logs**: Look for errors or warnings
3. **Note anomalies**: Document unexpected behavior
4. **Don't interrupt**: Let test complete naturally
5. **Save output**: Capture console output

### After Tests

1. **Review reports**: Read all generated reports
2. **Analyze failures**: Investigate any failed checks
3. **Compare runs**: Track metrics over time
4. **Document findings**: Note issues and improvements
5. **Clean up**: Run cleanup script

### Regular Testing

1. **Daily**: Run baseline test
2. **Weekly**: Run moderate chaos test
3. **Monthly**: Run extreme load test
4. **Before release**: Run full test suite
5. **After changes**: Run relevant scenarios

### CI/CD Integration

1. **Automate**: Run tests in CI pipeline
2. **Gate releases**: Require passing tests
3. **Track trends**: Monitor metrics over time
4. **Alert on failures**: Notify team immediately
5. **Archive reports**: Keep historical data

## Conclusion

This chaos testing harness is a powerful tool for validating distributed systems reliability. Use it regularly to ensure your system can handle production conditions.

**Remember**: 
- Start small and increase gradually
- Run baseline tests first
- Monitor actively during tests
- Analyze results thoroughly
- Fix issues before production

For questions or issues, refer to the main README.md or check the logs.
