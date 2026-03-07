# Phase 0: Horizontal Scaling Validation Plan
## Production-Grade Multi-Instance OAuth Testing

**Target**: Validate distributed OAuth state management across 2-3 backend instances  
**Scope**: Redis-based state with atomic operations, IP binding, fail-closed behavior  
**Environment**: Kubernetes + Load Balancer + Redis  
**Scale Target**: 1M users, 99.9% uptime

---

## Executive Summary

This plan validates that OAuth state management works correctly in a distributed environment with:
- Multiple backend pods handling authorization and callbacks
- Random routing via load balancer (no sticky sessions)
- Concurrent state operations
- Redis failure scenarios
- Security attack simulations

**Success Criteria**: 99.9% success rate across 500+ OAuth flows with random instance routing

---

## 1. Multi-Instance Test Setup

### 1.1 Local Development Setup (Docker Compose)

**File**: `apps/backend/docker-compose.multi-instance.yml`

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend-1:
    build: .
    environment:
      - NODE_ENV=production
      - PORT=5001
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - INSTANCE_ID=backend-1
    ports:
      - "5001:5001"
    depends_on:
      redis:
        condition: service_healthy

  backend-2:
    build: .
    environment:
      - NODE_ENV=production
      - PORT=5002
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - INSTANCE_ID=backend-2
    ports:
      - "5002:5002"
    depends_on:
      redis:
        condition: service_healthy

  backend-3:
    build: .
    environment:
      - NODE_ENV=production
      - PORT=5003
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - INSTANCE_ID=backend-3
    ports:
      - "5003:5003"
    depends_on:
      redis:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    ports:
      - "5000:80"
    volumes:
      - ./nginx-multi-instance.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend-1
      - backend-2
      - backend-3
```


### 1.2 Nginx Load Balancer Configuration

**File**: `apps/backend/nginx-multi-instance.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    # Round-robin load balancing (NO sticky sessions)
    upstream backend {
        server backend-1:5001;
        server backend-2:5002;
        server backend-3:5003;
    }

    # Access log with instance tracking
    log_format detailed '$remote_addr - $remote_user [$time_local] '
                       '"$request" $status $body_bytes_sent '
                       '"$http_referer" "$http_user_agent" '
                       'upstream: $upstream_addr';

    access_log /var/log/nginx/access.log detailed;

    server {
        listen 80;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # NO sticky sessions - force random routing
            proxy_no_cache 1;
            proxy_cache_bypass 1;
        }
    }
}
```

**Start Command**:
```bash
docker-compose -f docker-compose.multi-instance.yml up -d
```


### 1.3 Kubernetes Staging Setup

**File**: `k8s/oauth-validation-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-oauth-test
  namespace: staging
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/backend:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        - name: REDIS_PORT
          value: "6379"
        - name: INSTANCE_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: staging
spec:
  type: LoadBalancer
  sessionAffinity: None  # NO sticky sessions
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 5000
```

**Deploy Command**:
```bash
kubectl apply -f k8s/oauth-validation-deployment.yaml
kubectl rollout status deployment/backend-oauth-test -n staging
```


---

## 2. Horizontal Scaling Validation Plan

### 2.1 Test Execution

**Script**: `apps/backend/scripts/validate-horizontal-scaling.js`

**Run Command**:
```bash
# Local (Docker Compose)
BACKEND_URL=http://localhost:5000 \
NUM_FLOWS=500 \
CONCURRENCY=50 \
TEST_WORKSPACE_ID=test-workspace-123 \
TEST_USER_ID=test-user-456 \
TEST_AUTH_TOKEN=your-test-token \
node apps/backend/scripts/validate-horizontal-scaling.js

