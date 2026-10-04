# Kronos Atelier — Production Enterprise E-Commerce Platform

Kronos Atelier is a complete, production-grade full-stack e-commerce platform and DevOps engineering system built for luxury architectural lighting, reference studio audio, precision horology, and tactile hardware.

---

## 1. Project Overview & Core Features

- **Customer Storefront**: Editorial architectural design following strict visual hierarchy, dynamic search, category filtering, sorting, pagination, Contiguous Purchase Module (PDP), slide-over shopping bag, privilege promo codes (`ATELIER10`, `STUDIO15`, `KRONOS20`), wishlist archive, verified client evaluations, and multi-method checkout (`CARD`, `WIRE_TRANSFER`, `COD`).
- **Enterprise Admin Console**: Dedicated RBAC workspace for `ADMIN` and `SUPER_ADMIN` operators with live sales KPIs, inventory stock control, product & category CRUD, order status orchestration (`PENDING` → `CONFIRMED` → `PROCESSING` → `SHIPPED` → `DELIVERED` / `CANCELLED`), review moderation, user role management, real-time `/api/v1/health` telemetry, structured security audit logs, and multi-channel deployment notifications (`Telegram`, `Email`, `SMS`).
- **Strict Data Separation**: All database queries, cryptographic password hashing (`scrypt`), JWT signing (`HMAC-SHA256`), stock validation, and secrets reside strictly inside `/backend` and `/api`. The frontend communicates exclusively via `/api/v1/*` REST endpoints.
- **DevOps, Linux & Cloud Readiness**: Automated Bash scripts (`deploy.sh`, `health-check.sh`, `backup.sh`, `restore.sh`, `security-check.sh`, `rollback.sh`, `cleanup.sh`), multi-stage non-root `Dockerfile`, `docker-compose.yml`, Nginx TLS 1.2/1.3 reverse proxy, AWS EC2 Ubuntu systemd service, Terraform IaC, and GitHub Actions CI/CD pipelines.

---

## 2. Production Architecture

```text
Internet
   │
   ▼ HTTPS :443 (TLS 1.2 / 1.3)
[ Nginx Reverse Proxy ] (HSTS, CSP, Rate Limiting, Static Asset Cache)
   │
   ▼ HTTP :3000
[ Express / TypeScript REST API (/api/v1/*) + React 19 SPA ]
   │
   ├── /backend/src/security/crypto.ts      (scrypt KDF, HMAC-SHA256 JWT, XSS sanitizer)
   ├── /backend/src/middleware/auth.ts      (Authentication & RBAC: CUSTOMER, ADMIN, SUPER_ADMIN)
   ├── /backend/src/repositories/database.ts(Normalized SQLite WAL Database + Migrations + Seed)
   └── /backend/src/utils/logger.ts         (Structured JSON Audit Logger with Secret Redaction)
```

---

## 3. Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend & API**: Node.js 22, Express 4, TypeScript (`tsx`), OpenAPI 3.0.3
- **Database**: Relational SQLite (`node:sqlite` in WAL mode with foreign keys, indexes, and SQL migrations in `/database/migrations/001_initial_schema.sql`)
- **Automation & Quality**: Python 3.10 (`automation.py`, `unittest`/`pytest`, `flake8`, `black`, `bandit`), POSIX/Bash automation scripts (`set -euo pipefail`)
- **Infrastructure**: Docker, Nginx 1.27, AWS EC2 (Ubuntu 22.04 LTS), Terraform, Prometheus, GitHub Actions CI/CD

---

## 4. Local Setup & Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the full-stack development server (port `3000`):
   ```bash
   npm run dev
   ```
4. Build the production frontend bundle:
   ```bash
   npm run build
   ```

### Seeded Verification Accounts

| Role Tier | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| `CUSTOMER` | `elena.rostova@kronos-client.com` | `CustomerPass!2026` | Storefront, Cart, Wishlist, Checkout, Orders, Reviews |
| `ADMIN` | `marcus.vance@kronos-atelier.com` | `AdminPass!2026` | Full Storefront + Enterprise Admin Console |
| `SUPER_ADMIN` | `director@kronos-atelier.com` | `SuperAdmin!2026` | Full Storefront + Enterprise Admin Console & RBAC |

---

## 5. Running Tests & Security Checks

```bash
# Run Backend REST API, Auth, RBAC, Cart, Checkout & Stock Tests
npm test

# Run Frontend Architecture & Data Separation Tests
npx tsx --test frontend/tests/storefront.test.ts

# Run Python Automation Unit Tests
python3 -m unittest discover -s backend/tests

# Run TypeScript Type Check
npm run lint

# Run Production Security Audit & Health Check
bash ./scripts/security-check.sh
bash ./scripts/health-check.sh
```

---

## 6. Backup, Restore & Rollback Operations

```bash
# Create timestamped & verified database backup
bash ./scripts/backup.sh

# Restore from latest verified backup and run PRAGMA integrity_check
bash ./scripts/restore.sh

# Execute emergency production rollback with health check & notification
bash ./scripts/rollback.sh
```

---

## 7. Documentation Index

- [Architecture Specification](docs/architecture.md)
- [AWS EC2, Docker & Nginx Deployment Guide](docs/deployment.md)
- [Security Controls & TLS Governance](docs/security.md)
- [REST API v1 Reference](docs/api.md)
- [Troubleshooting Runbook](docs/troubleshooting.md)
- [Disaster Recovery & Backup Strategy](docs/disaster-recovery.md)
