#!/bin/bash
# Redis Restore Script
# 
# This script restores a Redis backup from a specified file.
#
# Usage: ./scripts/restore-redis.sh <backup_file>
# Example: ./scripts/restore-redis.sh redis_backup_20240209_120000.rdb

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ Error: Backup file not specified"
    echo "Usage: ./scripts/restore-redis.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/redis/redis_backup_*.rdb 2>/dev/null || echo "No backups found"
    exit 1
fi

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

BACKUP_FILE="$1"
BACKUP_DIR="./backups/redis"

# Check if backup file exists
if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file not found: ${BACKUP_DIR}/${BACKUP_FILE}"
    exit 1
fi

echo "⚠️  WARNING: This will restore Redis from backup"
echo "Backup file: ${BACKUP_FILE}"
echo "⚠️  All current data in Redis will be lost!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo ""
echo "🔄 Starting Redis restore..."

# Stop Redis to safely replace dump file
echo "⏸️  Stopping Redis..."
docker stop sms-redis-prod

# Copy backup file to Redis data directory
echo "📤 Copying backup file..."
docker cp "${BACKUP_DIR}/${BACKUP_FILE}" sms-redis-prod:/data/dump.rdb

# Start Redis
echo "▶️  Starting Redis..."
docker start sms-redis-prod

# Wait for Redis to start
echo "⏳ Waiting for Redis to start..."
sleep 5

# Verify Redis is running
if docker exec sms-redis-prod redis-cli -a "${REDIS_PASSWORD}" PING > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Error: Redis failed to start"
    exit 1
fi

# Get database size
DBSIZE=$(docker exec sms-redis-prod redis-cli -a "${REDIS_PASSWORD}" DBSIZE)
echo "📊 Database size: ${DBSIZE} keys"

echo ""
echo "✅ Redis restored successfully from ${BACKUP_FILE}"