# Staging (Kubernetes)
BACKEND_URL=https://staging-api.yourdomain.com \
NUM_FLOWS=1000 \
CONCURRENCY=100 \
TEST_WORKSPACE_ID=staging-workspace \
TEST_USER_ID=staging-user \
TEST_AUTH_TOKEN=staging-token \
node apps/backend/scripts/validate-horizontal-scaling.js
```

### 2.2 Expected Success Rate

**Target**: ≥99.9% success rate

**Calculation**:
- Total flows: 500
- Maximum allowed failures: 0 (for 100% success)
- Acceptable failures: ≤1 (for 99.8% success)

**Success Criteria**:
- ✅ State creation success: 100%
- ✅ State consumption success: ≥99.9%
- ✅ Cross-instance routing: ≥30% of callbacks route to different instance
- ✅ P99 latency: <2000ms
- ✅ No Redis connection errors

### 2.3 Failure Indicators

**Critical Failures** (immediate investigation required):
- State not found after creation (indicates Redis write failure)
- State consumed twice (indicates atomic operation failure)
- Redis connection errors
- Success rate <99%

**Warning Indicators** (monitor but may proceed):
- P99 latency >2000ms (performance issue)
- Uneven instance routing (load balancer issue)
- Success rate 99-99.9% (investigate errors)


---

## 3. Concurrency Stress Test

### 3.1 Test Execution

**Script**: `apps/backend/load-tests/concurrency-stress-test.js`

**Run Command**:
```bash
# Install dependencies
npm install ioredis

# Run test
BACKEND_URL=http://localhost:5000 \
CONCURRENT_CREATES=1000 \
CONCURRENT_CONSUMES=1000 \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
node apps/backend/load-tests/concurrency-stress-test.js
```

### 3.2 Metrics to Observe

**Redis Performance**:
- CPU usage: Should stay <80%
- Memory usage: Should stay <200MB for 1000 states
- Connection count: Should match backend instance count (3-5)
- Command latency: P99 <10ms

**Backend Performance**:
- State creation P99: <500ms
- State consumption P99: <1000ms
- No connection pool exhaustion
- No memory leaks

**System Performance**:
- No pod restarts
- No OOM kills
- No Redis evictions
- No connection timeouts

### 3.3 Success Criteria

- ✅ 1000 concurrent creates: ≥99.9% success
- ✅ 1000 concurrent consumes: ≥99.9% success
- ✅ Redis CPU: <80%
- ✅ Redis memory: <200MB
- ✅ P99 latency: <2000ms
- ✅ No errors in logs


---

## 4. Redis Failure Simulation

### 4.1 Test Execution

**Script**: `apps/backend/scripts/redis-failure-simulation.sh`

**Run Command**:
```bash
chmod +x apps/backend/scripts/redis-failure-simulation.sh

# Docker Compose
BACKEND_URL=http://localhost:5000 \
REDIS_CONTAINER=redis \
./apps/backend/scripts/redis-failure-simulation.sh

# Kubernetes
kubectl delete pod -n staging -l app=redis
# Watch for automatic recovery
kubectl get pods -n staging -w
```

### 4.2 Expected Behavior

**Scenario 1: Redis Unavailable**
- Authorization endpoint: Returns 503 Service Unavailable
- Callback endpoint: Returns 503 Service Unavailable
- Error message: "OAuth state storage failed: Redis unavailable"
- No fallback to in-memory storage (fail-closed)

**Scenario 2: Redis Restart Mid-Flow**
- State created before restart: Lost (Redis is not persistent in test env)
- Callback with old state: Returns 400 Bad Request ("Invalid or expired state")
- New authorization after restart: Works normally

**Scenario 3: Redis Recovery**
- Authorization endpoint: Returns 200 OK immediately after Redis is back
- New OAuth flows: Work normally
- Circuit breaker: Resets after successful operations

### 4.3 Recovery Validation

**Automatic Recovery Checklist**:
- [ ] Backend reconnects to Redis automatically (ioredis auto-reconnect)
- [ ] Circuit breaker closes after successful operations
- [ ] New OAuth flows succeed immediately
- [ ] No manual intervention required
- [ ] Logs show reconnection events

**Manual Verification**:
```bash
# Check Redis connection
redis-cli ping

