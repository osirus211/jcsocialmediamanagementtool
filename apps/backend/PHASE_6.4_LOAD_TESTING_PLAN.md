# Phase 6.4 — Publishing Load Testing - Implementation Plan

**Date**: March 7, 2026  
**Status**: PLANNING  
**Goal**: Create load testing tools to validate publishing system scalability

---

## OVERVIEW

Phase 6.1-6.3 are complete. The publishing system is production-ready with:
- ✅ Multi-platform fanout
- ✅ Platform-specific idempotency
- ✅ SchedulerWorker (BullMQ-based)
- ✅ Media pipeline separation
- ✅ Comprehensive observability

Phase 6.4 creates load testing tools to validate the system can handle:
- 100k scheduled posts
- 10k connected accounts
- High concurrency
- Publishing bursts

---

## IMPLEMENTATION STEPS

### STEP 1 — Test Data Generator

**Purpose**: Generate large volumes of test posts

**Script**: `load-testing/generate-test-data.ts`

**Features**:
- CLI arguments: `--posts`, `--accounts`, `--platforms`
- Creates fake posts in MongoDB
- Assigns scheduledAt timestamps (next hour)
- Attaches random media
- Assigns random social accounts
- Creates test workspaces and users

**Example Usage**:
```bash
npm run load-test:generate -- --posts 10000 --accounts 2000 --platforms twitter,linkedin,facebook
```

**Output**:
```
✅ Created 2000 test accounts
✅ Created 10000 test posts
   - Twitter: 3500 posts
   - LinkedIn: 3200 posts
   - Facebook: 3300 posts
✅ Scheduled within next 60 minutes
```

---

### STEP 2 — Scheduler Stress Test

**Purpose**: Test scheduler with many posts due simultaneously

**Script**: `load-testing/scheduler-stress-test.ts`

**Features**:
- Creates 5000 posts scheduled at same minute
- Measures scheduler performance
- Tracks MongoDB query time
- Logs jobs created

**Metrics**:
- Scheduler duration (ms)
- Jobs created count
- MongoDB query time (ms)
- Posts processed per second

**Example Usage**:
```bash
npm run load-test:scheduler -- --posts 5000
```

**Output**:
```
Scheduler Stress Test Results:
- Posts scheduled: 5000
- Scheduler duration: 2500ms
- Jobs created: 15000 (3 platforms avg)
- Mongo query time: 150ms
- Throughput: 2000 posts/sec
```

---

### STEP 3 — Queue Throughput Test

**Purpose**: Measure publishing throughput

**Script**: `load-testing/queue-throughput-test.ts`

**Features**:
- Adds jobs to queue continuously
- Measures jobs per second
- Tracks worker processing time
- Monitors queue backlog growth
- Logs results every 10 seconds

**Metrics**:
- Jobs per second
- Average processing time
- Queue backlog size
- Worker utilization

**Example Usage**:
```bash
npm run load-test:throughput -- --duration 300 --rate 100
```

**Output**:
```
[10s] Jobs/sec: 95, Backlog: 50, Avg time: 1200ms
[20s] Jobs/sec: 98, Backlog: 45, Avg time: 1150ms
[30s] Jobs/sec: 100, Backlog: 40, Avg time: 1100ms
```

---

### STEP 4 — Worker Concurrency Test

**Purpose**: Test different concurrency levels

**Script**: `load-testing/worker-concurrency-test.ts`

**Features**:
- Runs tests with concurrency 5, 10, 20
- Measures average publish time
- Tracks queue latency
- Monitors failure rate

**Metrics**:
- Average publish time per concurrency level
- Queue latency
- Failure rate
- Optimal concurrency

**Example Usage**:
```bash
npm run load-test:concurrency -- --levels 5,10,20 --posts 1000
```

**Output**:
```
Concurrency Test Results:
- Concurrency 5:  Avg time: 1500ms, Latency: 500ms, Failures: 0%
- Concurrency 10: Avg time: 1200ms, Latency: 300ms, Failures: 0%
- Concurrency 20: Avg time: 1100ms, Latency: 200ms, Failures: 0.5%
Optimal: 10 workers
```

---

### STEP 5 — Redis Stress Test

**Purpose**: Test Redis under heavy load

**Script**: `load-testing/redis-stress-test.ts`

**Features**:
- Simulates concurrent publishing
- Tests rate limit keys
- Tests lock contention
- Tests publish hash lookups
- Verifies no Redis errors

**Metrics**:
- Redis operations per second
- Lock acquisition time
- Lock contention rate
- Error rate

**Example Usage**:
```bash
npm run load-test:redis -- --concurrent 100 --duration 60
```

**Output**:
```
Redis Stress Test Results:
- Operations/sec: 5000
- Lock acquisition: 5ms avg
- Lock contention: 2%
- Errors: 0
✅ Redis stable under load
```

---

### STEP 6 — Metrics Report

**Purpose**: Generate comprehensive test report

**Script**: `load-testing/generate-report.ts`

**Features**:
- Aggregates all test results
- Calculates summary statistics
- Generates markdown report
- Includes recommendations

