# Server Infrastructure Verification

## Overview

This document describes the server infrastructure verification implementation for **Task 3.1 STEP 1** of the email-password-login-security-fix spec.

## Components Verified

### 1. MongoDB Connectivity and Performance
- **Connection Test**: Verifies MongoDB connection using configured URI
- **Performance Check**: Measures response time for basic operations
- **Index Validation**: Checks for proper email indexes
- **Database Health**: Validates database state and configuration

### 2. Redis Connectivity and Memory Usage
- **Connection Test**: Verifies Redis connection with timeout handling
- **Memory Analysis**: Checks memory usage and configuration
- **Fallback Detection**: Identifies if Redis is falling back to memory store
- **Key Validation**: Ensures Redis is properly storing data

### 3. Backend API Health Checks
- **Health Endpoint**: Tests `/health` endpoint availability
- **Auth Status**: Validates `/api/auth/status` endpoint
- **Response Time**: Measures API response performance
- **Status Validation**: Ensures proper HTTP status codes

### 4. Frontend Application Availability
- **Accessibility Test**: Verifies frontend is reachable
- **Content Validation**: Checks for proper HTML/React content
- **Response Analysis**: Validates content type and structure
- **Performance Metrics**: Measures frontend load times

## Usage

### Command Line Execution

```bash
# Using npm script (recommended)
npm run verify:infrastructure

# Using shell script (Linux/Mac)
./verify-infrastructure.sh

# Using PowerShell script (Windows)
./verify-infrastructure.ps1

# Direct execution
tsx src/scripts/server-infrastructure-verification.ts
```

### Environment Configuration

The script uses the following environment variables:

```env
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/social-media-scheduler

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=

# API
API_URL=http://localhost:5000
BACKEND_URL=http://localhost:5000

# Frontend
FRONTEND_URL=http://localhost:5173
```

## Output Format

### Success Example
```
================================================================================
SERVER INFRASTRUCTURE VERIFICATION REPORT
================================================================================
Timestamp: 2026-03-15T13:57:43.971Z
Overall Status: PASS

Summary: 4/4 PASSED, 0 FAILED, 0 WARNINGS

1. ✅ MongoDB: PASS
   Message: Connected successfully (96.96ms)
   Response Time: 96.96ms
   Details: {
     "readyState": 1,
     "host": "127.0.0.1",
     "port": 27017,
     "database": "social-media-scheduler",
     "hasEmailIndex": true,
     "indexCount": 6
   }

2. ✅ Redis: PASS
   Message: Connected successfully (83.40ms)
   Response Time: 83.40ms
   Details: {
     "usedMemory": "2MB",
     "maxMemory": "0MB",
     "hasKeys": true,
     "isMemoryFallback": false,
     "keyspaceInfo": "db0:keys=11,expires=0,avg_ttl=0"
   }

3. ✅ Backend API: PASS
   Message: API endpoints responding (150.25ms)
   Response Time: 150.25ms
   Details: {
     "baseURL": "http://localhost:5000",
     "healthEndpoint": { "status": 200, "ok": true },
     "authEndpoint": { "status": 401, "ok": true }
   }

4. ✅ Frontend: PASS
   Message: Frontend accessible (200.15ms)
   Response Time: 200.15ms
   Details: {
     "url": "http://localhost:5173",
     "status": 200,
     "contentType": "text/html",
     "isHTML": true,
     "hasReactApp": true
   }

================================================================================

✅ All infrastructure components are operational and healthy!

================================================================================
```

### Failure Example
```
================================================================================
SERVER INFRASTRUCTURE VERIFICATION REPORT
================================================================================
Timestamp: 2026-03-15T13:57:43.971Z
Overall Status: FAIL

Summary: 2/4 PASSED, 2 FAILED, 0 WARNINGS

🚨 CRITICAL ISSUES FOUND:
- Backend API: API not accessible: Connection refused
- Frontend: Frontend not accessible: Connection refused

================================================================================
```

## Status Codes

- **PASS**: Component is fully operational
- **WARNING**: Component is operational but has issues
- **FAIL**: Component is not operational

## Exit Codes

- `0`: All checks passed or warnings only
- `1`: One or more critical failures detected

## Integration

### CI/CD Pipeline
```yaml
- name: Verify Infrastructure
  run: |
    cd apps/backend
    npm run verify:infrastructure
```

### Monitoring Integration
The script can be integrated with monitoring systems by parsing the JSON output or checking exit codes.

### Automated Testing
Use in automated test suites to ensure infrastructure readiness before running tests.

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MONGODB_URI configuration
   - Ensure MongoDB service is running
   - Verify network connectivity

2. **Redis Connection Failed**
   - Check REDIS_HOST and REDIS_PORT
   - Ensure Redis service is running
   - Verify authentication if password is set

3. **Backend API Not Accessible**
   - Check if backend server is running
   - Verify API_URL configuration
   - Check firewall/network settings

4. **Frontend Not Accessible**
   - Check if frontend dev server is running
   - Verify FRONTEND_URL configuration
   - Ensure build process completed successfully

### Performance Issues

- **Slow Response Times**: Check network latency and server load
- **Memory Warnings**: Monitor Redis memory usage and configuration
- **Database Performance**: Review MongoDB indexes and query patterns

## Security Considerations

- The script does not expose sensitive credentials in output
- Connection timeouts prevent hanging on unreachable services
- Error messages are sanitized to avoid information disclosure

## Maintenance

- Update timeout values based on infrastructure performance
- Add new components as the system grows
- Review and update health check endpoints
- Monitor script performance and optimize as needed

## Related Files

- `src/scripts/server-infrastructure-verification.ts` - Main verification script
- `verify-infrastructure.sh` - Shell wrapper script
- `verify-infrastructure.ps1` - PowerShell wrapper script
- `package.json` - npm script configuration
- `.env` - Environment configuration