# Automated Backup Verification System

## Overview

The Automated Backup Verification System ensures MongoDB backups are valid and restorable by performing periodic integrity checks and restore tests. The system is designed to be:

- **Non-blocking**: Never affects production database or main application
- **Production-safe**: Uses temporary databases for testing
- **Automated**: Runs on configurable schedule (default: every 12 hours)
- **Alert-integrated**: Sends alerts on backup failures
- **Timeout-protected**: Won't hang if restore takes too long

## Architecture

### Components

1. **BackupVerifier** (`src/services/backup/BackupVerifier.ts`)
   - Core verification logic
   - Finds latest backup file
   - Validates backup integrity
   - Performs safe restore test to temporary database
   - Verifies restored data
   - Cleans up temporary database

2. **BackupVerificationWorker** (`src/workers/BackupVerificationWorker.ts`)
   - Background worker that runs on schedule
   - Triggers verification periodically
   - Sends alerts on failure
   - Tracks metrics
   - Never blocks main system

## Verification Process

The system performs a comprehensive 5-step verification:

### Step 1: Find Latest Backup
- Scans backup directory for `mongodb_backup_*.tar.gz` files
- Sorts by modification time (newest first)
- Returns latest backup file path

### Step 2: Validate Backup File
- Checks file exists
- Verifies file is not empty
- Checks file size (must be > 1 KB)
- Validates tar.gz integrity using `tar -tzf`

### Step 3: Check Backup Age
- Calculates backup age from file modification time
- Warns if backup is older than threshold (default: 48 hours)
- Continues verification even if old

### Step 4: Perform Restore Test
- Extracts backup archive to temporary directory
- Creates temporary database with unique name: `backup_verify_<timestamp>`
- Runs `mongorestore` to temporary database
- Verifies collections were restored
- **SAFETY**: Never touches production database

### Step 5: Cleanup
- Drops temporary database
- Removes extracted files
- Logs verification result

## Configuration

### Environment Variables

```bash
# Enable/disable backup verification
BACKUP_VERIFY_ENABLED=false

# Path to backup directory
BACKUP_PATH=/backups/mongodb

# Verification interval (hours)
BACKUP_VERIFY_INTERVAL_HOURS=12

# Restore timeout (milliseconds)
BACKUP_VERIFY_TIMEOUT_MS=300000

# Temporary database prefix (SAFETY: only databases with this prefix can be dropped)
BACKUP_TEMP_DB_PREFIX=backup_verify_

# Maximum backup age before warning (hours)
BACKUP_MAX_AGE_HOURS=48
```

### Example Configurations

#### Development (Disabled)
```bash
BACKUP_VERIFY_ENABLED=false
```

#### Production (Every 12 hours)
```bash
BACKUP_VERIFY_ENABLED=true
BACKUP_PATH=/backups/mongodb
BACKUP_VERIFY_INTERVAL_HOURS=12
BACKUP_VERIFY_TIMEOUT_MS=300000
BACKUP_TEMP_DB_PREFIX=backup_verify_
BACKUP_MAX_AGE_HOURS=48
```

#### Production (Every 6 hours, faster timeout)
```bash
BACKUP_VERIFY_ENABLED=true
BACKUP_PATH=/backups/mongodb
BACKUP_VERIFY_INTERVAL_HOURS=6
BACKUP_VERIFY_TIMEOUT_MS=180000
BACKUP_TEMP_DB_PREFIX=backup_verify_
BACKUP_MAX_AGE_HOURS=24
```

## Alert Conditions

The system sends CRITICAL alerts for the following conditions:

### 1. No Backup Found
- **Condition**: No backup files in backup directory
- **Impact**: Backups may not be running
- **Action**: Check backup script, cron job, or backup service

### 2. Backup File Missing
- **Condition**: Expected backup file doesn't exist
- **Impact**: Backup may have been deleted
- **Action**: Check backup retention policy, disk space

### 3. Backup File Empty
- **Condition**: Backup file size is 0 bytes
- **Impact**: Backup failed to create properly
- **Action**: Check backup script logs, MongoDB connection

### 4. Backup File Too Small
- **Condition**: Backup file < 1 KB
- **Impact**: Backup is likely corrupted or incomplete
- **Action**: Check backup script, MongoDB data

### 5. Backup File Corrupted
- **Condition**: tar.gz integrity check fails
- **Impact**: Backup cannot be extracted
- **Action**: Re-run backup, check disk integrity

### 6. Backup Too Old
- **Condition**: Latest backup older than threshold
- **Impact**: Recent data not backed up
- **Action**: Check backup schedule, cron job

### 7. Restore Timeout
- **Condition**: Restore takes longer than timeout
- **Impact**: Backup may be too large or system too slow
- **Action**: Increase timeout, check system resources

