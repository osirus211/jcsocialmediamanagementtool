# MongoDB Backup System - Setup Guide

## Quick Start (5 Minutes)

### 1. Install MongoDB Database Tools

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y mongodb-database-tools
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-database-tools
```

**Windows:**
Download from: https://www.mongodb.com/try/download/database-tools

Verify installation:
```bash
mongodump --version
```

### 2. Create Backup Directory

```bash
# Create directory
sudo mkdir -p /backups/mongodb

# Set permissions
sudo chown -R $USER:$USER /backups/mongodb
sudo chmod -R 755 /backups/mongodb
```

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
# Enable backups
BACKUP_ENABLED=true

# Schedule (2 AM daily)
BACKUP_SCHEDULE="0 2 * * *"

# Retention (14 days)
BACKUP_RETENTION_DAYS=14

# Local storage path
BACKUP_LOCAL_PATH=/backups/mongodb

# Enable compression
BACKUP_COMPRESSION_ENABLED=true

# Verify after backup
BACKUP_VERIFY_AFTER_BACKUP=true
```

### 4. Restart Application

```bash
npm run dev
# or
npm start
```

### 5. Verify Backup System

Check health endpoint:
```bash
curl http://localhost:5000/health
```

Look for backup status in response:
```json
{
  "checks": {
    "backup": {
      "status": "healthy",
      "message": "Backup system healthy"
    }
  }
}
```

## Advanced Setup

### S3 Storage (Recommended for Production)

#### 1. Install AWS CLI

```bash
# Ubuntu/Debian
sudo apt-get install awscli

# macOS
brew install awscli

# Verify
aws --version
```

#### 2. Configure AWS Credentials

```bash
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region: us-east-1
# Default output format: json
```

#### 3. Create S3 Bucket

```bash
aws s3 mb s3://my-mongodb-backups --region us-east-1
```

#### 4. Enable S3 in Environment

Add to `.env`:
```bash
BACKUP_S3_BUCKET=my-mongodb-backups
BACKUP_S3_REGION=us-east-1
BACKUP_S3_PREFIX=mongodb-backups
```

#### 5. Test S3 Upload

```bash
# Trigger manual backup
curl -X POST http://localhost:5000/api/v1/admin/backup/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check S3
aws s3 ls s3://my-mongodb-backups/mongodb-backups/
```

## Backup Schedule Configuration

The `BACKUP_SCHEDULE` uses cron format:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Common Schedules

```bash
# Daily at 2 AM
BACKUP_SCHEDULE="0 2 * * *"

# Every 6 hours
BACKUP_SCHEDULE="0 */6 * * *"

# Twice daily (2 AM and 2 PM)
BACKUP_SCHEDULE="0 2,14 * * *"

# Weekly on Sunday at midnight
BACKUP_SCHEDULE="0 0 * * 0"

# Weekdays at 3 AM
BACKUP_SCHEDULE="0 3 * * 1-5"

# Every hour
BACKUP_SCHEDULE="0 * * * *"
```

## Testing Backup System

### 1. Trigger Manual Backup

```bash
curl -X POST http://localhost:5000/api/v1/admin/backup/trigger \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. List Backups

```bash
curl http://localhost:5000/api/v1/admin/backup/list \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. Check Backup Files

```bash
ls -lh /backups/mongodb/
```

Expected output:
```
-rw-r--r-- 1 user user 125M Feb 24 02:00 mongodb-backup-2026-02-24T02-00-00-000Z.tar.gz
-rw-r--r-- 1 user user 124M Feb 23 02:00 mongodb-backup-2026-02-23T02-00-00-000Z.tar.gz
```

### 4. Test Restore (Safe Test)

```bash
# Extract backup
cd /backups/mongodb
tar -xzf mongodb-backup-2026-02-24T02-00-00-000Z.tar.gz

# Restore to test database
mongorestore --uri="mongodb://localhost:27017" \
  --db=test-restore \
  mongodb-backup-2026-02-24T02-00-00-000Z/social-media-scheduler/

# Verify
mongo test-restore --eval "db.posts.count()"

# Clean up
mongo test-restore --eval "db.dropDatabase()"
```

