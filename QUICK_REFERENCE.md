# Quick Reference Guide

## Essential Commands

### Deployment

```bash
# Deploy to production
./scripts/deploy-production.sh

# Manual deployment
docker compose -f docker-compose.production.yml up -d

# Rebuild and deploy
docker compose -f docker-compose.production.yml up -d --build

# Stop all services
docker compose -f docker-compose.production.yml down

# Restart specific service
docker compose -f docker-compose.production.yml restart backend
```

### Monitoring

```bash
# View all logs
docker compose -f docker-compose.production.yml logs -f

# View specific service logs
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f worker

# Check service status
docker compose -f docker-compose.production.yml ps

# Check resource usage
docker stats

# Check health
curl http://localhost:5000/health
curl http://localhost:5000/health/ready
```

### Backup & Restore

```bash
# Backup MongoDB
./scripts/backup-mongodb.sh

# Backup Redis
./scripts/backup-redis.sh

# List backups
ls -lh backups/mongodb/
ls -lh backups/redis/

# Restore MongoDB
./scripts/restore-mongodb.sh mongodb_backup_YYYYMMDD_HHMMSS.tar.gz

# Restore Redis
./scripts/restore-redis.sh redis_backup_YYYYMMDD_HHMMSS.rdb
```

### Scaling

```bash
# Scale workers to 3 instances
docker compose -f docker-compose.production.yml up -d --scale worker=3

# Scale backend to 2 instances
docker compose -f docker-compose.production.yml up -d --scale backend=2
```

### Database

```bash
# MongoDB shell
docker exec -it sms-mongodb-prod mongosh -u admin -p <password> --authenticationDatabase admin

# Redis CLI
docker exec -it sms-redis-prod redis-cli -a <password>

# Check MongoDB status
docker exec sms-mongodb-prod mongosh -u admin -p <password> --authenticationDatabase admin --eval "db.adminCommand('ping')"

# Check Redis status
docker exec sms-redis-prod redis-cli -a <password> PING
```

### Troubleshooting

```bash
# View container details
docker inspect sms-backend-prod

# Enter container shell
docker exec -it sms-backend-prod sh

# Check disk space
df -h

# Check memory usage
free -h

# Check network
docker network inspect sms-network

# Restart all services
docker compose -f docker-compose.production.yml restart

# Force recreate containers
docker compose -f docker-compose.production.yml up -d --force-recreate
```

---

## Environment Files

### Root Environment (.env.production)
```env
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=<strong-password>
MONGO_DATABASE=social_media_scheduler_prod
REDIS_PASSWORD=<strong-password>
WORKER_CONCURRENCY=5
```

### Backend Environment (apps/backend/.env.production)
```env
NODE_ENV=production
PORT=5000
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
JWT_SECRET=<64-char-secret>
JWT_REFRESH_SECRET=<64-char-secret>
ENCRYPTION_KEY=<64-hex-chars>
STRIPE_SECRET_KEY=sk_live_...
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
LOG_LEVEL=info
```

---

## Service Ports

| Service | Internal Port | External Port |
|---------|--------------|---------------|
| Frontend | 80 | 80 |
| Backend API | 5000 | 5000 |
| MongoDB | 27017 | 27017 |
| Redis | 6379 | 6379 |

---

## Health Check URLs

| Service | URL | Expected Response |
|---------|-----|-------------------|
| Backend | http://localhost:5000/health | `{"status":"ok"}` |
| Backend Ready | http://localhost:5000/health/ready | `{"status":"ready"}` |
| Frontend | http://localhost:80/health | `healthy` |

---

## Log Locations

| Service | Location |
|---------|----------|
| Backend | `./backend_logs/` |
| Worker | `./worker_logs/` |
| MongoDB | Docker logs |
| Redis | Docker logs |

---

## Backup Locations

| Type | Location |
|------|----------|
| MongoDB | `./backups/mongodb/` |
| Redis | `./backups/redis/` |

---

## Common Issues

### Container Won't Start
```bash
# Check logs
docker compose -f docker-compose.production.yml logs <service>

# Check if port is in use
netstat -tulpn | grep <port>

# Remove and recreate
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### Database Connection Failed
```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs sms-mongodb-prod

# Restart MongoDB
docker compose -f docker-compose.production.yml restart mongodb
```

### High Memory Usage
```bash
# Check memory usage
docker stats

# Restart services
docker compose -f docker-compose.production.yml restart

# Clear Redis cache
docker exec sms-redis-prod redis-cli -a <password> FLUSHDB
```

### Queue Not Processing
```bash
# Check worker logs
docker compose -f docker-compose.production.yml logs -f worker

# Restart worker
docker compose -f docker-compose.production.yml restart worker

# Check Redis connection
docker exec sms-redis-prod redis-cli -a <password> PING
```

---

## Emergency Procedures

### Complete System Restart
```bash
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### Rollback to Previous Version
```bash
# Stop current
docker compose -f docker-compose.production.yml down

# Restore backups
./scripts/restore-mongodb.sh <backup-file>
./scripts/restore-redis.sh <backup-file>

# Deploy previous version
git checkout <previous-tag>
docker compose -f docker-compose.production.yml up -d --build
```

### Emergency Backup
```bash
./scripts/backup-mongodb.sh
./scripts/backup-redis.sh
```

---

## Maintenance Tasks

### Daily
- [ ] Check logs for errors
- [ ] Verify backups completed
- [ ] Monitor disk space

### Weekly
- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Test backup restoration

### Monthly
- [ ] Update dependencies
- [ ] Optimize database
- [ ] Clean old logs/backups
- [ ] Security audit

---

## Support Contacts

- **Documentation**: See DEPLOYMENT.md
- **Checklist**: See PRODUCTION_CHECKLIST.md
- **Readiness Report**: See PRODUCTION_READY.md
- **GitHub Issues**: [repository-url]/issues

---

## Quick Tips

1. **Always backup before updates**
2. **Test in staging first**
3. **Monitor logs after deployment**
4. **Keep environment files secure (chmod 600)**
5. **Use strong passwords (32+ characters)**
6. **Enable automated backups (cron)**
7. **Set up monitoring alerts**
8. **Document all changes**
9. **Test restore procedures regularly**
10. **Keep documentation updated**

---

**Last Updated**: February 9, 2026  
**Version**: 1.0.0
