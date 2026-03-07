#!/bin/bash
# MongoDB Backup Script
# 
# This script creates a backup of the MongoDB database
# and stores it with a timestamp.
#
# Usage: ./scripts/backup-mongodb.sh

set -e

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups/mongodb"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="mongodb_backup_${TIMESTAMP}"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "🔄 Starting MongoDB backup..."
echo "Timestamp: ${TIMESTAMP}"

# Run mongodump inside the container
docker exec sms-mongodb-prod mongodump \
    --username="${MONGO_ROOT_USERNAME}" \
    --password="${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase=admin \
    --db="${MONGO_DATABASE}" \
    --out="/backups/${BACKUP_NAME}"

# Compress the backup
echo "📦 Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"

# Calculate backup size
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
echo "✅ Backup completed: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Remove old backups (older than RETENTION_DAYS)
echo "🧹 Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "mongodb_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
echo ""
echo "📋 Current backups:"
ls -lh "${BACKUP_DIR}"/mongodb_backup_*.tar.gz 2>/dev/null || echo "No backups found"

echo ""
echo "✅ Backup process completed successfully"
