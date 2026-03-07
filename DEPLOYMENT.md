# Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Social Media Scheduler SaaS platform to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Application Deployment](#application-deployment)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Recovery](#backup--recovery)
9. [Scaling](#scaling)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- Docker 24.0+ and Docker Compose 2.0+
- Git
- Domain name with DNS access
- SSL certificate (Let's Encrypt recommended)

### Minimum Server Requirements
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **OS**: Ubuntu 22.04 LTS (recommended)

### Recommended Server Requirements
- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 100GB SSD
- **OS**: Ubuntu 22.04 LTS

---

## Server Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 3. Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 4. Create Application Directory

```bash
mkdir -p /opt/social-media-scheduler
cd /opt/social-media-scheduler
```

---

## Environment Configuration

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/social-media-scheduler.git .
```

### 2. Create Production Environment Files

```bash
# Copy root environment template
cp .env.production.example .env.production

# Copy backend environment template
cp apps/backend/.env.production.example apps/backend/.env.production
```

### 3. Generate Secure Secrets

```bash
# Generate JWT secrets (64 characters)
openssl rand -base64 64

# Generate encryption key (64 hex characters = 32 bytes)
openssl rand -hex 32

# Generate session secret
openssl rand -base64 48

# Generate strong passwords
openssl rand -base64 32
```

### 4. Configure Root Environment (.env.production)

```bash
nano .env.production
```

Fill in the following:

```env
# MongoDB Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=<generated-strong-password>
MONGO_DATABASE=social_media_scheduler_prod

# Redis Configuration
REDIS_PASSWORD=<generated-strong-password>

# Worker Configuration
WORKER_CONCURRENCY=5
```

### 5. Configure Backend Environment (apps/backend/.env.production)

```bash
nano apps/backend/.env.production
```

**Critical Settings:**

```env
NODE_ENV=production
PORT=5000
API_URL=https://api.yourdomain.com

# Database (will be overridden by docker-compose)
MONGODB_URI=mongodb://admin:password@mongodb:27017/social_media_scheduler_prod?authSource=admin

# Redis (will be overridden by docker-compose)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<same-as-root-env>

# JWT Secrets (CRITICAL - use generated values)
JWT_SECRET=<generated-jwt-secret>
JWT_REFRESH_SECRET=<generated-refresh-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Encryption Key (CRITICAL - use generated value)
ENCRYPTION_KEY=<generated-encryption-key>

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Stripe (Production Keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Provider (Production)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

# AWS S3 (Production)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-production-bucket

# Security
FORCE_HTTPS=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict

# Logging
LOG_LEVEL=info
```

---

## Database Setup

### 1. Create Backup Directory

```bash
mkdir -p backups/mongodb backups/redis
chmod +x scripts/*.sh
```

### 2. Start Database Services

```bash
docker compose -f docker-compose.production.yml up -d mongodb redis
```

### 3. Verify Database Connections

```bash
# Check MongoDB
docker exec sms-mongodb-prod mongosh \
  -u admin \
  -p <MONGO_ROOT_PASSWORD> \
  --authenticationDatabase admin \
  --eval "db.adminCommand('ping')"

# Check Redis
docker exec sms-redis-prod redis-cli -a <REDIS_PASSWORD> PING
```

### 4. Create Database Indexes

The application will automatically create indexes on startup. Verify with:

```bash
docker exec sms-mongodb-prod mongosh \
  -u admin \
  -p <MONGO_ROOT_PASSWORD> \
  --authenticationDatabase admin \
  social_media_scheduler_prod \
  --eval "db.getCollectionNames().forEach(c => { print(c); db[c].getIndexes().forEach(i => print('  ', JSON.stringify(i.key))) })"
```

---

## SSL/TLS Configuration

### Option 1: Let's Encrypt with Certbot (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Option 2: Custom SSL Certificate

Place your certificate files in:
- `/opt/social-media-scheduler/ssl/fullchain.pem`
- `/opt/social-media-scheduler/ssl/privkey.pem`

### Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/social-media-scheduler`:

```nginx
# API Server
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Frontend
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/social-media-scheduler /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Application Deployment

### 1. Build Production Images

```bash
# Build backend
docker build -f apps/backend/Dockerfile.production -t sms-backend:latest apps/backend

# Build frontend
docker build -f apps/frontend/Dockerfile.production -t sms-frontend:latest apps/frontend
```

### 2. Start All Services

```bash
docker compose -f docker-compose.production.yml up -d
```

### 3. Verify Services

```bash
# Check all containers
docker compose -f docker-compose.production.yml ps

# Check logs
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f worker
docker compose -f docker-compose.production.yml logs -f frontend

# Check health
curl http://localhost:5000/health
curl http://localhost:5000/health/ready
```

### 4. Verify Application

```bash
# Test API
curl https://api.yourdomain.com/health

# Test Frontend
curl https://yourdomain.com
```

---

## Monitoring & Logging

### 1. View Logs

```bash
# Backend logs
docker compose -f docker-compose.production.yml logs -f backend

# Worker logs
docker compose -f docker-compose.production.yml logs -f worker

# All logs
docker compose -f docker-compose.production.yml logs -f
```

### 2. Log Files

Logs are stored in:
- Backend: `./backend_logs/`
- Worker: `./worker_logs/`

### 3. Monitor Resources

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Specific container
docker stats sms-backend-prod
```

### 4. Health Checks

```bash
# API health
curl https://api.yourdomain.com/health

# Detailed health
curl https://api.yourdomain.com/health/ready

# Queue stats
curl -H "Authorization: Bearer <token>" https://api.yourdomain.com/api/v1/queue/stats
```

---

## Backup & Recovery

### 1. Automated Backups

Set up cron jobs for automated backups:

```bash
# Edit crontab
crontab -e

# Add backup jobs (daily at 2 AM)
0 2 * * * /opt/social-media-scheduler/scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
0 2 * * * /opt/social-media-scheduler/scripts/backup-redis.sh >> /var/log/redis-backup.log 2>&1
```

### 2. Manual Backup

```bash
# Backup MongoDB
./scripts/backup-mongodb.sh

# Backup Redis
./scripts/backup-redis.sh
```

### 3. Restore from Backup

```bash
# List available backups
ls -lh backups/mongodb/
ls -lh backups/redis/

# Restore MongoDB
./scripts/restore-mongodb.sh mongodb_backup_20240209_120000.tar.gz

# Restore Redis
./scripts/restore-redis.sh redis_backup_20240209_120000.rdb
```

### 4. Offsite Backup

Sync backups to S3 or another cloud storage:

```bash
# Install AWS CLI
sudo apt install awscli -y

# Configure AWS credentials
aws configure

# Sync backups to S3
aws s3 sync ./backups/ s3://your-backup-bucket/social-media-scheduler/ --delete
```

---

## Scaling

### Horizontal Scaling

#### Scale Workers

```bash
# Scale to 3 worker instances
docker compose -f docker-compose.production.yml up -d --scale worker=3

# Verify
docker compose -f docker-compose.production.yml ps worker
```

#### Scale Backend API

```bash
# Scale to 2 backend instances
docker compose -f docker-compose.production.yml up -d --scale backend=2

# Update nginx upstream configuration
```

### Vertical Scaling

Update resource limits in `docker-compose.production.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

### Database Scaling

#### MongoDB Replica Set

For high availability, set up a MongoDB replica set:

1. Use MongoDB Atlas (managed service)
2. Or configure a self-hosted replica set

#### Redis Cluster

For high availability, set up Redis Sentinel or Cluster:

1. Use Redis Cloud (managed service)
2. Or configure Redis Sentinel

---

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.production.yml logs <service-name>

# Check container status
docker inspect <container-name>

# Restart service
docker compose -f docker-compose.production.yml restart <service-name>
```

#### 2. Database Connection Issues

```bash
# Check MongoDB connectivity
docker exec sms-mongodb-prod mongosh -u admin -p <password> --eval "db.adminCommand('ping')"

# Check Redis connectivity
docker exec sms-redis-prod redis-cli -a <password> PING

# Check network
docker network inspect sms-network
```

#### 3. High Memory Usage

```bash
# Check memory usage
docker stats

# Restart services
docker compose -f docker-compose.production.yml restart

# Clear Redis cache
docker exec sms-redis-prod redis-cli -a <password> FLUSHDB
```

#### 4. Queue Not Processing

```bash
# Check worker logs
docker compose -f docker-compose.production.yml logs -f worker

# Check queue stats
curl -H "Authorization: Bearer <token>" https://api.yourdomain.com/api/v1/queue/stats

# Restart worker
docker compose -f docker-compose.production.yml restart worker
```

#### 5. SSL Certificate Issues

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Test certificate
sudo certbot certificates

# Reload nginx
sudo systemctl reload nginx
```

### Emergency Procedures

#### Complete System Restart

```bash
# Stop all services
docker compose -f docker-compose.production.yml down

# Start all services
docker compose -f docker-compose.production.yml up -d

# Verify
docker compose -f docker-compose.production.yml ps
```

#### Rollback Deployment

```bash
# Stop current deployment
docker compose -f docker-compose.production.yml down

# Restore from backup
./scripts/restore-mongodb.sh <backup-file>
./scripts/restore-redis.sh <backup-file>

# Deploy previous version
git checkout <previous-tag>
docker compose -f docker-compose.production.yml up -d --build
```

---

## Maintenance

### Regular Tasks

#### Daily
- Monitor logs for errors
- Check disk space
- Verify backups completed

#### Weekly
- Review application metrics
- Check for security updates
- Test backup restoration

#### Monthly
- Update dependencies
- Review and optimize database indexes
- Clean up old logs and backups
- Security audit

### Update Procedure

```bash
# 1. Backup current state
./scripts/backup-mongodb.sh
./scripts/backup-redis.sh

# 2. Pull latest code
git pull origin main

# 3. Rebuild images
docker compose -f docker-compose.production.yml build

# 4. Stop services
docker compose -f docker-compose.production.yml down

# 5. Start services
docker compose -f docker-compose.production.yml up -d

# 6. Verify
docker compose -f docker-compose.production.yml ps
curl https://api.yourdomain.com/health
```

---

## Security Checklist

- [ ] Strong passwords for all services
- [ ] JWT secrets are random and secure (64+ characters)
- [ ] Encryption key is random and secure (64 hex characters)
- [ ] SSL/TLS certificates are valid and auto-renewing
- [ ] Firewall is configured and enabled
- [ ] Database authentication is enabled
- [ ] Redis password is set
- [ ] Environment files have restricted permissions (600)
- [ ] Regular security updates are applied
- [ ] Backups are encrypted and stored offsite
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] Security headers are set
- [ ] Logs don't contain sensitive data
- [ ] Non-root users in containers
- [ ] Docker socket is not exposed

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/social-media-scheduler/issues
- Documentation: https://docs.yourdomain.com
- Email: support@yourdomain.com

---

## License

Copyright © 2024. All rights reserved.
