# Production Deployment Guide (Docker, Linux, Nginx, AWS EC2)

## 1. AWS EC2 Ubuntu 22.04 LTS Provisioning

1. Provision infrastructure using Terraform (`/infrastructure/terraform/main.tf`) or launch an Ubuntu 22.04 LTS EC2 instance with Security Group rules allowing TCP `443` (HTTPS), `80` (HTTP redirect), and restricted `22` (SSH).
2. Run the host provisioning script to create the non-root `ecommerce` system user and UFW firewall rules:
   ```bash
   bash ./infrastructure/aws/ec2-setup.sh
   ```
3. Copy `/infrastructure/aws/kronos-ecommerce.service` to `/etc/systemd/system/kronos-ecommerce.service` and enable:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now kronos-ecommerce.service
   ```

## 2. Nginx Reverse Proxy & SSL/TLS Configuration

1. Place externally provisioned TLS certificates on the server (never inside Git):
   - `/etc/ssl/certs/app/fullchain.pem`
   - `/etc/ssl/private/app/privkey.pem`
2. Install `/infrastructure/nginx/nginx.conf` to `/etc/nginx/nginx.conf`, validate syntax with `sudo nginx -t`, and reload Nginx.

## 3. Automated Deployment & Rollback Runbook

Execute `./scripts/deploy.sh` to perform:
1. Pre-deployment database backup (`./scripts/backup.sh`)
2. Workspace security audit (`./scripts/security-check.sh`)
3. Production asset build (`npm run build`)
4. System health check (`./scripts/health-check.sh`)
5. Automated rollback (`./scripts/rollback.sh`) if any health check fails.
