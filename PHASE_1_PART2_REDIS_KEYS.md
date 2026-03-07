# Phase 1: Distributed Token Lifecycle Automation
## Part 2: Redis Key Design

---

## REDIS KEY STRUCTURE

### 1. Distributed Lock Keys

**Key**: `oauth:refresh:lock:{connectionId}`  
**Value**: `{workerId}:{timestamp}`  
**TTL**: 120 seconds  
**Operation**: `SET key value EX 120 NX`

**Purpose**: Prevent multiple workers from refreshing the same token simultaneously

**Example**:
```
Key: oauth:refresh:lock:conn_abc123
Value: worker-1:1709491200000
TTL: 120
```

**Behavior**:
- Worker attempts `SET oauth:refresh:lock:conn_abc123 worker-1:1709491200000 EX 120 NX`
- If returns `OK` → Lock acquired, proceed with refresh
- If returns `null` → Lock held by another worker, skip job

**Lock Release**:
- Automatic via TTL (120 seconds)
- Manual via `DEL` after successful refresh
- Prevents deadlocks if worker crashes

---

### 2. Circuit Breaker Keys

**Key**: `oauth:circuit:{provider}`  
**Value**: JSON object with circuit state  
**TTL**: None (persistent)  
**Structure**:
```json
{
  "state": "closed|open|half-open",
  "failureCount": 0,
  "successCount": 0,
  "lastFailureTime": 1709491200000,
  "lastSuccessTime": 1709491200000,
  "openedAt": null,
  "nextAttemptAt": null
}
```

**Purpose**: Prevent cascading failures when provider API is down

**States**:
- `closed`: Normal operation, all requests allowed
- `open`: Provider failing, block all requests for cooldown period
- `half-open`: Testing if provider recovered, allow limited requests

**Thresholds**:
- Open circuit after 5 consecutive failures
- Keep open for 60 seconds
- Transition to half-open after cooldown
- Close after 3 consecutive successes in half-open

**Example**:
```
Key: oauth:circuit:twitter
Value: {"state":"open","failureCount":5,"openedAt":1709491200000,"nextAttemptAt":1709491260000}
```

---

### 3. Retry Attempt Tracking

**Key**: `oauth:refresh:attempts:{connectionId}`  
**Value**: Attempt count (integer)  
**TTL**: 3600 seconds (1 hour)  
**Operation**: `INCR oauth:refresh:attempts:{connectionId}`

**Purpose**: Track retry attempts to prevent infinite retry loops

**Example**:
```
Key: oauth:refresh:attempts:conn_abc123
Value: 2
TTL: 3600
```

**Behavior**:
- Increment on each retry attempt
- If count >= MAX_RETRIES (3), move to DLQ
- Reset to 0 on successful refresh
- Auto-expire after 1 hour

---

### 4. Metrics Keys

**Key**: `oauth:refresh:metrics:{provider}:{date}`  
**Value**: JSON object with metrics  
**TTL**: 604800 seconds (7 days)  
**Structure**:
```json
{
  "success": 150,
  "failure": 5,
  "retry": 10,
  "avgLatency": 450,
  "p99Latency": 1200
}
```

**Purpose**: Track refresh performance per provider per day

**Example**:
```
Key: oauth:refresh:metrics:twitter:2026-03-03
Value: {"success":150,"failure":5,"retry":10,"avgLatency":450}
TTL: 604800
```

---

### 5. Job Deduplication Keys

**Key**: `oauth:refresh:job:{connectionId}`  
**Value**: Job ID  
**TTL**: 86400 seconds (24 hours)  
**Operation**: `SET key jobId EX 86400 NX`

**Purpose**: Prevent duplicate jobs for same connection

**Example**:
```
Key: oauth:refresh:job:conn_abc123
Value: job_xyz789
TTL: 86400
```

**Behavior**:
- Before enqueuing job, check if key exists
- If exists → Skip enqueue (job already queued)
- If not exists → Set key and enqueue job
- Auto-expire after 24 hours

---

### 6. Rate Limit Keys (Per Provider)

**Key**: `oauth:refresh:ratelimit:{provider}:{window}`  
**Value**: Request count (integer)  
**TTL**: 60 seconds (sliding window)  
**Operation**: `INCR oauth:refresh:ratelimit:{provider}:{window}`

**Purpose**: Respect provider API rate limits

**Example**:
```
Key: oauth:refresh:ratelimit:twitter:1709491200
Value: 45
TTL: 60
```

**Behavior**:
- Increment on each API call
- If count >= RATE_LIMIT, delay request
- Auto-expire after window

**Rate Limits** (per provider):
- Twitter: 50 requests/minute
- Facebook: 200 requests/minute
- Instagram: 200 requests/minute
- LinkedIn: 100 requests/minute

---

### 7. Last Refresh Timestamp

**Key**: `oauth:refresh:last:{connectionId}`  
**Value**: Timestamp (milliseconds)  
**TTL**: 2592000 seconds (30 days)  
**Operation**: `SET oauth:refresh:last:{connectionId} {timestamp}`

**Purpose**: Track when token was last refreshed

**Example**:
```
Key: oauth:refresh:last:conn_abc123
Value: 1709491200000
TTL: 2592000
```

**Behavior**:
- Set after successful refresh
- Used to prevent refresh storms
- Minimum refresh interval: 5 minutes

---

## KEY NAMING CONVENTIONS

**Prefix**: `oauth:refresh:`  
**Separator**: `:`  
**Format**: `{namespace}:{entity}:{identifier}`

**Examples**:
- `oauth:refresh:lock:conn_abc123`
- `oauth:refresh:circuit:twitter`
- `oauth:refresh:attempts:conn_abc123`
- `oauth:refresh:metrics:twitter:2026-03-03`

---

## TTL STRATEGY

| Key Type | TTL | Reason |
|----------|-----|--------|
| Lock | 120s | Prevent deadlocks, auto-release |
| Circuit | None | Persistent state |
| Attempts | 3600s | Reset after 1 hour |
| Metrics | 7 days | Historical analysis |
| Job Dedup | 24h | Prevent duplicate jobs |
| Rate Limit | 60s | Sliding window |
| Last Refresh | 30 days | Long-term tracking |

---

## MEMORY ESTIMATION

**Per Connection**:
- Lock: ~100 bytes
- Attempts: ~50 bytes
- Job Dedup: ~100 bytes
- Last Refresh: ~50 bytes
- **Total**: ~300 bytes/connection

**At Scale**:
- 10K connections: ~3 MB
- 100K connections: ~30 MB
- 1M connections: ~300 MB

**Circuit Breakers** (per provider):
- ~500 bytes/provider
- 10 providers: ~5 KB

**Metrics** (per provider per day):
- ~200 bytes/provider/day
- 10 providers × 7 days: ~14 KB

**Total Redis Memory** (1M connections):
- Connections: 300 MB
- Circuit Breakers: 5 KB
- Metrics: 14 KB
- **Total**: ~300 MB

**Result**: Negligible Redis impact even at 1M scale

---

