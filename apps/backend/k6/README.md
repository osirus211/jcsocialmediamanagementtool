# k6 Load Testing Suite

This directory contains a comprehensive load testing suite using [k6](https://k6.io/) for performance testing the social media management API.

## 📋 Prerequisites

### Install k6

**Windows (using Chocolatey):**
```bash
choco install k6
```

**Windows (using Scoop):**
```bash
scoop install k6
```

**macOS (using Homebrew):**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Or download from:** https://k6.io/docs/getting-started/installation/

### Verify Installation
```bash
k6 version
```

## 🔧 Environment Setup

Create a `.env` file in the backend directory or set environment variables:

```bash
# Required
BASE_URL=http://localhost:5000
TEST_USER_EMAIL=loadtest@example.com
TEST_USER_PASSWORD=LoadTest123!

# Optional
TEST_WORKSPACE_ID=your-workspace-id
TEST_API_KEY=your-api-key
OUTPUT_DIR=./k6/reports
DEBUG=false
VERBOSE=false
```

### Create Test User

Before running tests, create a test user account:

```bash
# Using the API directly
curl -X POST http://localhost:5000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "loadtest@example.com",
    "password": "LoadTest123!",
    "firstName": "Load",
    "lastName": "Test",
    "workspaceName": "Load Test Workspace"
  }'
```

## 🚀 Running Tests

### Quick Start

```bash
# Navigate to backend directory
cd apps/backend

# Run smoke test (basic functionality)
npm run k6:smoke

# Run load test (normal traffic simulation)
npm run k6:load

# Run stress test (find breaking point)
npm run k6:stress

# Run spike test (sudden traffic burst)
npm run k6:spike
```

### Direct k6 Commands

```bash
# Smoke test
k6 run k6/scenarios/smoke-test.js

# Load test with custom environment
BASE_URL=https://api.yourapp.com k6 run k6/scenarios/load-test.js

# Stress test with output to file
k6 run --out json=k6/reports/stress-results.json k6/scenarios/stress-test.js

# API key test
k6 run k6/scenarios/api-key-test.js

# Spike test with custom VU count
MAX_VUS=200 k6 run k6/scenarios/spike-test.js
```

## 📊 Test Scenarios

### 1. Smoke Test (`smoke-test.js`)
- **Purpose**: Validate basic functionality works
- **Load**: 1 VU, 1 iteration
- **Duration**: ~2 minutes
- **Tests**: Health check, authentication, basic API endpoints
- **Thresholds**: <1% errors, <2s response time

### 2. Load Test (`load-test.js`)
- **Purpose**: Simulate normal production traffic
- **Load**: 50-200 VUs over 14 minutes
- **Scenarios**: 40% read, 20% create, 20% analytics, 10% media, 10% calendar
- **Thresholds**: <5% errors, P95 <3s, P99 <5s

### 3. Stress Test (`stress-test.js`)
- **Purpose**: Find system breaking point
- **Load**: 100-1000 VUs over 30 minutes
- **Focus**: Identify when error rate exceeds 10% or P99 exceeds 10s
- **Thresholds**: <10% errors, P95 <10s, P99 <15s

### 4. API Key Test (`api-key-test.js`)
- **Purpose**: Test public API v2 performance
- **Load**: 20 VUs for 3 minutes
- **Focus**: API key authentication, rate limiting, endpoint performance
- **Thresholds**: <2% errors, P95 <2s

### 5. Spike Test (`spike-test.js`)
- **Purpose**: Test sudden traffic burst handling
- **Load**: 10→500→10 VUs with rapid transitions
- **Focus**: System recovery after traffic spikes
- **Thresholds**: <15% errors during spike, system recovery validation

## 📈 Viewing Results

### Console Output
All tests provide real-time console output with:
- Request counts and error rates
- Response time percentiles
- Threshold pass/fail status
- Phase-specific metrics

### JSON Reports
```bash
# Generate detailed JSON report
k6 run --out json=results.json k6/scenarios/load-test.js

# View summary
cat results.json | jq '.metrics'
```

### HTML Reports
Some tests generate HTML reports automatically:
```bash
# Load test generates HTML summary
k6 run k6/scenarios/load-test.js
# Check k6/reports/load-test-summary.html
```

### Real-time Monitoring with Grafana

Set up InfluxDB + Grafana for real-time metrics:

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Run test with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 k6/scenarios/load-test.js

# Access Grafana at http://localhost:3000
# Default credentials: admin/admin
```

## 🎯 Understanding Thresholds

### Error Rate Thresholds
- **Smoke**: <1% errors (basic functionality must work)
- **Load**: <5% errors (acceptable for normal traffic)
- **Stress**: <10% errors (higher tolerance when finding limits)
- **Spike**: <15% errors (temporary degradation during spikes)

### Response Time Thresholds
- **P95**: 95% of requests complete within threshold
- **P99**: 99% of requests complete within threshold
- **Average**: Mean response time across all requests

### Custom Thresholds
```javascript
thresholds: {
  // Global thresholds
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<3000'],
  
  // Endpoint-specific thresholds
  'http_req_duration{endpoint:posts}': ['p(95)<1000'],
  'http_req_duration{operation:read}': ['p(95)<500'],
}
```

## 🔧 Configuration

### Environment Variables
- `BASE_URL`: API base URL (default: http://localhost:5000)
- `TEST_USER_EMAIL`: Test user email
- `TEST_USER_PASSWORD`: Test user password
- `MAX_VUS`: Maximum virtual users for stress tests
- `TEST_DURATION`: Override test duration
- `DEBUG`: Enable debug logging
- `OUTPUT_DIR`: Results output directory

### Test Data
Tests use predefined test data from `k6.config.js`:
- Sample post content
- Platform combinations
- User credentials
- Realistic usage patterns

### Rate Limiting
Tests respect and validate rate limiting:
- Monitor rate limit headers
- Test rate limit enforcement
- Validate rate limit recovery

## 🚨 Troubleshooting

### Common Issues

**Authentication Failures:**
```bash
# Verify test user exists
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"loadtest@example.com","password":"LoadTest123!"}'
```

**Connection Refused:**
```bash
# Check if API server is running
curl http://localhost:5000/api/v1/health
```

**High Error Rates:**
- Check server logs for errors
- Verify database connectivity
- Monitor system resources (CPU, memory)
- Check rate limiting configuration

**Slow Response Times:**
- Monitor database query performance
- Check Redis connectivity
- Verify adequate server resources
- Review application logs

### Debug Mode
```bash
# Enable verbose logging
DEBUG=true VERBOSE=true k6 run k6/scenarios/load-test.js
```

### Resource Monitoring
Monitor system resources during tests:
```bash
# CPU and memory usage
top -p $(pgrep -f "node.*server")

