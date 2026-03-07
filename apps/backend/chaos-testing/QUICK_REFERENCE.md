# Chaos Testing Quick Reference

## One-Line Commands

```bash
# Quick test (10 min)
ACCOUNTS=100 POSTS=500 DURATION_MINUTES=10 ./scripts/run-chaos-test.sh

# Standard test (30 min)
./scripts/run-chaos-test.sh

# Extreme test (60 min)
ACCOUNTS=5000 POSTS=25000 DURATION_MINUTES=60 ./scripts/run-chaos-test.sh

# Baseline (no chaos)
CHAOS_ENABLED=false ./scripts/run-chaos-test.sh

# Cleanup
./scripts/cleanup.sh
```

## Key Endpoints

```bash
# Metrics
curl http://localhost:9090/metrics

# Summary
curl http://localhost:9090/metrics/summary

# Health
curl http://localhost:9090/health
```

## Important Files

```
reports/SUMMARY.txt              # Quick result
reports/chaos-test-report.md     # Full report
reports/chaos-test-report.json   # JSON data
reports/chaos-test.log           # Detailed logs
```

## Common Configurations

```bash
# Light load
ACCOUNTS=100 POSTS=500

# Medium load
ACCOUNTS=1000 POSTS=5000

# Heavy load
ACCOUNTS=5000 POSTS=25000

# Disable chaos
CHAOS_ENABLED=false

# Aggressive chaos
CHAOS_PLATFORM_429_RATE=0.5 CHAOS_PLATFORM_500_RATE=0.2

# More workers
PUBLISHING_WORKER_REPLICAS=5 REFRESH_WORKER_REPLICAS=3
```

## Pass/Fail Criteria

✅ **PASS** if:
- Zero duplicates
- Refresh rate ≤ 50/sec
- Memory growth ≤ 2x
- Queue lag ≤ 60s

❌ **FAIL** if:
- Any duplicates
- Refresh storm
- Memory runaway
- Queue starvation

## Troubleshooting

```bash
# View logs
docker-compose -f docker-compose.chaos.yml logs -f load-simulator

# Check containers
docker-compose -f docker-compose.chaos.yml ps

# Restart
docker-compose -f docker-compose.chaos.yml restart

# Full cleanup
./scripts/cleanup.sh
```

## Test Scenarios

```bash
# Scenario 1: Baseline
CHAOS_ENABLED=false ACCOUNTS=500 POSTS=2500 DURATION_MINUTES=15 ./scripts/run-chaos-test.sh

# Scenario 2: Moderate
ACCOUNTS=1000 POSTS=5000 DURATION_MINUTES=30 ./scripts/run-chaos-test.sh

# Scenario 3: Extreme
ACCOUNTS=5000 POSTS=25000 PUBLISH_RATE=20 DURATION_MINUTES=60 ./scripts/run-chaos-test.sh

# Scenario 4: Refresh Storm
ACCOUNTS=2000 REFRESH_EXPIRY_BURST=1000 DURATION_MINUTES=20 ./scripts/run-chaos-test.sh

# Scenario 5: Rate Limit
CHAOS_PLATFORM_429_RATE=0.5 ACCOUNTS=500 POSTS=2000 DURATION_MINUTES=15 ./scripts/run-chaos-test.sh
```

## Environment Variables

### Load
- `ACCOUNTS` (default: 1000)
- `POSTS` (default: 5000)
- `PUBLISH_RATE` (default: 5)
- `DURATION_MINUTES` (default: 30)

### Chaos
- `CHAOS_ENABLED` (default: true)
- `CHAOS_PLATFORM_429_RATE` (default: 0.1)
- `CHAOS_PLATFORM_500_RATE` (default: 0.05)
- `CHAOS_KILL_WORKER_INTERVAL` (default: 300000)

### Workers
- `PUBLISHING_WORKER_REPLICAS` (default: 3)
- `REFRESH_WORKER_REPLICAS` (default: 2)

## Quick Checks

```bash
# Is test running?
curl -s http://localhost:9090/health

# Current metrics
curl -s http://localhost:9090/metrics/summary | jq

# Container status
docker-compose -f docker-compose.chaos.yml ps

# Recent logs
docker-compose -f docker-compose.chaos.yml logs --tail=50
```

## Report Interpretation

```
Success Rate: 97.00%
  99%+   = Excellent
  95-99% = Good
  90-95% = Acceptable
  <90%   = Investigate

Queue Lag: 2500ms
  <5s    = Excellent
  5-30s  = Good
  30-60s = Acceptable
  >60s   = Problem

Memory Growth: 1.5x
  <1.5x  = Excellent
  1.5-2x = Good
  2-3x   = Acceptable
  >3x    = Memory leak

Peak Refresh Rate: 45/s
  <30/s  = Excellent
  30-50/s = Good
  50-100/s = Acceptable
  >100/s = Refresh storm
```

## Help

- Full docs: `README.md`
- Usage guide: `USAGE_GUIDE.md`
- Checklist: `VALIDATION_CHECKLIST.md`
- Implementation: `IMPLEMENTATION_COMPLETE.md`