### 8. Restore Failed
- **Condition**: mongorestore command fails
- **Impact**: Backup cannot be restored
- **Action**: Check backup format, MongoDB version compatibility

### 9. Restore Verification Failed
- **Condition**: Restore succeeds but no collections found
- **Impact**: Backup may be empty or corrupted
- **Action**: Check backup content, MongoDB data

## Safety Guarantees

### Production Database Protection

1. **Separate Connection**: Uses dedicated connection to temporary database
2. **Unique Database Name**: Temporary database has timestamp: `backup_verify_1234567890`
3. **Prefix Validation**: Only databases with `backup_verify_` prefix can be dropped
4. **No Production Writes**: Verification only reads from production URI, writes to temp DB

### Non-Blocking Operation

1. **Background Worker**: Runs in separate interval, doesn't block main thread
2. **Timeout Protection**: Restore operations have configurable timeout
3. **Error Handling**: All errors caught and logged, never crashes app
4. **Graceful Shutdown**: Worker stops cleanly during shutdown

### Cleanup Guarantees

1. **Always Cleanup**: Temporary database dropped even if verification fails
2. **File Cleanup**: Extracted files removed after verification
3. **Prefix Safety**: Cannot accidentally drop production database

## Integration

### Server Startup

The backup verification worker is automatically started in `server.ts` if:
1. `BACKUP_VERIFY_ENABLED=true`

```typescript
// Start backup verification worker if enabled
if (config.backup.verifyEnabled) {
  // Create alerting service (if enabled)
  let alertingService = null;
  if (config.alerting.enabled && redisConnected) {
    // ... create alerting service
  }
  
  // Create and start backup verification worker
  backupVerificationWorkerInstance = new BackupVerificationWorker(
    {
      enabled: config.backup.verifyEnabled,
      backupPath: config.backup.path,
      mongoUri: config.database.uri,
      intervalHours: config.backup.verifyIntervalHours,
      timeoutMs: config.backup.verifyTimeoutMs,
      tempDbPrefix: config.backup.tempDbPrefix,
      maxBackupAgeHours: config.backup.maxAgeHours,
    },
    alertingService
  );
  
  backupVerificationWorkerInstance.start();
  logger.info('💾 Backup verification worker started');
}
```

### Graceful Shutdown

The worker is properly stopped during graceful shutdown:

```typescript
// Stop backup verification worker
if (backupVerificationWorkerInstance) {
  logger.info('Stopping backup verification worker...');
  backupVerificationWorkerInstance.stop();
  logger.info('✅ Backup verification worker stopped');
}
```

## Verification Results

### Success Result
```json
{
  "success": true,
  "backupFile": "/backups/mongodb/mongodb_backup_20260217_103000.tar.gz",
  "backupSize": 52428800,
  "backupAge": 3600000,
  "collectionsRestored": 12,
  "tempDbName": "backup_verify_1708167000000",
  "verifiedAt": "2026-02-17T10:30:00.000Z",
  "duration": 45000
}
```

### Failure Result
```json
{
  "success": false,
  "backupFile": "/backups/mongodb/mongodb_backup_20260217_103000.tar.gz",
  "backupSize": 52428800,
  "backupAge": 3600000,
  "error": "Backup file is corrupted (tar integrity check failed)",
  "errorCode": "CORRUPTED_FILE",
  "verifiedAt": "2026-02-17T10:30:00.000Z",
  "duration": 5000
}
```

## Logs

### Successful Verification
```
[2026-02-17 10:30:00] INFO: Starting backup verification
[2026-02-17 10:30:00] INFO: Found backup file { backupFile: '/backups/mongodb/mongodb_backup_20260217_103000.tar.gz' }
[2026-02-17 10:30:00] INFO: Starting restore test { backupFile: '...', tempDbName: 'backup_verify_1708167000000' }
[2026-02-17 10:30:45] INFO: Backup verification successful { backupFile: '...', backupSize: 52428800, collectionsRestored: 12, duration: 45000 }
```

### Failed Verification
```
[2026-02-17 10:30:00] INFO: Starting backup verification
[2026-02-17 10:30:00] INFO: Found backup file { backupFile: '/backups/mongodb/mongodb_backup_20260217_103000.tar.gz' }
[2026-02-17 10:30:05] ERROR: Backup verification failed { error: 'Backup file is corrupted', errorCode: 'CORRUPTED_FILE', duration: 5000 }
[2026-02-17 10:30:05] ERROR: ALERT: Backup File Corrupted
```

## Testing

### Manual Verification
```bash
# Enable backup verification
BACKUP_VERIFY_ENABLED=true
BACKUP_PATH=/backups/mongodb

# Start server
npm run dev

# Watch logs for verification
tail -f logs/application-*.log | grep "backup verification"
```

### Force Verification (Programmatic)
```typescript
// In code or REPL
backupVerificationWorkerInstance.forceVerify();
```

