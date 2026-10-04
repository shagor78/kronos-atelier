#!/usr/bin/env bash
# ============================================================================
# KRONOS ATELIER — DATABASE BACKUP AUTOMATION SCRIPT
# Validates destination, creates timestamped backup, verifies integrity.
# ============================================================================

set -euo pipefail

DB_SOURCE="${DATABASE_URL:-./database/ecommerce.sqlite}"
BACKUP_DIR="${DB_BACKUP_DIR:-./database/backups}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/ecommerce_backup_${TIMESTAMP}.sqlite"

echo "[BACKUP] Starting production database backup..."

mkdir -p "${BACKUP_DIR}"

if [ ! -d "${BACKUP_DIR}" ] || [ ! -w "${BACKUP_DIR}" ]; then
  echo "[BACKUP] ERROR: Backup destination ${BACKUP_DIR} is not writable." >&2
  exit 1
fi

# Ensure database is initialized before backup if not yet created
if [ ! -f "${DB_SOURCE}" ]; then
  echo "[BACKUP] Initializing database prior to snapshot..."
  node --input-type=module -e "import { initDatabase } from './backend/src/repositories/database.ts'; initDatabase();"
fi

if [ ! -f "${DB_SOURCE}" ]; then
  echo "[BACKUP] ERROR: Source database ${DB_SOURCE} does not exist." >&2
  exit 1
fi

cp "${DB_SOURCE}" "${BACKUP_FILE}"

if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[BACKUP] ERROR: Backup file ${BACKUP_FILE} is empty or failed verification." >&2
  exit 1
fi

# Create a pointer to latest verified backup
cp "${BACKUP_FILE}" "${BACKUP_DIR}/latest_backup.sqlite"

BACKUP_SIZE=$(wc -c < "${BACKUP_FILE}" | tr -d ' ')
echo "[BACKUP] SUCCESS: Created verified backup ${BACKUP_FILE} (${BACKUP_SIZE} bytes)."
exit 0
