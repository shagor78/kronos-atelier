# Troubleshooting & Operational Runbook

## 1. Health Check Diagnostic Failures

Run the production health check script to isolate subsystem status:
```bash
bash ./scripts/health-check.sh
```
- **Application : FAIL**: Verify the Node/Express process is running (`npm run dev` or `systemctl status kronos-ecommerce`).
- **Database : FAIL**: Run `bash ./scripts/restore.sh` to restore from `./database/backups/latest_backup.sqlite` and verify SQLite WAL integrity.
- **Disk / Memory : FAIL**: Run `bash ./scripts/cleanup.sh` to rotate old backup snapshots and clear temporary build caches.

## 2. Authentication or 403 Forbidden Errors

- Ensure requests to protected routes include the `Authorization: Bearer <accessToken>` header.
- Admin routes (`/api/v1/admin/*`) strictly require `ADMIN` or `SUPER_ADMIN` role claims inside the signed JWT. Check `/logs/application.log` or the Admin Security Logs tab for `FORBIDDEN_ACCESS_ATTEMPT` entries.

## 3. Restoring a Corrupted Database

```bash
bash ./scripts/restore.sh ./database/backups/latest_backup.sqlite
```
The script automatically saves a `pre_restore_safety.sqlite` copy and runs `PRAGMA integrity_check;` using Python `sqlite3` before completing.
