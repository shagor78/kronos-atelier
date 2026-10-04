# System Architecture — Kronos Atelier E-Commerce Platform

## 1. Layered Separation of Concerns

The platform enforces strict boundaries between presentation, API routing, business/security logic, relational persistence, and infrastructure:

1. **Frontend Layer (`/src`, `/frontend/tests`)**:
   - Contains React UI components, client state, and `/src/services/apiClient.ts`.
   - Zero direct database access; zero private secrets or cryptographic keys.
2. **API Layer (`/api/routes/v1.ts`, `/api/openapi/spec.ts`)**:
   - Versioned REST API mounted at `/api/v1`.
   - Exposes `/health`, `/openapi.json`, `/auth`, `/users`, `/categories`, `/products`, `/cart`, `/wishlist`, `/orders`, `/payments`, `/reviews`, and `/admin`.
3. **Backend Domain & Security Layer (`/backend/src`)**:
   - `config/env.ts`: Environment variable parsing and validation.
   - `security/crypto.ts`: `scrypt` password hashing with 16-byte random salt, constant-time `timingSafeEqual` verification, HMAC-SHA256 JWT token signing/verification, and XSS string sanitization.
   - `middleware/auth.ts`: Stateless JWT bearer verification and RBAC role enforcement (`CUSTOMER`, `ADMIN`, `SUPER_ADMIN`).
   - `middleware/security.ts`: HSTS, CSP/X-Content-Type-Options headers, and sliding-window IP rate limiting.
   - `utils/logger.ts`: Structured JSON audit logger that automatically redacts sensitive keys (`password`, `secret`, `token`, `privateKey`) before persisting to `/logs/application.log` and the `audit_logs` table.
4. **Relational Database Layer (`/database`)**:
   - `migrations/001_initial_schema.sql`: Normalized schema with foreign key constraints, check constraints, and performance indexes across 11 tables (`users`, `user_sessions`, `categories`, `products`, `cart_items`, `wishlist_items`, `orders`, `order_items`, `reviews`, `audit_logs`, `notifications`).
5. **Infrastructure & Automation Layer (`/infrastructure`, `/scripts`, `/.github/workflows`)**:
   - Nginx TLS termination, Docker multi-stage non-root build, AWS EC2 systemd service, Terraform IaC, and Bash operational runbooks.