# Check backend logs
kubectl logs -n staging -l app=backend --tail=50 | grep -i redis

# Test OAuth flow
curl -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test"
```


---

## 5. Security Validation

### 5.1 Replay Attack Prevention

**Test**: Attempt to consume the same state twice

**Script**:
```bash
# Create state
STATE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test")

STATE=$(echo $STATE_RESPONSE | jq -r '.state')

# First consumption (should succeed)
curl -s "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE"

# Second consumption (should fail - replay attack)
curl -s "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE"
```

**Expected Result**:
- First attempt: 302 redirect (success)
- Second attempt: 400 Bad Request with error "Invalid or expired state"
- Audit log: Contains "OAUTH_REPLAY_ATTEMPT" event
- Redis: State key deleted after first consumption (GETDEL atomic operation)

### 5.2 Expired State Prevention

**Test**: Wait for state to expire (10 minutes)

**Script**:
```bash
# Create state
STATE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test")

STATE=$(echo $STATE_RESPONSE | jq -r '.state')

# Wait for expiration (or manually delete from Redis)
redis-cli DEL "oauth:state:$STATE"

# Attempt to consume expired state
curl -s "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE"
```

**Expected Result**:
- Response: 400 Bad Request with error "Invalid or expired state"
- Audit log: Contains "STATE_EXPIRED" or "STATE_INVALID" event
- No account created

### 5.3 IP Binding Validation

**Test**: Consume state from different IP address

**Script**:
```bash
# Create state from IP 1
STATE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test" \
  -H "X-Forwarded-For: 192.168.1.100")

STATE=$(echo $STATE_RESPONSE | jq -r '.state')

# Consume from IP 2 (should fail)
curl -s "http://localhost:5000/api/v1/oauth/twitter/callback?code=test&state=$STATE" \
  -H "X-Forwarded-For: 192.168.1.200"
```

**Expected Result**:
- Response: 400 Bad Request with error "IP address mismatch"
- Audit log: Contains "STATE_IP_MISMATCH" event
- Security alert triggered (if threshold exceeded)

**Note**: Instagram platform skips IP validation due to proxy issues (documented exception)

### 5.4 User-Agent Fingerprinting

**Test**: Verify User-Agent is stored and logged

**Script**:
```bash
# Create state with specific User-Agent
STATE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
  -H "Authorization: Bearer test-token" \
  -H "X-Workspace-ID: test" \
  -H "X-User-ID: test" \
  -H "User-Agent: Mozilla/5.0 (Test Browser)")

# Check Redis state data
STATE=$(echo $STATE_RESPONSE | jq -r '.state')
redis-cli GET "oauth:state:$STATE" | jq '.metadata.userAgent'
```

**Expected Result**:
- User-Agent stored in state metadata
- User-Agent logged in audit events
- User-Agent available for forensic analysis

### 5.5 State Entropy Validation

**Test**: Verify state has sufficient entropy (256-bit)

**Script**:
```bash
# Create 100 states
for i in {1..100}; do
  curl -s -X POST http://localhost:5000/api/v1/oauth/twitter/authorize \
    -H "Authorization: Bearer test-token" \
    -H "X-Workspace-ID: test" \
    -H "X-User-ID: test-$i" | jq -r '.state'
