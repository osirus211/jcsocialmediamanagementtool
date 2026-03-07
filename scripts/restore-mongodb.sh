#!/bin/bash
# MongoDB Restore Script
# 
# This script restores a MongoDB backup from a specified file.
#
# Usage: ./scripts/restore-mongodb.sh <backup_file>
# Example: ./scripts/restore-mongodb.sh mongodb_backup_20240209_120000.tar.gz

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ Error: Backup file not specified"
    echo "Usage: ./scripts/restore-mongodb.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/mongodb/mongodb_backup_*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

BACKUP_FILE="$1"
BACKUP_DIR="./backups/mongodb"
RESTORE_DIR="${BACKUP_DIR}/restore_temp"

# Check if backup file exists
if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file not found: ${BACKUP_DIR}/${BACKUP_FILE}"
    exit 1
fi

echo "⚠️  WARNING: This will restore the database from backup"
echo "Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo ""
echo "🔄 Starting MongoDB restore..."

# Create temporary restore directory
mkdir -p "${RESTORE_DIR}"

# Extract backup
echo "📦 Extracting backup..."
tar -xzf "${BACKUP_DIR}/${BACKUP_FILE}" -C "${RESTORE_DIR}"

# Find the extracted directory
EXTRACTED_DIR=$(find "${RESTORE_DIR}" -maxdepth 1 -type d -name "mongodb_backup_*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "❌ Error: Could not find extracted backup directory"
    rm -rf "${RESTORE_DIR}"
    exit 1
fi

# Copy to container
echo "📤 Copying backup to container..."
docker cp "${EXTRACTED_DIR}" sms-mongodb-prod:/backups/restore

# Run mongorestore
echo "🔄 Restoring database..."
docker exec sms-mongodb-prod mongorestore \
    --username="${MONGO_ROOT_USERNAME}" \
    --password="${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase=admin \
    --db="${MONGO_DATABASE}" \
    --drop \
    "/backups/restore/${MONGO_DATABASE}"

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "${RESTORE_DIR}"
docker exec sms-mongodb-prod rm -rf /backups/restore

echo ""
echo "✅ Database restored successfully from ${BACKUP_FILE}"
