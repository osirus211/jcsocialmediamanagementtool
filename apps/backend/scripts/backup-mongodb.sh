#!/bin/bash

###############################################################################
# MongoDB Daily Backup Script
#
# Features:
# - mongodump with compression
# - gzip compression
# - Store in /backups directory
# - Keep last 7 days
# - Auto delete older backups
# - Health check logging
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/mongodb}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
MONGO_DB="${MONGO_DB:-social-scheduler}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="mongodb_backup_${DATE}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting MongoDB backup: $BACKUP_NAME"

# Check if mongodump is available
if ! command -v mongodump &> /dev/null; then
    log_error "mongodump command not found. Please install MongoDB tools."
    exit 1
fi

# Perform backup
log "Running mongodump..."
if mongodump \
    --uri="$MONGO_URI" \
    --db="$MONGO_DB" \
    --out="$BACKUP_DIR/$BACKUP_NAME" \
    --gzip \
    2>&1 | tee -a "$LOG_FILE"; then
    
    log_success "mongodump completed successfully"
else
    log_error "mongodump failed"
    exit 1
fi

# Create tarball
log "Creating compressed archive..."
cd "$BACKUP_DIR"
if tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Archive created: ${BACKUP_NAME}.tar.gz"
    
    # Remove uncompressed directory
    rm -rf "$BACKUP_NAME"
    log "Removed uncompressed backup directory"
else
    log_error "Failed to create archive"
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
log "Backup size: $BACKUP_SIZE"

# Verify backup integrity
log "Verifying backup integrity..."
if tar -tzf "${BACKUP_NAME}.tar.gz" > /dev/null 2>&1; then
    log_success "Backup integrity verified"
else
    log_error "Backup integrity check failed"
    exit 1
fi

# Clean old backups (keep last N days)
log "Cleaning old backups (keeping last $RETENTION_DAYS days)..."
DELETED_COUNT=0
find "$BACKUP_DIR" -name "mongodb_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS | while read -r old_backup; do
    log "Deleting old backup: $(basename "$old_backup")"
    rm -f "$old_backup"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

if [ $DELETED_COUNT -gt 0 ]; then
    log "Deleted $DELETED_COUNT old backup(s)"
else
    log "No old backups to delete"
fi

# List current backups
log "Current backups:"
ls -lh "$BACKUP_DIR"/mongodb_backup_*.tar.gz 2>/dev/null | tee -a "$LOG_FILE" || log "No backups found"

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Total backup directory size: $TOTAL_SIZE"

# Success summary
log_success "Backup completed successfully!"
log "Backup location: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
log "Backup size: $BACKUP_SIZE"
log "Retention: $RETENTION_DAYS days"

# Write success marker for health check
echo "SUCCESS $(date +%s)" > "$BACKUP_DIR/.last_backup_status"

exit 0