done | sort | uniq -d
```

**Expected Result**:
- No duplicate states (uniq -d returns empty)
- State length: 43 characters (base64url encoding of 32 bytes)
- State format: `[A-Za-z0-9_-]{43}`


---

## 6. Observability Checklist

### 6.1 Required Logs

**Authorization Endpoint** (`POST /api/v1/oauth/:platform/authorize`):
```json
{
  "level": "info",
  "message": "[OAuth] Authorization initiated",
  "platform": "twitter",
  "workspaceId": "workspace-123",
  "userId": "user-456",
  "state": "abc123...",
  "ipBound": true,
  "duration": 45
}
```

**Callback Endpoint** (`GET /api/v1/oauth/:platform/callback`):
```json
{
  "level": "info",
  "message": "[OAuth] Account created",
  "platform": "twitter",
  "workspaceId": "workspace-123",
  "accountId": "account-789",
  "providerUserId": "twitter-user-123",
  "username": "testuser",
  "connectionVersion": "v2",
  "duration": 1250
}
```

**State Consumption** (OAuthStateService):
```json
{
  "level": "debug",
  "message": "OAuth state consumed atomically",
  "state": "abc123...",
  "workspaceId": "workspace-123",
  "userId": "user-456",
  "platform": "twitter"
}
```

**Redis Errors**:
```json
{
  "level": "error",
  "message": "Redis unavailable for OAuth state storage - FAILING HARD",
  "state": "abc123...",
  "workspaceId": "workspace-123",
  "userId": "user-456",
  "platform": "twitter"
}
```

**Security Events**:
```json
{
  "level": "warn",
  "message": "[OAuth] Invalid or expired state",
  "platform": "twitter",
  "state": "abc123...",
  "ipHash": "def456..."
}
```

### 6.2 Required Metrics

**Prometheus Metrics** (to be implemented in Phase 3):
- `oauth_authorization_requests_total{platform, status}` - Counter
- `oauth_callback_requests_total{platform, status}` - Counter
- `oauth_state_operations_total{operation, status}` - Counter (create, consume, delete)
- `oauth_flow_duration_seconds{platform}` - Histogram
- `redis_operations_total{operation, status}` - Counter
- `redis_connection_errors_total` - Counter

**Current Monitoring** (via logs):
- Count of "Authorization initiated" logs
- Count of "Account created" logs
- Count of "Invalid or expired state" logs
- Count of "Redis unavailable" errors
- Average duration from authorization to callback

### 6.3 Required Alerts

**Critical Alerts** (immediate action required):
- Redis unavailable for >1 minute
- OAuth success rate <95% over 5 minutes
- No successful OAuth flows in 10 minutes (if traffic expected)

**Warning Alerts** (investigate within 1 hour):
- OAuth success rate 95-99% over 15 minutes
- P99 latency >5 seconds
- Redis connection errors >10 per minute
- Replay attack attempts >100 per hour

**Info Alerts** (monitor):
- IP mismatch rate >5% (may indicate proxy issues)
- State expiration rate >10% (users taking too long)


---

## 7. Go / No-Go Criteria

### 7.1 Measurable Thresholds

**MUST PASS (Go Criteria)**:

| Metric | Threshold | Measurement Method |
|--------|-----------|-------------------|
| OAuth Success Rate | ≥99.9% | 500 flows, max 0-1 failures |
| State Creation Success | 100% | All creates must succeed |
| Atomic Consumption | 100% | No double-consumption |
| Cross-Instance Routing | ≥30% | Callbacks to different instance |
| P99 Latency | <2000ms | Authorization + callback |
| Redis Availability | 100% | No connection errors during test |
| Replay Attack Prevention | 100% | All replay attempts blocked |
| IP Binding (non-Instagram) | 100% | All IP mismatches blocked |
| State Entropy | 100% unique | No duplicate states in 1000 creates |

**SHOULD PASS (Warning Criteria)**:

| Metric | Threshold | Action if Failed |
|--------|-----------|------------------|
| P95 Latency | <1000ms | Investigate performance |
| Instance Load Balance | 25-40% each | Check load balancer config |
| Redis CPU | <80% | Consider Redis optimization |
| Redis Memory | <200MB | Normal for test load |

### 7.2 When to Proceed to P0-3

**✅ GO Decision** - Proceed to Phase 0 Task P0-3 (Idempotency Guard) when:

1. All MUST PASS criteria met
2. At least 2 of 4 SHOULD PASS criteria met
3. No critical errors in logs
4. Redis recovery validated
5. Security tests passed
6. Team consensus on readiness

**Example GO Scenario**:
```
✅ Success Rate: 99.98% (499/500)
✅ State Creation: 100% (500/500)
✅ Atomic Consumption: 100% (0 double-consumes)
✅ Cross-Instance: 35% (175/500)
✅ P99 Latency: 1450ms
✅ Redis Errors: 0
✅ Replay Prevention: 100%
✅ IP Binding: 100%
✅ State Entropy: 100% unique

