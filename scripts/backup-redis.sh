#!/bin/bash
# Redis Backup Script
# 
# This script creates a backup of the Redis database
# by triggering a BGSAVE and copying the dump file.
#
# Usage: ./scripts/backup-redis.sh

set -e

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="redis_backup_${TIMESTAMP}.rdb"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "🔄 Starting Redis backup..."
echo "Timestamp: ${TIMESTAMP}"

# Trigger Redis BGSAVE
echo "📸 Triggering Redis BGSAVE..."
docker exec sms-redis-prod redis-cli -a "${REDIS_PASSWORD}" BGSAVE

# Wait for BGSAVE to complete
echo "⏳ Waiting for BGSAVE to complete..."
sleep 5

while true; do
    LASTSAVE=$(docker exec sms-redis-prod redis-cli -a "${REDIS_PASSWORD}" LASTSAVE)
    BGSAVE_STATUS=$(docker exec sms-redis-prod redis-cli -a "${REDIS_PASSWORD}" INFO persistence | grep rdb_bgsave_in_progress | cut -d: -f2 | tr -d '\r')
    
    if [ "$BGSAVE_STATUS" = "0" ]; then
        echo "✅ BGSAVE completed"
        break
    fi
    
    echo "⏳ Still saving... (Last save: ${LASTSAVE})"
    sleep 2
done

# Copy the dump file
echo "📦 Copying dump file..."
docker cp sms-redis-prod:/data/dump.rdb "${BACKUP_DIR}/${BACKUP_NAME}"

# Calculate backup size
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1)
echo "✅ Backup completed: ${BACKUP_NAME} (${BACKUP_SIZE})"

# Remove old backups (older than RETENTION_DAYS)
echo "🧹 Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "redis_backup_*.rdb" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
echo ""
echo "📋 Current backups:"
ls -lh "${BACKUP_DIR}"/redis_backup_*.rdb 2>/dev/null || echo "No backups found"

echo ""
echo "✅ Backup process completed successfully"
