#!/usr/bin/env bash
# ============================================================================
# KRONOS ATELIER — SECURITY VALIDATION & SECRET SCANNER SCRIPT
# Checks for accidentally committed secrets, keys, certificates, or vulnerabilities.
# ============================================================================

set -euo pipefail

echo "===================================="
echo " Production Security Audit"
echo "===================================="

FAILURES=0

# 1. Verify .gitignore protects sensitive files
for pattern in ".env" "*.pem" "*.key" "private.key" "fullchain.pem"; do
  if ! grep -Fq "${pattern}" .gitignore; then
    echo "[SECURITY] FAIL: .gitignore is missing pattern ${pattern}" >&2
    FAILURES=$((FAILURES + 1))
  fi
done
echo "[SECURITY] .gitignore rules       : PASS"

# 2. Verify no real certificate or private key files exist in workspace
FOUND_KEYS=$(find . -maxdepth 4 \( -name "private.key" -o -name "server.key" -o -name "certificate.pem" -o -name "fullchain.pem" \) -not -path "./node_modules/*" || true)
if [ -n "${FOUND_KEYS}" ]; then
  echo "[SECURITY] FAIL: Found prohibited key/certificate files: ${FOUND_KEYS}" >&2
  FAILURES=$((FAILURES + 1))
else
  echo "[SECURITY] No SSL keys committed  : PASS"
fi

# 3. Verify frontend contains zero database or JWT signing secrets
if grep -RInE "node:sqlite|JWT_SECRET|scryptSync" src/ 2>/dev/null; then
  echo "[SECURITY] FAIL: Backend secrets or DB driver detected in frontend src/" >&2
  FAILURES=$((FAILURES + 1))
else
  echo "[SECURITY] Frontend/Backend split : PASS"
fi

# 4. Verify .env.example contains only safe placeholders
if grep -E "sk_live_|AKIA[0-9A-Z]{16}" .env.example 2>/dev/null; then
  echo "[SECURITY] FAIL: Live secret detected in .env.example" >&2
  FAILURES=$((FAILURES + 1))
else
  echo "[SECURITY] .env.example hygiene   : PASS"
fi

if [ "${FAILURES}" -ne 0 ]; then
  echo "===================================="
  echo "Security Audit Status: FAILED (${FAILURES} issues)"
  echo "===================================="
  exit 1
fi

echo "===================================="
echo "Security Audit Status: PASSED"
echo "===================================="
exit 0