Decision: GO - Ready for P0-3
```

### 7.3 When to Stop and Investigate

**❌ NO-GO Decision** - Stop and investigate when:

1. Any MUST PASS criterion failed
2. Success rate <99%
3. Double-consumption detected (atomic operation failure)
4. Redis connection errors during test
5. Replay attacks not prevented
6. State entropy issues (duplicates found)

**Example NO-GO Scenario**:
```
❌ Success Rate: 97.2% (486/500)
✅ State Creation: 100% (500/500)
❌ Atomic Consumption: 98% (10 double-consumes)
✅ Cross-Instance: 32% (160/500)
❌ P99 Latency: 3200ms
❌ Redis Errors: 15
✅ Replay Prevention: 100%
✅ IP Binding: 100%
✅ State Entropy: 100% unique

Decision: NO-GO - Critical issues detected
Actions Required:
1. Investigate atomic operation failures
2. Optimize latency (P99 >2000ms)
3. Fix Redis connection stability
4. Re-run validation after fixes
```

### 7.4 Investigation Checklist

When NO-GO decision is made:

**Atomic Operation Failures**:
- [ ] Verify Redis version ≥6.2.0 (GETDEL support)
- [ ] Check Lua script fallback is working
- [ ] Review Redis logs for errors
- [ ] Test GETDEL command manually
- [ ] Check for race conditions in code

**Performance Issues**:
- [ ] Check Redis CPU and memory
- [ ] Review backend pod resources
- [ ] Check network latency between pods and Redis
- [ ] Review slow query logs
- [ ] Profile backend code

**Redis Connection Issues**:
- [ ] Verify Redis is running and accessible
- [ ] Check connection pool configuration
- [ ] Review ioredis auto-reconnect settings
- [ ] Check network policies in Kubernetes
- [ ] Review Redis maxclients setting

**Security Issues**:
- [ ] Review IP extraction logic
- [ ] Check X-Forwarded-For header handling
- [ ] Verify state generation entropy
- [ ] Review atomic consumption implementation
- [ ] Check audit logging


---

## 8. Execution Workflow

### 8.1 Pre-Validation Checklist

Before running validation tests:

- [ ] Redis is running and accessible
- [ ] 2-3 backend instances are running
- [ ] Load balancer is configured (no sticky sessions)
- [ ] Test credentials are configured
- [ ] Monitoring is enabled
- [ ] Logs are being collected
- [ ] Team is available for observation

### 8.2 Validation Sequence

**Step 1: Environment Setup** (15 minutes)
```bash
# Start multi-instance environment
docker-compose -f docker-compose.multi-instance.yml up -d

# Verify all services are healthy
docker-compose ps

# Check Redis
redis-cli ping

# Check backend instances
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health

# Check load balancer
curl http://localhost:5000/health
```

**Step 2: Horizontal Scaling Test** (30 minutes)
```bash
# Run 500 OAuth flows with random routing
BACKEND_URL=http://localhost:5000 \
NUM_FLOWS=500 \
CONCURRENCY=50 \
node apps/backend/scripts/validate-horizontal-scaling.js

# Review results
# Expected: ≥99.9% success rate
```

**Step 3: Concurrency Stress Test** (20 minutes)
```bash
# Run 1000 concurrent operations
BACKEND_URL=http://localhost:5000 \
CONCURRENT_CREATES=1000 \
CONCURRENT_CONSUMES=1000 \
node apps/backend/load-tests/concurrency-stress-test.js

