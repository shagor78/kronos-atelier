#!/usr/bin/env bash
# ============================================================================
# KRONOS ATELIER — AWS EC2 UBUNTU 22.04 LTS PRODUCTION PROVISIONING SCRIPT
# Configures dedicated non-root user, UFW firewall, Nginx, systemd service.
# ============================================================================

set -euo pipefail

APP_USER="ecommerce"
APP_DIR="/opt/kronos-ecommerce"

echo "[AWS-EC2] Provisioning Ubuntu Linux host for Kronos Atelier..."

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  sudo useradd --system --create-home --shell /bin/bash "${APP_USER}"
fi

sudo mkdir -p "${APP_DIR}" /etc/ssl/certs/app /etc/ssl/private/app
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
sudo chmod 750 "${APP_DIR}"

# Configure UFW Firewall (Allow SSH, HTTP 80, HTTPS 443 only)
if command -v ufw >/dev/null 2>&1; then
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
fi

echo "[AWS-EC2] Host provisioning complete. Ready for systemd service activation."
