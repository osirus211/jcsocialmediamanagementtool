# RUNTIME_TRACE Diagnostic Instrumentation

## Overview
Safe, temporary diagnostic logging has been applied to the authentication system. All logs are prefixed with `RUNTIME_TRACE` for easy filtering and removal.

## What Was Modified

### Files with RUNTIME_TRACE Logs
1. **apps/backend/src/controllers/AuthController.ts**
   - REGISTER_START
   - REGISTER_COMPLETE
   - REGISTER_FAILED

2. **apps/backend/src/services/AuthService.ts**
   - USER_CREATING
   - USER_CREATED
   - WORKSPACE_CREATE_CHECK
   - REGISTER_FLOW_END
   - DUPLICATE_REGISTRATION_BLOCKED
   - LOGIN_START
   - LOGIN_SUCCESS
   - LOGIN_FAILED
   - REFRESH_START
   - TOKEN_ROTATED
   - REFRESH_SUCCESS
   - REFRESH_FAILED

3. **apps/backend/src/middleware/auth.ts**
   - INVALID_TOKEN_REJECTED

4. **apps/backend/src/middleware/tenant.ts**
   - TENANT_CHECK
   - TENANT_FAILED
   - TENANT_SUCCESS

## Safety Guarantees

✅ **No Logic Changes**
- Zero authentication logic modified
- No JWT behavior changed
- No database schema altered
- No API responses modified

✅ **No Sensitive Data**
- No passwords logged
- No tokens logged
- No cookies logged
- No secrets logged
- No request bodies logged

✅ **Removable**
- All logs searchable via "RUNTIME_TRACE"
- Simple removal via search/replace
- Instructions in REMOVE_RUNTIME_TRACE.txt

## Diagnostic Tools

### 1. auth-runtime-test.sh
Curl-based tests for:
- User registration
- Duplicate registration blocking
- Login
- Token refresh
- Invalid token rejection
- Protected routes
- Metrics endpoint

**Usage:**
```bash
cd apps/backend/diagnostics
chmod +x auth-runtime-test.sh
./auth-runtime-test.sh
```

### 2. mongo-auth-check.js
Read-only MongoDB verification:
- User count
- Recent user details
- Workspace auto-creation
- Duplicate user detection
- Refresh token storage

**Usage:**
```bash
cd apps/backend/diagnostics
node mongo-auth-check.js
```

### 3. redis-auth-check.txt
Safe Redis commands (SCAN only, never KEYS *):
- Keyspace info
- Database size
- Auth-related key patterns
- Session data
- Token blacklist

**Usage:**
```bash
# Copy commands from redis-auth-check.txt
redis-cli
# Paste commands one by one
```

### 4. metrics-auth-check.sh
Automated metrics verification:
- Baseline capture
- Auth operations
- Metrics comparison
- Pass/fail results

**Usage:**
```bash
cd apps/backend/diagnostics
chmod +x metrics-auth-check.sh
./metrics-auth-check.sh
```

### 5. AUTH_RUNTIME_CHECKLIST.txt
Complete verification checklist:
- Pre-flight checks
- Log verification per flow
- Metrics verification
- Redis verification
- MongoDB verification
- Security checks

## Log Format

All RUNTIME_TRACE logs include:
```typescript
logger.info('RUNTIME_TRACE <EVENT_NAME>', { timestamp: new Date().toISOString() });
```

Example output:
```
[2026-02-21T10:30:45.123Z] info: RUNTIME_TRACE REGISTER_START {"timestamp":"2026-02-21T10:30:45.123Z"}
[2026-02-21T10:30:45.234Z] info: RUNTIME_TRACE USER_CREATING {"timestamp":"2026-02-21T10:30:45.234Z"}
[2026-02-21T10:30:45.345Z] info: RUNTIME_TRACE USER_CREATED {"timestamp":"2026-02-21T10:30:45.345Z"}
```

## Viewing Logs

### Filter RUNTIME_TRACE logs
```bash
# Real-time monitoring
tail -f apps/backend/logs/application-*.log | grep RUNTIME_TRACE

# Search all logs
grep -r "RUNTIME_TRACE" apps/backend/logs/

# Count occurrences
grep -c "RUNTIME_TRACE" apps/backend/logs/application-*.log
```

### By Event Type
```bash
grep "RUNTIME_TRACE REGISTER_START" apps/backend/logs/application-*.log
grep "RUNTIME_TRACE LOGIN_SUCCESS" apps/backend/logs/application-*.log
grep "RUNTIME_TRACE TENANT_FAILED" apps/backend/logs/application-*.log
```

## Removal

See **REMOVE_RUNTIME_TRACE.txt** for complete removal instructions.

Quick removal:
```bash
cd apps/backend/src

# Remove all RUNTIME_TRACE lines
find . -name "*.ts" -exec sed -i '/RUNTIME_TRACE/d' {} \;

# Rebuild
npm run build
```

## Verification Workflow

1. **Start Backend**
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Run Tests**
   ```bash
   cd diagnostics
   ./auth-runtime-test.sh
   ```

3. **Check Logs**
   ```bash
   tail -f ../logs/application-*.log | grep RUNTIME_TRACE
   ```

4. **Verify Database**
   ```bash
   node mongo-auth-check.js
   ```

5. **Check Metrics**
   ```bash
   ./metrics-auth-check.sh
   ```

6. **Review Checklist**
   - Open AUTH_RUNTIME_CHECKLIST.txt
   - Verify each item

## Expected Flow Traces

### Registration
```
RUNTIME_TRACE REGISTER_START
RUNTIME_TRACE USER_CREATING
RUNTIME_TRACE USER_CREATED
RUNTIME_TRACE WORKSPACE_CREATE_CHECK
RUNTIME_TRACE REGISTER_FLOW_END
RUNTIME_TRACE REGISTER_COMPLETE
```

### Login
```
RUNTIME_TRACE LOGIN_START
RUNTIME_TRACE LOGIN_SUCCESS
```

### Token Refresh
```
RUNTIME_TRACE REFRESH_START
RUNTIME_TRACE TOKEN_ROTATED
RUNTIME_TRACE REFRESH_SUCCESS
```

### Tenant Access
```
RUNTIME_TRACE TENANT_CHECK
RUNTIME_TRACE TENANT_SUCCESS
```

## Troubleshooting

### No RUNTIME_TRACE logs appearing
- Check log level (should be 'info' or lower)
- Verify logger is configured
- Check log file location
- Ensure backend is running

### Compilation errors
- Pre-existing TypeScript issues in codebase
- RUNTIME_TRACE logs are syntactically correct
- Run: `npm run build` to see all errors
- RUNTIME_TRACE changes don't introduce new errors

### Tests failing
- Check MongoDB connection
- Check Redis connection
- Verify environment variables
- Check port availability (5000)

## Production Notes

⚠️ **This is diagnostic instrumentation**
- Intended for development/staging only
- Remove before production deployment
- Adds minimal overhead (timestamp logging)
- No performance impact on auth logic

## Support

For issues or questions:
1. Check AUTH_RUNTIME_CHECKLIST.txt
2. Review REMOVE_RUNTIME_TRACE.txt
3. Verify pre-existing compilation errors
4. Check backend logs for errors

## Summary

✅ RUNTIME_TRACE instrumentation applied successfully
✅ 15+ diagnostic log points inserted
✅ 6 diagnostic tools created
✅ Complete removal instructions provided
✅ No authentication logic modified
✅ No sensitive data logged
✅ Safe for runtime verification
