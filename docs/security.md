# Security Controls & Compliance Architecture

## 1. Authentication & Password Security

- **Password Hashing**: Uses Node's native `crypto.scryptSync` KDF with a unique 16-byte cryptographic random salt per user (`scrypt$<salt>$<64-byte-derived-hex>`).
- **Constant-Time Verification**: Uses `crypto.timingSafeEqual` for both password hash comparisons and JWT HMAC-SHA256 signature verification to eliminate timing side-channel attacks.
- **Session Revocation**: Refresh tokens are hashed with SHA-256 and stored in `user_sessions` with explicit expiration and revocation flags.

## 2. Role-Based Access Control (RBAC)

- Every `/api/v1/admin/*` and catalog mutation route requires both `authenticate` and `authorize(['ADMIN', 'SUPER_ADMIN'])` middleware on the backend.
- Unauthorized attempts return HTTP `401` or `403` and emit a `SECURITY` severity record to the `audit_logs` table.

## 3. Input Validation, SQLi & XSS Protection

- **SQL Injection Prevention**: 100% of database queries use parameterized prepared statements (`db.prepare(...)`).
- **XSS Prevention**: Server-side input sanitization (`sanitizeString`) strips `<`, `>`, and inline event/script protocols before storage.
- **Rate Limiting & Headers**: Sliding-window IP rate limiting (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) and strict HTTP headers (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`).

## 4. Secret & Certificate Hygiene

- `.gitignore` and `.dockerignore` explicitly block `.env`, `*.pem`, `*.key`, `private.key`, `server.key`, `certificate.pem`, and `fullchain.pem`.
- `scripts/security-check.sh` verifies workspace hygiene in CI prior to every build.