# Review Redis metrics
# Expected: CPU <80%, Memory <200MB
```

**Step 4: Redis Failure Simulation** (15 minutes)
```bash
# Test fail-closed behavior
./apps/backend/scripts/redis-failure-simulation.sh

# Expected: 503 errors when Redis down, recovery when Redis up
```

**Step 5: Security Validation** (20 minutes)
```bash
# Run security tests (included in horizontal scaling script)
# - Replay attack prevention
# - IP binding validation
# - State entropy check

# Manual verification
./apps/backend/scripts/security-validation.sh
```

**Step 6: Results Analysis** (30 minutes)
- Review all test outputs
- Check logs for errors
- Verify metrics
- Make Go/No-Go decision
- Document findings

### 8.3 Total Time Estimate

- Environment Setup: 15 minutes
- Test Execution: 85 minutes
- Results Analysis: 30 minutes
- **Total: ~2.5 hours**

### 8.4 Post-Validation Actions

**If GO**:
1. Document validation results
2. Mark Phase 0 Tasks P0-1 and P0-2 as validated
3. Proceed to Phase 0 Task P0-3 (Idempotency Guard)
4. Schedule Phase 0 checkpoint review

**If NO-GO**:
1. Document all failures
2. Create investigation tasks
3. Assign owners for each issue
4. Set target date for re-validation
5. Do NOT proceed to P0-3


---

## 9. Production Deployment Considerations

### 9.1 Kubernetes Production Setup

**Recommended Configuration**:
- Replicas: 3-5 backend pods
- Redis: Managed service (AWS ElastiCache, GCP Memorystore) or Redis Sentinel
- Load Balancer: Cloud provider LB with health checks
- Resource Limits: 1GB memory, 1 CPU per pod
- Auto-scaling: HPA based on CPU >70%

**Production Deployment YAML**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-production
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/backend:v1.0.0
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: host
        - name: REDIS_PORT
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: port
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

### 9.2 Redis Production Configuration

**Managed Redis (Recommended)**:
- AWS ElastiCache: cache.r6g.large (13.07 GB memory)
- GCP Memorystore: Standard tier, 5GB
- Azure Cache for Redis: Standard C1 (1GB)

**Self-Hosted Redis**:
```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
maxclients 10000
timeout 300
tcp-keepalive 60

# Persistence (optional for OAuth state)
save ""
appendonly no

# Security
requirepass your-strong-password
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### 9.3 Monitoring Setup

