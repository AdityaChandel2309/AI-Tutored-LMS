# LMS Deployment Guide

> Single-VM deployment with Docker Compose + Nginx reverse proxy.

## Prerequisites

| Requirement | Minimum |
|---|---|
| OS | Ubuntu 22.04+ (or any Linux with Docker support) |
| Docker Engine | 24.0+ |
| Docker Compose | V2 (bundled with Docker Desktop / `docker compose`) |
| RAM | 4 GB (8 GB recommended) |
| Disk | 20 GB free |
| Git | 2.x |

---

## Quick Start

### 1. Clone & Configure

```bash
git clone <your-repo-url> /opt/lms
cd /opt/lms

# Copy and fill in production environment variables
cp .env.production.example .env
nano .env   # ← set DOMAIN, passwords, keys
```

> [!IMPORTANT]
> Change **every** `CHANGE_ME` value. Use strong, unique passwords for `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `MINIO_ROOT_PASSWORD`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY`.

### 2. Configure API Environment

```bash
cp api/.env.example api/.env
nano api/.env
# Ensure DATABASE_URL, MINIO_*, KEYCLOAK_* match your .env values
```

### 3. Remove Dev Override

The `docker-compose.override.yml` re-exposes API/Web ports for local dev. On production, remove or rename it:

```bash
mv docker-compose.override.yml docker-compose.override.yml.dev
```

### 4. Build & Launch

```bash
docker compose build
docker compose up -d
```

### 5. Verify

```bash
# Wait ~60s for all services to start, then:
bash scripts/smoke-test.sh http://localhost
```

---

## SSL/TLS with Let's Encrypt

### 1. Install Certbot

```bash
sudo apt install certbot
```

### 2. Obtain Certificate

```bash
# Stop nginx temporarily
docker compose stop nginx

sudo certbot certonly --standalone \
  -d lms.example.com \
  --agree-tos \
  --email admin@example.com

# Copy certs to project
mkdir -p docker/nginx/certs
sudo cp /etc/letsencrypt/live/lms.example.com/fullchain.pem docker/nginx/certs/
sudo cp /etc/letsencrypt/live/lms.example.com/privkey.pem docker/nginx/certs/
sudo chown $USER:$USER docker/nginx/certs/*.pem
```

### 3. Enable HTTPS in Nginx

Edit `docker/nginx/nginx.conf`:
- Uncomment the HTTPS `server` block
- Set `server_name` to your domain
- Copy the location blocks from the HTTP server

Edit `docker-compose.yml`:
- Uncomment the `443` port mapping under `nginx`
- Uncomment the certs volume mount

### 4. Add HTTP → HTTPS Redirect

In the HTTP `server` block, replace location blocks with:

```nginx
server {
    listen 80;
    server_name lms.example.com;
    return 301 https://$host$request_uri;
}
```

### 5. Auto-Renewal

```bash
# Add cron job for auto-renewal
echo "0 3 * * * certbot renew --pre-hook 'docker compose -f /opt/lms/docker-compose.yml stop nginx' --post-hook 'cp /etc/letsencrypt/live/lms.example.com/*.pem /opt/lms/docker/nginx/certs/ && docker compose -f /opt/lms/docker-compose.yml start nginx'" | sudo crontab -
```

---

## Database Backup

### Manual Backup

```bash
docker exec lms-postgres pg_dump -U postgres lms | gzip > backup_lms_$(date +%Y%m%d_%H%M%S).sql.gz
docker exec lms-postgres pg_dump -U postgres keycloak | gzip > backup_keycloak_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore

```bash
gunzip -c backup_lms_20240101_120000.sql.gz | docker exec -i lms-postgres psql -U postgres lms
```

### Automated Daily Backup

```bash
# Create backup script
cat > /opt/lms/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/lms/backups/db"
mkdir -p "$BACKUP_DIR"
docker exec lms-postgres pg_dump -U postgres lms | gzip > "$BACKUP_DIR/lms_$(date +%Y%m%d).sql.gz"
docker exec lms-postgres pg_dump -U postgres keycloak | gzip > "$BACKUP_DIR/keycloak_$(date +%Y%m%d).sql.gz"
# Keep last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
EOF
chmod +x /opt/lms/scripts/backup-db.sh

# Cron: daily at 2 AM
echo "0 2 * * * /opt/lms/scripts/backup-db.sh" | crontab -
```

---

## MinIO Backup

MinIO data is stored in a Docker volume (`minio_data`). Back it up with:

```bash
# Find volume path
docker volume inspect lms_minio_data --format '{{ .Mountpoint }}'

# Tar the data
sudo tar czf minio_backup_$(date +%Y%m%d).tar.gz -C $(docker volume inspect lms_minio_data --format '{{ .Mountpoint }}') .
```

---

## Monitoring & Logs

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 api
```

### Health Checks

```bash
# API liveness
curl http://localhost/api/health

# API readiness (DB + MinIO)
curl http://localhost/api/health/ready

# All services status
docker compose ps
```

### Resource Usage

```bash
docker stats --no-stream
```

---

## Updating / Redeploying

```bash
cd /opt/lms

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose build
docker compose up -d

# Run migrations (if any)
docker exec lms-api npx prisma migrate deploy

# Verify
bash scripts/smoke-test.sh
```

> [!TIP]
> For zero-downtime deploys, rebuild images first, then use `docker compose up -d --no-deps api web nginx` to restart only the application services.

---

## Troubleshooting

### Services won't start

```bash
# Check which services are unhealthy
docker compose ps

# Check logs for the failing service
docker compose logs <service-name>
```

### Database connection refused

- Verify `DATABASE_URL` in `api/.env` uses `postgres` as the host (not `localhost`)
- Check that postgres container is healthy: `docker compose ps postgres`
- Check postgres logs: `docker compose logs postgres`

### Keycloak login fails

- Ensure `KEYCLOAK_BASE_URL` points to the external URL users access
- If behind nginx, `KEYCLOAK_INTERNAL_URL` should be `http://keycloak:8080`
- Check the provisioner ran successfully: `docker compose logs keycloak-provisioner`

### File uploads fail (413 error)

- The nginx config allows up to 1100MB (`client_max_body_size`). If you need more, edit `docker/nginx/nginx.conf`
- Restart nginx: `docker compose restart nginx`

### Out of disk space

```bash
# Clean unused Docker resources
docker system prune -a --volumes

# Check disk usage
df -h
docker system df
```

### Cannot access MinIO console

- MinIO console is on port 9001 (exposed by default)
- Access at `http://<your-ip>:9001`
- Login with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
