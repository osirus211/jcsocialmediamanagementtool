# Phase 1: Distributed Token Lifecycle Automation
## Part 1: System Architecture

**Date**: 2026-03-03  
**Engineer**: Principal Distributed Systems Engineer  
**Status**: DESIGN PHASE

---

## EXECUTIVE SUMMARY

Production-grade distributed token refresh system designed to scale to 1M users without refresh storms, race conditions, or token expiry failures.

**Core Principles**:
- Redis-based coordination (no in-memory state)
- BullMQ for job queue management
- Distributed locks for race condition prevention
- Circuit breakers per provider
- Exponential backoff with jitter
- Dead letter queue for failed jobs
- Comprehensive metrics and observability

---

## PART 1: WORKER ARCHITECTURE

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISTRIBUTED TOKEN REFRESH                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Scheduler Cron  │  (Every 5 minutes)
│  (Single Leader) │
└────────┬─────────┘
         │
         │ Scan DB for tokens expiring < 24h
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BullMQ: token-refresh Queue                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Job 1    │  │ Job 2    │  │ Job 3    │  │ Job N    │       │
│  │ conn:123 │  │ conn:456 │  │ conn:789 │  │ conn:... │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Worker 1    │ │  Worker 2    │ │  Worker 3    │ │  Worker N    │
│  Instance 1  │ │  Instance 2  │ │  Instance 3  │ │  Instance N  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │
       │ 1. Acquire distributed lock (Redis SETNX)       │
       │ 2. Check circuit breaker                        │
       │ 3. Call provider refresh API                    │
       │ 4. Update tokens atomically                     │
       │ 5. Release lock                                 │
       │                                                  │
       ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Redis Coordination                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Locks:     oauth:refresh:lock:{connectionId}               │ │
│  │ Circuit:   oauth:circuit:{provider}                        │ │
│  │ Attempts:  oauth:refresh:attempts:{connectionId}           │ │
│  │ Metrics:   oauth:refresh:metrics:{provider}                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
       │
       │ On failure after retries
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Dead Letter Queue (DLQ): token-refresh-dlq          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Failed 1 │  │ Failed 2 │  │ Failed N │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
       │
       │ Manual intervention / Alert
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring & Alerting                         │
│  - Prometheus metrics                                            │
│  - Grafana dashboards                                            │
│  - PagerDuty alerts                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Components

**1. Scheduler (Cron)**
- Runs every 5 minutes
- Scans database for tokens expiring within 24 hours
- Enqueues refresh jobs to BullMQ
- Uses distributed lock to ensure single leader

**2. BullMQ Queue (`token-refresh`)**
- Persistent job queue backed by Redis
- Handles job distribution across workers
- Automatic retry with exponential backoff
- Job deduplication (idempotency)

**3. Workers (N instances)**
- Process jobs from queue
- Acquire distributed lock per connection
- Check circuit breaker before API call
- Call provider refresh endpoint
- Update tokens atomically
- Release lock

**4. Redis Coordination**
- Distributed locks
- Circuit breaker state
- Retry attempt tracking
- Metrics aggregation

**5. Dead Letter Queue (DLQ)**
- Stores permanently failed jobs
- Enables manual intervention
- Triggers alerts

---

