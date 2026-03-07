# MongoDB Backup System

Automated MongoDB backup system with daily scheduling, configurable retention, and S3 support.

## Features

- ✅ Automated daily backups via cron
- ✅ Configurable retention policy (7-14 days)
- ✅ Local filesystem storage
- ✅ Optional S3 storage
- ✅ Backup compression (tar.gz)
- ✅ Backup verification
- ✅ Health check integration
- ✅ Non-blocking execution
- ✅ Comprehensive logging

## Configuration

Add these environment variables to your `.env` file:

```bash
# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"  # 2 AM daily (cron format)
BACKUP_RETENTION_DAYS=14
BACKUP_LOCAL_PATH=/backups/mongodb
BACKUP_COMPRESSION_ENABLED=true
BACKUP_VERIFY_AFTER_BACKUP=true

# Optional: S3 Storage
BACKUP_S3_BUCKET=my-backup-bucket
BACKUP_S3_REGION=us-east-1
BACKUP_S3_PREFIX=mongodb-backups
```

## Cron Schedule Examples

```bash
"0 2 * * *"      # Daily at 2 AM
"0 */6 * * *"    # Every 6 hours
"0 0 * * 0"      # Weekly on Sunday at midnight
"0 3 * * 1-5"    # Weekdays at 3 AM
```

## Prerequisites

### 1. Install mongodump

**Ubuntu/Debian:**
```bash
sudo apt-get install mongodb-database-tools
```

**macOS:**
```bash
brew install mongodb-database-tools
```

**Windows:**
Download from: https://www.mongodb.com/try/download/database-tools

### 2. Create Backup Directory

```bash
sudo mkdir -p /backups/mongodb
sudo chown -R $USER:$USER /backups/mongodb
```

### 3. (Optional) Configure AWS CLI for S3

```bash
aws configure
# Enter your AWS credentials
```

## Usage

### Automatic Backups

Backups run automatically based on the configured schedule. No manual intervention required.

### Manual Backup

Trigger a manual backup via API:

```bash
POST /api/v1/admin/backup/trigger
Authorization: Bearer <token>
```

### List Backups

```bash
GET /api/v1/admin/backup/list
Authorization: Bearer <token>
```

### Check Backup Health

```bash
GET /health
```

Response includes backup status:
```json
{
  "status": "ok",
  "checks": {
    "backup": {
      "status": "healthy",
      "message": "Backup system healthy",
      "details": {
        "lastBackupTime": "2026-02-24T02:00:00.000Z",
        "lastBackupStatus": "success",
        "backupCount": 14,
        "totalSize": "1250.45 MB"
      }
    }
  }
}
```

## Backup File Structure

### Local Storage

```
/backups/mongodb/
├── mongodb-backup-2026-02-24T02-00-00-000Z.tar.gz
├── mongodb-backup-2026-02-23T02-00-00-000Z.tar.gz
├── mongodb-backup-2026-02-22T02-00-00-000Z.tar.gz
└── ...
```

### S3 Storage

```
s3://my-backup-bucket/mongodb-backups/
├── mongodb-backup-2026-02-24T02-00-00-000Z.tar.gz
├── mongodb-backup-2026-02-23T02-00-00-000Z.tar.gz
└── ...
```

## Restore Procedures

### 1. Restore from Local Backup

```bash
# Extract backup
cd /backups/mongodb
tar -xzf mongodb-backup-2026-02-24T02-00-00-000Z.tar.gz

# Restore to MongoDB
mongorestore --uri="mongodb://localhost:27017" \
  --drop \
  mongodb-backup-2026-02-24T02-00-00-000Z/
```

### 2. Restore from S3 Backup

```bash
# Download from S3
aws s3 cp s3://my-backup-bucket/mongodb-backups/mongodb-backup-2026-02-24T02-00-00-000Z.tar.gz .

# Extract
tar -xzf mongodb-backup-2026-02-24T02-00-00-000Z.tar.gz

# Restore
mongorestore --uri="mongodb://localhost:27017" \
  --drop \
  mongodb-backup-2026-02-24T02-00-00-000Z/
```

