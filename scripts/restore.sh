#!/usr/bin/env bash
# ============================================================================
# KRONOS ATELIER — DATABASE RESTORE AUTOMATION SCRIPT
# Restores database from a verified backup snapshot safely.
# ============================================================================

set -euo pipefail

DB_TARGET="${DATABASE_URL:-./database/ecommerce.sqlite}"
BACKUP_DIR="${DB_BACKUP_DIR:-./database/backups}"
SOURCE_BACKUP="${1:-${BACKUP_DIR}/latest_backup.sqlite}"

echo "[RESTORE] Validating backup snapshot: ${SOURCE_BACKUP}"

if [ ! -f "${SOURCE_BACKUP}" ] || [ ! -s "${SOURCE_BACKUP}" ]; then
  echo "[RESTORE] ERROR: Backup file ${SOURCE_BACKUP} does not exist or is empty." >&2
  exit 1
fi

mkdir -p "$(dirname "${DB_TARGET}")"

# Create pre-restore safety snapshot if target exists
if [ -f "${DB_TARGET}" ]; then
  cp "${DB_TARGET}" "${BACKUP_DIR}/pre_restore_safety.sqlite"
fi

cp "${SOURCE_BACKUP}" "${DB_TARGET}"

# Verify restored SQLite database integrity via Python sqlite3
python3 -c "
import sqlite3, sys
conn = sqlite3.connect('${DB_TARGET}')
res = conn.execute('PRAGMA integrity_check;').fetchone()
conn.close()
if not res or res[0] != 'ok':
    sys.exit(1)
"

echo "[RESTORE] SUCCESS: Database restored and passed PRAGMA integrity_check."
exit 0