**Metrics**:
- Total posts processed
- Average publish latency
- Max queue backlog
- Error rate
- Worker utilization
- System bottlenecks

**Example Usage**:
```bash
npm run load-test:report
```

**Output**: `LOAD_TEST_REPORT.md`

---

## DIRECTORY STRUCTURE

```
apps/backend/
├── load-testing/
│   ├── generate-test-data.ts
│   ├── scheduler-stress-test.ts
│   ├── queue-throughput-test.ts
│   ├── worker-concurrency-test.ts
│   ├── redis-stress-test.ts
│   ├── generate-report.ts
│   ├── utils/
│   │   ├── test-data-factory.ts
│   │   ├── metrics-collector.ts
│   │   └── report-generator.ts
│   └── README.md
├── package.json (add scripts)
└── tsconfig.json
```

---

## NPM SCRIPTS

Add to `package.json`:
```json
{
  "scripts": {
    "load-test:generate": "ts-node load-testing/generate-test-data.ts",
    "load-test:scheduler": "ts-node load-testing/scheduler-stress-test.ts",
    "load-test:throughput": "ts-node load-testing/queue-throughput-test.ts",
    "load-test:concurrency": "ts-node load-testing/worker-concurrency-test.ts",
    "load-test:redis": "ts-node load-testing/redis-stress-test.ts",
    "load-test:report": "ts-node load-testing/generate-report.ts",
    "load-test:all": "npm run load-test:generate && npm run load-test:scheduler && npm run load-test:throughput && npm run load-test:concurrency && npm run load-test:redis && npm run load-test:report"
  }
}
```

---

## TESTING SCENARIOS

### Scenario 1: Normal Load
- 1,000 posts
- 100 accounts
- 3 platforms
- Expected: All pass

### Scenario 2: High Load
- 10,000 posts
- 1,000 accounts
- 5 platforms
- Expected: All pass, some queue backlog

### Scenario 3: Extreme Load
- 100,000 posts
- 10,000 accounts
- 5 platforms
- Expected: System handles gracefully, identifies bottlenecks

### Scenario 4: Burst Load
- 5,000 posts scheduled at same minute
- Expected: Scheduler handles burst, queue processes efficiently

---

## SUCCESS CRITERIA

### Performance Targets
- ✅ Scheduler: Process 100 posts/second
- ✅ Queue: Handle 50 jobs/second
- ✅ Worker: Publish in <2 seconds average
- ✅ Redis: <10ms lock acquisition
- ✅ Error rate: <1%

### Scalability Targets
- ✅ Handle 100k scheduled posts
- ✅ Support 10k connected accounts
- ✅ Process burst of 5k posts
- ✅ No Redis errors under load
- ✅ No MongoDB timeouts

---

## IMPLEMENTATION CHECKLIST

### Step 1: Test Data Generator
- [ ] Create test-data-factory.ts
- [ ] Create generate-test-data.ts
- [ ] Add CLI argument parsing
- [ ] Test with small dataset (100 posts)
- [ ] Test with large dataset (10k posts)

### Step 2: Scheduler Stress Test
- [ ] Create scheduler-stress-test.ts
- [ ] Measure scheduler duration
- [ ] Track MongoDB query time
- [ ] Log jobs created
- [ ] Test with 5k posts

### Step 3: Queue Throughput Test
- [ ] Create queue-throughput-test.ts
- [ ] Track jobs per second
- [ ] Monitor queue backlog
- [ ] Log every 10 seconds
- [ ] Test for 5 minutes

### Step 4: Worker Concurrency Test
- [ ] Create worker-concurrency-test.ts
- [ ] Test concurrency levels (5, 10, 20)
- [ ] Measure publish time
- [ ] Track failure rate
- [ ] Identify optimal concurrency

### Step 5: Redis Stress Test
- [ ] Create redis-stress-test.ts
- [ ] Test lock contention
- [ ] Test rate limit keys
- [ ] Monitor error rate
- [ ] Verify stability

### Step 6: Metrics Report
- [ ] Create metrics-collector.ts
- [ ] Create report-generator.ts
- [ ] Create generate-report.ts
- [ ] Generate markdown report
- [ ] Include recommendations

---

## SAFETY MEASURES

### Database Safety
- Use separate test database or prefix
- Add `--test-mode` flag
- Cleanup test data after run
- Don't affect production data

### Redis Safety
- Use test key prefix (`test:`)
- Cleanup test keys after run
- Monitor Redis memory
- Don't affect production keys

### Worker Safety
- Use separate test queue
- Don't interfere with production workers
- Graceful shutdown on Ctrl+C
- Cleanup jobs on exit

---

## CLEANUP SCRIPT

Create `load-testing/cleanup.ts`:
```typescript
// Remove all test data
// Remove test posts
// Remove test accounts
// Remove test workspaces
// Remove test Redis keys
// Remove test queue jobs
```

---

## CONCLUSION

**Status**: Ready for implementation

**Estimated Time**: 4-6 hours

**Files to Create**: 10 files

**Ready for**: Load testing implementation

---

**Plan Version**: 1.0  
**Last Updated**: March 7, 2026  
**Status**: READY FOR IMPLEMENTATION
