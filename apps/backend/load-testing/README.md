# Publishing Load Testing

Comprehensive load testing tools for the publishing system.

## Overview

This directory contains load testing utilities to validate the publishing system can handle:
- 100k scheduled posts
- 10k connected accounts
- High concurrency
- Publishing bursts

## Prerequisites

```bash
# Install dependencies
npm install

# Ensure MongoDB and Redis are running
# Ensure test database is configured
```

## Test Scripts

### 1. Generate Test Data

Creates large volumes of test posts, accounts, and workspaces.

```bash
npm run load-test:generate -- --posts 10000 --accounts 2000 --platforms twitter,linkedin,facebook
```

**Options**:
- `--posts` - Number of posts to create (default: 1000)
- `--accounts` - Number of social accounts (default: 100)
- `--platforms` - Comma-separated platforms (default: twitter,linkedin,facebook)
- `--spread` - Time spread in minutes (default: 60)
- `--media` - Percentage of posts with media (default: 0.3)

**Output**:
- Creates test user, workspace, accounts, and posts
- Saves test data IDs to `.test-data-ids.json`
- Posts scheduled within next N minutes

### 2. Scheduler Stress Test

Tests scheduler with many posts due simultaneously.

```bash
npm run load-test:scheduler -- --posts 5000
```

**Options**:
- `--posts` - Number of posts in burst (default: 5000)
- `--platforms` - Platforms to test (default: twitter,linkedin,facebook)
- `--burstMinutes` - Minutes from now for burst (default: 1)

**Metrics**:
- Scheduler duration
- MongoDB query time
- Jobs created
- Posts processed per second

### 3. Queue Throughput Test

Measures publishing throughput over time.

```bash
npm run load-test:throughput -- --duration 300 --rate 100
```

**Options**:
- `--duration` - Test duration in seconds (default: 300)
- `--rate` - Target jobs per second (default: 100)

**Metrics**:
- Jobs per second
- Queue backlog
- Average processing time
- Worker utilization

### 4. Worker Concurrency Test

Tests different worker concurrency levels.

```bash
npm run load-test:concurrency -- --levels 5,10,20 --posts 1000
```

**Options**:
- `--levels` - Concurrency levels to test (default: 5,10,20)
- `--posts` - Posts per test (default: 1000)

**Metrics**:
- Average publish time per level
- Queue latency
- Failure rate
- Optimal concurrency

### 5. Redis Stress Test

Tests Redis under heavy concurrent load.

```bash
npm run load-test:redis -- --concurrent 100 --duration 60
```

**Options**:
- `--concurrent` - Concurrent operations (default: 100)
- `--duration` - Test duration in seconds (default: 60)

**Metrics**:
- Operations per second
- Lock acquisition time
- Lock contention rate
- Error rate

### 6. Generate Report

Generates comprehensive test report.

```bash
npm run load-test:report
```

**Output**: `LOAD_TEST_REPORT.md`

## Cleanup

Remove all test data:

```bash
npm run load-test:cleanup
```

This removes:
- Test posts
- Test social accounts
- Test workspaces
- Test users
- Test Redis keys
- Test queue jobs

## Test Scenarios

### Scenario 1: Normal Load
```bash
npm run load-test:generate -- --posts 1000 --accounts 100
npm run load-test:scheduler -- --posts 1000
```

### Scenario 2: High Load
```bash
npm run load-test:generate -- --posts 10000 --accounts 1000
npm run load-test:scheduler -- --posts 5000
npm run load-test:throughput -- --duration 300
```

### Scenario 3: Extreme Load
```bash
npm run load-test:generate -- --posts 100000 --accounts 10000
npm run load-test:scheduler -- --posts 10000
npm run load-test:concurrency -- --levels 5,10,20,50
npm run load-test:redis -- --concurrent 200
```

### Scenario 4: Full Test Suite
```bash
npm run load-test:all
```

## Performance Targets

### Scheduler
- ✅ Process 100 posts/second
- ✅ MongoDB query < 200ms
- ✅ Handle 5k burst

### Queue
- ✅ Handle 50 jobs/second
- ✅ Backlog < 1000 jobs
- ✅ Latency < 5 seconds

### Worker
- ✅ Publish in < 2 seconds average
- ✅ P95 < 3 seconds
- ✅ Error rate < 1%

### Redis
- ✅ Lock acquisition < 10ms
- ✅ No errors under load
- ✅ Handle 1000 ops/second

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongosh

# Check connection string in .env
MONGODB_URI=mongodb://localhost:27017/social-scheduler-test
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping

# Check connection in .env
REDIS_URL=redis://localhost:6379
```

### Out of Memory
```bash
# Reduce test size
npm run load-test:generate -- --posts 1000 --accounts 100

# Increase Node memory
NODE_OPTIONS=--max-old-space-size=4096 npm run load-test:generate
```

### Test Data Not Cleaned Up
```bash
# Manual cleanup
npm run load-test:cleanup

# Or connect to MongoDB and remove manually
mongosh
use social-scheduler-test
db.posts.deleteMany({ "metadata.testPost": true })
db.socialaccounts.deleteMany({ "metadata.testAccount": true })
db.workspaces.deleteMany({ "metadata.testWorkspace": true })
db.users.deleteMany({ "metadata.testUser": true })
```

## Safety

### Database Safety
- Uses test database or prefix
- All test data marked with `metadata.testPost: true`
- Cleanup script removes only test data
- Never affects production data

### Redis Safety
- Uses test key prefix (`test:`)
- Cleanup removes only test keys
- Monitors Redis memory
- Never affects production keys

### Worker Safety
- Uses separate test queue
- Doesn't interfere with production workers
- Graceful shutdown on Ctrl+C
- Cleanup jobs on exit

## Metrics

All tests collect comprehensive metrics:
- Duration
- Throughput (posts/sec, jobs/sec)
- Latency (avg, p50, p95, p99)
- Queue backlog
- Error rate
- Resource usage

Metrics are:
- Printed to console
- Saved to JSON files
- Included in final report

## CI/CD Integration

Run load tests in CI/CD:

```yaml
# .github/workflows/load-test.yml
name: Load Tests
on: [push]
jobs:
  load-test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:6
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run load-test:generate -- --posts 1000
      - run: npm run load-test:scheduler -- --posts 1000
      - run: npm run load-test:cleanup
```

## Contributing

When adding new load tests:
1. Follow existing patterns
2. Use MetricsCollector for metrics
3. Use TestDataFactory for test data
4. Add cleanup logic
5. Update this README
6. Add npm script to package.json

## License

Same as main project
