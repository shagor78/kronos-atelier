#!/usr/bin/env bash
# ============================================================================
# KRONOS ATELIER — SAFE WORKSPACE & ARTIFACT CLEANUP SCRIPT
# ============================================================================

set -euo pipefail

BACKUP_DIR="${DB_BACKUP_DIR:-./database/backups}"
RETENTION_COUNT="${RETENTION_COUNT:-5}"

echo "[CLEANUP] Cleaning temporary build caches and rotating old backups..."

rm -rf ./backend/__pycache__ ./backend/src/__pycache__ ./backend/tests/__pycache__ .pytest_cache

if [ -d "${BACKUP_DIR}" ]; then
  # Retain the most recent backups and remove older timestamped snapshots safely
  ls -1t "${BACKUP_DIR}"/ecommerce_backup_*.sqlite 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)) | xargs -r rm -f
fi

echo "[CLEANUP] Workspace cleanup completed safely."
exit 0
