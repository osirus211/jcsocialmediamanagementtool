# Prometheus Metrics Endpoint

## Overview

The `/metrics` endpoint exposes real-time system metrics in Prometheus-compatible text format for monitoring and alerting.

## Endpoint

```
GET /metrics
```

**Response Format**: `text/plain; version=0.0.4; charset=utf-8`

## Features

- ✅ Prometheus-compatible text format
- ✅ Non-blocking metric collection
- ✅ Never crashes (returns error metric on failure)
- ✅ Read-only access to existing metrics
- ✅ No modification of workers or services
- ✅ Production-safe
- ✅ Horizontally scalable

## Architecture

### Components

1. **MetricsCollector** (`src/services/metrics/MetricsCollector.ts`)
   - Aggregates metrics from all workers and services
   - Read-only access via `getStatus()` methods
   - Never throws errors (returns partial metrics on failure)

2. **MetricsService** (`src/services/metrics/MetricsService.ts`)
   - Formats metrics in Prometheus text format
   - Handles collection errors gracefully

3. **MetricsController** (`src/controllers/MetricsController.ts`)
   - Handles HTTP requests to `/metrics`
   - Returns error metric on failure (never crashes)

### Integration

The metrics system is integrated in `server.ts`:
- Instantiated after all workers/services start
- Passed references to workers via constructor
- Added as Express route: `app.get('/metrics', ...)`

## Exposed Metrics

### System Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `process_uptime_seconds` | gauge | Process uptime in seconds |
| `process_memory_usage_bytes` | gauge | Process memory usage in bytes (RSS) |
| `cpu_load_average` | gauge | CPU load average (1 minute) |

### Publishing Worker Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `worker_alive` | gauge | Publishing worker alive status (1=alive, 0=dead) |
| `publish_success_total` | counter | Total successful publishes |
| `publish_failed_total` | counter | Total failed publishes |
| `publish_retry_total` | counter | Total publish retries |
| `publish_skipped_total` | counter | Total skipped publishes |
| `active_jobs` | gauge | Number of active publishing jobs |

### Scheduler Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `scheduler_alive` | gauge | Scheduler alive status (1=alive, 0=dead) |

### Queue Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `queue_waiting_jobs` | gauge | Number of jobs waiting in queue |
| `queue_active_jobs` | gauge | Number of active jobs in queue |
| `queue_completed_jobs` | counter | Total completed jobs in queue |
| `queue_failed_jobs` | counter | Total failed jobs in queue |
| `queue_delayed_jobs` | gauge | Number of delayed jobs in queue |
| `queue_failure_rate` | gauge | Queue failure rate percentage |

### Token Refresh Worker Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `token_refresh_success_total` | counter | Total successful token refreshes |
| `token_refresh_failed_total` | counter | Total failed token refreshes |
| `token_refresh_retry_total` | counter | Total token refresh retries |
| `token_refresh_skipped_total` | counter | Total skipped token refreshes |

### Backup Verification Worker Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `backup_verify_success_total` | counter | Total successful backup verifications |
| `backup_verify_failed_total` | counter | Total failed backup verifications |
| `backup_verify_last_duration_seconds` | gauge | Duration of last backup verification in seconds |

### Alerting Metrics (Optional)

| Metric | Type | Description |
|--------|------|-------------|
| `alerts_total` | counter | Total alerts sent |
| `alerts_critical_total` | counter | Total critical alerts sent |
| `alerts_warning_total` | counter | Total warning alerts sent |

## Example Output

```
# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds 3600

# HELP process_memory_usage_bytes Process memory usage in bytes
# TYPE process_memory_usage_bytes gauge
process_memory_usage_bytes 134217728

# HELP cpu_load_average CPU load average (1 minute)
# TYPE cpu_load_average gauge
cpu_load_average 0.45

# HELP worker_alive Publishing worker alive status (1=alive, 0=dead)
# TYPE worker_alive gauge
worker_alive 1

# HELP publish_success_total Total successful publishes
# TYPE publish_success_total counter
publish_success_total 42

# HELP publish_failed_total Total failed publishes
# TYPE publish_failed_total counter
publish_failed_total 3

# HELP queue_waiting_jobs Number of jobs waiting in queue
# TYPE queue_waiting_jobs gauge
queue_waiting_jobs 5

# HELP queue_failure_rate Queue failure rate percentage
# TYPE queue_failure_rate gauge
queue_failure_rate 6.67
```

## Usage with Prometheus

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'social-media-scheduler'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Example Queries

**Worker Health**:
```promql
worker_alive == 0
```

**High Failure Rate**:
```promql
queue_failure_rate > 10
```

**Memory Usage**:
```promql
process_memory_usage_bytes / 1024 / 1024
```

**Publish Success Rate**:
```promql
rate(publish_success_total[5m])
```

**Token Refresh Failures**:
```promql
increase(token_refresh_failed_total[1h])
```

## Error Handling

If metric collection fails, the endpoint returns:

```
# HELP metrics_collection_error Metrics collection error (1=error, 0=ok)
# TYPE metrics_collection_error gauge
metrics_collection_error 1

# Error: <error message>
```

This ensures Prometheus can still scrape the endpoint and alert on collection failures.

## Safety Guarantees

1. **Non-Blocking**: Metric collection never blocks workers or services
2. **Read-Only**: Only reads metrics, never modifies worker state
3. **Never Crashes**: All errors caught and returned as error metrics
4. **Partial Metrics**: Returns available metrics even if some fail to collect
5. **No Dependencies**: Workers don't depend on metrics system
6. **Production-Safe**: Designed for high-traffic production environments

## Testing

### Manual Test

```bash
curl http://localhost:3000/metrics
```

### Health Check

```bash
curl http://localhost:3000/metrics | grep "worker_alive"
```

### Prometheus Validation

```bash
promtool check metrics < <(curl -s http://localhost:3000/metrics)
```

## Monitoring Recommendations

### Critical Alerts

1. **Worker Down**: `worker_alive == 0`
2. **Scheduler Down**: `scheduler_alive == 0`
3. **High Failure Rate**: `queue_failure_rate > 20`
4. **Token Refresh Failures**: `increase(token_refresh_failed_total[1h]) > 10`
5. **Backup Verification Failures**: `backup_verify_failed_total > 0`

### Warning Alerts

1. **Moderate Failure Rate**: `queue_failure_rate > 10`
2. **High Queue Depth**: `queue_waiting_jobs > 100`
3. **Memory Usage**: `process_memory_usage_bytes > 1GB`
4. **Token Refresh Retries**: `increase(token_refresh_retry_total[1h]) > 20`

## Implementation Notes

- Metrics are collected on-demand (not cached)
- Collection timeout: None (fast read-only operations)
- No authentication required (internal metrics)
- Compatible with Prometheus, Grafana, Datadog, etc.
- Works in multi-instance deployments (each instance exposes its own metrics)

## Files Created

1. `src/services/metrics/MetricsCollector.ts` - Aggregates metrics from workers
2. `src/services/metrics/MetricsService.ts` - Formats Prometheus text output
3. `src/controllers/MetricsController.ts` - HTTP endpoint handler
4. `src/server.ts` - Integration (metrics service instantiation)

## Verification

✅ TypeScript compiles without errors (no new errors introduced)
✅ No existing systems modified (read-only access)
✅ Production-safe (non-blocking, never crashes)
✅ Horizontally scalable (each instance exposes own metrics)
✅ Prometheus-compatible format