### Test Scenarios

#### Test 1: No Backup Found
```bash
# Remove all backups
rm -rf /backups/mongodb/*.tar.gz

# Trigger verification
# Expected: Alert "No Backup Found"
```

#### Test 2: Corrupted Backup
```bash
# Create corrupted backup
echo "corrupted" > /backups/mongodb/mongodb_backup_test.tar.gz

# Trigger verification
# Expected: Alert "Backup File Corrupted"
```

#### Test 3: Old Backup
```bash
# Create old backup (modify timestamp)
touch -t 202601010000 /backups/mongodb/mongodb_backup_old.tar.gz

# Trigger verification
# Expected: Warning about backup age
```

## Troubleshooting

### Verification Not Running

1. **Check if enabled**
   ```bash
   echo $BACKUP_VERIFY_ENABLED
   # Should be "true"
   ```

2. **Check logs for startup**
   ```bash
   grep "Backup verification worker" logs/application-*.log
   # Should see "started" message
   ```

3. **Check backup path exists**
   ```bash
   ls -la $BACKUP_PATH
   # Should show backup directory
   ```

### Verification Failing

1. **Check backup files exist**
   ```bash
   ls -lh /backups/mongodb/mongodb_backup_*.tar.gz
   ```

2. **Check backup integrity manually**
   ```bash
   tar -tzf /backups/mongodb/mongodb_backup_*.tar.gz
   ```

3. **Check MongoDB connection**
   ```bash
   mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')"
   ```

4. **Check disk space**
   ```bash
   df -h /backups
   ```

### Restore Timeout

1. **Increase timeout**
   ```bash
   BACKUP_VERIFY_TIMEOUT_MS=600000  # 10 minutes
   ```

2. **Check system resources**
   ```bash
   top
   df -h
   ```

3. **Check backup size**
   ```bash
   du -h /backups/mongodb/mongodb_backup_*.tar.gz
   ```

### Temporary Database Not Cleaned Up

1. **List temporary databases**
   ```bash
   mongosh "$MONGODB_URI" --eval "db.adminCommand('listDatabases')" | grep backup_verify
   ```

2. **Manual cleanup**
   ```bash
   mongosh "$MONGODB_URI" --eval "db.getSiblingDB('backup_verify_1234567890').dropDatabase()"
   ```

## Production Recommendations

1. **Enable verification in production**
   ```bash
   BACKUP_VERIFY_ENABLED=true
   ```

2. **Set appropriate interval**
   - Every 12 hours for daily backups
   - Every 6 hours for critical systems
   - Every 24 hours for less critical systems

3. **Configure alerting**
   - Enable alerting system
   - Configure webhook for immediate notification
   - Set up on-call rotation for backup alerts

4. **Set appropriate timeout**
   - 5 minutes (300000ms) for small databases (< 1 GB)
   - 10 minutes (600000ms) for medium databases (1-10 GB)
   - 30 minutes (1800000ms) for large databases (> 10 GB)

5. **Monitor verification metrics**
   - Check logs for verification success/failure
   - Track verification duration trends
   - Alert if verification consistently fails

6. **Test restore procedure**
   - Periodically perform full restore to staging environment
   - Verify application works with restored data
   - Document restore procedure

## Metrics

The worker tracks the following metrics:

```typescript
{
  verification_success_total: 0,      // Total successful verifications
  verification_failed_total: 0,       // Total failed verifications
  last_verification_timestamp: 0,     // Timestamp of last verification
  last_verification_duration: 0,      // Duration of last verification (ms)
}
```

Access metrics:
```typescript
const status = backupVerificationWorkerInstance.getStatus();
console.log(status.metrics);
```

## Future Enhancements

Potential improvements for the backup verification system:

1. **Multiple Backup Locations**
   - Verify backups in multiple locations (local, S3, etc.)
   - Alert if any location missing backups

2. **Backup Comparison**
   - Compare multiple backups for consistency
   - Detect data corruption across backups

3. **Selective Restore**
   - Restore only specific collections for faster verification
   - Verify critical collections first

4. **Backup Metrics Dashboard**
   - Track backup size trends
   - Track verification duration trends
   - Alert on anomalies

5. **Automated Recovery**
   - Automatically trigger backup if verification fails
   - Retry failed backups

## Summary

The Automated Backup Verification System provides:

- ✅ Automated backup integrity verification
- ✅ Safe restore testing to temporary database
- ✅ Never touches production database
- ✅ Comprehensive alert conditions
- ✅ Non-blocking background operation
- ✅ Timeout protection
- ✅ Graceful shutdown integration
- ✅ Production-safe implementation

The system is ready for production use and can be enabled by setting `BACKUP_VERIFY_ENABLED=true` and configuring appropriate paths and intervals.
