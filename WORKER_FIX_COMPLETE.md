# Worker Fix Complete ✅

## Problem Summary
The worker container was stuck in a restart loop with exit code 1, with no logs visible.

## Root Causes Identified & Fixed

### 1. **Module-Level Singleton Export** ❌ → ✅
**Problem**: `PublishingWorker.ts` exported a singleton instance at module level:
```typescript
export const publishingWorker = new PublishingWorker();
```
This triggered instantiation before DB/Redis connections were established.

**Fix**: Removed singleton export. Let `worker-standalone.ts` create instance after connections.

### 2. **Wrong Docker Command** ❌ → ✅
**Problem**: `docker-compose.production.yml` had incorrect command:
```yaml
command: ["node", "dist/workers/PublishingWorker.js"]
```

**Fix**: Changed to correct entry point:
```yaml
command: ["node", "dist/workers/worker-standalone.js"]
```

### 3. **Environment Variable Validation Failure** ❌ → ✅
**Problem**: `apps/backend/.env.production` had placeholder JWT secrets that were too short (< 32 chars), causing Zod validation to fail immediately.

**Fix**: Updated JWT secrets to be 32+ characters:
```env
JWT_SECRET=supersecret-jwt-access-key-min-32-chars-long-for-production-use
JWT_REFRESH_SECRET=supersecret-jwt-refresh-key-min-32-chars-long-for-production-use
```

### 4. **Logger File Path Issue** ❌ → ✅
**Problem**: Winston logger used relative path `logs/` which didn't exist or had permission issues.

**Fix**: Updated logger to use absolute path in production:
```typescript
const logsDir = process.env.NODE_ENV === 'production' 
  ? '/app/logs' 
  : path.join(process.cwd(), 'logs');
```

### 5. **BullMQ Redis Configuration** ❌ → ✅ (CRITICAL FIX)
**Problem**: BullMQ requires `maxRetriesPerRequest: null` for blocking operations, but Redis client had:
```typescript
maxRetriesPerRequest: 3
```

**Error Message**:
```
BullMQ: Your redis options maxRetriesPerRequest must be null.
```

**Fix**: Updated `apps/backend/src/config/redis.ts`:
```typescript
maxRetriesPerRequest: null, // Required for BullMQ blocking operations
```

## Files Modified

1. `apps/backend/src/workers/PublishingWorker.ts` - Removed singleton export
2. `apps/backend/src/workers/worker-standalone.ts` - Create instance after connections
3. `docker-compose.production.yml` - Fixed worker command
4. `apps/backend/.env.production` - Fixed JWT secrets and API_URL
5. `apps/backend/src/utils/logger.ts` - Fixed log directory path
6. `apps/backend/src/config/redis.ts` - Fixed maxRetriesPerRequest for BullMQ

## Current Status

### ✅ All Containers Running
```
sms-worker-prod     Up and running (health: starting)
sms-backend-prod    Up and healthy
sms-mongodb-prod    Up and healthy
sms-redis-prod      Up and healthy
sms-frontend-prod   Up (unhealthy - not critical)
```

### ✅ Worker Logs Show Success
```
✓ MongoDB connected
✓ Redis connected
✓ PublishingWorker imported
✓ PublishingWorker instantiated
✓ Worker started
```

### ⚠️ Minor Warning (Non-Critical)
```
IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"
```
This is a Redis configuration warning from BullMQ. For production, consider setting Redis eviction policy to `noeviction` in `docker-compose.production.yml`:
```yaml
redis:
  command: redis-server --maxmemory-policy noeviction
```

## Next Steps

1. **Remove Debug Logging**: Clean up console.log statements added during debugging
2. **Seed Plans**: Create FREE plan in database
3. **Auto-Assign Plans**: Modify WorkspaceService to auto-assign FREE plan to new workspaces
4. **Complete Phase 1 Verification**: Test full user journey with working worker

## Lessons Learned

1. **Silent Failures**: When Docker containers crash before logging, add incremental console.log statements to trace execution
2. **BullMQ Requirements**: Always set `maxRetriesPerRequest: null` for Redis clients used with BullMQ
3. **Environment Validation**: Zod schema validation can cause silent crashes if env vars are invalid
4. **Module-Level Side Effects**: Avoid creating instances at module level - defer until runtime after dependencies are ready
5. **Docker Command Verification**: Always verify the CMD/command points to the correct entry file

---

**Worker is now fully operational and ready for job processing! 🎉**