### 3. Restore Specific Database

```bash
mongorestore --uri="mongodb://localhost:27017" \
  --db=social-media-scheduler \
  --drop \
  mongodb-backup-2026-02-24T02-00-00-000Z/social-media-scheduler/
```

### 4. Restore Specific Collection

```bash
mongorestore --uri="mongodb://localhost:27017" \
  --db=social-media-scheduler \
  --collection=posts \
  mongodb-backup-2026-02-24T02-00-00-000Z/social-media-scheduler/posts.bson
```

## Monitoring

### Health Check Alerts

The backup system reports health status via `/health` endpoint:

- ✅ **Healthy**: Last backup within 48 hours, status=success
- ⚠️ **Degraded**: Last backup 48-72 hours ago
- ❌ **Unhealthy**: Last backup >72 hours ago or last backup failed

### Log Monitoring

Monitor backup logs:

```bash
# View backup logs
tail -f logs/combined.log | grep "MongoDB backup"

# Check for failures
grep "backup failed" logs/error.log
```

### Metrics

Key metrics to monitor:

- `backup.last_success_time` - Timestamp of last successful backup
- `backup.duration_seconds` - Time taken for backup
- `backup.size_bytes` - Size of backup file
- `backup.count` - Total number of backups
- `backup.failures_total` - Count of failed backups

## Troubleshooting

### Backup Fails with "mongodump: command not found"

**Solution**: Install MongoDB Database Tools

```bash
# Ubuntu/Debian
sudo apt-get install mongodb-database-tools

# macOS
brew install mongodb-database-tools
```

### Backup Fails with "Permission denied"

**Solution**: Fix directory permissions

```bash
sudo chown -R $USER:$USER /backups/mongodb
sudo chmod -R 755 /backups/mongodb
```

### S3 Upload Fails

**Solution**: Check AWS credentials

```bash
aws s3 ls s3://my-backup-bucket/
# If this fails, reconfigure AWS CLI
aws configure
```

### Backup Directory Full

**Solution**: Reduce retention days or increase disk space

```bash
# Check disk usage
df -h /backups

# Reduce retention
BACKUP_RETENTION_DAYS=7
```

### Backup Takes Too Long

**Solution**: Optimize backup process

1. Exclude unnecessary collections
2. Use compression
3. Schedule during low-traffic hours
4. Consider incremental backups (requires custom implementation)

## Security Best Practices

1. **Encrypt Backups**: Use S3 server-side encryption
2. **Restrict Access**: Limit backup directory permissions
3. **Secure Credentials**: Use IAM roles instead of access keys
4. **Audit Logs**: Monitor backup access logs
5. **Test Restores**: Regularly test restore procedures
6. **Off-site Storage**: Always use S3 or remote storage
7. **Retention Policy**: Balance storage costs with recovery needs

## Disaster Recovery Plan

### RTO (Recovery Time Objective): 4 hours
### RPO (Recovery Point Objective): 24 hours

### Recovery Steps:

1. **Identify Issue**: Determine data loss scope
2. **Select Backup**: Choose appropriate backup point
3. **Download Backup**: Retrieve from S3 if needed
4. **Verify Backup**: Check integrity before restore
5. **Stop Application**: Prevent new writes during restore
6. **Restore Database**: Execute mongorestore
7. **Verify Data**: Check critical collections
8. **Start Application**: Resume normal operations
9. **Monitor**: Watch for issues post-restore
10. **Document**: Record incident and lessons learned

## Testing Restore Procedures

**Monthly Test Schedule:**

```bash
# 1. Create test database
mongorestore --uri="mongodb://localhost:27017" \
  --db=test-restore \
  latest-backup/

# 2. Verify data integrity
mongo test-restore --eval "db.posts.count()"

# 3. Clean up
mongo test-restore --eval "db.dropDatabase()"
```

## Support

For issues or questions:
- Check logs: `logs/combined.log`
- Review health check: `GET /health`
- Contact DevOps team

## License

Internal use only - Social Media Scheduler Platform