## Production Deployment Checklist

- [ ] MongoDB Database Tools installed
- [ ] Backup directory created with correct permissions
- [ ] Environment variables configured
- [ ] S3 bucket created (if using S3)
- [ ] AWS credentials configured (if using S3)
- [ ] Backup schedule set appropriately
- [ ] Retention policy configured
- [ ] Manual backup tested successfully
- [ ] Restore procedure tested
- [ ] Health check verified
- [ ] Monitoring alerts configured
- [ ] Backup logs monitored
- [ ] Disaster recovery plan documented
- [ ] Team trained on restore procedures

## Monitoring & Alerts

### Health Check Monitoring

Add to your monitoring system:

```bash
# Check backup health every 5 minutes
*/5 * * * * curl -s http://localhost:5000/health | jq '.checks.backup'
```

Alert if:
- `status` is "unhealthy"
- `lastBackupTime` is > 48 hours ago
- `lastBackupStatus` is "failed"

### Log Monitoring

Monitor these log patterns:

```bash
# Success
grep "MongoDB backup completed successfully" logs/combined.log

# Failures
grep "MongoDB backup failed" logs/error.log

# Cleanup
grep "Old backups cleaned up" logs/combined.log
```

### Disk Space Monitoring

```bash
# Check backup directory size
du -sh /backups/mongodb

# Alert if > 80% full
df -h /backups | awk '$5 > 80 {print "WARNING: Backup disk usage at " $5}'
```

## Troubleshooting

### Issue: "mongodump: command not found"

**Solution:**
```bash
# Install MongoDB Database Tools
sudo apt-get install mongodb-database-tools

# Verify
which mongodump
```

### Issue: "Permission denied" on backup directory

**Solution:**
```bash
sudo chown -R $USER:$USER /backups/mongodb
sudo chmod -R 755 /backups/mongodb
```

### Issue: Backup fails with "connection refused"

**Solution:**
Check MongoDB connection string in `.env`:
```bash
# Verify MongoDB is running
mongo --eval "db.adminCommand('ping')"

# Check MONGODB_URI
echo $MONGODB_URI
```

### Issue: S3 upload fails

**Solution:**
```bash
# Test AWS credentials
aws s3 ls

# Reconfigure if needed
aws configure

# Check bucket permissions
aws s3api get-bucket-acl --bucket my-mongodb-backups
```

### Issue: Backups taking too long

**Solutions:**
1. Schedule during low-traffic hours
2. Reduce backup frequency
3. Exclude unnecessary collections
4. Use faster storage (SSD)
5. Increase server resources

### Issue: Disk space running out

**Solutions:**
1. Reduce retention days: `BACKUP_RETENTION_DAYS=7`
2. Enable compression: `BACKUP_COMPRESSION_ENABLED=true`
3. Move to S3 storage
4. Increase disk size

## Security Best Practices

1. **Encrypt Backups**
   ```bash
   # Enable S3 encryption
   aws s3api put-bucket-encryption \
     --bucket my-mongodb-backups \
     --server-side-encryption-configuration \
     '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```

2. **Restrict Access**
   ```bash
   # Backup directory permissions
   chmod 700 /backups/mongodb
   
   # S3 bucket policy (restrict to specific IAM role)
   ```

3. **Audit Logging**
   ```bash
   # Enable S3 access logging
   aws s3api put-bucket-logging \
     --bucket my-mongodb-backups \
     --bucket-logging-status file://logging.json
   ```

4. **Regular Testing**
   - Test restore monthly
   - Document restore time
   - Verify data integrity

## Support

For issues:
1. Check logs: `logs/combined.log`
2. Review health: `GET /health`
3. Check documentation: `src/services/backup/README.md`
4. Contact DevOps team

## Next Steps

After setup:
1. ✅ Monitor first backup execution
2. ✅ Test restore procedure
3. ✅ Set up monitoring alerts
4. ✅ Document recovery procedures
5. ✅ Train team on restore process
6. ✅ Schedule monthly restore tests
