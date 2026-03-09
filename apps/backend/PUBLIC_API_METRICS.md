# Public API Metrics Documentation

## Overview

The Public API Layer includes comprehensive Prometheus-compatible metrics for monitoring API key usage, performance, and security events.

## Metrics Exposed

### Request Counters

#### `public_api_requests_total`
- **Type**: Counter
- **Description**: Total number of Public API requests
- **Labels**: endpoint, method, workspace_id, api_key_id
- **Usage**: Track overall API usage

#### `public_api_errors_total`
- **Type**: Counter
- **Description**: Total number of Public API errors (4xx and 5xx responses)
- **Labels**: endpoint, api_key_id
- **Usage**: Monitor error rates per endpoint and API key

### Security Metrics

#### `public_api_auth_failures`
- **Type**: Counter
- **Description**: Total number of authentication failures
- **Reasons tracked**:
  - Invalid API key
  - Revoked API key
  - Expired API key
  - IP not allowlisted
- **Usage**: Detect potential security threats or misconfigurations

#### `public_api_scope_denials`
- **Type**: Counter
- **Description**: Total number of scope permission denials
- **Usage**: Identify API keys attempting unauthorized operations

#### `public_api_rate_limit_hits`
- **Type**: Counter
- **Description**: Total number of rate limit violations
- **Usage**: Monitor API key usage patterns and potential abuse

### Performance Metrics

#### `public_api_latency_avg_ms`
- **Type**: Gauge
- **Description**: Average request latency in milliseconds
- **Granularity**: Overall and per-endpoint
- **Usage**: Monitor API performance and identify slow endpoints

## Prometheus Query Examples

### Request Rate by Endpoint
```promql
rate(public_api_requests_total[5m])
```

### Error Rate
```promql
rate(public_api_errors_total[5m]) / rate(public_api_requests_total[5m])
```

### Authentication Failure Rate
```promql
rate(public_api_auth_failures[5m])
```

### Top API Keys by Request Count
```promql
topk(10, sum by (api_key_id) (public_api_requests_total))
```

### Average Latency by Endpoint
```promql
public_api_latency_avg_ms
```

### Rate Limit Hit Rate
```promql
rate(public_api_rate_limit_hits[5m])
```

### Requests by Workspace
```promql
sum by (workspace_id) (rate(public_api_requests_total[5m]))
```

## Grafana Dashboard Queries

### Panel 1: Request Rate (Time Series)
```promql
sum(rate(public_api_requests_total[5m])) by (endpoint)
```

### Panel 2: Error Rate (Time Series)
```promql
sum(rate(public_api_errors_total[5m])) by (endpoint)
```

### Panel 3: Authentication Failures (Single Stat)
```promql
sum(increase(public_api_auth_failures[1h]))
```

### Panel 4: Average Latency (Gauge)
```promql
public_api_latency_avg_ms
```

### Panel 5: Top API Keys (Table)
```promql
topk(10, sum by (api_key_id) (increase(public_api_requests_total[24h])))
```

### Panel 6: Rate Limit Hits (Time Series)
```promql
rate(public_api_rate_limit_hits[5m])
```

### Panel 7: Scope Denials (Single Stat)
```promql
sum(increase(public_api_scope_denials[1h]))
```

### Panel 8: Requests by Method (Pie Chart)
```promql
sum by (method) (increase(public_api_requests_total[1h]))
```

### Panel 9: Requests by Status Code (Bar Chart)
```promql
sum by (status) (increase(public_api_requests_total[1h]))
```

### Panel 10: Slow Requests (Table)
Query: Show endpoints with latency > 1000ms
```promql
public_api_latency_avg_ms > 1000
```

## Alerting Rules

### High Error Rate
```yaml
- alert: PublicApiHighErrorRate
  expr: |
    rate(public_api_errors_total[5m]) / rate(public_api_requests_total[5m]) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Public API error rate above 5%"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

### Authentication Failures Spike
```yaml
- alert: PublicApiAuthFailureSpike
  expr: |
    rate(public_api_auth_failures[5m]) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High rate of authentication failures"
    description: "{{ $value }} auth failures per second"
```

### Rate Limit Abuse
```yaml
- alert: PublicApiRateLimitAbuse
  expr: |
    rate(public_api_rate_limit_hits[5m]) > 5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Frequent rate limit violations"
    description: "{{ $value }} rate limit hits per second"
```

### High Latency
```yaml
- alert: PublicApiHighLatency
  expr: |
    public_api_latency_avg_ms > 2000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Public API latency above 2 seconds"
    description: "Average latency is {{ $value }}ms"
```

## Example Prometheus Output

```
# HELP public_api_requests_total Total Public API requests
# TYPE public_api_requests_total counter
public_api_requests_total 15234

# HELP public_api_errors_total Total Public API errors (4xx and 5xx)
# TYPE public_api_errors_total counter
public_api_errors_total 127

# HELP public_api_rate_limit_hits Total Public API rate limit hits
# TYPE public_api_rate_limit_hits counter
public_api_rate_limit_hits 45

# HELP public_api_auth_failures Total Public API authentication failures
# TYPE public_api_auth_failures counter
public_api_auth_failures 23

# HELP public_api_scope_denials Total Public API scope permission denials
# TYPE public_api_scope_denials counter
public_api_scope_denials 8

# HELP public_api_latency_avg_ms Average Public API request latency in milliseconds
# TYPE public_api_latency_avg_ms gauge
public_api_latency_avg_ms 145.67
```

## Security Considerations

### What is NOT Exposed
- Raw API keys (NEVER logged or exposed in metrics)
- Sensitive request/response data
- User personal information

### What IS Exposed
- API key IDs (safe identifiers)
- Workspace IDs (tenant identifiers)
- Aggregated usage statistics
- Performance metrics
- Security event counts

## Integration with Existing Metrics

The Public API metrics extend the existing metrics infrastructure:
- Uses same Prometheus format
- Integrated with MetricsCollector
- Exposed on same `/metrics` endpoint
- Compatible with existing Grafana dashboards

## Accessing Metrics

### Endpoint
```
GET /metrics
```

### Example Request
```bash
curl http://localhost:3000/metrics
```

### Response Format
Prometheus text format (see example above)

## Monitoring Best Practices

1. **Set up alerts** for authentication failures and rate limit abuse
2. **Monitor error rates** per endpoint to identify problematic routes
3. **Track latency trends** to detect performance degradation
4. **Review top API keys** to identify heavy users
5. **Analyze scope denials** to detect misconfigured API keys
6. **Set up dashboards** for real-time visibility

## Troubleshooting

### Metrics not appearing
- Check that public API routes are being accessed
- Verify middleware is properly integrated in app.ts
- Check server.ts includes publicApiMetricsTracker in collector

### Incorrect counts
- Verify middleware order in app.ts
- Check that metrics are incremented in correct locations
- Review logs for errors in metrics collection

### High memory usage
- Metrics use Maps for per-endpoint/per-key tracking
- Consider implementing periodic cleanup for old entries
- Monitor Map sizes in production