**Prometheus Metrics** (to be implemented in Phase 3):
```yaml
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-oauth-metrics
  namespace: production
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

**Grafana Dashboard** (key panels):
- OAuth success rate (last 5m, 1h, 24h)
- OAuth flow duration (P50, P95, P99)
- Redis operations per second
- Redis connection pool usage
- State creation/consumption rate
- Error rate by type

### 9.4 Alerting Rules

**PagerDuty/Opsgenie Integration**:
```yaml
# Prometheus AlertManager rules
groups:
- name: oauth_critical
  interval: 30s
  rules:
  - alert: OAuthSuccessRateLow
    expr: rate(oauth_success_total[5m]) / rate(oauth_total[5m]) < 0.95
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "OAuth success rate below 95%"
      description: "Success rate: {{ $value | humanizePercentage }}"

  - alert: RedisDown
    expr: up{job="redis"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Redis is down"
      description: "OAuth flows will fail"

  - alert: OAuthHighLatency
    expr: histogram_quantile(0.99, rate(oauth_duration_seconds_bucket[5m])) > 5
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "OAuth P99 latency above 5s"
      description: "P99: {{ $value }}s"
```

---

## 10. Validation Results Template

### 10.1 Results Document Structure

**File**: `PHASE_0_VALIDATION_RESULTS.md`

```markdown
# Phase 0 Validation Results

**Date**: YYYY-MM-DD  
**Environment**: Local/Staging/Production  
**Executed By**: [Name]  
**Duration**: [Time]

## Test Results

### 1. Horizontal Scaling Test
- Total Flows: 500
- Success: 499 (99.8%)
- Failed: 1 (0.2%)
- Cross-Instance: 175 (35%)
- P99 Latency: 1450ms
- **Result**: ✅ PASS

### 2. Concurrency Stress Test
- Concurrent Creates: 1000
- Create Success: 1000 (100%)
- Concurrent Consumes: 1000
- Consume Success: 999 (99.9%)
- Redis CPU: 65%
- Redis Memory: 145MB
- **Result**: ✅ PASS

### 3. Redis Failure Simulation
- Fail-Closed: ✅ Verified
- Recovery: ✅ Automatic
- **Result**: ✅ PASS

### 4. Security Validation
- Replay Prevention: ✅ 100%
- IP Binding: ✅ 100%
- State Entropy: ✅ No duplicates
- **Result**: ✅ PASS

## Go/No-Go Decision

**Decision**: ✅ GO

**Rationale**:
- All critical criteria met
- Success rate above threshold
- No security issues detected
- System handles concurrency well

## Next Steps

1. Proceed to Phase 0 Task P0-3 (Idempotency Guard)
2. Schedule Phase 0 checkpoint review
3. Document lessons learned

## Appendix

- Detailed logs: `validation-results/`
- Screenshots: [attach if applicable]
- Team sign-off: [names]
```

---

## 11. Conclusion

This validation plan provides comprehensive testing of the distributed OAuth state management system. By following this plan, you will:

1. **Prove horizontal scaling works** across multiple backend instances
2. **Validate atomic operations** prevent race conditions
3. **Confirm fail-closed behavior** protects against Redis failures
4. **Verify security controls** prevent replay attacks and session hijacking
5. **Establish performance baselines** for production monitoring

**Success Criteria Summary**:
- ✅ 99.9% success rate across 500+ flows
- ✅ Atomic state consumption (no double-consume)
- ✅ Cross-instance routing (≥30%)
- ✅ P99 latency <2000ms
- ✅ Fail-closed on Redis unavailable
- ✅ 100% replay attack prevention
- ✅ 100% IP binding enforcement

**Time Investment**: ~2.5 hours  
**Value**: Confidence in production readiness for 1M users

**After Validation**: Proceed to Phase 0 Task P0-3 (Idempotency Guard) with confidence that the distributed state management foundation is solid.

---

## Appendix A: Troubleshooting Guide

### A.1 Test Failures

**Symptom**: Success rate <99%  
**Diagnosis**:
```bash
# Check backend logs
kubectl logs -n staging -l app=backend --tail=100 | grep ERROR

# Check Redis logs
kubectl logs -n staging -l app=redis --tail=100

# Check network latency
kubectl exec -n staging backend-pod -- ping redis-service
```

**Symptom**: Double-consumption detected  
**Diagnosis**:
```bash
# Verify Redis version
redis-cli INFO server | grep redis_version

# Test GETDEL manually
redis-cli SET test:key "value"
redis-cli GETDEL test:key
redis-cli GET test:key  # Should return (nil)

# Check Lua script fallback
grep -A 10 "getdel" apps/backend/src/services/OAuthStateService.ts
```

**Symptom**: High latency  
**Diagnosis**:
```bash
# Check Redis latency
redis-cli --latency

# Check backend CPU/memory
kubectl top pods -n staging

# Check network
kubectl exec -n staging backend-pod -- curl -w "@curl-format.txt" http://redis-service:6379
```

### A.2 Environment Issues

**Symptom**: Load balancer not distributing evenly  
**Fix**:
```nginx
# Verify Nginx config
upstream backend {
    least_conn;  # or round_robin
    server backend-1:5001;
    server backend-2:5002;
    server backend-3:5003;
}
```

**Symptom**: Redis connection pool exhausted  
**Fix**:
```typescript
// Increase pool size in redis config
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  // Increase pool size
  maxConnections: 50,
});
```

---

**End of Validation Plan**