# Database connections
# Check your database monitoring tools

# Redis connections
redis-cli info clients
```

## 📋 Best Practices

### Before Running Tests
1. Ensure test environment is isolated
2. Create dedicated test user accounts
3. Verify baseline system performance
4. Check system resource availability
5. Review rate limiting configuration

### During Tests
1. Monitor system resources
2. Watch for error patterns
3. Check database performance
4. Monitor external service calls
5. Validate rate limiting behavior

### After Tests
1. Analyze results thoroughly
2. Compare against previous runs
3. Identify performance bottlenecks
4. Document findings
5. Plan optimization efforts

### Test Data Management
- Use realistic test data
- Clean up test data after runs
- Avoid impacting production data
- Use separate test databases

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Load Tests
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run smoke test
        run: k6 run apps/backend/k6/scenarios/smoke-test.js
        env:
          BASE_URL: ${{ secrets.TEST_BASE_URL }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

## 📚 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://github.com/grafana/k6/tree/master/examples)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/performance-testing-best-practices/)
- [k6 Thresholds Guide](https://k6.io/docs/using-k6/thresholds/)
- [Grafana k6 Dashboard](https://grafana.com/grafana/dashboards/2587)

## 🤝 Contributing

When adding new test scenarios:
1. Follow existing naming conventions
2. Include appropriate thresholds
3. Add comprehensive documentation
4. Test with various load levels
5. Update this README

## 📄 License

This load testing suite is part of the social media management platform and follows the same license terms.