# Disaster Recovery & Business Continuity Plan

## 1. Recovery Objectives

- **RPO (Recovery Point Objective)**: < 15 minutes via automated pre-deployment and scheduled cron snapshots (`./scripts/backup.sh`).
- **RTO (Recovery Time Objective)**: < 2 minutes via automated one-command rollback (`./scripts/rollback.sh`).

## 2. Backup Verification Procedure

1. `./scripts/backup.sh` validates target directory permissions, snapshots the active SQLite database to `./database/backups/ecommerce_backup_<UTC_TIMESTAMP>.sqlite`, verifies non-zero byte length, and updates `./database/backups/latest_backup.sqlite`.
2. `./scripts/cleanup.sh` retains the 5 most recent verified snapshots to prevent disk exhaustion.

## 3. Automated Rollback Procedure

When a deployment or health check fails:
1. `./scripts/rollback.sh` invokes `./scripts/restore.sh` against `latest_backup.sqlite`.
2. Executes `PRAGMA integrity_check` to confirm relational consistency.
3. Re-runs `./scripts/health-check.sh` to confirm the restored service is `HEALTHY`.
4. Emits a formatted rollback alert notification (`Rollback: EXECUTED`).
